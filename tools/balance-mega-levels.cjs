const fs = require('fs');
const path = require('path');

const singlesPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/sets.json'
);

const doublesPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/doubles-sets.json'
);

const singles = JSON.parse(fs.readFileSync(singlesPath, 'utf8'));
const doubles = JSON.parse(fs.readFileSync(doublesPath, 'utf8'));

/*
 * Only put forms here when Mega Evolution causes a very large
 * increase in practical strength.
 *
 * These levels belong to the MEGA entry, not the base Pokemon.
 */
const LEVEL_OVERRIDES = {

	// Huge transformations
	beedrillmega: 77,
	mawilemega: 76,

	// Huge Power / Pure Power style offensive jumps
	medichammega: 76,

	// Very powerful old Megas
	kangaskhanmega: 74,
	salamencemega: 73,
	metagrossmega: 73,

	// Extremely powerful battle-only transformation
	rayquazamega: 71,

	// Strong offensive Megas
	blazikenmega: 73,
	gengarmega: 77,
	pinsirmega: 72,
};

/*
 * ZA Megas currently use their own balancing.
 *
 * Do NOT put all of them at one level forever.
 * We can individually lower exceptionally strong ones later.
 */
const ZA_LEVEL_OVERRIDES = {
	// Examples — leave commented until testing says they need it:
	// magearnamega: 72,
	// darkraimega: 73,
	// heatranmega: 74,
	// zeraoramega: 75,
};

function applyLevels(table, label) {
	console.log(`\n--- ${label} ---`);

	const allOverrides = {
		...LEVEL_OVERRIDES,
		...ZA_LEVEL_OVERRIDES,
	};

	for (const [id, level] of Object.entries(allOverrides)) {
		if (!table[id]) {
			console.log(`- ${id}: not present`);
			continue;
		}

		const oldLevel = table[id].level ?? 80;

		table[id].level = level;

		console.log(
			`✓ ${id}: Lv${oldLevel} -> Lv${level}`
		);
	}
}

console.log('');
console.log('========================================');
console.log(' MEGA LEVEL BALANCING');
console.log('========================================');

applyLevels(singles, 'Singles');
applyLevels(doubles, 'FFA / Doubles');

fs.writeFileSync(
	singlesPath,
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	doublesPath,
	JSON.stringify(doubles, null, 2) + '\n'
);

console.log('\nMega level balancing complete.');
