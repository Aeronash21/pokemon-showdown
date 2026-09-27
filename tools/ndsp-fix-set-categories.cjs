'use strict';

/*
 * ===========================================================
 * NDSP SET CATEGORY FIXER
 * ===========================================================
 *
 * The NDSP pools merge Gen 9, Gen 8 and Gen 7 random-battle
 * data. The Gen 9 generator does not cull mismatched attacks
 * the way the older generators did, so a number of sets ended
 * up mixing physical and special attacks on Pokémon that
 * clearly favour one side (e.g. Hydro Pump + Close Combat +
 * Crunch on Sharpedo).
 *
 * For every set this script decides which attacking stat the
 * set should use, then swaps attacks of the other category
 * for learnable moves of the right category (same type first,
 * so the set keeps its coverage).
 *
 * Pokémon whose Atk and SpA are close (e.g. Infernape,
 * Iron Valiant, Kommo-o) are left free to run mixed sets.
 *
 * Usage (after `node build`):
 *
 *   node tools/ndsp-fix-set-categories.cjs            fix both files
 *   node tools/ndsp-fix-set-categories.cjs --check    report only
 *   node tools/ndsp-fix-set-categories.cjs --verbose  print every change
 *
 * It is also run automatically at the end of
 * tools/ndsp-v4-postprocess.cjs, so rebuilding the pools with
 * tools/build-nd-shared-sets.cjs keeps them fixed.
 */

const fs = require('fs');
const path = require('path');

const {Dex} = require('../dist/sim/dex');

const dex = Dex.mod('ndsharedpower');

const root = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower'
);

const FILES = [
	{label: 'Singles', file: path.join(root, 'sets.json'), doubles: false},
	{label: 'Doubles/FFA/2v2', file: path.join(root, 'doubles-sets.json'), doubles: true},
];

const toID = text =>
	String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

/*
 * A Pokémon counts as committed to one attacking stat when the
 * higher stat is at least 15% AND 15 base points above the
 * lower one. Sharpedo (120 / 95) is committed; Infernape
 * (104 / 104), Blastoise (83 / 85) and Delcatty (65 / 55)
 * are not.
 */
const COMMIT_RATIO = 1.15;
const COMMIT_GAP = 15;

/*
 * A set whose attacks are ALL on the wrong side is only flipped
 * when the gap is this large (e.g. Mega Froslass 80 / 140).
 * Smaller gaps are left alone: all-special Dragapult or
 * Sheer Force Nidoqueen are coherent sets.
 */
const FLIP_RATIO = 1.5;

/*
 * A clear majority of attacks on one side (2+ more) wins over
 * the stat split, as long as the gap is below this.
 * Keeps Sheer Force Nidoking special (102 / 85).
 */
const MAJORITY_MAX_RATIO = 1.3;

/*
 * -----------------------------------------------------------
 * Utility attacks
 * -----------------------------------------------------------
 *
 * Chosen for their effect rather than their damage, so they
 * never make a set "mixed".
 */
const UTILITY_MOVES = new Set([
	'uturn',
	'voltswitch',
	'flipturn',
	'rapidspin',
	'mortalspin',
	'knockoff',
	'fakeout',
	'firstimpression',
	'dragontail',
	'circlethrow',
	'explosion',
	'selfdestruct',
	'mistyexplosion',
	'beatup',
	'pursuit',
	'nuzzle',
	'infestation',
	'whirlpool',
	'firespin',
	'sandtomb',
	'thousandwaves',
	'anchorshot',
	'spiritshackle',
	'saltcure',
	'ceaselessedge',
	'stoneaxe',
	'terablast',
	'photongeyser',
	'shellsidearm',
	'bodypress',
	'foulplay',
	// Meloetta uses Relic Song to change forme.
	'relicsong',
	// Heals the ally in Doubles.
	'pollenpuff',
	// Chosen for the burn chance on physical Water types.
	'scald',
]);

/*
 * Status-combo attacks: count as utility when the set also
 * inflicts status (e.g. Hex + Will-O-Wisp on Dragapult).
 */
const STATUS_COMBO_MOVES = new Set(['hex', 'venoshock', 'barbbarb', 'infernalparade']);
const STATUS_MOVES = new Set([
	'willowisp', 'toxic', 'thunderwave', 'glare', 'stunspore', 'spore',
	'sleeppowder', 'hypnosis', 'yawn', 'poisonpowder', 'toxicspikes',
	'nuzzle', 'toxicthread', 'scald',
]);

/*
 * Moves whose category follows the user's stats, so they fit
 * either kind of set.
 */
const FLEXIBLE_MOVES = new Set([
	'terablast',
	'photongeyser',
	'shellsidearm',
	'lightthatburnsthesky',
]);

function secondariesOf(move) {
	return move.secondaries || (move.secondary ? [move.secondary] : []);
}

function isUtility(move, set) {
	if (UTILITY_MOVES.has(move.id)) return true;

	if (
		STATUS_COMBO_MOVES.has(move.id) &&
		set?.movepool.some(name => STATUS_MOVES.has(toID(name)))
	) {
		return true;
	}

	// Fixed or stat-independent damage.
	if (move.damage || move.damageCallback) return true;
	if (move.ohko) return true;
	if (move.overrideOffensiveStat || move.overrideOffensivePokemon) {
		return true;
	}

	// Pivoting / phazing attacks.
	if (move.selfSwitch || move.forceSwitch) return true;

	if (move.basePower <= 65) {
		const secondaries = secondariesOf(move);

		// Guaranteed stat drop or status on the target
		// (Icy Wind, Electroweb, Snarl, Rock Tomb, Bulldoze...).
		if (
			secondaries.some(
				s => s.chance === 100 && (s.boosts || s.status || s.volatileStatus)
			)
		) {
			return true;
		}

		// Guaranteed self-boost (Flame Charge, Trailblaze...).
		if (
			secondaries.some(s => s.chance === 100 && s.self?.boosts) ||
			(move.self?.boosts && !Object.values(move.self.boosts).some(v => v < 0))
		) {
			return true;
		}
	}

	return false;
}

/*
 * -----------------------------------------------------------
 * Signals for which side a set is built around
 * -----------------------------------------------------------
 */
const PHYSICAL_SETUP = new Set([
	'swordsdance',
	'dragondance',
	'bulkup',
	'coil',
	'honeclaws',
	'howl',
	'bellydrum',
	'victorydance',
	'tidyup',
	'meditate',
	'sharpen',
	'noretreat',
	'curse',
]);

const SPECIAL_SETUP = new Set([
	'nastyplot',
	'calmmind',
	'quiverdance',
	'tailglow',
	'geomancy',
	'takeheart',
	'torchsong',
]);

const PHYSICAL_ABILITIES = new Set([
	'hugepower',
	'purepower',
	'gorillatactics',
	'guts',
	'toughclaws',
	'strongjaw',
	'ironfist',
	'sharpness',
	'hustle',
	'toxicboost',
	'reckless',
	'intrepidsword',
	'orichalcumpulse',
	'skilllink',
]);

const SPECIAL_ABILITIES = new Set([
	'solarpower',
	'flareboost',
	'megalauncher',
	'soulheart',
	'hadronengine',
]);

/*
 * Formes whose battle stats differ from the listed species.
 */
function battleStats(species, set) {
	const abilities = (set.abilities || []).map(toID);

	const swap = {
		wishiwashi: abilities.includes('schooling') && 'Wishiwashi-School',
		aegislash: abilities.includes('stancechange') && 'Aegislash-Blade',
		darmanitan: abilities.length && abilities.every(a => a === 'zenmode') && 'Darmanitan-Zen',
		darmanitangalar: abilities.length && abilities.every(a => a === 'zenmode') &&
			'Darmanitan-Galar-Zen',
	}[species.id];

	return (swap ? dex.species.get(swap) : species).baseStats;
}

function sideByRatio(atk, spa, ratio, gap = 0) {
	if (atk >= spa * ratio && atk - spa >= gap) return 'Physical';
	if (spa >= atk * ratio && spa - atk >= gap) return 'Special';
	return null;
}

function setAbilities(species, set) {
	// Megas / Primals fight with their own ability.
	if (species.isMega || species.isPrimal) {
		return Object.values(species.abilities).map(toID);
	}

	return (set.abilities || []).map(toID);
}

/*
 * Decide which category a set should attack with.
 * Returns {side, reason}; side is null when mixed is fine.
 */
function intendedSide(species, set, physical, special) {
	// Meloetta switches between a special and a physical forme.
	if (species.baseSpecies === 'Meloetta' && set.movepool.some(m => toID(m) === 'relicsong')) {
		return {side: null, reason: 'Relic Song forme change'};
	}

	const {atk, spa} = battleStats(species, set);
	const statSide = sideByRatio(atk, spa, COMMIT_RATIO, COMMIT_GAP);

	// Close attacking stats: mixed sets are fine.
	if (!statSide) {
		return {side: null, reason: `balanced Atk ${atk} / SpA ${spa}`};
	}

	const moves = set.movepool.map(toID);

	// Ghost-type Curse is not a setup move.
	const physSetup = moves.filter(
		id => PHYSICAL_SETUP.has(id) && !(id === 'curse' && species.types.includes('Ghost'))
	);
	const specSetup = moves.filter(id => SPECIAL_SETUP.has(id));

	if (physSetup.length && !specSetup.length) {
		return {side: 'Physical', reason: `setup move (${physSetup.map(id => dex.moves.get(id).name).join(', ')})`};
	}

	if (specSetup.length && !physSetup.length) {
		return {side: 'Special', reason: `setup move (${specSetup.map(id => dex.moves.get(id).name).join(', ')})`};
	}

	const abilities = setAbilities(species, set);

	if (abilities.length && abilities.every(a => PHYSICAL_ABILITIES.has(a))) {
		return {side: 'Physical', reason: `ability (${dex.abilities.get(abilities[0]).name})`};
	}

	if (abilities.length && abilities.every(a => SPECIAL_ABILITIES.has(a))) {
		return {side: 'Special', reason: `ability (${dex.abilities.get(abilities[0]).name})`};
	}

	const lead = physical.length - special.length;

	if (Math.abs(lead) >= 2 && !sideByRatio(atk, spa, MAJORITY_MAX_RATIO)) {
		return {
			side: lead > 0 ? 'Physical' : 'Special',
			reason: `most attacks are ${lead > 0 ? 'physical' : 'special'}`,
		};
	}

	return {side: statSide, reason: `Atk ${atk} / SpA ${spa}`};
}

function classify(set) {
	const physical = [];
	const special = [];

	for (const name of set.movepool) {
		const move = dex.moves.get(name);

		if (!move.exists || move.category === 'Status') continue;
		if (isUtility(move, set) || FLEXIBLE_MOVES.has(move.id)) continue;

		if (move.category === 'Physical') physical.push(move);
		else special.push(move);
	}

	return {physical, special};
}

/*
 * Signature Z-Move requirements: never remove these from a
 * Z-Move set (e.g. Clanging Scales for Kommonium Z).
 */
const Z_SIGNATURE_MOVES = {
	kommoo: 'clangingscales',
	decidueye: 'spiritshackle',
	incineroar: 'darkestlariat',
	primarina: 'sparklingaria',
	raichualola: 'thunderbolt',
	lycanroc: 'stoneedge',
	mimikyu: 'playrough',
	marshadow: 'spectralthief',
	solgaleo: 'sunsteelstrike',
	lunala: 'moongeistbeam',
	necrozmaduskmane: 'sunsteelstrike',
	necrozmadawnwings: 'moongeistbeam',
	snorlax: 'gigaimpact',
	pikachu: 'volttackle',
	eevee: 'lastresort',
};

function isProtected(species, set, move) {
	return (
		/z[- ]?move/i.test(set.role || '') &&
		Z_SIGNATURE_MOVES[species.id] === move.id
	);
}

/*
 * -----------------------------------------------------------
 * Replacement search
 * -----------------------------------------------------------
 */

// Moves that only work in special situations.
const BAD_REPLACEMENTS = new Set([
	'belch', 'lastresort', 'dreameater', 'synchronoise', 'steelroller',
	'fling', 'naturalgift', 'spitup', 'focuspunch', 'futuresight',
	'doomdesire', 'snore', 'burnup', 'doubleshock', 'shelltrap',
	'beakblast', 'feint', 'mefirst', 'echoedvoice', 'round',
	'trumpcard', 'punishment', 'naturepower', 'secretpower',
	'hyperspacefury', 'hyperspacehole', 'upperhand', 'suckerpunch',
	'thunderclap', 'poltergeist', 'lashout', 'retaliate', 'avalanche',
	'revenge', 'payback', 'assurance', 'stompingtantrum', 'temperflare',
	'ragefist', 'lastrespects', 'grassyglide', 'mistyexplosion',
	'expandingforce', 'risingvoltage', 'terrainpulse', 'weatherball',
	'hiddenpower', 'solarbeam', 'solarblade', 'meteorbeam', 'electroshot',
	'skyattack', 'razorwind', 'skullbash', 'freezeshock', 'iceburn',
	'dig', 'dive', 'fly', 'bounce', 'phantomforce', 'shadowforce',
	'geomancy', 'selfdestruct', 'explosion', 'finalgambit', 'memento',
	'mindblown', 'steelbeam', 'chloroblast', 'struggle', 'present',
	'magnitude', 'triplekick', 'rollout', 'iceball', 'furycutter',
	'spitup', 'wringout', 'crushgrip', 'hardpress', 'flail', 'reversal', 'storedpower',
	'powertrip', 'electroball', 'gyroball', 'grassknot', 'lowkick',
	'heavyslam', 'heatcrash', 'relicsong', 'ruination', 'terastarstorm',
	'blazingtorque', 'wickedtorque', 'noxioustorque', 'combattorque',
	'magicaltorque', 'fakeout', 'facade',
]);

const BAD_NONSTANDARD = new Set(['CAP', 'LGPE', 'Unobtainable', 'Future', 'Custom', 'Gigantamax']);

const learnsetCache = new Map();

function learnableMoves(species) {
	if (learnsetCache.has(species.id)) return learnsetCache.get(species.id);

	const moves = new Set();
	const seen = new Set();

	const addFrom = start => {
		let current = start;

		while (current?.exists && !seen.has(current.id)) {
			seen.add(current.id);

			const data = dex.species.getLearnsetData(current.id);
			const own = Object.keys(data?.learnset || {});

			for (const move of own) moves.add(move);

			// Battle formes, Megas and fusion formes (e.g. Necrozma-
			// Dawn-Wings) only list their signature moves.
			const base = dex.species.get(current.changesFrom || current.baseSpecies);

			if (
				base.id !== current.id &&
				(own.length < 20 || current.changesFrom || current.battleOnly || current.isMega)
			) {
				addFrom(base);
			}

			current = current.prevo ? dex.species.get(current.prevo) : null;
		}
	};

	addFrom(species);

	learnsetCache.set(species.id, moves);

	return moves;
}

/*
 * Moves used anywhere in the curated Gen 9 random sets are a
 * good sign of a competitively sensible choice.
 */
const CURATED_MOVES = (() => {
	const moves = new Set();

	for (const rel of ['gen9/sets.json', 'gen9/doubles-sets.json']) {
		const table = JSON.parse(
			fs.readFileSync(path.resolve(__dirname, '../data/random-battles', rel), 'utf8')
		);

		for (const entry of Object.values(table)) {
			for (const set of entry.sets || []) {
				for (const move of set.movepool || []) moves.add(toID(move));
			}
		}
	}

	return moves;
})();

function speciesPoolMoves(tables, species) {
	const moves = new Set();
	const ids = new Set([species.id, dex.species.get(species.baseSpecies).id]);

	for (const table of tables) {
		for (const id of ids) {
			for (const set of table[id]?.sets || []) {
				for (const move of set.movepool) moves.add(toID(move));
			}
		}
	}

	return moves;
}

function scoreMove(move, context) {
	if (!move.exists || move.category === 'Status') return -Infinity;
	if (move.isZ || move.isMax) return -Infinity;
	if (move.isNonstandard && BAD_NONSTANDARD.has(move.isNonstandard)) return -Infinity;
	if (move.flags.recharge || move.self?.volatileStatus === 'mustrecharge') return -Infinity;
	if (move.selfdestruct) return -Infinity;
	if (isUtility(move)) return -Infinity;

	// Moves this species already uses in a curated NDSP set are
	// trusted even if they are situational (Sucker Punch,
	// Phantom Force, Last Respects...).
	const trusted = context.speciesMoves.has(move.id);

	if (!trusted) {
		if (BAD_REPLACEMENTS.has(move.id)) return -Infinity;
		if (move.flags.charge) return -Infinity;
	}

	const accuracy = move.accuracy === true ? 100 : move.accuracy;
	let hits = 1;

	if (Array.isArray(move.multihit)) hits = move.id === 'scaleshot' || context.skillLink ? 5 : 3;
	else if (typeof move.multihit === 'number') hits = move.multihit;

	let power = move.basePower * hits;

	if (move.priority > 0) power = Math.max(power, 60);
	if (power < 60 && !trusted) return -Infinity;

	let score = power * accuracy / 100;

	// Drawbacks.
	if (move.recoil) {
		const fraction = move.recoil[0] / move.recoil[1];
		const penalty = fraction >= 0.5 ? 40 : fraction >= 0.33 ? 25 : 15;
		// Bulky / support roles care more about their HP.
		score -= /support|bulky|pivot|staller/i.test(context.role) ? penalty * 2 : penalty;
	}
	if (move.self?.volatileStatus === 'lockedmove' && !trusted) score -= 20;
	if (move.self?.boosts && Object.values(move.self.boosts).some(v => v < 0)) score -= 5;
	if (move.isNonstandard === 'Past') score -= 15;

	// In Doubles avoid moves that also hit the partner.
	if (context.doubles && move.target === 'allAdjacent') score -= 40;

	// Prefer moves already used by this species, then curated ones.
	if (trusted) score += 60;
	if (CURATED_MOVES.has(move.id)) score += 25;

	// Same-type attack bonus; Normal-type coverage hits nothing
	// super effectively, so it is a poor filler.
	if (context.species.types.includes(move.type)) score += 10;
	else if (move.type === 'Normal') score -= 20;

	return score;
}

function bestMove(species, context, filter, minScore = -Infinity) {
	let best = null;
	let bestScore = minScore;

	for (const id of learnableMoves(species)) {
		const move = dex.moves.get(id);

		if (!filter(move)) continue;

		const score = scoreMove(move, context);

		if (score > bestScore || (score === bestScore && !best && score > -Infinity)) {
			best = move;
			bestScore = score;
		}
	}

	return best;
}

/*
 * When a set still has four or more moves without the removed
 * attack, only add a replacement that is genuinely good
 * (e.g. Liquidation for Sharpedo), not a weak one (Take Down
 * for Toucannon).
 */
const OPTIONAL_REPLACEMENT_SCORE = 90;

/*
 * -----------------------------------------------------------
 * Fix one set
 * -----------------------------------------------------------
 */
function fixSet(species, set, tables, doubles) {
	const {physical, special} = classify(set);
	const want = intendedSide(species, set, physical, special);

	if (!want.side) return null;

	let wrong;
	let kind;

	if (physical.length && special.length) {
		kind = 'mixed';
		wrong = want.side === 'Physical' ? special : physical;
	} else {
		const has = physical.length ? 'Physical' : special.length ? 'Special' : null;

		if (!has || has === want.side) return null;

		// Only flip whole sets when the stat gap is huge.
		const {atk, spa} = battleStats(species, set);

		if (!sideByRatio(atk, spa, FLIP_RATIO)) return null;
		if (sideByRatio(atk, spa, FLIP_RATIO) !== want.side) return null;

		kind = 'flipped';
		wrong = physical.length ? physical : special;
	}

	wrong = wrong.filter(move => !isProtected(species, set, move));

	if (!wrong.length) return null;

	const context = {
		species,
		role: set.role || '',
		doubles,
		speciesMoves: speciesPoolMoves(tables, species),
		// Only count five hits when Skill Link is guaranteed.
		skillLink: setAbilities(species, set).every(a => a === 'skilllink'),
	};

	const before = [...set.movepool];
	const wrongIDs = new Set(wrong.map(m => m.id));
	const pool = set.movepool.filter(name => !wrongIDs.has(toID(name)));
	const poolIDs = () => new Set(pool.map(toID));
	const swaps = [];
	const dropped = [];

	const hasAttackOfType = type =>
		pool.some(name => {
			const move = dex.moves.get(name);
			return move.type === type && move.category === want.side && !isUtility(move, set);
		});

	// 1. Same-type replacement for each removed attack, unless the
	//    set already has a right-category attack of that type.
	for (const old of wrong) {
		if (hasAttackOfType(old.type)) {
			dropped.push(old.name);
			continue;
		}

		const sameType = move =>
			move.type === old.type &&
			move.category === want.side &&
			!poolIDs().has(move.id);

		const optional = pool.length >= Math.min(4, before.length);
		const minScore = optional ? OPTIONAL_REPLACEMENT_SCORE : -Infinity;

		let replacement = bestMove(
			species,
			context,
			move => sameType(move) && !(doubles && move.target === 'allAdjacent'),
			minScore
		);

		// In Doubles, only accept a move that also hits the partner
		// (Earthquake, Surf...) when it is needed for STAB.
		if (!replacement && doubles && species.types.includes(old.type)) {
			replacement = bestMove(species, context, sameType, minScore);
		}

		if (replacement) {
			pool.push(replacement.name);
			swaps.push([old.name, replacement.name]);
		} else {
			dropped.push(old.name);
		}
	}

	// 2. Keep at least four options for the generator, and at
	//    least two real attacks if the set had them.
	const minimum = Math.min(4, before.length);
	const attacksBefore = Math.min(2, physical.length + special.length);
	const attackCount = () =>
		pool.filter(name => {
			const move = dex.moves.get(name);
			return move.category !== 'Status' && !isUtility(move, set);
		}).length;

	while (pool.length < minimum || attackCount() < attacksBefore) {
		const covered = new Set(
			pool
				.map(name => dex.moves.get(name))
				.filter(move => move.category !== 'Status')
				.map(move => move.type)
		);

		const filler =
			bestMove(
				species,
				context,
				move =>
					move.category === want.side &&
					!covered.has(move.type) &&
					!poolIDs().has(move.id)
			) ||
			bestMove(
				species,
				context,
				move => move.category === want.side && !poolIDs().has(move.id)
			);

		if (!filler) break;

		pool.push(filler.name);
		swaps.push([dropped.shift() || '(filler)', filler.name]);
	}

	// Keep the alphabetical order Gen 9 data uses.
	const sorted = before.every((name, i) => i === 0 || before[i - 1] <= name);

	if (sorted) pool.sort();

	set.movepool = pool;

	return {
		kind,
		side: want.side,
		reason: want.reason,
		swaps,
		dropped,
		before,
		after: [...pool],
	};
}

/*
 * -----------------------------------------------------------
 * Z-Move sets on Megas
 * -----------------------------------------------------------
 *
 * Some Mega entries inherited their base form's Gen 7
 * "Z-Move user" sets, but a Mega holds its Mega Stone and can
 * never use a Z-Move. Moves that only make sense as Z-Moves
 * (Happy Hour, Celebrate, Fly...) become dead slots, so those
 * sets are turned into normal sets.
 */
const Z_ONLY_MOVES = new Set([
	'happyhour', 'celebrate', 'holdhands', 'conversion', 'splash',
]);

function fixZOnMega(species, set, tables, doubles) {
	if (!/z[- ]?move/i.test(set.role || '')) return null;
	if (!species.requiredItem || !(species.isMega || species.isPrimal)) return null;

	const {physical, special} = classify(set);
	const want = intendedSide(species, set, physical, special);
	const side =
		want.side ||
		(physical.length >= special.length ? 'Physical' : 'Special');

	const context = {
		species,
		role: set.role,
		doubles,
		speciesMoves: speciesPoolMoves(tables, species),
		skillLink: false,
	};

	const before = [...set.movepool];
	const swaps = [];
	const dropped = [];
	const pool = [];

	for (const name of set.movepool) {
		const move = dex.moves.get(name);

		if (Z_ONLY_MOVES.has(move.id)) {
			dropped.push(move.name);
			continue;
		}

		// Two-turn moves were only there to become a Z-Move.
		if (move.flags.charge && move.category !== 'Status') {
			const replacement = bestMove(
				species,
				{...context, speciesMoves: new Set()},
				m =>
					m.type === move.type &&
					m.category === move.category &&
					!m.flags.charge &&
					!set.movepool.some(n => toID(n) === m.id)
			);

			if (replacement && replacement.basePower >= 70) {
				pool.push(replacement.name);
				swaps.push([move.name, replacement.name]);
			} else {
				dropped.push(move.name);
			}

			continue;
		}

		pool.push(move.name);
	}

	while (pool.length < Math.min(4, before.length)) {
		const covered = new Set(
			pool.map(n => dex.moves.get(n)).filter(m => m.category !== 'Status').map(m => m.type)
		);
		const ids = new Set(pool.map(toID));
		const filler = bestMove(
			species,
			context,
			m => m.category === side && !covered.has(m.type) && !ids.has(m.id)
		);

		if (!filler) break;

		pool.push(filler.name);
		swaps.push([dropped.shift() || '(filler)', filler.name]);
	}

	const oldRole = set.role;
	const hasSetup = pool.some(n => PHYSICAL_SETUP.has(toID(n)) || SPECIAL_SETUP.has(toID(n)));

	set.role = hasSetup ? 'Setup Sweeper' : 'Fast Attacker';
	set.movepool = pool.sort();

	// Gen 7 data stored the Z-Crystal type as the "Tera" type;
	// give these sets the Mega's own types instead.
	if (!set.teraTypes?.some(type => species.types.includes(type))) {
		set.teraTypes = [...species.types];
	}

	return {
		kind: 'z-on-mega',
		side,
		reason: `Mega can't hold a Z-Crystal (role ${oldRole} → ${set.role})`,
		swaps,
		dropped,
		before,
		after: [...pool],
	};
}

/*
 * -----------------------------------------------------------
 * Run
 * -----------------------------------------------------------
 */
function run(options = {}) {
	const checkOnly = !!options.check;
	const verbose = !!options.verbose;

	const loaded = FILES.map(entry => ({
		...entry,
		data: JSON.parse(fs.readFileSync(entry.file, 'utf8')),
	}));

	const tables = loaded.map(entry => entry.data);
	const report = [];

	for (const entry of loaded) {
		let changed = 0;

		for (const [id, speciesData] of Object.entries(entry.data)) {
			const species = dex.species.get(id);

			if (!species.exists) continue;

			const touched = new Set();

			for (const set of speciesData.sets || []) {
				const target = checkOnly ? JSON.parse(JSON.stringify(set)) : set;
				const role = set.role;
				const results = [
					fixZOnMega(species, target, tables, entry.doubles),
					fixSet(species, target, tables, entry.doubles),
				].filter(Boolean);

				if (!results.length) continue;

				changed++;
				touched.add(set);

				for (const result of results) {
					report.push({
						file: entry.label,
						species: species.name,
						role,
						...result,
					});
				}
			}

			// A fixed set can end up identical to an existing one
			// (same role and moves); merge their Tera types.
			if (!checkOnly && touched.size) {
				const kept = [];

				for (const set of speciesData.sets) {
					const key = JSON.stringify([set.role, [...set.movepool].sort()]);
					const twin = kept.find(
						other => JSON.stringify([other.role, [...other.movepool].sort()]) === key
					);

					if (twin && (touched.has(set) || touched.has(twin))) {
						twin.teraTypes = [...new Set([...twin.teraTypes, ...set.teraTypes])];
						twin.abilities = [...new Set([...twin.abilities, ...set.abilities])];
						continue;
					}

					kept.push(set);
				}

				speciesData.sets = kept;
			}
		}

		if (!checkOnly && changed) {
			fs.writeFileSync(entry.file, JSON.stringify(entry.data, null, 2) + '\n');
		}

		console.log(
			`${entry.label}: ${changed} set(s) ${checkOnly ? 'need fixing' : 'fixed'}`
		);
	}

	if (verbose || checkOnly) {
		for (const r of report) {
			const swaps = r.swaps.map(([a, b]) => `${a} -> ${b}`);
			const drops = r.dropped.map(a => `${a} removed`);

			console.log(
				`[${r.file}] ${r.species} (${r.role}) → ${r.side} [${r.reason}]: ` +
				[...swaps, ...drops].join(', ')
			);
		}
	}

	return report;
}

module.exports = {
	run,
	classify,
	intendedSide,
	isUtility,
	dex,
};

if (require.main === module) {
	run({
		check: process.argv.includes('--check'),
		verbose: process.argv.includes('--verbose'),
	});
}
