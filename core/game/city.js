export class CityService {
  constructor(clientLib) {
    this.clientLib = clientLib;
  }

  getCities() {
    const cities = this.clientLib.getMainData()?.get_Cities?.();
    return cities?.get_AllCities?.() || cities || null;
  }

  getCurrentOwnCity() {
    return this.clientLib.getMainData()?.get_Cities?.()?.get_CurrentOwnCity?.() || null;
  }
}
