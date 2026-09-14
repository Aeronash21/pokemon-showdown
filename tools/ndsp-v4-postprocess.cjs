'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower'
);

const singlesPath = path.join(root, 'sets.json');
const ffaPath = path.join(root, 'doubles-sets.json');

const singles = JSON.parse(
	fs.readFileSync(singlesPath, 'utf8')
);

const ffa = JSON.parse(
	fs.readFileSync(ffaPath, 'utf8')
);

const normalize = text =>
	String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

const bannedSpecies = new Set([
	'gengarmega',
	'shedinja',
	'eternatuseternamax',
	'groudonprimal',
	'kyogreprimal',
]);

const bannedAbilities = new Set([
	'shadowtag',
	'arenatrap',
	'simple',
	'moody',
]);

function removeGengariteSets(table, label) {
	let removed = 0;

	for (const [id, entry] of Object.entries(table)) {
		if (!Array.isArray(entry.sets)) continue;

		entry.sets = entry.sets.filter(set => {
			if (normalize(set.item) === 'gengarite') {
				removed++;
				return false;
			}

			return true;
		});

		if (!entry.sets.length) {
			delete table[id];
		}
	}

	console.log(
		`${label}: removed ${removed} Gengarite templates`
	);
}

// NDSP GENGARITE FILTER

function cleanTable(table, label) {
	for (const id of bannedSpecies) {
		delete table[id];
	}

	let removedAbilitySets = 0;

	for (const [id, entry] of Object.entries(table)) {
		if (!Array.isArray(entry.sets)) continue;

		entry.sets = entry.sets.filter(set => {
			if (Array.isArray(set.abilities)) {
				set.abilities = set.abilities.filter(
					a => !bannedAbilities.has(normalize(a))
				);

				if (!set.abilities.length) {
					removedAbilitySets++;
					return false;
				}
			} else if (
				typeof set.abilities === 'string' &&
				bannedAbilities.has(normalize(set.abilities))
			) {
				removedAbilitySets++;
				return false;
			}

			return true;
		});

		if (!entry.sets.length) {
			delete table[id];
		}
	}

	console.log(
		`${label}: removed ${removedAbilitySets} banned-ability templates`
	);
}

/*
 * Spotlight's legitimate main-series learners:
 *
 * Clefairy
 * Clefable
 * Starmie
 * Lanturn
 * Morelull
 * Shiinotic
 * Spinda
 *
 * FFA only.
 */
const spotlightSpecies = new Set([
	'clefairy',
	'clefable',
	'starmie',
	'lanturn',
	'morelull',
	'shiinotic',
	'spinda',
]);

let spotlightTemplates = 0;

for (const id of spotlightSpecies) {
	const entry = ffa[id];

	if (!entry?.sets) continue;

	for (const set of entry.sets) {
		if (!Array.isArray(set.movepool)) {
			set.movepool = [];
		}

		if (
			!set.movepool.some(
				move => normalize(move) === 'spotlight'
			)
		) {
			set.movepool.push('Spotlight');
		}

		spotlightTemplates++;
	}
}

removeGengariteSets(singles, 'Singles');
removeGengariteSets(ffa, 'FFA');

cleanTable(singles, 'Singles');
cleanTable(ffa, 'FFA');

fs.writeFileSync(
	singlesPath,
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	ffaPath,
	JSON.stringify(ffa, null, 2) + '\n'
);

console.log(
	`FFA Spotlight-enabled templates: ${spotlightTemplates}`
);

console.log(
	`Singles final pool: ${Object.keys(singles).length}`
);

console.log(
	`FFA final pool:     ${Object.keys(ffa).length}`
);
