const fs = require('fs');
const path = require('path');

const {Dex} = require('../dist/sim/dex');

Dex.includeMods();

const dex = Dex.mod('ndsharedpower');

const root = path.resolve(__dirname, '..');

function load(rel) {
	return JSON.parse(
		fs.readFileSync(
			path.join(root, rel),
			'utf8'
		)
	);
}

function loadOptional(rel) {
	const file = path.join(root, rel);

	if (!fs.existsSync(file)) return {};

	return JSON.parse(
		fs.readFileSync(file, 'utf8')
	);
}

function clone(obj) {
	return structuredClone(obj);
}

function toID(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

const BANNED_ABILITIES =
	new Set([
		'shadowtag',
		'moody',
	]);

const gen9 = load(
	'data/random-battles/gen9/sets.json'
);

const gen9Doubles = load(
	'data/random-battles/gen9/doubles-sets.json'
);

const gen8 = loadOptional(
	'data/random-battles/gen8/sets.json'
);

const gen8Doubles = loadOptional(
	'data/random-battles/gen8/doubles-sets.json'
);

const gen7 = loadOptional(
	'data/random-battles/gen7/sets.json'
);

const gen7Doubles = loadOptional(
	'data/random-battles/gen7/doubles-sets.json'
);

/*
 * Gen 9 gets priority.
 * Older data fills Pokémon/formes not represented in Gen 9.
 */
const singles = clone(gen9);
const doubles = clone(gen9Doubles);

function mergeMissing(target, source) {
	for (
		const [id, data]
		of Object.entries(source)
	) {
		if (!target[id]) {
			target[id] = clone(data);
		}
	}
}

mergeMissing(singles, gen8);
mergeMissing(singles, gen7);

mergeMissing(
	doubles,
	gen8Doubles
);

mergeMissing(
	doubles,
	gen7Doubles
);

/*
 * Also import older Z-Move and Dynamax roles for species
 * which already exist in the modern database.
 */
function appendMatchingRoles(
	target,
	source,
	regex
) {
	for (
		const [id, data]
		of Object.entries(source)
	) {
		if (
			!target[id]?.sets ||
			!Array.isArray(data?.sets)
		) {
			continue;
		}

		for (const set of data.sets) {
			if (!regex.test(set.role || '')) continue;

			const signature =
				JSON.stringify({
					role: set.role,
					movepool:
						set.movepool || [],
				});

			const exists =
				target[id].sets.some(
					current =>
						JSON.stringify({
							role:
								current.role,
							movepool:
								current.movepool ||
								[],
						}) ===
						signature
				);

			if (!exists) {
				target[id].sets.push(
					clone(set)
				);
			}
		}
	}
}

appendMatchingRoles(
	singles,
	gen8,
	/Dynamax/i
);

appendMatchingRoles(
	singles,
	gen7,
	/Z[- ]?Move/i
);

appendMatchingRoles(
	doubles,
	gen8Doubles,
	/Dynamax/i
);

appendMatchingRoles(
	doubles,
	gen7Doubles,
	/Z[- ]?Move/i
);

/*
 * Convert old data into the current Gen 9 random-set schema.
 */
function normalizeMoves(moves) {
	const result = [];

	for (const name of moves || []) {
		const move =
			dex.moves.get(name);

		if (!move.exists) continue;

		if (!result.includes(move.name)) {
			result.push(move.name);
		}
	}

	return result;
}

function normalAbilityList(
	species,
	input
) {
	let abilities =
		Array.isArray(input)
			? input
			: [];

	if (!abilities.length) {
		abilities =
			Object.values(
				species.abilities || {}
			);
	}

	return unique(
		abilities
			.map(name => dex.abilities.get(name))
			.filter(
				ability =>
					ability.exists &&
					!BANNED_ABILITIES.has(
						ability.id
					)
			)
			.map(ability => ability.name)
	);
}

function normalizeTable(table) {
	for (
		const [id, data]
		of Object.entries(table)
	) {
		const species =
			dex.species.get(id);

		if (
			!species.exists ||
			!Array.isArray(data?.sets)
		) {
			delete table[id];
			continue;
		}

		const sets = [];

		for (const old of data.sets) {
			const movepool =
				normalizeMoves(
					old.movepool ||
					old.moves ||
					[]
				);

			if (movepool.length < 4) {
				continue;
			}

			const abilities =
				normalAbilityList(
					species,
					old.abilities
				);

			if (!abilities.length) {
				continue;
			}

			let teraTypes =
				old.teraTypes ||
				old.preferredTypes ||
				species.types;

			teraTypes =
				unique(
					teraTypes
						.map(type =>
							dex.types.get(type)
						)
						.filter(type =>
							type.exists
						)
						.map(type =>
							type.name
						)
				);

			if (!teraTypes.length) {
				teraTypes =
					[...species.types];
			}

			sets.push({
				role:
					old.role ||
					'Fast Attacker',

				movepool,

				abilities,

				teraTypes,
			});
		}

		if (!sets.length) {
			delete table[id];
			continue;
		}

		table[id] = {
			...(
				typeof data.level ===
				'number'
					? {
						level:
							data.level,
					}
					: {}
			),

			sets,
		};
	}
}

normalizeTable(singles);
normalizeTable(doubles);

/*
 * ===========================================================
 * COMPLETE THE FFA / DOUBLES POOL
 * ===========================================================
 *
 * Pokémon Showdown treats every non-Singles game type,
 * including Free-For-All, as isDoubles=true for Random Battles.
 *
 * randomSet() therefore reads randomDoublesSets rather than
 * randomSets for the FFA format.
 *
 * Official Random Doubles data does not contain every Pokémon,
 * so use the complete Singles National Dex database as a
 * fallback ONLY for species/formes which do not already have
 * dedicated Doubles data.
 *
 * Existing Doubles entries always win because mergeMissing()
 * never overwrites an existing entry.
 */
mergeMissing(doubles, singles);

/*
 * ===========================================================
 * ADD EVERY CURRENT GEN 9 / ZA MEGA
 * ===========================================================
 */
function ensureZAMegas(
	table,
	label
) {
	const megas =
		dex.species.all()
			.filter(
				species =>
					species.exists &&
					species.isMega &&
					species.gen === 9
			);

	let added = 0;

	for (const mega of megas) {
		if (table[mega.id]) continue;

		const possibleOrigins = [];

		if (
			Array.isArray(
				mega.battleOnly
			)
		) {
			possibleOrigins.push(
				...mega.battleOnly
			);
		} else if (mega.battleOnly) {
			possibleOrigins.push(
				mega.battleOnly
			);
		}

		if (mega.changesFrom) {
			possibleOrigins.push(
				mega.changesFrom
			);
		}

		if (mega.baseSpecies) {
			possibleOrigins.push(
				mega.baseSpecies
			);
		}

		let source;

		for (
			const origin
			of possibleOrigins
		) {
			const sourceID =
				toID(origin);

			if (table[sourceID]) {
				source =
					table[sourceID];
				break;
			}
		}

		if (!source) {
			console.warn(
				`⚠ ${label}: no source for ${mega.name}`
			);
			continue;
		}

		table[mega.id] =
			clone(source);

		added++;
	}

	console.log(
		`${label}: ${megas.length} ZA Mega formes; ` +
		`${added} newly inserted`
	);
}

ensureZAMegas(
	singles,
	'Singles'
);

ensureZAMegas(
	doubles,
	'FFA'
);

/*
 * ===========================================================
 * FORCE RADICALLY DIFFERENT ZA MEGA SETS
 * ===========================================================
 */

const FORCED_ZA = {

	raichumegax: [
		{
			role: 'Fast Attacker',
			moves: [
				'Volt Tackle',
				'Drain Punch',
				'Play Rough',
				'Knock Off',
			],
			teraTypes: [
				'Electric',
				'Fighting',
			],
		},
	],

	raichumegay: [
		{
			role: 'Fast Attacker',
			moves: [
				'Zap Cannon',
				'Focus Blast',
				'Surf',
				'Volt Switch',
			],
			teraTypes: [
				'Electric',
			],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Zap Cannon',
				'Focus Blast',
				'Grass Knot',
				'Substitute',
			],
			teraTypes: [
				'Electric',
			],
		},
	],

	starmiemega: [
		{
			role: 'Fast Attacker',
			moves: [
				'Liquidation',
				'Psycho Cut',
				'Flip Turn',
				'Aqua Jet',
			],
			teraTypes: [
				'Water',
				'Psychic',
			],
		},
		{
			role: 'Setup Sweeper',
			moves: [
				'Bulk Up',
				'Liquidation',
				'Psycho Cut',
				'Aqua Jet',
			],
			teraTypes: [
				'Water',
				'Psychic',
			],
		},
	],

	meganiummega: [
		{
			role: 'Bulky Attacker',
			moves: [
				'Solar Beam',
				'Weather Ball',
				'Dazzling Gleam',
				'Synthesis',
			],
			teraTypes: [
				'Grass',
				'Fairy',
				'Fire',
			],
		},
		{
			role: 'Bulky Attacker',
			moves: [
				'Solar Beam',
				'Weather Ball',
				'Earth Power',
				'Synthesis',
			],
			teraTypes: [
				'Grass',
				'Fairy',
			],
		},
	],

	feraligatrmega: [
		{
			role: 'Setup Sweeper',
			moves: [
				'Dragon Dance',
				'Double-Edge',
				'Liquidation',
				'Earthquake',
			],
			teraTypes: [
				'Water',
				'Dragon',
			],
		},
	],

	absolmegaz: [
		{
			role: 'Setup Sweeper',
			moves: [
				'Swords Dance',
				'Night Slash',
				'Psycho Cut',
				'Sucker Punch',
			],
			teraTypes: [
				'Dark',
				'Ghost',
			],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Night Slash',
				'Psycho Cut',
				'Close Combat',
				'Sucker Punch',
			],
			teraTypes: [
				'Dark',
				'Ghost',
			],
		},
	],

	staraptormega: [
		{
			role: 'Fast Attacker',
			moves: [
				'Close Combat',
				'Brave Bird',
				'U-turn',
				'Roost',
			],
			teraTypes: [
				'Fighting',
				'Flying',
			],
		},
	],

	garchompmegaz: [
		{
			role: 'Fast Attacker',
			moves: [
				'Draco Meteor',
				'Dragon Pulse',
				'Earth Power',
				'Fire Blast',
			],
			teraTypes: [
				'Dragon',
				'Ground',
			],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Draco Meteor',
				'Earth Power',
				'Fire Blast',
				'Stealth Rock',
			],
			teraTypes: [
				'Dragon',
				'Ground',
			],
		},
	],

	lucariomegaz: [
		{
			role: 'Setup Sweeper',
			moves: [
				'Nasty Plot',
				'Aura Sphere',
				'Flash Cannon',
				'Dark Pulse',
			],
			teraTypes: [
				'Fighting',
				'Steel',
			],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Aura Sphere',
				'Flash Cannon',
				'Dark Pulse',
				'Vacuum Wave',
			],
			teraTypes: [
				'Fighting',
				'Steel',
			],
		},
	],

	skarmorymega: [
		{
			role: 'Fast Attacker',
			moves: [
				'Brave Bird',
				'Iron Head',
				'Drill Run',
				'Roost',
			],
			teraTypes: [
				'Flying',
				'Steel',
			],
		},
		{
			role: 'Setup Sweeper',
			moves: [
				'Swords Dance',
				'Brave Bird',
				'Iron Head',
				'Roost',
			],
			teraTypes: [
				'Flying',
				'Steel',
			],
		},
	],
};

function forceSets(
	table,
	id,
	templates
) {
	const old = table[id];

	if (!old?.sets?.length) {
		console.warn(
			`⚠ Cannot force ${id}: missing`
		);
		return;
	}

	const oldAbilities =
		unique(
			old.sets.flatMap(
				set =>
					set.abilities || []
			)
		);

	table[id] = {
		...old,

		sets:
			templates.map(
				template => ({
					role:
						template.role,

					movepool:
						[...template.moves],

					abilities:
						[...oldAbilities],

					teraTypes:
						[
							...template.teraTypes,
						],
				})
			),
	};
}

for (
	const [id, templates]
	of Object.entries(FORCED_ZA)
) {
	forceSets(
		singles,
		id,
		templates
	);

	forceSets(
		doubles,
		id,
		templates
	);
}

/*
 * ===========================================================
 * ULTRA NECROZMA
 * ===========================================================
 */

function addUltraNecrozma(
	table,
	doublesMode
) {
	if (table.necrozmaultra?.sets?.length) {
		for (
			const set
			of table.necrozmaultra.sets
		) {
			set.abilities =
				['Prism Armor'];
		}

		return;
	}

	const ref =
		table.necrozmaduskmane ||
		table.necrozmadawnwings ||
		table.necrozma;

	const level =
		ref?.level ?? 72;

	table.necrozmaultra = {
		level,

		sets:
			doublesMode
				? [
					{
						role:
							'Setup Sweeper',

						movepool: [
							'Dragon Dance',
							'Photon Geyser',
							'Earthquake',
							'Protect',
						],

						abilities: [
							'Prism Armor',
						],

						teraTypes: [
							'Psychic',
							'Dragon',
							'Ground',
						],
					},
					{
						role:
							'Setup Sweeper',

						movepool: [
							'Calm Mind',
							'Photon Geyser',
							'Dragon Pulse',
							'Protect',
						],

						abilities: [
							'Prism Armor',
						],

						teraTypes: [
							'Psychic',
							'Dragon',
						],
					},
				]
				: [
					{
						role:
							'Setup Sweeper',

						movepool: [
							'Dragon Dance',
							'Photon Geyser',
							'Earthquake',
							'Knock Off',
						],

						abilities: [
							'Prism Armor',
						],

						teraTypes: [
							'Psychic',
							'Dragon',
							'Ground',
						],
					},
					{
						role:
							'Setup Sweeper',

						movepool: [
							'Calm Mind',
							'Photon Geyser',
							'Dragon Pulse',
							'Heat Wave',
						],

						abilities: [
							'Prism Armor',
						],

						teraTypes: [
							'Psychic',
							'Dragon',
						],
					},
				],
	};
}

addUltraNecrozma(
	singles,
	false
);

addUltraNecrozma(
	doubles,
	true
);

/*
 * ===========================================================
 * PRIMAL GROUDON + PRIMAL KYOGRE
 * ===========================================================
 */

function addPrimals(table) {
	if (!table.groudonprimal && table.groudon) {
		table.groudonprimal =
			clone(table.groudon);
	}

	if (table.groudonprimal) {
		for (
			const set
			of table.groudonprimal.sets
		) {
			set.abilities =
				['Drought'];
		}
	}

	if (!table.kyogreprimal && table.kyogre) {
		table.kyogreprimal =
			clone(table.kyogre);
	}

	if (table.kyogreprimal) {
		for (
			const set
			of table.kyogreprimal.sets
		) {
			set.abilities =
				['Drizzle'];
		}
	}
}

addPrimals(singles);
addPrimals(doubles);

/*
 * ===========================================================
 * CHOICE SCARF GALLADE
 * ===========================================================
 */

function addGalladeScarf(table) {
	if (!table.gallade?.sets) return;

	table.gallade.sets =
		table.gallade.sets.filter(
			set => {
				const moves =
					new Set(
						(set.movepool || [])
							.map(toID)
					);

				return !(
					moves.has('trick') &&
					moves.has('sacredsword') &&
					moves.has('psychocut')
				);
			}
		);

	table.gallade.sets.push(
		{
			role: 'Fast Attacker',

			movepool: [
				'Sacred Sword',
				'Psycho Cut',
				'Leaf Blade',
				'Trick',
			],

			abilities: [
				'Sharpness',
			],

			teraTypes: [
				'Fighting',
				'Psychic',
				'Steel',
				'Dark',
			],
		},

		{
			role: 'Fast Attacker',

			movepool: [
				'Sacred Sword',
				'Psycho Cut',
				'Knock Off',
				'Trick',
			],

			abilities: [
				'Sharpness',
			],

			teraTypes: [
				'Fighting',
				'Psychic',
				'Steel',
				'Dark',
			],
		}
	);
}

addGalladeScarf(singles);
addGalladeScarf(doubles);

/*
 * ===========================================================
 * STRONG STOUTLAND
 * ===========================================================
 */

function fixStoutland(table) {
	if (!table.stoutland) return;

	const level =
		table.stoutland.level;

	table.stoutland = {
		...(
			level !== undefined
				? {level}
				: {}
		),

		sets: [
			{
				role: 'Wallbreaker',

				movepool: [
					'Return',
					'Superpower',
					'Crunch',
					'Switcheroo',
				],

				abilities: [
					'Scrappy',
				],

				teraTypes: [
					'Normal',
					'Fighting',
				],
			},

			{
				role: 'Wallbreaker',

				movepool: [
					'Return',
					'Superpower',
					'Wild Charge',
					'Switcheroo',
				],

				abilities: [
					'Scrappy',
				],

				teraTypes: [
					'Normal',
					'Fighting',
				],
			},
		],
	};
}

fixStoutland(singles);
fixStoutland(doubles);

/*
 * ===========================================================
 * MEGA LEVEL BALANCING
 * ===========================================================
 */

const MEGA_LEVELS = {
	beedrillmega: 77,
	mawilemega: 76,
	medichammega: 76,
	kangaskhanmega: 74,
	salamencemega: 73,
	metagrossmega: 73,
	rayquazamega: 71,
	blazikenmega: 73,
	gengarmega: 77,
	pinsirmega: 72,
};

function applyLevels(table) {
	for (
		const [id, level]
		of Object.entries(MEGA_LEVELS)
	) {
		if (table[id]) {
			table[id].level =
				level;
		}
	}
}

applyLevels(singles);
applyLevels(doubles);

/*
 * ===========================================================
 * REMOVE BANNED SPECIES
 * ===========================================================
 */

function removeBannedSpecies(table) {
	delete table.shedinja;
	delete table.eternatuseternamax;
}

removeBannedSpecies(singles);
removeBannedSpecies(doubles);

/*
 * ===========================================================
 * REMOVE SHADOW TAG + MOODY EVERYWHERE
 * ===========================================================
 */

function getFallbackAbilities(id) {
	let species =
		dex.species.get(id);

	if (species.isMega) {
		const base =
			dex.species.get(
				species.baseSpecies
			);

		if (base.exists) {
			species = base;
		}
	}

	return unique(
		Object.values(
			species.abilities || {}
		)
			.map(name =>
				dex.abilities.get(name)
			)
			.filter(
				ability =>
					ability.exists &&
					!BANNED_ABILITIES.has(
						ability.id
					)
			)
			.map(ability =>
				ability.name
			)
	);
}

function cleanAbilities(table) {
	for (
		const [id, data]
		of Object.entries(table)
	) {
		if (!Array.isArray(data?.sets)) {
			continue;
		}

		const goodSets = [];

		for (const set of data.sets) {
			set.abilities =
				unique(
					(set.abilities || [])
						.filter(
							ability =>
								!BANNED_ABILITIES.has(
									toID(ability)
								)
						)
				);

			if (!set.abilities.length) {
				set.abilities =
					getFallbackAbilities(id);
			}

			if (set.abilities.length) {
				goodSets.push(set);
			}
		}

		data.sets =
			goodSets;

		if (!goodSets.length) {
			delete table[id];
		}
	}
}

cleanAbilities(singles);
cleanAbilities(doubles);

/*
 * Do this a second time after all transformations.
 */
removeBannedSpecies(singles);
removeBannedSpecies(doubles);

/*
 * ===========================================================
 * FINAL SANITY CHECK
 * ===========================================================
 */

function validate(table, label) {
	for (
		const [id, data]
		of Object.entries(table)
	) {
		if (!data.sets?.length) {
			throw new Error(
				`${label}: ${id} has no sets`
			);
		}

		for (const set of data.sets) {
			if (
				!set.movepool ||
				set.movepool.length < 4
			) {
				throw new Error(
					`${label}: ${id} has an invalid movepool`
				);
			}

			if (!set.abilities?.length) {
				throw new Error(
					`${label}: ${id} has no abilities`
				);
			}

			for (
				const ability
				of set.abilities
			) {
				if (
					BANNED_ABILITIES.has(
						toID(ability)
					)
				) {
					throw new Error(
						`${label}: ${id} still has ${ability}`
					);
				}
			}
		}
	}
}

validate(
	singles,
	'Singles'
);

validate(
	doubles,
	'FFA'
);

const outputDir =
	path.join(
		root,
		'data/random-battles/ndsharedpower'
	);

fs.mkdirSync(
	outputDir,
	{recursive: true}
);

fs.writeFileSync(
	path.join(
		outputDir,
		'sets.json'
	),

	JSON.stringify(
		singles,
		null,
		2
	) + '\n'
);

fs.writeFileSync(
	path.join(
		outputDir,
		'doubles-sets.json'
	),

	JSON.stringify(
		doubles,
		null,
		2
	) + '\n'
);

console.log('');
console.log(
	`Singles pool: ${Object.keys(singles).length} species/formes`
);

console.log(
	`FFA pool:     ${Object.keys(doubles).length} species/formes`
);

console.log(
	'National Dex Shared Power datasets created.'
);

// NDSP V4 final legality / FFA pass
require('./ndsp-v4-postprocess.cjs');
