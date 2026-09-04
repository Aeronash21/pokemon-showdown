import fs from 'node:fs/promises';
import path from 'node:path';

/*
 * Priority:
 * newer/current singles formats first.
 *
 * National Dex is first because it is the closest match to our
 * all-generations Gen 9 singles environment.
 */
const SOURCES = [
	// Gen 9
	'gen9nationaldex',
	'gen9ou',
	'gen9ubers',
	'gen9anythinggoes',
	'gen9uu',
	'gen9ru',
	'gen9nu',
	'gen9pu',
	'gen9zu',
	'gen9nfe',
	'gen9battlestadiumsingles',

	// Gen 8
	'gen8nationaldex',
	'gen8ou',
	'gen8ubers',
	'gen8anythinggoes',
	'gen8uu',
	'gen8ru',
	'gen8nu',
	'gen8pu',
	'gen8zu',
	'gen8nfe',
	'gen8battlestadiumsingles',

	// Gen 7
	'gen7ou',
	'gen7ubers',
	'gen7anythinggoes',
	'gen7uu',
	'gen7ru',
	'gen7nu',
	'gen7pu',
	'gen7zu',
	'gen7nfe',
	'gen7battlespotsingles',

	// Gen 6
	'gen6ou',
	'gen6ubers',
	'gen6anythinggoes',
	'gen6uu',
	'gen6ru',
	'gen6nu',
	'gen6pu',
	'gen6zu',
	'gen6battlespotsingles',

	// Gen 5
	'gen5ou',
	'gen5ubers',
	'gen5uu',
	'gen5ru',
	'gen5nu',
	'gen5pu',
	'gen5zu',

	// Gen 4
	'gen4ou',
	'gen4ubers',
	'gen4uu',
	'gen4nu',
	'gen4pu',
	'gen4zu',

	// Gen 3
	'gen3ou',
	'gen3ubers',
	'gen3uu',
	'gen3ru',
	'gen3nu',
	'gen3pu',
	'gen3zu',
];

const BASE = 'https://data.pkmn.cc/sets';

const OUTPUT = path.resolve(
	'data/random-battles/gen9/extra-singles-sets.json'
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
			console.warn(`Skipping ${format}: HTTP ${response.status}`);
			continue;
		}

		const data = await response.json();
		let added = 0;

		for (const [speciesName, namedSets] of Object.entries(data)) {
			const id = toID(speciesName);

			// A higher-priority format already supplied this Pokémon.
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
		console.warn(`Could not download ${format}: ${error.message}`);
	}
}

if (!Object.keys(output).length) {
	throw new Error('No Smogon singles sets could be downloaded.');
}

await fs.mkdir(path.dirname(OUTPUT), {recursive: true});

await fs.writeFile(
	OUTPUT,
	JSON.stringify(output, null, 2) + '\n'
);

console.log(
	`\n✅ Saved singles sets for ${Object.keys(output).length} species`
);
console.log(`   ${OUTPUT}`);
