'use strict';

const {Dex} = require('../dist/sim/dex');
const {
	NDSharedPowerTeams,
} = require('../dist/data/random-battles/ndsharedpower/teams');

Dex.includeMods();
Dex.includeFormats();

const pokemonName = process.argv[2];
const count = Number(process.argv[3] || 10);
const mode = (process.argv[4] || 'singles').toLowerCase();

if (!pokemonName) {
	console.log('');
	console.log('Usage:');
	console.log('  node tools/generate-set.cjs "Hydreigon" 10');
	console.log('  node tools/generate-set.cjs "Charizard-Mega-X" 10');
	console.log('  node tools/generate-set.cjs "Dragonite-Mega" 20');
	console.log('  node tools/generate-set.cjs "Hydreigon" 10 ffa');
	console.log('');
	process.exit(1);
}

const isFFA = mode === 'ffa';
const format = isFFA
	? 'gen9ndsharedpowerffa'
	: 'gen9ndsharedpowerrandbats';

const generator = new NDSharedPowerTeams(format, null);
const species = generator.dex.species.get(pokemonName);

if (!species.exists) {
	console.error(`Unknown Pokémon: ${pokemonName}`);
	process.exit(1);
}

const database = isFFA
	? generator.randomDoublesSets
	: generator.randomSets;

if (!database[species.id]) {
	console.error('');
	console.error(`${species.name} is not in the ${isFFA ? 'FFA' : 'Singles'} random-set database.`);
	console.error(`ID: ${species.id}`);
	console.error('');
	process.exit(1);
}

console.log('');
console.log(`========================================`);
console.log(`${species.name}`);
console.log(`${isFFA ? 'FFA' : 'Singles'} - ${count} generated sets`);
console.log(`========================================`);
console.log('');

for (let i = 1; i <= count; i++) {
	try {
		const set = generator.randomSet(
			species,
			{},
			false,
			isFFA
		);

		console.log(`SET ${i}`);
		console.log(`Species: ${set.species}`);
		console.log(`Item: ${set.item || 'None'}`);
		console.log(`Ability: ${set.ability}`);
		console.log(`Level: ${set.level}`);
		console.log(`Tera Type: ${set.teraType || 'None'}`);
		console.log(`Role: ${set.role || 'None'}`);
		console.log(`Moves:`);

		for (const move of set.moves) {
			console.log(`  - ${generator.dex.moves.get(move).name}`);
		}

		if (set.gigantamax) {
			console.log(`Gigantamax: Yes`);
		}

		console.log('');
	} catch (err) {
		console.error(`Failed to generate set ${i}:`);
		console.error(err);
		process.exit(1);
	}
}
