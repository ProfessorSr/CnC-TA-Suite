export function compatibleClientEnvironment() {
  const mainData = {
    get_Server: () => ({ id: 1 }), get_Player: () => ({ id: 2 }),
    get_Cities: () => ({}), get_World: () => ({})
  };
  const root = {
    Data: { MainData: { GetInstance: () => mainData } },
    API: { Battleground: { GetInstance: () => ({}) } },
    Base: { Tech: { GetTechIdFromTechNameAndFaction: () => 7 } }
  };
  return {
    environment: { clientLib: root, application: {} },
    manager: { root, getMainData: () => mainData, call(target, names, ...args) {
      for (const name of names) if (typeof target?.[name] === 'function') return target[name](...args);
      return null;
    } }
  };
}

export function degradedClientEnvironment() {
  const fixture = compatibleClientEnvironment();
  delete fixture.manager.root.API;
  delete fixture.manager.root.Base;
  return fixture;
}
