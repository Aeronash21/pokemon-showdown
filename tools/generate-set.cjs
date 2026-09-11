const {Dex} =
	require('../dist/sim/dex');

Dex.includeFormats();

const RandomTeams =
	require(
		'../dist/data/random-battles/ndsharedpower/teams'
	).default;

const pokemon =
	process.argv[2];

const count =
	Number(
		process.argv[3] || 10
	);

const mode =
	String(
		process.argv[4] || 'singles'
	).toLowerCase();

if (!pokemon) {
	console.error(
		'Usage: node tools/generate-set.cjs "Pokemon" 10 [singles|ffa]'
	);
	process.exit(1);
}

const formatID =
	mode === 'ffa'
		? 'gen9ndsharedpowerffa'
		: 'gen9ndsharedpowerrandbats';

const format =
	Dex.formats.get(
		formatID
	);

const generator =
	new RandomTeams(
		format
	);

const species =
	generator.dex.species.get(
		pokemon
	);

if (!species.exists) {
	console.error(
		`Unknown Pokémon: ${pokemon}`
	);
	process.exit(1);
}

const isFFA =
	format.gameType !== 'singles';

console.log('');
console.log(
	'========================================'
);

console.log(
	species.name
);

console.log(
	`${isFFA ? 'FFA' : 'Singles'} - ${count} generated sets`
);

console.log(
	'========================================'
);

console.log('');

for (
	let i = 1;
	i <= count;
	i++
) {
	const set =
		generator.randomSet(
			species,
			{},
			false,
			isFFA
		);

	console.log(`SET ${i}`);
	console.log(
		`Species: ${set.species}`
	);
	console.log(
		`Item: ${set.item || 'None'}`
	);
	console.log(
		`Ability: ${set.ability}`
	);
	console.log(
		`Level: ${set.level}`
	);
	console.log(
		`Tera Type: ${set.teraType || 'None'}`
	);
	console.log(
		`Role: ${set.role || 'None'}`
	);

	console.log('Moves:');

	for (const move of set.moves) {
		console.log(
			`  - ${generator.dex.moves.get(move).name}`
		);
	}

	if (set.gigantamax) {
		console.log(
			'Gigantamax: Yes'
		);
	}

	console.log('');
}
