import fs from 'node:fs/promises';
import path from 'node:path';

/*
 * Priority order:
 *
 * 1. Current Gen 9 National Dex Doubles
 * 2. Current Gen 9 doubles formats
 * 3. Previous-gen Doubles OU
 * 4. Previous-gen VGC / Battle Spot doubles
 *
 * The FIRST format containing a species wins.
 */
const SOURCES = [
	'gen9nationaldexdoubles',
	'gen9doublesou',
	'gen9vgc2025',
	'gen9vgc2024',
	'gen9vgc2023',

	'gen8doublesou',
	'gen8vgc2022',
	'gen8vgc2021',
	'gen8vgc2020',
	'gen8battlestadiumdoubles',

	'gen7doublesou',
	'gen7vgc2019',
	'gen7vgc2018',
	'gen7vgc2017',
	'gen7battlespotdoubles',

	'gen6doublesou',
	'gen6vgc2016',
	'gen6vgc2014',
	'gen6battlespotdoubles',

	'gen5doublesou',
	'gen5vgc2013',
	'gen5vgc2012',
	'gen5vgc2011',

	'gen4doublesou',
	'gen4vgc2010',
	'gen4vgc2009',

	'gen3doublesou',
];

const BASE = 'https://data.pkmn.cc/sets';
const OUTPUT = path.resolve(
	'data/random-battles/gen9ffa/extra-doubles-sets.json'
);

const toID = value =>
	String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

const output = {};

for (const format of SOURCES) {
	const url = `${BASE}/${format}.json`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			console.warn(
				`Skipping ${format}: HTTP ${response.status}`
			);
			continue;
		}

		const data = await response.json();
		let added = 0;

		for (const [speciesName, namedSets] of Object.entries(data)) {
			const id = toID(speciesName);

			// Higher-priority source already supplied this species.
			if (output[id]) continue;

			if (!namedSets || typeof namedSets !== 'object') continue;

			const sets = [];

			for (const [setName, set] of Object.entries(namedSets)) {
				if (!set || typeof set !== 'object') continue;
				if (!Array.isArray(set.moves) || !set.moves.length) continue;

				sets.push({
					source: format,
					setName,
					...set,
				});
			}

			if (sets.length) {
				output[id] = sets;
				added++;
			}
		}

		console.log(`${format}: added ${added} species`);
	} catch (error) {
		console.warn(`Could not download ${format}:`, error.message);
	}
}

if (!Object.keys(output).length) {
	throw new Error('No Smogon doubles sets could be downloaded.');
}

await fs.mkdir(path.dirname(OUTPUT), {recursive: true});
await fs.writeFile(
	OUTPUT,
	JSON.stringify(output, null, 2) + '\n'
);

console.log(
	`\n✅ Saved doubles sets for ${Object.keys(output).length} species`
);
console.log(`   ${OUTPUT}`);
