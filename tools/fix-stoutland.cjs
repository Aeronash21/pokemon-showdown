const fs = require('fs');
const path = require('path');

const files = [
	{
		name: 'Singles',
		path: path.resolve(
			__dirname,
			'../data/random-battles/ndsharedpower/sets.json'
		),
	},
	{
		name: 'FFA / Doubles',
		path: path.resolve(
			__dirname,
			'../data/random-battles/ndsharedpower/doubles-sets.json'
		),
	},
];

for (const file of files) {
	const table = JSON.parse(fs.readFileSync(file.path, 'utf8'));

	if (!table.stoutland) {
		console.warn(`⚠ Stoutland missing from ${file.name}`);
		continue;
	}

	/*
	 * Preserve its current balancing level.
	 * We only replace the weak movesets.
	 */
	const oldLevel = table.stoutland.level;

	table.stoutland = {
		...(oldLevel !== undefined ? {level: oldLevel} : {}),

		sets: [
			/*
			 * Classic Scrappy Choice Band wallbreaker.
			 *
			 * Four moves means Showdown uses all four exactly.
			 * Wallbreaker + four physical attacks causes the normal
			 * item logic to heavily favour / select Choice Band.
			 */
			{
				role: 'Wallbreaker',

				movepool: [
					'Return',
					'Superpower',
					'Crunch',
					'Wild Charge',
				],

				abilities: [
					'Scrappy',
				],

				teraTypes: [
					'Normal',
					'Fighting',
				],
			},

			/*
			 * Alternative coverage version.
			 * Psychic Fangs gives it another strong physical option
			 * and also has useful screen-breaking utility.
			 */
			{
				role: 'Wallbreaker',

				movepool: [
					'Return',
					'Superpower',
					'Crunch',
					'Psychic Fangs',
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

	fs.writeFileSync(
		file.path,
		JSON.stringify(table, null, 2) + '\n'
	);

	console.log(`✓ Replaced weak Stoutland sets in ${file.name}`);
}

console.log('\n✓ Stoutland fix complete');
