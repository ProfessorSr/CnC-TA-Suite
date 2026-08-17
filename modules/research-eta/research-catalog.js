import { RESEARCH_ASSETS } from './research-assets.generated.js';

const item = (name, key, credits, rp, description, image, upgrade = null) => Object.freeze({
  name, key, credits, rp, description,
  image: image ? RESEARCH_ASSETS[image] ?? null : null,
  upgrade
});

const asset = (name) => name ? RESEARCH_ASSETS[name] ?? null : null;
const upgrade = (name, key, credits, rp, description, prerequisite, image = null) =>
  Object.freeze({ name, key, credits, rp, description, prerequisite, image: asset(image) });

const GDI_RESEARCH_CATALOG = Object.freeze({
  OFFENSE: Object.freeze([
    [
      item('RIFLEMAN SQUAD', 'Riflemen', 0, 0, 'Basic squad, best suited to fight other infantry.', 'rifleman', upgrade('SMOKE GRENADE', 'SmokeGrenade', 5e6, 10e6, "Disable one structure's attacks temporarily.", 'RIFLEMAN SQUAD')),
      item('GUARDIAN', 'Guardian', 0, 0, 'Fast anti-infantry vehicle with short range.', 'guardian', upgrade('TRANSPORT', 'GuardianTransport', 30e6, 60e6, 'Transports one infantry squad to the enemy base.', 'GUARDIAN')),
      item('PALADIN', 'Paladin', 0, 0, 'Vehicle buster.', 'paladin', upgrade('TRANSPORT', 'PaladinTransport', 270e6, 540e6, 'Transports one infantry squad to the enemy base.', 'PALADIN'))
    ],
    [
      item('PITBULL', 'Pitbull', 0, 0, 'Fast buggy with high impact against structures.', 'pitbull', upgrade('FLASHBANG', 'PitbullFlashbang', 40e6, 80e6, 'Disable one infantry unit temporarily.', 'PITBULL')),
      item('MISSILE SQUAD', 'MissileSquad', 8e4, 2e5, 'Send to attack structures.', 'missile_squad', upgrade('MISSILE STORM', 'MissileStorm', 0, 0, 'Deals splash damage around its main target.', 'MISSILE SQUAD')),
      item('PREDATOR', 'Predator', 0, 0, 'Light tank, best suited to attack vehicles.', 'predator', upgrade('HEAT-MP-T', 'PredatorHeat', 460e6, 920e6, 'Special ammunition that deals more damage against vehicles.', 'PREDATOR'))
    ],
    [
      item('FIREHAWK', 'Firehawk', 2e5, 5e5, 'Quick air strike to bring down structures.', 'firehawk', upgrade('NANO TECH', 'FirehawkNano', 0, 0, 'Decreases the required repair time after combat.', 'FIREHAWK')),
      item('ZONE TROOPERS', 'ZoneTrooper', 6e5, 1.5e6, 'Send to attack enemy vehicles.', 'zone_troopers', upgrade('CHARGE', 'ZoneCharge', 0, 0, 'Boosts running speed when the unit gets damaged.', 'ZONE TROOPERS')),
      item('COMMANDO', 'Commando', 2.4e6, 5.8e6, 'High endurance infantry specialized against structures.', 'commando', upgrade('CHARGE', 'CommandoCharge', 0, 0, 'Boosts running speed when the unit gets damaged.', 'COMMANDO'))
    ],
    [
      item('ORCA', 'Orca', 4.1e6, 9.85e6, 'Infantry buster.', 'orca', upgrade('EMP', 'OrcaEmp', 0, 0, 'Disable one vehicle temporarily.', 'ORCA')),
      item('JUGGERNAUT', 'Juggernaut', 8.65e6, 19.6e6, 'Slow structure buster.', 'juggernaut', upgrade('BARRAGE', 'JuggernautBarrage', 0, 0, 'Deals splash damage around its main target.', 'JUGGERNAUT')),
      item('SNIPER TEAM', 'SniperTeam', 19e6, 42.5e6, 'Weak defense, but out-ranges enemy infantry.', 'sniper_team', upgrade('LASER SCOPE', 'SniperLaserScope', 0, 0, 'Increases the damage against infantry units.', 'SNIPER TEAM'))
    ],
    [
      item('MAMMOTH', 'Mammoth', 40e6, 100e6, 'Heavy tank with solid damage impact. Best used against vehicles.', 'mammoth', upgrade('BATTERING RAM', 'MammothRam', 0, 0, 'A crystal ram allows the Mammoth to break through walls.', 'MAMMOTH')),
      item('KODIAK', 'Kodiak', 60e6, 120e6, 'Structure buster.', 'kodiak', upgrade('AEGIS AURA', 'KodiakAegis', 0, 0, 'Shields nearby ground units from damage.', 'KODIAK'))
    ]
  ]),
  DEFENSE: Object.freeze([
    [
      item('PREDATOR', 'DefensePredator', 55e3, 135e3, 'Mobile vehicle buster.', 'defense_predator', upgrade('HEAT-MP-T', 'DefensePredatorHeat', 0, 0, 'Special ammunition that deals more damage against vehicles.', 'PREDATOR')),
      item('MISSILE SQUAD', 'DefenseMissileSquad', 70e3, 170e3, 'Mobile anti-air infantry.', 'defense_missile_squad', upgrade('MISSILE STORM', 'DefenseMissileStorm', 0, 0, 'Deals splash damage to air units around its main target.', 'MISSILE SQUAD')),
      item('ANTI-TANK BARRIER', 'AntiTankBarrier', 80e3, 200e3, 'Anti-vehicle structure. Damages passing vehicles.', 'anti_tank_barrier', upgrade('REPAIR DRONES', 'BarrierRepairDrones', 0, 0, 'Instant full-repair after combat.', 'ANTI-TANK BARRIER'))
    ],
    [
      item('GUARDIAN', 'DefenseGuardian', 100e3, 250e3, 'Mobile, fast anti-infantry vehicle.', 'defense_guardian', upgrade('TRANSPORT', 'DefenseGuardianTransport', 0, 0, 'Transports one infantry squad until it gets destroyed.', 'GUARDIAN')),
      item('GUARDIAN CANNON', 'GuardianCannon', 125e3, 320e3, 'Heavy turret structure specialized against vehicles.', 'guardian_cannon', upgrade('GARRISON', 'GuardianCannonGarrison', 0, 0, 'Garrisons one infantry squad until it gets destroyed.', 'GUARDIAN CANNON')),
      item('PITBULL', 'DefensePitbull', 380e3, 940e3, 'Mobile, fast anti-air vehicle.', 'defense_pitbull', upgrade('FLASHBANG', 'DefensePitbullFlashbang', 0, 0, 'Disables one infantry unit temporarily.', 'PITBULL'))
    ],
    [
      item('BARBWIRE', 'Barbwire', 920e3, 2.2e6, 'Anti-infantry structure. Damages passing infantry and vehicles.', 'barbwire', upgrade('REPAIR DRONES', 'BarbwireRepairDrones', 0, 0, 'Instant full-repair after combat.', 'BARBWIRE')),
      item('SNIPER TEAM', 'DefenseSniperTeam', 2.6e6, 6.2e6, 'Long-ranged anti-infantry squad.', 'defense_sniper', upgrade('LASER SCOPE', 'DefenseSniperLaser', 0, 0, 'Increases the damage against infantry units.', 'SNIPER TEAM')),
      item('FLAK', 'Flak', 5.4e6, 12.3e6, 'Heavy turret specialized against aircraft.', 'flak', upgrade('GUIDED MISSILES', 'FlakGuidedMissiles', 0, 0, 'Increases the damage against air units.', 'FLAK'))
    ],
    [
      item('ZONE TROOPER', 'DefenseZoneTrooper', 9.5e6, 21e6, 'Mobile anti-vehicle infantry.', 'defense_zone', upgrade('EMP', 'DefenseZoneEmp', 0, 0, 'Disable one vehicle temporarily.', 'ZONE TROOPER')),
      item('WATCHTOWER', 'Watchtower', 24e6, 48e6, 'Anti-infantry artillery vehicle. Minimum range.', 'watchtower', upgrade('SR ARMS', 'WatchtowerSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'WATCHTOWER')),
      item('TITAN ARTILLERY', 'TitanArtillery', 50e6, 120e6, 'Anti-vehicle artillery vehicle. Minimum range.', 'titan_artillery', upgrade('SR ARMS', 'TitanSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'TITAN ARTILLERY'))
    ],
    [item('SAM SITE', 'SamSite', 125e6, 300e6, 'Anti-aircraft artillery vehicle. Minimum range.', 'sam_site', upgrade('SR ARMS', 'SamSiteSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'SAM SITE'))]
  ]),
  SPECIAL: Object.freeze([[
    item('MCV', 'BaseFound', 12e6, 9.5e6, 'Construct an additional MCV which allows founding a new base.', 'mcv'),
    item('ION CANNON SUPPORT', 'IonCannonSupport', 150e3, 380e3, 'Anti-vehicle support that defends alerted friendly bases.', 'ion_cannon_support'),
    item('FALCON SUPPORT', 'FalconSupport', 460e3, 1.13e6, 'Anti-aircraft support that defends alerted friendly bases.', 'falcon_support')
  ]])
});

const NOD_IMAGES = Object.freeze({
  MilitantRocketSquad: 'nod_rocket', AttackBike: 'nod_attack_bike', BlackHand: 'nod_black_hand',
  Vertigo: 'nod_vertigo', Scorpion: 'nod_scorpion', Specter: 'nod_specter', Cobra: 'nod_cobra',
  Commando: 'nod_commando', Avatar: 'nod_avatar', Confessor: 'nod_confessor', Salamander: 'nod_salamander',
  ShredderMG: 'nod_shredder', DefenseAttackBike: 'nod_attack_bike', LaserFence: 'nod_laser_fence',
  DefenseBlackHand: 'nod_black_hand', Flak: 'nod_flak', DefenseMilitantRocketSquad: 'nod_rocket',
  AntiTankBarrier: 'nod_anti_tank', DefenseConfessor: 'nod_confessor', BeamCannon: 'nod_beam_cannon',
  DefenseReckoner: 'nod_reckoner', ObeliskArtillery: 'nod_obelisk', SamSite: 'nod_sam_site',
  GatlingCannon: 'nod_gatling', BaseFound: 'nod_mcv', EyeOfKane: 'nod_eye_kane', BladeOfKane: 'nod_blade_kane'
});
const nodItem = (name, key, credits, rp, description, image = null, upgradeItem = null) => {
  if (image && typeof image === 'object') return item(name, key, credits, rp, description, NOD_IMAGES[key], image);
  return item(name, key, credits, rp, description, image ?? NOD_IMAGES[key], upgradeItem);
};
const nodUpgrade = (name, key, credits, rp, description, prerequisite, image = null) =>
  upgrade(name, key, credits, rp, description, prerequisite, image);

const NOD_RESEARCH_CATALOG = Object.freeze({
  OFFENSE: Object.freeze([
    [
      nodItem('MILITANTS', 'Militants', 0, 0, 'Basic squad, best suited to fight other infantry.', 'nod_militants', nodUpgrade('STEALTH', 'MilitantStealth', 5e6, 10e6, 'Cannot be attacked unless it attacks first.', 'MILITANTS', 'nod_stealth')),
      nodItem('RECKONER', 'Reckoner', 0, 0, 'Anti-infantry vehicle with short range.', 'nod_reckoner', nodUpgrade('TRANSPORT', 'ReckonerTransport', 30e6, 60e6, 'Transports one infantry squad to the enemy base.', 'RECKONER', 'nod_transport_ground')),
      nodItem('VENOM', 'Venom', 0, 0, 'Infantry buster.', 'nod_venom', nodUpgrade('TRANSPORT', 'VenomTransport', 270e6, 540e6, 'Transports one infantry squad to the enemy base.', 'VENOM', 'nod_transport_air'))
    ],
    [
      nodItem('MILITANT ROCKET SQUAD', 'MilitantRocketSquad', 0, 0, 'Send to attack structures.', nodUpgrade('DEFENSE MATRIX', 'RocketDefenseMatrix', 80e6, 160e6, 'Makes its carrier more resistant against damage.', 'MILITANT ROCKET SQUAD')),
      nodItem('ATTACK BIKE', 'AttackBike', 8e4, 2e5, 'Fast bike with high impact against structures.', nodUpgrade('SHIELD', 'AttackBikeShield', 0, 0, 'Absorbs damage depending on the unit level.', 'ATTACK BIKE')),
      nodItem('BLACK HAND', 'BlackHand', 0, 0, 'Send to attack enemy vehicles.', nodUpgrade('CONFLAGRATION', 'BlackHandConflagration', 460e6, 920e6, 'Deals splash damage around its main target.', 'BLACK HAND'))
    ],
    [
      nodItem('VERTIGO', 'Vertigo', 0, 0, 'Quick air strike to bring down structures.', nodUpgrade('NANO TECH', 'VertigoNanoTech', 215e6, 430e6, 'Decreases the required repair time after combat.', 'VERTIGO')),
      nodItem('SCORPION', 'Scorpion', 6e5, 1.5e6, 'Light tank, best suited to attack vehicles.', nodUpgrade('LASER CUTTER', 'ScorpionLaserCutter', 0, 0, 'Increases the damage when running over enemy units.', 'SCORPION')),
      nodItem('SPECTER', 'Specter', 2.4e6, 5.8e6, 'Fast wall and building breaker.', nodUpgrade('STEALTH', 'SpecterStealth', 0, 0, 'Cannot be attacked unless it attacks first.', 'SPECTER'))
    ],
    [
      nodItem('COBRA', 'Cobra', 4.1e6, 9.85e6, 'Vehicle buster.', nodUpgrade('SHIELD', 'CobraShield', 0, 0, 'Absorbs damage depending on the unit level.', 'COBRA')),
      nodItem('COMMANDO', 'Commando', 8.65e6, 19.6e6, 'High endurance infantry specialized against structures.', nodUpgrade('STEALTH', 'CommandoStealth', 0, 0, 'Cannot be attacked unless it attacks first.', 'COMMANDO')),
      nodItem('AVATAR', 'Avatar', 19e6, 42.5e6, 'Heavy walker with solid damage impact. Best used against vehicles.', nodUpgrade('CONVERSION', 'AvatarConversion', 0, 0, 'Turns the dealt damage of enemy vehicles into own health.', 'AVATAR'))
    ],
    [
      nodItem('CONFESSOR', 'Confessor', 40e6, 100e6, 'Weak defense, but out-ranges enemy infantry.', nodUpgrade('DEFENSE MATRIX', 'ConfessorDefenseMatrix', 0, 0, 'Makes its carrier more resistant against damage.', 'CONFESSOR')),
      nodItem('SALAMANDER', 'Salamander', 60e6, 120e6, 'Structure buster.', nodUpgrade('CONVERSION', 'SalamanderConversion', 0, 0, 'Turns the dealt damage of enemy defense structures into own health.', 'SALAMANDER'))
    ]
  ]),
  DEFENSE: Object.freeze([
    [
      nodItem('SHREDDER MG', 'ShredderMG', 0, 0, 'Light infantry nest specialized against infantry.', nodUpgrade('SHRAPNEL AMMO', 'ShredderShrapnelAmmo', 600e6, 1.2e9, 'Increases the damage against infantry units.', 'SHREDDER MG')),
      nodItem('ATTACK BIKE', 'DefenseAttackBike', 0, 0, 'Mobile, fast anti-air vehicle.', nodUpgrade('SHIELD', 'DefenseAttackBikeShield', 7e6, 14e6, 'Absorbs damage depending on the unit level.', 'ATTACK BIKE')),
      nodItem('LASER FENCE', 'LaserFence', 8e4, 2e5, 'Anti-infantry structure. Damages passing infantry and vehicles.', nodUpgrade('REPAIR DRONES', 'LaserFenceRepairDrones', 0, 0, 'Instant full-repair after combat.', 'LASER FENCE'))
    ],
    [
      nodItem('BLACK HAND', 'DefenseBlackHand', 1e5, 2.5e5, 'Mobile anti-vehicle infantry.', nodUpgrade('CONFLAGRATION', 'DefenseBlackHandConflagration', 0, 0, 'Deals splash damage to ground units around its main target.', 'BLACK HAND')),
      nodItem('FLAK', 'Flak', 125e3, 320e3, 'Heavy turret specialized against aircraft.', nodUpgrade('GARRISON', 'FlakGarrison', 0, 0, 'Garrisons one infantry squad until it gets destroyed.', 'FLAK')),
      nodItem('MILITANT ROCKET SQUAD', 'DefenseMilitantRocketSquad', 380e3, 940e3, 'Mobile anti-air infantry.', nodUpgrade('DEFENSE MATRIX', 'DefenseRocketMatrix', 0, 0, 'Makes its carrier more resistant against damage.', 'MILITANT ROCKET SQUAD'))
    ],
    [
      nodItem('ANTI-TANK BARRIER', 'AntiTankBarrier', 920e3, 2.2e6, 'Anti-vehicle structure. Damages passing vehicles.', nodUpgrade('REPAIR DRONES', 'BarrierRepairDrones', 0, 0, 'Instant full-repair after combat.', 'ANTI-TANK BARRIER')),
      nodItem('CONFESSOR', 'DefenseConfessor', 2.6e6, 6.2e6, 'Advanced defense unit, good against infantry.', nodUpgrade('DEFENSE MATRIX', 'DefenseConfessorMatrix', 0, 0, 'Makes its carrier more resistant against damage.', 'CONFESSOR')),
      nodItem('BEAM CANNON', 'BeamCannon', 5.4e6, 12.3e6, 'Heavy turret structure specialized against vehicles.', nodUpgrade('STEALTH', 'BeamCannonStealth', 0, 0, 'Cannot be attacked unless it attacks first.', 'BEAM CANNON'))
    ],
    [
      nodItem('RECKONER', 'DefenseReckoner', 9.5e6, 21e6, 'Mobile, fast anti-infantry vehicle.', nodUpgrade('TRANSPORT', 'DefenseReckonerTransport', 0, 0, 'Transports one infantry squad until it gets destroyed.', 'RECKONER')),
      nodItem('OBELISK ARTILLERY', 'ObeliskArtillery', 24e6, 48e6, 'Anti-vehicle artillery vehicle. Minimum range.', nodUpgrade('SR ARMS', 'ObeliskSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'OBELISK ARTILLERY')),
      nodItem('SAM SITE', 'SamSite', 50e6, 120e6, 'Anti-aircraft artillery vehicle. Minimum range.', nodUpgrade('SR ARMS', 'SamSiteSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'SAM SITE'))
    ],
    [nodItem('GATLING CANNON', 'GatlingCannon', 125e6, 300e6, 'Anti-infantry artillery vehicle. Minimum range.', nodUpgrade('SR ARMS', 'GatlingSrArms', 0, 0, 'Short Range Arms reduce the minimum weapon range.', 'GATLING CANNON'))]
  ]),
  SPECIAL: Object.freeze([[
    nodItem('MCV', 'BaseFound', 12e6, 9.5e6, 'Construct an additional MCV which allows founding a new base.'),
    nodItem('EYE OF KANE', 'EyeOfKane', 150e3, 380e3, 'Anti-aircraft support that defends alerted friendly bases.'),
    nodItem('BLADE OF KANE', 'BladeOfKane', 460e3, 1.13e6, 'Anti-infantry support that defends alerted friendly bases.')
  ]])
});

export const RESEARCH_CATALOGS = Object.freeze({ gdi: GDI_RESEARCH_CATALOG, nod: NOD_RESEARCH_CATALOG });
export const RESEARCH_CATALOG = GDI_RESEARCH_CATALOG;
