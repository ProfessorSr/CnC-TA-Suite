const item = (name, key, credits, rp, description, image, upgrade = null) => Object.freeze({
  name, key, credits, rp, description,
  image: image ? new URL(`./assets/${image}.png`, import.meta.url).href : null,
  upgrade
});

const upgrade = (name, key, credits, rp, description, prerequisite) =>
  Object.freeze({ name, key, credits, rp, description, prerequisite });

export const RESEARCH_CATALOG = Object.freeze({
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
