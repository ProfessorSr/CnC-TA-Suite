function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      const value = target[name](...args);
      if (value !== undefined && value !== null) return value;
    } catch {
      // ClientLib state may be transient during city changes.
    }
  }
  return null;
}

function values(collection) {
  if (!collection) return [];
  const source = collection.d ?? collection.l ?? collection;
  return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean);
}

function finite(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export class ResourceTransferHub {
  constructor(context) {
    this.context = context;
  }

  clientLib() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.clientLib()?.root ?? null; }

  cities() {
    const collection = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return values(call(collection, ['get_AllCities'])).filter((city) =>
      !call(city, ['get_IsGhostMode']) && call(city, ['IsOwnBase']) !== false
    );
  }

  currentCity() {
    const collection = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return call(collection, ['get_CurrentOwnCity']);
  }

  resourceType(name) {
    const types = this.root()?.Base?.EResourceType ?? {};
    return name === 'crystal' ? (types.Crystal ?? types.Chrystal) : types.Tiberium;
  }

  cityRecord(city, resourceName) {
    const type = this.resourceType(resourceName);
    return {
      id: String(call(city, ['get_Id']) ?? ''),
      name: String(call(city, ['get_Name']) ?? 'Unknown base'),
      x: finite(call(city, ['get_PosX', 'get_X'])),
      y: finite(call(city, ['get_PosY', 'get_Y'])),
      amount: Math.floor(finite(call(city, ['GetResourceCount'], type))),
      storage: Math.floor(finite(call(city, ['GetResourceMaxStorage'], type))),
      tradeError: call(city, ['CanTrade']),
      city
    };
  }

  snapshot(resourceName = 'tiberium') {
    const current = this.currentCity();
    const records = this.cities().map((city) => this.cityRecord(city, resourceName));
    const destinationId = String(call(current, ['get_Id']) ?? '');
    const player = this.clientLib()?.getPlayer?.();
    return {
      cities: records,
      currentDestinationId: destinationId,
      credits: Math.floor(finite(call(player, ['GetCreditsCount', 'get_CreditsCount'])))
    };
  }

  plan({ destinationId, sourceIds, resourceName, reserveAmount = 0, fraction = 1 }) {
    const snapshot = this.snapshot(resourceName);
    const destination = snapshot.cities.find((city) => city.id === String(destinationId));
    if (!destination) throw new Error('Select a valid destination base.');
    const none = this.root()?.Data?.ETradeError?.None ?? 0;
    const entries = [];
    let totalAmount = 0;
    let totalCost = 0;
    for (const source of snapshot.cities.filter((city) => sourceIds.includes(city.id) && city.id !== destination.id)) {
      const available = Math.max(0, source.amount - reserveAmount);
      const requested = Math.floor(available * Math.max(0, Math.min(1, fraction)));
      // The game permits owned bases to hold resources above their nominal
      // storage capacity. Storage is informational and must not truncate a
      // user-requested SelfTrade amount.
      const amount = requested;
      const cost = amount > 0
        ? Math.ceil(finite(call(source.city, ['CalculateTradeCostToCoord'], destination.x, destination.y, amount)))
        : 0;
      const eligible = source.tradeError === none && destination.tradeError === none && amount > 0;
      entries.push({ source, destination, available, amount, cost, eligible });
      if (eligible) {
        totalAmount += amount;
        totalCost += cost;
      }
    }
    return {
      resourceName,
      destination,
      entries,
      totalAmount,
      totalCost,
      remainingCapacity: null,
      storageLimitIgnored: true,
      credits: snapshot.credits,
      affordable: totalCost <= snapshot.credits
    };
  }

  sendTrade(manager, entry, resourceType) {
    const root = this.root();
    const delegateFactory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate
      ?? globalThis.phe?.cnc?.Util?.createEventDelegate;
    const commandResult = root?.Net?.CommandResult;
    if (typeof delegateFactory !== 'function' || !commandResult) {
      return Promise.reject(new Error('The native trade result callback is unavailable.'));
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Transfer from ${entry.source.name} timed out.`)), 15000);
      const receiver = {
        done(_context, result) {
          clearTimeout(timeout);
          const success = root?.Base?.EErrorCode?.Success ?? 0;
          if (Number(result) !== Number(success)) {
            reject(new Error(`Transfer from ${entry.source.name} was rejected by the game (code ${result}).`));
            return;
          }
          resolve();
        }
      };
      try {
        manager.SendCommand('SelfTrade', {
          targetCityId: call(entry.destination.city, ['get_Id']),
          sourceCityId: call(entry.source.city, ['get_Id']),
          resourceType,
          amount: entry.amount
        }, delegateFactory(commandResult, receiver, receiver.done), null, true);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  async execute(plan) {
    if (!plan?.affordable) throw new Error('Not enough Credits for this transfer plan.');
    const manager = this.root()?.Net?.CommunicationManager?.GetInstance?.();
    if (!manager?.SendCommand) throw new Error('The SelfTrade command is unavailable.');
    const type = this.resourceType(plan.resourceName);
    const accepted = [];
    for (const entry of plan.entries.filter((item) => item.eligible && item.amount > 0)) {
      await this.sendTrade(manager, entry, type);
      accepted.push({ source: entry.source.name, destination: entry.destination.name, amount: entry.amount });
    }
    return accepted;
  }
}
