export class TargetAnalyzer {
  static rows(snapshot) {
    const target = snapshot.target;
    if (!target) return [['Status', 'Select a target on the world map']];
    return [
      ['Name', target.name],
      ['Owner', target.owner],
      ['Alliance', target.alliance || '—'],
      ['Level', target.level],
      ['Coordinates', `${target.x}:${target.y}`],
      ['Type', target.npc ? 'Forgotten/NPC' : 'Player'],
      ['Command points', snapshot.cpCost]
    ];
  }
}
