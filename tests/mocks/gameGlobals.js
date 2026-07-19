export function installGameMocks() {
  window.ClientLib = window.ClientLib || {
    Data: {
      MainData: {
        GetInstance: () => ({
          get_Player: () => ({ get_Name: () => 'Mock Player' }),
          get_Cities: () => ({ get_CurrentOwnCity: () => null }),
          get_World: () => ({})
        })
      }
    }
  };
}
