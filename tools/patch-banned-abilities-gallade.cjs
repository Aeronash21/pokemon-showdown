const fs = require('fs');
const path = require('path');

const files = [
	{
		name: 'Singles',
		path: path.resolve(
			__dirname,
			'../data/random-battles/ndsharedpower/sets.json'
		),
		doubles: false,
	},
	{
		name: 'FFA / Doubles',
		path: path.resolve(
			__dirname,
			'../data/random-battles/ndsharedpower/doubles-sets.json'
		),
		doubles: true,
	},
];

function toID(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

const BANNED_ABILITIES = new Set([
	'shadowtag',
	'moody',
]);

function removeBannedAbilities(table) {
	let removed = 0;
	let removedSets = 0;
	let removedSpecies = 0;

	for (const [speciesId, data] of Object.entries(table)) {
		if (!data || !Array.isArray(data.sets)) continue;

		const keptSets = [];

		for (const set of data.sets) {
			if (!Array.isArray(set.abilities)) {
				keptSets.push(set);
				continue;
			}

			const oldAbilities = [...set.abilities];

			set.abilities = set.abilities.filter(
				ability => !BANNED_ABILITIES.has(toID(ability))
			);

			removed += oldAbilities.length - set.abilities.length;

			if (!set.abilities.length) {
				console.warn(
					`  ${speciesId}: removed a set because its only abilities were banned`
				);
				removedSets++;
				continue;
			}

			keptSets.push(set);
		}

		data.sets = keptSets;

		if (!data.sets.length) {
			delete table[speciesId];
			removedSpecies++;
			console.warn(
				`  ${speciesId}: removed because no usable sets remain`
			);
		}
	}

	console.log(`✓ Removed ${removed} banned ability entries`);
	if (removedSets) console.log(`  Removed ${removedSets} unusable set(s)`);
	if (removedSpecies) console.log(`  Removed ${removedSpecies} empty species`);
}

function addGalladeScarf(table, doubles) {
	const gallade = table.gallade;

	if (!gallade || !Array.isArray(gallade.sets)) {
		console.warn('⚠ Gallade not found');
		return;
	}

	/*
	 * Prevent duplicate scarf templates if this script is ever run
	 * multiple times without regenerating the JSON first.
	 */
	gallade.sets = gallade.sets.filter(set => {
		const moves = new Set(
			(set.movepool || []).map(toID)
		);

		const scarfSignature =
			moves.has('trick') &&
			moves.has('sacredsword') &&
			moves.has('psychocut');

		return !scarfSignature;
	});

	const role = 'Fast Attacker';

	gallade.sets.push(
		{
			role,
			movepool: [
				'Sacred Sword',
				'Psycho Cut',
				'Leaf Blade',
				'Trick',
			],
			abilities: ['Sharpness'],
			teraTypes: [
				'Fighting',
				'Psychic',
				'Steel',
				'Dark',
			],
		},
		{
			role,
			movepool: [
				'Sacred Sword',
				'Psycho Cut',
				'Knock Off',
				'Trick',
			],
			abilities: ['Sharpness'],
			teraTypes: [
				'Fighting',
				'Psychic',
				'Steel',
				'Dark',
			],
		}
	);

	console.log(
		`✓ Added 2 Choice Scarf Gallade templates${doubles ? ' to FFA' : ''}`
	);
}

for (const file of files) {
	if (!fs.existsSync(file.path)) {
		throw new Error(`Missing ${file.path}`);
	}

	const table = JSON.parse(
		fs.readFileSync(file.path, 'utf8')
	);

	console.log(`\n--- ${file.name} ---`);

	addGalladeScarf(table, file.doubles);

	/*
	 * Do this LAST so Moody / Shadow Tag cannot survive this pass.
	 */
	removeBannedAbilities(table);

	fs.writeFileSync(
		file.path,
		JSON.stringify(table, null, 2) + '\n'
	);
}

console.log('\n✓ Moody / Shadow Tag + Gallade patch complete');
