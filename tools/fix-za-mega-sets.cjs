'use strict';

const fs = require('fs');
const path = require('path');

const {Dex} = require('../dist/sim/dex');

Dex.includeMods();

const dex = Dex.mod('ndsharedpower');

const DIR = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower'
);

const singlesPath = path.join(DIR, 'sets.json');
const ffaPath = path.join(DIR, 'doubles-sets.json');

const singles = JSON.parse(
	fs.readFileSync(singlesPath, 'utf8')
);

const ffa = JSON.parse(
	fs.readFileSync(ffaPath, 'utf8')
);

const S = (role, ...slots) => ({
	role,
	slots: slots.map(
		x => Array.isArray(x) ? x : [x]
	),
});

/*
 * ============================================================
 * CURATED SINGLES ZA MEGA SETS
 * ============================================================
 */

const SETS = {
	Clefable: [
		S(
			'Bulky Setup',
			'Calm Mind',
			'Moonblast',
			'Soft-Boiled',
			['Flamethrower', 'Mystical Fire']
		),
	],

	Victreebel: [
		S(
			'Wallbreaker',
			'Sleep Powder',
			['Leaf Storm', 'Power Whip'],
			'Sludge Bomb',
			['Knock Off', 'Sucker Punch']
		),
		S(
			'Setup Sweeper',
			'Growth',
			'Power Whip',
			'Poison Jab',
			'Sucker Punch'
		),
	],

	/*
	 * Huge Power makes physical Starmie substantially better
	 * than simply inheriting its normal special-attacker set.
	 */
	Starmie: [
		S(
			'Fast Attacker',
			'Liquidation',
			'Aqua Jet',
			'Psycho Cut',
			'Flip Turn'
		),
		S(
			'Fast Attacker',
			'Liquidation',
			'Aqua Jet',
			['Zen Headbutt', 'Psycho Cut'],
			'Ice Spinner'
		),
	],

	Dragonite: [
		S(
			'Bulky Attacker',
			'Hurricane',
			['Draco Meteor', 'Dragon Pulse'],
			'Roost',
			['Fire Blast', 'Thunderbolt']
		),
		S(
			'Setup Sweeper',
			['Agility', 'Dragon Dance'],
			'Hurricane',
			['Dragon Pulse', 'Dragon Claw'],
			'Roost'
		),
	],

	/*
	 * Mega Sol means Meganium should actually exploit automatic
	 * sun with Solar Beam + Weather Ball.
	 */
	Meganium: [
		S(
			'Bulky Attacker',
			'Solar Beam',
			'Weather Ball',
			'Dazzling Gleam',
			'Synthesis'
		),
		S(
			'Bulky Attacker',
			'Solar Beam',
			'Weather Ball',
			'Earth Power',
			'Synthesis'
		),
	],

	/*
	 * Dragonize makes Normal attacks into useful Dragon offense.
	 */
	Feraligatr: [
		S(
			'Setup Sweeper',
			'Dragon Dance',
			'Liquidation',
			'Body Slam',
			'Earthquake'
		),
		S(
			'Setup Sweeper',
			'Dragon Dance',
			'Liquidation',
			'Double-Edge',
			'Aqua Jet'
		),
	],

	Skarmory: [
		S(
			'Bulky Support',
			'Brave Bird',
			'Iron Head',
			'Roost',
			'Swords Dance'
		),
	],

	Chimecho: [
		S(
			'Bulky Setup',
			'Calm Mind',
			['Psychic', 'Psyshock'],
			'Recover',
			['Flash Cannon', 'Shadow Ball', 'Dazzling Gleam']
		),
	],

	/*
	 * Mega Absol Z is deliberately loaded with Sharpness moves.
	 *
	 * Night Slash
	 * Shadow Claw
	 * Psycho Cut
	 *
	 * are all major ability beneficiaries.
	 */
	Absol: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Night Slash',
			'Shadow Claw',
			'Psycho Cut'
		),
		S(
			'Fast Attacker',
			'Night Slash',
			'Shadow Claw',
			'Psycho Cut',
			'Close Combat'
		),
		S(
			'Wallbreaker',
			'Night Slash',
			'Shadow Claw',
			'Psycho Cut',
			['Sucker Punch', 'Close Combat']
		),
	],

	Staraptor: [
		S(
			'Fast Attacker',
			'Brave Bird',
			'Close Combat',
			'Roost',
			'U-turn'
		),
	],

	Garchomp: [
		S(
			'Fast Special Attacker',
			'Draco Meteor',
			'Power Gem',
			'Flamethrower',
			'Earth Power'
		),
		S(
			'Fast Special Attacker',
			'Dragon Pulse',
			'Power Gem',
			'Fire Blast',
			'Earth Power'
		),
	],

	Lucario: [
		S(
			'Setup Sweeper',
			'Nasty Plot',
			'Aura Sphere',
			'Flash Cannon',
			'Vacuum Wave'
		),
		S(
			'Setup Sweeper',
			'Calm Mind',
			'Aura Sphere',
			'Flash Cannon',
			'Dark Pulse'
		),
	],

	Froslass: [
		S(
			'Fast Support',
			'Aurora Veil',
			'Blizzard',
			'Shadow Ball',
			'Thunderbolt'
		),
	],

	Heatran: [
		S(
			'Wallbreaker',
			'Magma Storm',
			'Earth Power',
			'Flash Cannon',
			'Taunt'
		),
		S(
			'Bulky Support',
			'Magma Storm',
			'Earth Power',
			'Stealth Rock',
			'Toxic'
		),
	],

	Darkrai: [
		S(
			'Setup Sweeper',
			'Nasty Plot',
			'Dark Pulse',
			'Sludge Bomb',
			['Dark Void', 'Hypnosis', 'Focus Blast']
		),
		S(
			'Fast Attacker',
			'Dark Pulse',
			'Ice Beam',
			'Focus Blast',
			['Dark Void', 'Hypnosis', 'Sludge Bomb']
		),
	],

	Emboar: [
		S(
			'Bulky Setup',
			'Bulk Up',
			'Drain Punch',
			['Heat Crash', 'Flare Blitz'],
			'Sucker Punch'
		),
	],

	Excadrill: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			['High Horsepower', 'Earthquake'],
			'Iron Head',
			['Rapid Spin', 'Rock Slide']
		),
	],

	Scolipede: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Earthquake',
			'Poison Jab',
			'Leech Life'
		),
	],

	Scrafty: [
		S(
			'Setup Sweeper',
			'Dragon Dance',
			['Drain Punch', 'Close Combat'],
			'Knock Off',
			'Ice Punch'
		),
		S(
			'Bulky Setup',
			'Bulk Up',
			'Drain Punch',
			'Knock Off',
			'Rest'
		),
	],

	Eelektross: [
		S(
			'Setup Sweeper',
			'Coil',
			'Thunder Punch',
			'Drain Punch',
			'Knock Off'
		),
		S(
			'Bulky Attacker',
			'Volt Switch',
			'Flamethrower',
			'Giga Drain',
			'Knock Off'
		),
	],

	Chandelure: [
		S(
			'Setup Sweeper',
			'Nasty Plot',
			'Shadow Ball',
			'Fire Blast',
			'Energy Ball'
		),
	],

	Golurk: [
		S(
			'Setup Sweeper',
			'Rock Polish',
			['High Horsepower', 'Earthquake'],
			'Shadow Punch',
			['Ice Punch', 'Drain Punch']
		),
		S(
			'Wallbreaker',
			'Shadow Punch',
			'Drain Punch',
			'Ice Punch',
			['High Horsepower', 'Earthquake']
		),
	],

	Chesnaught: [
		S(
			'Bulky Setup',
			'Iron Defense',
			'Body Press',
			'Synthesis',
			'Spikes'
		),
		S(
			'Bulky Setup',
			'Bulk Up',
			'Drain Punch',
			'Seed Bomb',
			'Synthesis'
		),
	],

	Delphox: [
		S(
			'Setup Sweeper',
			'Nasty Plot',
			['Fire Blast', 'Flamethrower'],
			['Psychic', 'Psyshock'],
			['Shadow Ball', 'Dazzling Gleam']
		),
	],

	Greninja: [
		S(
			'Fast Attacker',
			'Hydro Pump',
			'Dark Pulse',
			'Ice Beam',
			'U-turn'
		),
		S(
			'Fast Attacker',
			'Surf',
			'Dark Pulse',
			'Ice Beam',
			'Grass Knot'
		),
	],

	Pyroar: [
		S(
			'Fast Attacker',
			['Fire Blast', 'Overheat'],
			'Hyper Voice',
			'Dark Pulse',
			'Will-O-Wisp'
		),
	],

	Floette: [
		S(
			'Bulky Setup',
			'Calm Mind',
			['Light of Ruin', 'Moonblast'],
			'Psychic',
			['Synthesis', 'Draining Kiss']
		),
		S(
			'Wallbreaker',
			'Light of Ruin',
			'Moonblast',
			'Psychic',
			'Draining Kiss'
		),
	],

	Malamar: [
		S(
			'Bulky Setup',
			'Superpower',
			'Knock Off',
			'Psycho Cut',
			['Rest', 'Substitute']
		),
	],

	Barbaracle: [
		S(
			'Setup Sweeper',
			'Shell Smash',
			'Liquidation',
			'Stone Edge',
			['Cross Chop', 'Earthquake']
		),
	],

	Dragalge: [
		S(
			'AV Pivot',
			'Draco Meteor',
			'Sludge Bomb',
			'Flip Turn',
			'Focus Blast'
		),
		S(
			'Bulky Support',
			'Draco Meteor',
			'Sludge Bomb',
			'Flip Turn',
			'Toxic Spikes'
		),
	],

	Hawlucha: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'High Jump Kick',
			'Stone Edge',
			['Dual Wingbeat', 'Brave Bird']
		),
	],

	Zygarde: [
		S(
			'Bulky Attacker',
			'Core Enforcer',
			['Earth Power', 'Thousand Arrows'],
			'Glare',
			'Substitute'
		),
		S(
			'Bulky Setup',
			'Coil',
			'Thousand Arrows',
			'Glare',
			'Substitute'
		),
	],

	Crabominable: [
		S(
			'Wallbreaker',
			'Ice Punch',
			'Drain Punch',
			'Thunder Punch',
			['Mach Punch', 'Close Combat']
		),
	],

	Golisopod: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Leech Life',
			'Iron Head',
			'First Impression'
		),
		S(
			'Wallbreaker',
			'First Impression',
			'Leech Life',
			'Iron Head',
			'Liquidation'
		),
	],

	Drampa: [
		S(
			'Bulky Setup',
			'Calm Mind',
			'Hyper Voice',
			['Dragon Pulse', 'Draco Meteor'],
			'Roost'
		),
	],

	Magearna: [
		S(
			'Setup Sweeper',
			'Shift Gear',
			'Fleur Cannon',
			'Aura Sphere',
			'Thunderbolt'
		),
		S(
			'Bulky Setup',
			'Calm Mind',
			'Fleur Cannon',
			'Draining Kiss',
			'Aura Sphere'
		),
	],

	Zeraora: [
		S(
			'Fast Attacker',
			'Plasma Fists',
			'Close Combat',
			'Knock Off',
			'Volt Switch'
		),
		S(
			'Setup Sweeper',
			'Bulk Up',
			'Plasma Fists',
			'Close Combat',
			'Knock Off'
		),
	],

	Falinks: [
		S(
			'Setup Sweeper',
			'No Retreat',
			'Close Combat',
			['Knock Off', 'Iron Head'],
			'Poison Jab'
		),
	],

	Scovillain: [
		S(
			'Setup Sweeper',
			'Growth',
			'Fire Blast',
			'Giga Drain',
			['Stomping Tantrum', 'Substitute']
		),
		S(
			'Wallbreaker',
			'Overheat',
			'Giga Drain',
			'Stomping Tantrum',
			'Leech Seed'
		),
	],

	Glimmora: [
		S(
			'Wallbreaker',
			'Power Gem',
			'Sludge Wave',
			'Earth Power',
			'Stealth Rock'
		),
		S(
			'Bulky Support',
			'Power Gem',
			'Sludge Wave',
			'Mortal Spin',
			'Stealth Rock'
		),
	],

	Tatsugiri: [
		S(
			'Setup Sweeper',
			['Nasty Plot', 'Taunt'],
			'Draco Meteor',
			'Hydro Pump',
			'Rapid Spin'
		),
	],

	Baxcalibur: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Glaive Rush',
			'Icicle Crash',
			'Ice Shard'
		),
		S(
			'Setup Sweeper',
			'Dragon Dance',
			'Glaive Rush',
			'Icicle Crash',
			'High Horsepower'
		),
	],
};

/*
 * ============================================================
 * RAICHU X / RAICHU Y
 * ============================================================
 *
 * These MUST be separate because their intended offensive
 * profiles are completely different.
 */

const RAICHU_X = [
	S(
		'Fast Physical Attacker',
		'Volt Tackle',
		'Fake Out',
		['Knock Off', 'Brick Break'],
		'Volt Switch'
	),
	S(
		'Setup Sweeper',
		'Nasty Plot',
		'Thunderbolt',
		'Focus Blast',
		'Surf'
	),
];

/*
 * Raichu Y is built around Zap Cannon.
 *
 * DO NOT allow Volt Tackle on its curated sets.
 */
const RAICHU_Y = [
	S(
		'Fast Special Attacker',
		'Zap Cannon',
		'Focus Blast',
		'Surf',
		'Volt Switch'
	),
	S(
		'Setup Sweeper',
		'Nasty Plot',
		'Zap Cannon',
		'Focus Blast',
		'Surf'
	),
];

/*
 * ============================================================
 * MEOWSTIC
 * ============================================================
 */

const MEOWSTIC_M = [
	S(
		'Fast Support',
		'Psychic',
		'Thunder Wave',
		'Reflect',
		'Light Screen'
	),
];

const MEOWSTIC_F = [
	S(
		'Setup Sweeper',
		['Nasty Plot', 'Calm Mind'],
		['Psychic', 'Psyshock'],
		'Shadow Ball',
		'Thunderbolt'
	),
];

/*
 * ============================================================
 * FFA OVERRIDES
 * ============================================================
 */

const FFA_SETS = {
	Starmie: [
		S(
			'Fast Attacker',
			'Liquidation',
			'Aqua Jet',
			['Zen Headbutt', 'Psycho Cut'],
			'Protect'
		),
	],

	Meganium: [
		S(
			'Bulky Attacker',
			'Solar Beam',
			'Weather Ball',
			'Dazzling Gleam',
			'Protect'
		),
		S(
			'Bulky Attacker',
			'Solar Beam',
			'Weather Ball',
			'Earth Power',
			'Protect'
		),
	],

	Feraligatr: [
		S(
			'Setup Sweeper',
			'Dragon Dance',
			'Liquidation',
			'Double-Edge',
			'Protect'
		),
	],

	Absol: [
		S(
			'Fast Attacker',
			'Night Slash',
			'Shadow Claw',
			'Psycho Cut',
			'Protect'
		),
		S(
			'Fast Attacker',
			'Night Slash',
			'Shadow Claw',
			'Close Combat',
			'Protect'
		),
	],

	Garchomp: [
		S(
			'Fast Special Attacker',
			'Draco Meteor',
			'Power Gem',
			['Flamethrower', 'Earth Power'],
			'Protect'
		),
	],

	Lucario: [
		S(
			'Setup Sweeper',
			['Nasty Plot', 'Calm Mind'],
			'Aura Sphere',
			'Flash Cannon',
			'Protect'
		),
	],

	Froslass: [
		S(
			'Fast Support',
			'Aurora Veil',
			'Blizzard',
			'Shadow Ball',
			'Protect'
		),
	],

	Emboar: [
		S(
			'Bulky Setup',
			'Bulk Up',
			'Drain Punch',
			'Heat Crash',
			'Protect'
		),
	],

	Scolipede: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Leech Life',
			['Poison Jab', 'Rock Slide'],
			'Protect'
		),
	],

	Golisopod: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Leech Life',
			'Iron Head',
			'Protect'
		),
	],

	Baxcalibur: [
		S(
			'Setup Sweeper',
			'Swords Dance',
			'Glaive Rush',
			'Ice Shard',
			'Protect'
		),
	],
};

const RAICHU_X_FFA = [
	S(
		'Fast Physical Attacker',
		'Volt Tackle',
		'Volt Switch',
		'Fake Out',
		'Protect'
	),
];

const RAICHU_Y_FFA = [
	S(
		'Fast Special Attacker',
		'Zap Cannon',
		'Focus Blast',
		'Surf',
		'Protect'
	),
];

/*
 * Preferred PRE-MEGA abilities.
 */

const PRE_MEGA_ABILITIES = {
	Raichu: ['Lightning Rod'],
	Clefable: ['Magic Guard'],
	Starmie: ['Natural Cure'],
	Dragonite: ['Multiscale'],
	Feraligatr: ['Sheer Force'],
	Skarmory: ['Sturdy'],
	Chimecho: ['Levitate'],

	Absol: ['Justified', 'Super Luck'],

	Staraptor: ['Intimidate'],
	Garchomp: ['Rough Skin'],
	Lucario: ['Inner Focus'],
	Heatran: ['Flash Fire'],
	Darkrai: ['Bad Dreams'],
	Excadrill: ['Mold Breaker'],
	Scolipede: ['Speed Boost'],
	Scrafty: ['Intimidate'],
	Eelektross: ['Levitate'],
	Chandelure: ['Infiltrator', 'Flash Fire'],
	Golurk: ['Iron Fist', 'No Guard'],
	Chesnaught: ['Bulletproof'],
	Greninja: ['Protean'],
	Dragalge: ['Adaptability'],
	Hawlucha: ['Mold Breaker'],
	Zygarde: ['Aura Break'],
	Crabominable: ['Iron Fist'],
	Drampa: ['Berserk'],
	Magearna: ['Soul-Heart'],
	Zeraora: ['Volt Absorb'],
	Falinks: ['Defiant'],
	Glimmora: ['Toxic Debris'],
	Tatsugiri: ['Storm Drain'],
	Baxcalibur: ['Thermal Exchange'],
};

function getBaseSpecies(mega) {
	if (typeof mega.battleOnly === 'string') {
		const base = dex.species.get(mega.battleOnly);

		if (base.exists) return base;
	}

	if (
		Array.isArray(mega.battleOnly) &&
		mega.battleOnly.length
	) {
		const base = dex.species.get(
			mega.battleOnly[0]
		);

		if (base.exists) return base;
	}

	return dex.species.get(mega.baseSpecies);
}

function getAbilities(mega) {
	const base = getBaseSpecies(mega);

	const available = [
		...new Set(
			Object.values(base.abilities || {})
				.filter(Boolean)
		),
	];

	const wanted =
		PRE_MEGA_ABILITIES[mega.baseSpecies] || [];

	const preferred = wanted.filter(
		ability => available.includes(ability)
	);

	return preferred.length ?
		preferred :
		available;
}

function isRaichuX(mega) {
	const id = mega.id;

	return (
		id.includes('raichumegax') ||
		id.includes('raichuxmega') ||
		(
			mega.baseSpecies === 'Raichu' &&
			(
				String(mega.forme).endsWith('X') ||
				mega.name.endsWith(' X')
			)
		)
	);
}

function isRaichuY(mega) {
	const id = mega.id;

	return (
		id.includes('raichumegay') ||
		id.includes('raichuymega') ||
		(
			mega.baseSpecies === 'Raichu' &&
			(
				String(mega.forme).endsWith('Y') ||
				mega.name.endsWith(' Y')
			)
		)
	);
}

function getDefinitions(mega, isFFA) {
	if (mega.baseSpecies === 'Raichu') {
		if (isRaichuX(mega)) {
			return isFFA ?
				RAICHU_X_FFA :
				RAICHU_X;
		}

		if (isRaichuY(mega)) {
			return isFFA ?
				RAICHU_Y_FFA :
				RAICHU_Y;
		}

		throw new Error(
			`Unknown Raichu Mega forme: ${mega.name} / ${mega.id}`
		);
	}

	if (mega.baseSpecies === 'Meowstic') {
		const female =
			mega.id.includes('meowsticf') ||
			mega.name.includes('-F');

		return female ?
			MEOWSTIC_F :
			MEOWSTIC_M;
	}

	if (
		isFFA &&
		FFA_SETS[mega.baseSpecies]
	) {
		return FFA_SETS[mega.baseSpecies];
	}

	return SETS[mega.baseSpecies];
}

function legalMovePool(mega) {
	const result = new Set();

	for (const species of [
		mega,
		getBaseSpecies(mega),
	]) {
		try {
			for (
				const id of
					dex.species.getMovePool(
						species.id,
						true
					)
			) {
				result.add(id);
			}
		} catch {}
	}

	return result;
}

function makeEntry(
	mega,
	defs,
	previous
) {
	const pool = legalMovePool(mega);
	const abilities = getAbilities(mega);

	const generatedSets = [];

	for (const def of defs) {
		const moves = [];

		for (const slot of def.slots) {
			let selected = null;

			for (const candidate of slot) {
				const move =
					dex.moves.get(candidate);

				if (
					move.exists &&
					pool.has(move.id)
				) {
					selected = move.name;
					break;
				}
			}

			if (!selected) {
				throw new Error(
					`${mega.name}: none of [` +
					`${slot.join(', ')}] are legal`
				);
			}

			moves.push(selected);
		}

		if (new Set(moves).size !== 4) {
			throw new Error(
				`${mega.name}: duplicate moves: ` +
				moves.join(', ')
			);
		}

		generatedSets.push({
			role: def.role,

			/*
			 * EXACTLY four moves.
			 *
			 * This is important: the normal RandBats generator
			 * no longer has extra junk moves available to pick
			 * from.
			 */
			movepool: moves,

			abilities,

			teraTypes: [
				...new Set(mega.types),
			],
		});
	}

	return {
		level: previous?.level || 80,
		sets: generatedSets,
	};
}

/*
 * Detect every current ZA Mega automatically.
 */

const zaMegas = dex.species.all()
	.filter(species => (
		species.exists &&
		species.isMega &&
		species.gen === 9 &&
		species.requiredItem
	))
	.sort(
		(a, b) =>
			a.num - b.num ||
			a.name.localeCompare(b.name)
	);

console.log('');
console.log('========================================');
console.log(' MANUAL ZA MEGA SET CURATOR');
console.log('========================================');
console.log('');

let singlesUpdated = 0;
let ffaUpdated = 0;

for (const mega of zaMegas) {
	const singlesDefs =
		getDefinitions(mega, false);

	if (!singlesDefs) {
		throw new Error(
			`\nNO MANUAL SET FOR:\n` +
			`Name: ${mega.name}\n` +
			`ID: ${mega.id}\n` +
			`Base: ${mega.baseSpecies}\n`
		);
	}

	const ffaDefs =
		getDefinitions(mega, true) ||
		singlesDefs;

	singles[mega.id] = makeEntry(
		mega,
		singlesDefs,
		singles[mega.id]
	);

	ffa[mega.id] = makeEntry(
		mega,
		ffaDefs,
		ffa[mega.id]
	);

	singlesUpdated++;
	ffaUpdated++;

	console.log(
		'✓',
		mega.name.padEnd(30),
		'|',
		Object.values(
			mega.abilities
		).join(' / ')
	);
}

fs.writeFileSync(
	singlesPath,
	JSON.stringify(
		singles,
		null,
		2
	) + '\n'
);

fs.writeFileSync(
	ffaPath,
	JSON.stringify(
		ffa,
		null,
		2
	) + '\n'
);

console.log('');
console.log(
	`ZA Megas found:   ${zaMegas.length}`
);
console.log(
	`Singles updated:  ${singlesUpdated}`
);
console.log(
	`FFA updated:      ${ffaUpdated}`
);
console.log('');
console.log(
	'All ZA Mega sets manually curated.'
);
