'use strict';

const fs = require('fs');
const path = require('path');

const {Dex} = require('../dist/sim/dex');

Dex.includeMods();

const dex = Dex.mod('ndsharedpower');

const afdSets = require('../data/mods/afd/sets.json');

const dataDir = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower'
);

const singlesFile = path.join(dataDir, 'sets.json');
const doublesFile = path.join(dataDir, 'doubles-sets.json');

const singles = JSON.parse(fs.readFileSync(singlesFile, 'utf8'));
const doubles = JSON.parse(fs.readFileSync(doublesFile, 'utf8'));

/*
 * PokeRogue fallback abilities for Megas which do not yet have
 * officially revealed traditional-battle abilities.
 *
 * This is the Mega ability, not necessarily the pre-Mega ability.
 */
const FALLBACK_MEGA_ABILITIES = {
	zygardemega: 'Aura Break',
	heatranmega: 'Flash Fire',
	darkraimega: 'Bad Dreams',
	magearnamega: 'Soul-Heart',
	magearnaoriginalmega: 'Soul-Heart',
	zeraoramega: 'Volt Absorb',
	tatsugiricurlymega: 'Storm Drain',
	tatsugiridroopymega: 'Storm Drain',
	tatsugiristretchymega: 'Storm Drain',
};

function uniq(arr) {
	return [...new Set(arr)];
}

function getStartingSpecies(mega) {
	if (typeof mega.battleOnly === 'string') {
		return dex.species.get(mega.battleOnly);
	}

	if (Array.isArray(mega.battleOnly) && mega.battleOnly.length) {
		return dex.species.get(mega.battleOnly[0]);
	}

	return dex.species.get(mega.baseSpecies);
}

function getPreMegaAbilities(base, mega) {
	/*
	 * Mega Zygarde should not start with Power Construct or it can
	 * interfere with the intended Mega transformation.
	 */
	if (mega.id === 'zygardemega') {
		return ['Aura Break'];
	}

	/*
	 * Commander does nothing useful in Singles/FFA here, so Mega
	 * Tatsugiri uses Storm Drain before Mega Evolution too.
	 */
	if (mega.id.startsWith('tatsugiri') && mega.id.endsWith('mega')) {
		return ['Storm Drain'];
	}

	const abilities = uniq(Object.values(base.abilities).filter(Boolean));

	const legal = abilities.filter(name => {
		const ability = dex.abilities.get(name);
		return (
			ability.exists &&
			ability.isNonstandard !== 'Custom' &&
			ability.isNonstandard !== 'Future'
		);
	});

	return legal.length ? legal : abilities;
}

function findAFDSource(mega) {
	if (afdSets[mega.id]) return afdSets[mega.id];

	/*
	 * Some Megas have multiple cosmetic/base formes but AFD only
	 * needs one representative set. Reuse that movepool.
	 */
	const siblings = dex.species.all().filter(other => (
		other.isMega &&
		other.gen === 9 &&
		other.baseSpecies === mega.baseSpecies &&
		afdSets[other.id]
	));

	if (siblings.length) {
		return afdSets[siblings[0].id];
	}

	return null;
}

function cleanMoves(moves, base) {
	const legalMovePool = dex.species.getMovePool(base.id, true);

	return uniq(
		(moves || [])
			.map(name => dex.moves.get(name))
			.filter(move => (
				move.exists &&
				move.isNonstandard !== 'Custom' &&
				move.isNonstandard !== 'Future' &&
				legalMovePool.has(move.id)
			))
			.map(move => move.name)
	);
}

function getExtraMoves(database, base, current) {
	const currentIDs = new Set(current.map(x => dex.moves.get(x).id));
	const candidates = [];

	const existing = database[base.id];

	if (existing?.sets) {
		for (const set of existing.sets) {
			for (const moveName of set.movepool || []) {
				const move = dex.moves.get(moveName);

				if (
					move.exists &&
					!currentIDs.has(move.id)
				) {
					candidates.push(move.name);
				}
			}
		}
	}

	return uniq(candidates);
}

function fallbackMoveScore(move, mega) {
	let score = 0;

	const physical = mega.baseStats.atk;
	const special = mega.baseStats.spa;

	if (move.category === 'Physical') {
		score += move.basePower || 0;
		if (physical >= special) score += 35;
	}

	if (move.category === 'Special') {
		score += move.basePower || 0;
		if (special >= physical) score += 35;
	}

	if (mega.types.includes(move.type)) score += 40;
	if (move.priority > 0) score += 12;

	const usefulStatus = new Set([
		'agility',
		'auroraveil',
		'bulkup',
		'calmmind',
		'dragondance',
		'encore',
		'glare',
		'irondefense',
		'leechseed',
		'nastyplot',
		'protect',
		'rapidspin',
		'recover',
		'roost',
		'shellsmash',
		'spikes',
		'stealthrock',
		'strengthsap',
		'swordsdance',
		'synthesis',
		'thunderwave',
		'toxic',
		'toxicspikes',
		'willowisp',
	]);

	if (usefulStatus.has(move.id)) score += 100;

	return score;
}

function supplementMoves(database, base, mega, moves) {
	const legalPool = dex.species.getMovePool(base.id, true);
	const seen = new Set(moves.map(x => dex.moves.get(x).id));

	for (const moveName of getExtraMoves(database, base, moves)) {
		if (moves.length >= 5) break;

		const move = dex.moves.get(moveName);

		if (
			move.exists &&
			legalPool.has(move.id) &&
			move.isNonstandard !== 'Custom' &&
			move.isNonstandard !== 'Future' &&
			!seen.has(move.id)
		) {
			moves.push(move.name);
			seen.add(move.id);
		}
	}

	if (moves.length >= 4) return moves;

	const fallback = [...legalPool]
		.map(id => dex.moves.get(id))
		.filter(move => (
			move.exists &&
			move.isNonstandard !== 'Custom' &&
			move.isNonstandard !== 'Future' &&
			!seen.has(move.id)
		))
		.sort((a, b) =>
			fallbackMoveScore(b, mega) -
			fallbackMoveScore(a, mega)
		);

	for (const move of fallback) {
		if (moves.length >= 4) break;

		moves.push(move.name);
		seen.add(move.id);
	}

	return moves;
}

function makeEntry(database, mega) {
	const source = findAFDSource(mega);

	if (!source?.sets?.length) {
		console.warn(`No source sets found for ${mega.name}`);
		return null;
	}

	const base = getStartingSpecies(mega);

	if (!base.exists) {
		console.warn(`No base species found for ${mega.name}`);
		return null;
	}

	const abilities = getPreMegaAbilities(base, mega);

	const sets = [];

	for (const sourceSet of source.sets) {
		let movepool = cleanMoves(sourceSet.movepool, base);

		movepool = supplementMoves(
			database,
			base,
			mega,
			movepool
		);

		if (movepool.length < 4) {
			console.warn(
				`Skipping ${mega.name} ${sourceSet.role}: only ` +
				`${movepool.length} legal moves`
			);
			continue;
		}

		sets.push({
			role: sourceSet.role,
			movepool,
			abilities,
			/*
			 * If the player chooses not to Mega and instead
			 * Terastallizes, STAB-oriented Tera types are sensible.
			 */
			teraTypes: uniq([
				...base.types,
				...mega.types,
			]),
		});
	}

	if (!sets.length) return null;

	return {
		level: source.level || 80,
		sets,
	};
}

const zaMegas = dex.species.all()
	.filter(species => (
		species.exists &&
		species.isMega &&
		species.gen === 9 &&
		species.requiredItem
	))
	.sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));

let addedSingles = 0;
let addedDoubles = 0;

for (const mega of zaMegas) {
	const singlesEntry = makeEntry(singles, mega);
	const doublesEntry = makeEntry(doubles, mega);

	if (singlesEntry) {
		singles[mega.id] = singlesEntry;
		addedSingles++;
	}

	if (doublesEntry) {
		doubles[mega.id] = doublesEntry;
		addedDoubles++;
	}

	const megaAbility =
		FALLBACK_MEGA_ABILITIES[mega.id] ||
		Object.values(mega.abilities)[0];

	const source =
		FALLBACK_MEGA_ABILITIES[mega.id]
			? 'PokeRogue fallback'
			: 'official/current Showdown';

	console.log(
		`${mega.name.padEnd(28)} ` +
		`@ ${mega.requiredItem.padEnd(20)} ` +
		`-> ${megaAbility} [${source}]`
	);
}

fs.writeFileSync(
	singlesFile,
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	doublesFile,
	JSON.stringify(doubles, null, 2) + '\n'
);

console.log('');
console.log(`ZA Mega formes found: ${zaMegas.length}`);
console.log(`Added to Singles:      ${addedSingles}`);
console.log(`Added to FFA pool:     ${addedDoubles}`);
