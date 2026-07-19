export class PlayerService {
  constructor(clientLib) {
    this.clientLib = clientLib;
  }

  getPlayer() {
    return this.clientLib.getMainData()?.get_Player?.() || null;
  }

  getName() {
    const player = this.getPlayer();
    return player?.get_Name?.() || player?.get_PlayerName?.() || 'Unknown';
  }
}
