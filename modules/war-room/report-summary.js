export class ReportSummary {
  static rows(snapshot) {
    const types = snapshot.resourceTypes ?? {};
    const preferred = [
      ['Tiberium', 'Tiberium'],
      ['Crystal', 'Crystal'],
      ['Chrystal', 'Crystal'],
      ['Gold', 'Credits'],
      ['Credits', 'Credits'],
      ['Power', 'Power'],
      ['ResearchPoints', 'Research Points']
    ];
    const names = new Map();
    for (const [key, label] of preferred) {
      if (types[key] != null && !names.has(String(types[key]))) names.set(String(types[key]), label);
    }
    const rows = Object.entries(snapshot.loot).map(([type, amount]) => [
      names.get(String(type)) ?? `Resource ${type}`,
      amount
    ]);
    rows.push(['Infantry repair', snapshot.repair.infantry]);
    rows.push(['Vehicle repair', snapshot.repair.vehicle]);
    rows.push(['Aircraft repair', snapshot.repair.aircraft]);
    return rows;
  }
}
