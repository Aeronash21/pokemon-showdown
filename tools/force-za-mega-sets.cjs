const fs = require('fs');
const path = require('path');

const singlesPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/sets.json'
);

const ffaPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/doubles-sets.json'
);

const singles = JSON.parse(fs.readFileSync(singlesPath, 'utf8'));
const ffa = JSON.parse(fs.readFileSync(ffaPath, 'utf8'));

/*
 * These are ONLY the ZA Megas whose new stats / ability
 * fundamentally change how the base Pokemon should be played.
 *
 * Every template contains exactly four moves.
 * Showdown's randomMoveset() therefore MUST use all four.
 */
const FORCED_SINGLES = {
	raichumegay: [
		{
			role: 'Fast Attacker',
			moves: [
				'Zap Cannon',
				'Focus Blast',
				'Surf',
				'Volt Switch',
			],
			teraTypes: ['Electric'],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Zap Cannon',
				'Focus Blast',
				'Grass Knot',
				'Substitute',
			],
			teraTypes: ['Electric'],
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
			teraTypes: ['Water', 'Psychic'],
		},
		{
			role: 'Setup Sweeper',
			moves: [
				'Bulk Up',
				'Liquidation',
				'Psycho Cut',
				'Aqua Jet',
			],
			teraTypes: ['Water', 'Psychic'],
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
			teraTypes: ['Grass', 'Fairy', 'Fire'],
		},
		{
			role: 'Bulky Attacker',
			moves: [
				'Solar Beam',
				'Weather Ball',
				'Earth Power',
				'Synthesis',
			],
			teraTypes: ['Grass', 'Fairy'],
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
			teraTypes: ['Water', 'Dragon'],
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
			teraTypes: ['Dark', 'Ghost'],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Night Slash',
				'Psycho Cut',
				'Close Combat',
				'Sucker Punch',
			],
			teraTypes: ['Dark', 'Ghost'],
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
			teraTypes: ['Fighting', 'Flying'],
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
			teraTypes: ['Dragon'],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Draco Meteor',
				'Earth Power',
				'Fire Blast',
				'Stealth Rock',
			],
			teraTypes: ['Dragon'],
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
			teraTypes: ['Fighting', 'Steel'],
		},
		{
			role: 'Fast Attacker',
			moves: [
				'Aura Sphere',
				'Flash Cannon',
				'Dark Pulse',
				'Vacuum Wave',
			],
			teraTypes: ['Fighting', 'Steel'],
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
			teraTypes: ['Flying', 'Steel'],
		},
		{
			role: 'Setup Sweeper',
			moves: [
				'Swords Dance',
				'Brave Bird',
				'Iron Head',
				'Roost',
			],
			teraTypes: ['Flying', 'Steel'],
		},
	],
};

/*
 * Start FFA with the same identity-focused sets.
 * We can then customise Protect / spread / support variants separately.
 */
const FORCED_FFA = structuredClone(FORCED_SINGLES);

function unique(arr) {
	return [...new Set(arr)];
}

function forceSpecies(table, id, templates) {
	const old = table[id];

	if (!old) {
		console.warn(`⚠ ${id}: not found`);
		return;
	}

	/*
	 * IMPORTANT:
	 * Keep the abilities that were already generated for the PRE-MEGA
	 * base Pokemon.
	 *
	 * Do NOT put Sharpness / No Guard / Huge Power etc here if the set
	 * enters battle as Absol / Raichu / Starmie.
	 *
	 * Mega Evolution itself supplies the Mega ability.
	 */
	const oldAbilities = unique(
		old.sets.flatMap(set => set.abilities || [])
	);

	const oldTeraTypes = unique(
		old.sets.flatMap(set => set.teraTypes || [])
	);

	table[id] = {
		...old,
		sets: templates.map(template => ({
			role:
				template.role ||
				old.sets[0]?.role ||
				'Fast Attacker',

			movepool: template.moves,

			teraTypes:
				template.teraTypes?.length
					? template.teraTypes
					: oldTeraTypes,

			abilities: oldAbilities,
		})),
	};

	console.log(
		`✓ Forced ${id}: ${templates.length} exact set(s)`
	);
}

console.log('');
console.log('=== HARD-FORCING ZA MEGA SETS ===');

for (const [id, templates] of Object.entries(FORCED_SINGLES)) {
	forceSpecies(singles, id, templates);
}

for (const [id, templates] of Object.entries(FORCED_FFA)) {
	forceSpecies(ffa, id, templates);
}

fs.writeFileSync(
	singlesPath,
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	ffaPath,
	JSON.stringify(ffa, null, 2) + '\n'
);

console.log('');
console.log('ZA Mega hard-force pass complete.');
