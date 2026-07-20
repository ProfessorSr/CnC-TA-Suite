const STORAGE_KEY = 'module:war-room:combat-stats:v1';

function compactTarget(target) {
  if (!target) return null;
  return {
    id: target.id,
    name: target.name ?? 'Unknown',
    level: Number(target.level ?? 0),
    x: Number(target.x ?? 0),
    y: Number(target.y ?? 0),
    owner: target.owner ?? '',
    alliance: target.alliance ?? '',
    npc: Boolean(target.npc)
  };
}

export class CombatStats {
  constructor(storage = null) {
    this.storage = storage;
    this.history = [];
    this.favorites = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    const saved = await this.storage?.get?.(STORAGE_KEY, {}) ?? {};
    this.history = Array.isArray(saved.history) ? saved.history.slice(0, 100) : [];
    this.favorites = new Map((Array.isArray(saved.favorites) ? saved.favorites : [])
      .filter((target) => target?.id != null)
      .map((target) => [String(target.id), target]));
    this.loaded = true;
  }

  persist() {
    return this.storage?.set?.(STORAGE_KEY, {
      history: this.history,
      favorites: [...this.favorites.values()]
    });
  }

  record(snapshot, summary, formation = '') {
    if (!snapshot?.target?.id || !summary) return false;
    const target = compactTarget(snapshot.target);
    const previous = this.history[0];
    const signature = `${target.id}:${formation}`;
    const entry = {
      at: Date.now(),
      signature,
      target,
      attacker: compactTarget(snapshot.attacker),
      cpCost: Number(snapshot.cpCost ?? 0),
      summary: {
        cyRemaining: summary.cyRemaining,
        dfRemaining: summary.dfRemaining,
        defenderRemaining: Number(summary.defenderRemaining ?? 100),
        ownRemaining: Number(summary.ownRemaining ?? 100),
        repairSeconds: Number(summary.repairSeconds ?? 0),
        loot: Number(summary.loot ?? 0),
        research: Number(summary.research ?? 0),
        durationSeconds: Number(summary.durationSeconds ?? 0)
      }
    };
    if (previous?.signature === signature
      && Math.abs(Number(previous.at) - entry.at) < 15000) {
      this.history[0] = entry;
    } else {
      this.history.unshift(entry);
      this.history.length = Math.min(this.history.length, 100);
    }
    void this.persist();
    return true;
  }

  toggleFavorite(target) {
    if (!target?.id) return false;
    const key = String(target.id);
    if (this.favorites.has(key)) this.favorites.delete(key);
    else this.favorites.set(key, compactTarget(target));
    void this.persist();
    return this.favorites.has(key);
  }

  isFavorite(target) {
    return target?.id != null && this.favorites.has(String(target.id));
  }

  clearHistory() {
    this.history = [];
    void this.persist();
  }

  rows() {
    return this.history.map((entry) => [
      new Date(entry.at).toLocaleString(),
      entry.target?.name ?? 'Unknown',
      entry.cpCost ?? 0,
      Math.round(entry.summary?.loot ?? 0),
      `${Math.round(100 - Number(entry.summary?.defenderRemaining ?? 100))}% damage`
    ]);
  }

  exportText() {
    const header = 'Time\tTarget\tCoordinates\tCP\tLoot\tRP\tDefender damage\tOwn damage\tRepair\tDuration';
    const rows = this.history.map((entry) => {
      const summary = entry.summary ?? {};
      return [
        new Date(entry.at).toISOString(),
        entry.target?.name ?? 'Unknown',
        `${entry.target?.x ?? 0}:${entry.target?.y ?? 0}`,
        entry.cpCost ?? 0,
        Math.round(summary.loot ?? 0),
        Math.round(summary.research ?? 0),
        `${Math.round(100 - Number(summary.defenderRemaining ?? 100))}%`,
        `${Math.round(100 - Number(summary.ownRemaining ?? 100))}%`,
        Math.round(summary.repairSeconds ?? 0),
        Math.round(summary.durationSeconds ?? 0)
      ].join('\t');
    });
    return [header, ...rows].join('\n');
  }
}
