import { Events } from '../../events/eventTypes.js';

function identity(value) {
  if (!value) return null;

  const id = value.id
    ?? value.get_Id?.()
    ?? value.get_CityId?.()
    ?? value.get_BaseId?.()
    ?? null;

  return id === null ? null : String(id);
}

export class GameStateMonitor {
  constructor({
    eventBus,
    services,
    logger,
    interval = 500
  }) {
    this.eventBus = eventBus;
    this.services = services;
    this.logger = logger;
    this.interval = interval;
    this.timer = null;
    this.previous = null;
  }

  capture() {
    const player = this.services.get('player').current();
    const city = this.services.get('city').current();
    const world = this.services.get('world').snapshot();
    const alliance = this.services.get('alliance').current();
    const selection = this.services.get('selection').snapshot();
    const battle = this.services.get('battle');

    return Object.freeze({
      playerId: identity(player),
      cityId: identity(city),
      worldId: identity(world),
      allianceId: identity(alliance),
      selectionId: selection.id === null ? null : String(selection.id),
      selectionType: selection.type,
      battleActive: battle.isActive()
    });
  }

  emitChanges(previous, current) {
    if (!previous) {
      this.eventBus.emit(Events.GAME_STATE_INITIALIZED, current);
      return;
    }

    if (previous.playerId !== current.playerId) {
      this.eventBus.emit(Events.PLAYER_CHANGED, {
        previous: previous.playerId,
        current: current.playerId
      });
    }

    if (previous.cityId !== current.cityId) {
      this.services.get('city').invalidate();
      this.services.get('base').invalidate();
      this.eventBus.emit(Events.CITY_CHANGED, {
        previous: previous.cityId,
        current: current.cityId,
        city: this.services.get('city').current()
      });
    }

    if (previous.worldId !== current.worldId) {
      this.services.get('world').invalidate();
      this.eventBus.emit(Events.WORLD_CHANGED, {
        previous: previous.worldId,
        current: current.worldId
      });
    }

    if (previous.allianceId !== current.allianceId) {
      this.services.get('alliance').invalidate();
      this.eventBus.emit(Events.ALLIANCE_CHANGED, {
        previous: previous.allianceId,
        current: current.allianceId
      });
    }

    if (
      previous.selectionId !== current.selectionId
      || previous.selectionType !== current.selectionType
    ) {
      this.services.get('selection').invalidate();
      this.services.get('base').invalidate();
      this.eventBus.emit(Events.SELECTION_CHANGED, {
        previous: {
          id: previous.selectionId,
          type: previous.selectionType
        },
        current: this.services.get('selection').snapshot()
      });
    }

    if (!previous.battleActive && current.battleActive) {
      this.services.get('battle').invalidate();
      this.eventBus.emit(Events.BATTLE_ENTERED, {
        state: this.services.get('battle').getState()
      });
    }

    if (previous.battleActive && !current.battleActive) {
      this.services.get('battle').invalidate();
      this.eventBus.emit(Events.BATTLE_EXITED, {
        previousActive: true
      });
    }
  }

  tick() {
    try {
      const current = this.capture();
      this.emitChanges(this.previous, current);
      this.previous = current;
      this.eventBus.emit(Events.GAME_TICK, current);
    } catch (error) {
      this.logger.warn('Game state monitor tick failed.', error);
    }
  }

  start() {
    if (this.timer) return;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), this.interval);
    this.logger.info('Central game state monitor started.', {
      interval: this.interval
    });
  }

  stop() {
    if (!this.timer) return;
    window.clearInterval(this.timer);
    this.timer = null;
    this.previous = null;
    this.logger.info('Central game state monitor stopped.');
  }
}
