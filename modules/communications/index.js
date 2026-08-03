import { Module } from '../../core/interfaces/module.js';

const CONTACTS_KEY = 'module:communications:contacts:v1';

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value != null) return value;
      }
    } catch {}
  }
  return null;
}

export function coordinateBbcode(x, y) {
  return `[coords]${Math.round(Number(x) || 0)}:${Math.round(Number(y) || 0)}[/coords]`;
}

export function allianceRecipients(members, group = 'all') {
  const unique = new Map();
  for (const member of members ?? []) {
    const name = String(member?.Name ?? member?.n ?? member?.name ?? '').trim();
    if (!name) continue;
    const role = String(member?.RoleName ?? member?.rn ?? member?.role ?? member?.Role ?? '').trim();
    if (!unique.has(name.toLocaleLowerCase())) unique.set(name.toLocaleLowerCase(), { name, role });
  }
  const matches = ({ role }) => {
    if (group === 'all') return true;
    if (group === 'cic') return /^(?:leader|commander(?: in chief)?|cic)$/i.test(role) && !/second/i.test(role);
    if (group === 'sic') return /second commander|second in command|sic/i.test(role);
    if (group === 'officers') return /officer/i.test(role);
    return false;
  };
  return [...unique.values()].filter(matches).map(({ name }) => name).sort((a, b) => a.localeCompare(b));
}

export class CommunicationsModule extends Module {
  constructor() {
    super({
      id: 'communications', name: 'Communications', version: '0.2.0', apiVersion: '1.0.0',
      author: 'ProfessorSr',
      description: 'BBCode composition, whisper contacts, and user-confirmed in-game mail with alliance role recipients.',
      permissions: ['game', 'storage', 'settings', 'windows'],
      settings: { minimizeChatOnStart: { type: 'boolean', default: false } }
    });
    this.contacts = [];
    this.mailRecipients = [];
  }

  async enable(context) {
    this.context = context;
    this.contacts = await context.storage.get(CONTACTS_KEY, []);
    if (context.moduleSettings.get('minimizeChatOnStart', false)) this.minimizeChat();
  }

  clientRoot() {
    return this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
  }

  selection() {
    const root = this.clientRoot();
    const main = root?.Data?.MainData?.GetInstance?.();
    const cities = call(main, ['get_Cities']);
    const city = call(cities, ['get_CurrentCity', 'get_CurrentOwnCity']);
    const player = call(main, ['get_Player']);
    return {
      x: Number(call(city, ['get_PosX', 'get_RawX']) ?? 0),
      y: Number(call(city, ['get_PosY', 'get_RawY']) ?? 0),
      city: String(call(city, ['get_Name']) ?? 'Selected base'),
      player: String(call(city, ['get_PlayerName']) ?? call(player, ['get_Name']) ?? ''),
      alliance: String(call(city, ['get_AllianceName']) ?? '')
    };
  }

  playerDetails() {
    const value = this.selection();
    return `[player]${value.player}[/player] — ${value.city} ${coordinateBbcode(value.x, value.y)}`
      + (value.alliance ? ` — [alliance]${value.alliance}[/alliance]` : '');
  }

  waveSummary() {
    const root = this.clientRoot();
    const selected = this.selection();
    const main = root?.Data?.MainData?.GetInstance?.();
    const world = call(main, ['get_World']);
    const range = Number(call(call(main, ['get_Server']), ['get_MaxAttackDistance']) ?? 0);
    const baseType = Number(root?.Data?.WorldSector?.ObjectType?.NPCBase ?? 2);
    const levels = new Map();
    for (let y = selected.y - Math.ceil(range); y <= selected.y + Math.ceil(range); y += 1) {
      for (let x = selected.x - Math.ceil(range); x <= selected.x + Math.ceil(range); x += 1) {
        if (Math.hypot(x - selected.x, y - selected.y) > range) continue;
        const object = world?.GetObjectFromPosition?.(x, y);
        const type = Number(call(object, ['get_Type', 'getType']) ?? object?.Type ?? 0);
        if (type !== baseType && type !== 2) continue;
        const level = Number(call(object, ['get_BaseLevel', 'get_Level']) ?? 0);
        levels.set(level, (levels.get(level) ?? 0) + 1);
      }
    }
    const total = [...levels.values()].reduce((sum, count) => sum + count, 0);
    const distribution = [...levels].sort((a, b) => a[0] - b[0])
      .map(([level, count]) => `${count}× L${level}`).join(', ');
    return `${coordinateBbcode(selected.x, selected.y)} — ${total} Forgotten base(s), `
      + `${Math.ceil(total / 4)} wave(s)${distribution ? ` — ${distribution}` : ''}`;
  }

  minimizeChat() {
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    for (const name of ['getChat', 'getChatWidget', 'getChatWindow']) {
      const chat = call(app, [name]);
      if (!chat) continue;
      call(chat, ['minimize', 'close', 'setCollapsed'], true);
      return true;
    }
    return false;
  }

  allianceMembers(group = 'all') {
    const root = this.clientRoot();
    const alliance = root?.Data?.MainData?.GetInstance?.()?.get_Alliance?.();
    call(alliance, ['RefreshMemberData']);
    const memberArray = call(alliance, ['get_MemberDataAsArray']);
    const sources = [
      ...(Array.isArray(memberArray) ? memberArray : Object.values(memberArray?.d ?? memberArray ?? {})),
      ...Object.values(call(alliance, ['get_MemberData'])?.d ?? {})
    ];
    return allianceRecipients(sources.map((member) => ({
      name: member?.Name ?? member?.n ?? call(member, ['get_Name']),
      role: member?.RoleName ?? member?.rn ?? member?.Role
    })), group);
  }

  sendMail(recipients, subject, message) {
    const names = [...new Set(recipients.map((name) => String(name).trim()).filter(Boolean))];
    if (!names.length) throw new Error('Add at least one recipient.');
    if (!String(subject).trim()) throw new Error('Enter a mail subject.');
    if (!String(message).trim()) throw new Error('Enter a message.');
    const player = this.selection().player;
    const timestamp = Math.floor(Date.now() / 1000);
    const body = `<cnc><cncs>${player}</cncs><cncd>${timestamp}</cncd><cnct>${message}</cnct></cnc>`;
    const mail = this.clientRoot()?.Data?.Mail?.prototype;
    if (typeof mail?.SendMail !== 'function') throw new Error('Native in-game mail is unavailable.');
    mail.SendMail(names.join(';'), '', String(subject).trim(), body);
    return names.length;
  }

  wrap(tag, value = null) {
    const text = this.editor.getValue() || '';
    this.editor.setValue(value == null ? `[${tag}]${text}[/${tag}]` : `[${tag}=${value}]${text}[/${tag}]`);
  }

  append(text) {
    const current = String(this.editor.getValue() ?? '');
    this.editor.setValue(`${current}${current ? '\n' : ''}${text}`);
  }

  async openDraft(context, text) {
    await this.open(context ?? this.context);
    this.append(String(text ?? ''));
    this.editor?.focus?.();
    return this.record;
  }

  async copy(text = this.editor.getValue()) {
    if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
    else globalThis.prompt?.('Copy message', text);
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 9, textColor: '#fff' });
    const tools = new qx.ui.container.Composite(new qx.ui.layout.Flow(5, 5));
    for (const [label, tag] of [['Bold', 'b'], ['Italic', 'i'], ['Strike', 's'], ['Underline', 'u'], ['Player', 'player'], ['Alliance', 'alliance'], ['Coordinates', 'coords']]) {
      const button = new qx.ui.form.Button(label);
      button.addListener('execute', () => this.wrap(tag));
      tools.add(button);
    }
    const url = new qx.ui.form.Button('URL');
    url.addListener('execute', () => this.wrap('url', 'https://'));
    tools.add(url);
    root.add(tools);

    const selectionTools = new qx.ui.container.Composite(new qx.ui.layout.Flow(5, 5));
    for (const [label, producer] of [
      ['Selected Coordinates', () => coordinateBbcode(this.selection().x, this.selection().y)],
      ['Player Details', () => this.playerDetails()],
      ['Forgotten Waves', () => this.waveSummary()]
    ]) {
      const button = new qx.ui.form.Button(label);
      button.addListener('execute', () => this.append(producer()));
      selectionTools.add(button);
    }
    root.add(selectionTools);

    this.editor = new qx.ui.form.TextArea().set({ height: 180, placeholder: 'Compose reusable BBCode…' });
    root.add(this.editor);
    const messaging = new qx.ui.tabview.TabView();
    const whisperPage = new qx.ui.tabview.Page('Whisper').set({ layout: new qx.ui.layout.VBox(5), padding: 7 });
    const mailPage = new qx.ui.tabview.Page('Mail').set({ layout: new qx.ui.layout.VBox(5), padding: 7 });
    messaging.add(whisperPage);
    messaging.add(mailPage);
    const contacts = new qx.ui.groupbox.GroupBox('Whisper Contacts').set({ layout: new qx.ui.layout.VBox(5), padding: 7 });
    const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    this.contact = new qx.ui.form.TextField().set({ placeholder: 'Player name' });
    const add = new qx.ui.form.Button('Add');
    const remove = new qx.ui.form.Button('Remove Selected');
    row.add(this.contact, { flex: 1 }); row.add(add); row.add(remove); contacts.add(row);
    this.list = new qx.ui.form.List().set({ height: 95 }); contacts.add(this.list); whisperPage.add(contacts, { flex: 1 });
    const copyWhisper = new qx.ui.form.Button('Copy Whisper Command');
    copyWhisper.addListener('execute', () => {
      const name = this.list.getSelection()[0]?.getLabel?.() || String(this.contact.getValue() ?? '').trim();
      if (!name) return;
      void this.copy(`/w ${name} ${this.editor.getValue() || ''}`);
    });
    whisperPage.add(copyWhisper);

    const recipientRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    this.recipientField = new qx.ui.form.TextField().set({ placeholder: 'Receiving player names', readOnly: true });
    const recipientGroup = new qx.ui.form.SelectBox().set({ width: 190 });
    for (const [name, id] of [
      ['Whole alliance', 'all'], ['CiC of alliance', 'cic'],
      ['SiC of alliance', 'sic'], ['All officers', 'officers']
    ]) recipientGroup.add(new qx.ui.form.ListItem(name, null, id));
    const addRecipients = new qx.ui.form.Button('Add to Recipients');
    const clearRecipients = new qx.ui.form.Button('Clear');
    recipientRow.add(recipientGroup);
    recipientRow.add(addRecipients);
    recipientRow.add(clearRecipients);
    mailPage.add(recipientRow);
    mailPage.add(this.recipientField);
    this.mailSubject = new qx.ui.form.TextField().set({ placeholder: 'Mail subject' });
    mailPage.add(this.mailSubject);
    const mailStatus = new qx.ui.basic.Label('Choose a group, then add its members to the recipient field.').set({ wrap: true });
    mailPage.add(mailStatus);
    const sendMail = new qx.ui.form.Button('Send In-Game Mail');
    mailPage.add(sendMail);
    const renderRecipients = () => this.recipientField.setValue(this.mailRecipients.join('; '));
    addRecipients.addListener('execute', () => {
      const group = recipientGroup.getSelection()[0]?.getModel?.() ?? 'all';
      const names = this.allianceMembers(group);
      this.mailRecipients = [...new Set([...this.mailRecipients, ...names])];
      renderRecipients();
      mailStatus.setValue(names.length ? `${names.length} alliance member(s) added.` : 'No matching alliance members were available.');
    });
    clearRecipients.addListener('execute', () => { this.mailRecipients = []; renderRecipients(); mailStatus.setValue('Recipients cleared.'); });
    sendMail.addListener('execute', () => {
      const count = this.mailRecipients.length;
      if (!count || !globalThis.confirm?.(`Send this in-game mail to ${count} recipient(s)?`)) return;
      try {
        const sent = this.sendMail(this.mailRecipients, this.mailSubject.getValue(), this.editor.getValue());
        mailStatus.setValue(`Mail submitted to ${sent} recipient(s).`);
      } catch (error) {
        mailStatus.setValue(`Mail failed: ${error?.message ?? error}`);
      }
    });
    root.add(messaging, { flex: 1 });
    const copy = new qx.ui.form.Button('Copy Message');
    copy.addListener('execute', () => this.copy()); root.add(copy);
    const render = () => { this.list.removeAll(); for (const name of this.contacts) this.list.add(new qx.ui.form.ListItem(name)); };
    add.addListener('execute', () => { const name = String(this.contact.getValue() ?? '').trim(); if (name && !this.contacts.includes(name)) { this.contacts.push(name); this.contacts.sort(); void this.context.storage.set(CONTACTS_KEY, this.contacts); render(); } });
    remove.addListener('execute', () => { const name = this.list.getSelection()[0]?.getLabel(); this.contacts = this.contacts.filter(item => item !== name); void this.context.storage.set(CONTACTS_KEY, this.contacts); render(); });
    render();
    return root;
  }

  async open(context = this.context) {
    if (!this.context) await this.enable(context);
    if (this.record?.window && !this.record.window.isDisposed?.()) { this.record.window.open(); return this.record; }
    this.record = await this.context.windows.open({ id: 'communications', title: 'Communications', content: this.build(), x: 160, y: 90, width: 650, height: 620, resizable: true, singleton: true });
    return this.record;
  }

  async disable(context = this.context) { context?.windows?.close?.('communications'); this.record = null; this.context = null; }
}

export default CommunicationsModule;
