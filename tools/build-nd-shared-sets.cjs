'use strict';

const fs = require('fs');
const path = require('path');

const {Dex, toID} = require('../dist/sim/dex');
Dex.includeData();

const gen9Singles = require('../data/random-battles/gen9/sets.json');
const gen9Doubles = require('../data/random-battles/gen9/doubles-sets.json');
const gen8 = require('../data/random-battles/gen8/sets.json');
const gen7 = require('../data/random-battles/gen7/sets.json');

/*
 * NFEs deliberately allowed in the pool because they have genuine
 * competitive niches. Add/remove IDs here whenever desired.
 */
const VIABLE_NFES = new Set([
	'bisharp',
	'chansey',
	'clefairy',
	'dipplin',
	'doublade',
	'duraludon',
	'dusclops',
	'ferroseed',
	'gligar',
	'gurdurr',
	'magneton',
	'murkrow',
	'pikachu',
	'piloswine',
	'porygon2',
	'primeape',
	'qwilfishhisui',
	'rhydon',
	'roselia',
	'scyther',
	'sneasel',
	'sneaselhisui',
	'thwackey',
	'ursaring',
	'vullaby',
]);

const EXCLUDED_NONSTANDARD = new Set([
	'Future',
	'CAP',
	'LGPE',
	'Custom',
]);

function sourceInfo(id) {
	const sourceSpecies = Dex.species.get(id);
	if (!sourceSpecies.exists) return null;

	/*
	 * Gmax formes shouldn't be independent team members.
	 * Convert them to the ordinary species; Gigantamax is added
	 * by the random-team generator.
	 */
	let targetSpecies = sourceSpecies;
	if (sourceSpecies.forme === 'Gmax') {
		targetSpecies = Dex.species.get(sourceSpecies.baseSpecies);
	}

	if (!targetSpecies.exists) return null;

	if (
		EXCLUDED_NONSTANDARD.has(sourceSpecies.isNonstandard) ||
		EXCLUDED_NONSTANDARD.has(targetSpecies.isNonstandard)
	) {
		return null;
	}

	if (targetSpecies.natDexTier === 'Illegal') return null;

	if (targetSpecies.nfe && !VIABLE_NFES.has(targetSpecies.id)) {
		return null;
	}

	return {
		sourceSpecies,
		targetSpecies,
		targetId: targetSpecies.id,
	};
}

function preBattleSpecies(species) {
	if (species.forme === 'Gmax') {
		return Dex.species.get(species.baseSpecies);
	}

	if (typeof species.battleOnly === 'string') {
		const base = Dex.species.get(species.battleOnly);
		if (base.exists) return base;
	}

	if (Array.isArray(species.battleOnly)) {
		const base = Dex.species.get(species.baseSpecies);
		if (base.exists) return base;
	}

	return species;
}

function normalizeSet(sourceSpecies, set) {
	const baseSpecies = preBattleSpecies(sourceSpecies);

	const legalAbilities = [...new Set(
		Object.values(baseSpecies.abilities || {}).filter(Boolean)
	)];

	let abilities = (set.abilities || []).filter(
		ability => legalAbilities.includes(ability)
	);

	if (!abilities.length) {
		abilities = legalAbilities;
	}

	const movepool = [...new Set(
		(set.movepool || [])
			.map(move => Dex.moves.get(move))
			.filter(move => move.exists)
			.map(move => move.name)
	)];

	if (movepool.length < 4) return null;

	let teraTypes =
		set.teraTypes ||
		set.preferredTypes ||
		sourceSpecies.types ||
		['Normal'];

	if (!Array.isArray(teraTypes)) teraTypes = [teraTypes];

	teraTypes = [...new Set(
		teraTypes.filter(type =>
			type &&
			type !== 'Stellar' &&
			Dex.types.get(type).exists
		)
	)];

	if (!teraTypes.length) {
		teraTypes = sourceSpecies.types.slice();
	}

	return {
		role: set.role || 'Bulky Attacker',
		movepool,
		abilities,
		teraTypes,
	};
}

function normalizeEntry(id, entry) {
	const info = sourceInfo(id);
	if (!info || !entry?.sets?.length) return null;

	const sets = entry.sets
		.map(set => normalizeSet(info.sourceSpecies, set))
		.filter(Boolean);

	if (!sets.length) return null;

	return {
		id: info.targetId,
		entry: {
			level: entry.level || 80,
			sets,
		},
	};
}

function insert(out, source, onlyIfMissing = false) {
	for (const [id, rawEntry] of Object.entries(source)) {
		const normalized = normalizeEntry(id, rawEntry);
		if (!normalized) continue;

		const {id: targetId, entry} = normalized;

		if (onlyIfMissing && out[targetId]) continue;

		if (!out[targetId]) {
			out[targetId] = entry;
		} else if (!onlyIfMissing) {
			out[targetId].sets.push(...entry.sets);
		}
	}
}

function appendMatchingRoles(out, source, rolePattern) {
	for (const [id, rawEntry] of Object.entries(source)) {
		const info = sourceInfo(id);
		if (!info) continue;

		const chosenSets = (rawEntry.sets || []).filter(
			set => rolePattern.test(String(set.role || ''))
		);

		if (!chosenSets.length) continue;

		const normalized = normalizeEntry(id, {
			level: rawEntry.level,
			sets: chosenSets,
		});

		if (!normalized) continue;

		if (!out[normalized.id]) {
			out[normalized.id] = normalized.entry;
		} else {
			out[normalized.id].sets.push(...normalized.entry.sets);
		}
	}
}

function cleanup(out) {
	for (const [id, entry] of Object.entries(out)) {
		const seen = new Set();

		entry.sets = entry.sets.filter(set => {
			const key = JSON.stringify([
				set.role,
				set.movepool,
				set.abilities,
				set.teraTypes,
			]);

			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		if (!entry.sets.length) delete out[id];
	}
}

const singles = {};

/* Prefer present-day Gen 9 sets. */
insert(singles, gen9Singles);

/* Fill Pokémon missing from Gen 9 using progressively older RandBats data. */
insert(singles, gen8, true);
insert(singles, gen7, true);

/* Reintroduce curated old transformation-oriented roles. */
appendMatchingRoles(singles, gen8, /Dynamax/i);
appendMatchingRoles(singles, gen7, /Z[- ]?Move/i);

cleanup(singles);

/*
 * FFA starts from current doubles-oriented sets, then fills gaps
 * from the complete National Dex singles collection.
 */
const doubles = {};

insert(doubles, gen9Doubles);

for (const [id, entry] of Object.entries(singles)) {
	if (!doubles[id]) {
		doubles[id] = JSON.parse(JSON.stringify(entry));
	}
}

/* Also make Z/Dynamax-oriented sets available in FFA. */
appendMatchingRoles(doubles, gen8, /Dynamax/i);
appendMatchingRoles(doubles, gen7, /Z[- ]?Move/i);

cleanup(doubles);

const outputDir = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower'
);

fs.mkdirSync(outputDir, {recursive: true});

fs.writeFileSync(
	path.join(outputDir, 'sets.json'),
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	path.join(outputDir, 'doubles-sets.json'),
	JSON.stringify(doubles, null, 2) + '\n'
);

console.log(`Singles pool: ${Object.keys(singles).length} species/formes`);
console.log(`FFA pool:     ${Object.keys(doubles).length} species/formes`);
console.log('National Dex Shared Power datasets created.');

require('./add-za-megas.cjs');
require('./force-za-mega-sets.cjs');

require('./add-special-forms.cjs');

require('./patch-banned-abilities-gallade.cjs');

require('./fix-stoutland.cjs');
