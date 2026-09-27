'use strict';

/*
 * ===========================================================
 * ND MIX AND MEGA - CURATED SET BUILDER
 * ===========================================================
 *
 * Builds the random battle pools for the ND Mix and Mega
 * formats from the National Dex Shared Power pools:
 *
 *   data/random-battles/ndsharedpower/{sets,doubles-sets}.json
 *     -> data/random-battles/ndmixandmega/{sets,doubles-sets}.json
 *
 * Every legal NDSP Pokémon (no Megas, Primals or item-locked
 * formes) is paired with the Mega Stones that suit it:
 *
 * 1. Each (set, stone) pair is scored with Mix and Mega's own
 *    maths (tools/ndmnm-mix.cjs): the stat changes weighted by
 *    what the set uses, the Mega's ability for this set, and the
 *    type change.
 * 2. Every Pokémon gets its 1-2 best stones. Usage per stone is
 *    capped and every stone is given out at least a few times,
 *    so all Mega Stones appear. Power stones (Huge Power, Pure
 *    Power, Parental Bond...) only go to weaker Pokémon.
 * 3. Moves are adapted to the mix: item-reliant moves go, the
 *    new type's STAB and ability synergy moves are added
 *    (e.g. Normal moves for -ate abilities, pulse moves for
 *    Mega Launcher) and marked as required.
 * 4. Levels are adjusted by how much stronger (or weaker) the
 *    mix makes the Pokémon compared with a typical pairing.
 *
 * MANUAL_* tables below hold hand-picked overrides.
 *
 * Usage (after `node build`):
 *   node tools/build-ndmnm-sets.cjs            write the pools
 *   node tools/build-ndmnm-sets.cjs --report   also print a report
 */

const fs = require('fs');
const path = require('path');

const {dex, stones, megaOf, mix, deltas} = require('./ndmnm-mix.cjs');
const category = require('./ndsp-fix-set-categories.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data/random-battles/ndsharedpower');
const OUT = path.join(ROOT, 'data/random-battles/ndmixandmega');

const REPORT = process.argv.includes('--report');

const toID = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/*
 * ===========================================================
 * MANUAL CURATION
 * ===========================================================
 */

// Stones that make almost anything strong. They only go to
// Pokémon with a base stat total at or below POWER_STONE_MAX_BST,
// and are used sparingly.
const POWER_STONES = new Set([
	'mawilite', 'medichamite', 'starminite', // Huge / Pure Power
	'kangaskhanite', // Parental Bond
	'blazikenite', // Speed Boost
	'beedrillite', // Adaptability, +60 Atk / +70 Spe
	'zygardite', // +125 SpA
	'diancite', // +60 Atk / SpA / Spe
]);
const POWER_STONE_MAX_BST = 480;
const POWER_STONE_MAX_USES = 10;

// Hand-picked pairings: species -> stones to use (all its sets).
const MANUAL_PAIRINGS = {
};

// Hand-picked exclusions: stone -> species that must not get it.
const MANUAL_EXCLUSIONS = {
};

/*
 * ===========================================================
 * POOL SELECTION
 * ===========================================================
 */
function legalPool(table) {
	return Object.keys(table).filter(id => {
		const species = dex.species.get(id);

		return species.exists &&
			!species.isMega && !species.isPrimal &&
			!species.requiredItem && !species.requiredItems &&
			species.forme !== 'Ultra' &&
			!species.name.endsWith('-Gmax') && !species.id.endsWith('gmax');
	});
}

/*
 * ===========================================================
 * MOVE HELPERS
 * ===========================================================
 */
const learnsetCache = new Map();

function learnable(species) {
	if (learnsetCache.has(species.id)) return learnsetCache.get(species.id);

	const moves = new Set();
	const seen = new Set();

	const addFrom = start => {
		let current = start;

		while (current?.exists && !seen.has(current.id)) {
			seen.add(current.id);

			const own = Object.keys(dex.species.getLearnsetData(current.id)?.learnset || {});

			for (const move of own) moves.add(move);

			const base = dex.species.get(current.changesFrom || current.baseSpecies);

			if (base.id !== current.id && (own.length < 20 || current.changesFrom || current.battleOnly)) {
				addFrom(base);
			}

			current = current.prevo ? dex.species.get(current.prevo) : null;
		}
	};

	addFrom(species);
	learnsetCache.set(species.id, moves);

	return moves;
}

// Moves used in any curated Gen 9 random set: a sign a move is
// competitively sensible.
const CURATED_MOVES = (() => {
	const moves = new Set();

	for (const rel of ['gen9/sets.json', 'gen9/doubles-sets.json']) {
		const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/random-battles', rel), 'utf8'));

		for (const entry of Object.values(table)) {
			for (const set of entry.sets || []) {
				for (const move of set.movepool) moves.add(toID(move));
			}
		}
	}

	return moves;
})();

// Moves that don't work (or make no sense) while holding a Mega
// Stone, or that only exist for Z-Moves / Tera / Dynamax.
const ITEM_RELIANT_MOVES = new Set([
	'trick', 'switcheroo', 'fling', 'naturalgift', 'stuffcheeks', 'recycle',
	'acrobatics', 'terablast', 'celebrate', 'happyhour', 'holdhands',
	'conversion', 'splash', 'belch', 'bestow', 'teatime',
]);

// Never add these as a replacement / synergy move.
const BAD_ADDITIONS = new Set([
	'focuspunch', 'lastresort', 'dreameater', 'synchronoise', 'steelroller',
	'futuresight', 'doomdesire', 'snore', 'burnup', 'doubleshock', 'shelltrap',
	'beakblast', 'feint', 'round', 'echoedvoice', 'trumpcard', 'punishment',
	'secretpower', 'naturepower', 'upperhand', 'suckerpunch', 'thunderclap',
	'lashout', 'retaliate', 'avalanche', 'revenge', 'payback', 'assurance',
	'ragefist', 'lastrespects', 'grassyglide', 'expandingforce',
	'risingvoltage', 'terrainpulse', 'hiddenpower', 'solarblade', 'meteorbeam',
	'electroshot', 'skyattack', 'razorwind', 'skullbash', 'freezeshock',
	'iceburn', 'dig', 'dive', 'fly', 'bounce', 'phantomforce', 'shadowforce',
	'selfdestruct', 'explosion', 'finalgambit', 'mindblown', 'steelbeam',
	'chloroblast', 'present', 'magnitude', 'rollout', 'iceball', 'furycutter',
	'spitup', 'wringout', 'crushgrip', 'hardpress', 'flail', 'reversal',
	'storedpower', 'powertrip', 'electroball', 'gyroball', 'grassknot',
	'lowkick', 'heavyslam', 'heatcrash', 'fakeout', 'gigaimpact', 'hyperbeam',
	'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime',
	'prismaticlaser', 'eternabeam', 'meteorassault', 'solarbeam', 'relicsong',
	'thrash', 'petaldance', 'ragingfury', 'megakick', 'megapunch', 'takedown',
	'strength', 'slam', 'headbutt', 'stomp', 'cut', 'rockclimb', 'dizzypunch',
	'skydrop', 'natureswrath', 'spikecannon', 'barrage', 'cometpunch',
	'doubleslap', 'furyattack', 'furyswipes', 'bonemerang', 'twineedle',
	'doublehit', 'dualchop', 'geargrind', 'triplekick', 'doublekick', 'uproar',
	'outrage', 'bittermalice', 'mudslap', 'feintattack',
]);

// Moves that raise the user's stats; Contrary turns them into drops.
const SELF_BOOSTING = new Set([
	'bellydrum', 'filletaway', 'clangoroussoul', 'noretreat', 'tidyup', 'acupressure',
	'stockpile', 'chargebeam', 'poweruppunch', 'flamecharge', 'trailblaze', 'rapidspin',
	'meteormash', 'diamondstorm', 'torchsong', 'fierydance', 'esperwing', 'aquastep',
	'electroshot', 'shellsmash', 'growth', 'workup', 'curse',
]);

function raisesOwnStats(move) {
	if (SELF_BOOSTING.has(move.id)) return true;
	if (move.category === 'Status' && move.target === 'self' && move.boosts &&
		Object.values(move.boosts).some(v => v > 0)) return true;
	if (move.self?.boosts && Object.values(move.self.boosts).some(v => v > 0)) return true;

	return secondariesOf(move).some(sec => sec.self?.boosts && Object.values(sec.self.boosts).some(v => v > 0));
}

function secondariesOf(move) {
	return move.secondaries || (move.secondary ? [move.secondary] : []);
}

function isUtility(move) {
	return category.isUtility(move);
}

// Rough value of an attack for picking additions.
function moveValue(move, context) {
	if (!move.exists || move.category === 'Status' || move.isZ || move.isMax) return -Infinity;
	if (move.isNonstandard && !['Past', null].includes(move.isNonstandard) &&
		move.isNonstandard !== 'Unobtainable') return -Infinity;
	if (move.flags.charge || move.flags.recharge) return -Infinity;
	if (ITEM_RELIANT_MOVES.has(move.id)) return -Infinity;
	if (!context.trusted.has(move.id) && BAD_ADDITIONS.has(move.id)) return -Infinity;
	if (move.damage || move.damageCallback || move.ohko) return -Infinity;

	const accuracy = move.accuracy === true || context.noGuard ? 100 : move.accuracy;
	let hits = 1;

	if (Array.isArray(move.multihit)) hits = context.skillLink ? 5 : context.technician ? 3.5 : 3;
	else if (typeof move.multihit === 'number') hits = move.multihit;

	let power = move.basePower * hits;

	if (context.technician && move.basePower <= 60) power *= 1.5;
	if (move.priority > 0) power = Math.max(power, 70);
	if (power < 55) return -Infinity;

	let score = power * accuracy / 100;

	if (move.recoil) score -= 12;
	if (move.self?.boosts && Object.values(move.self.boosts).some(v => v < 0)) {
		score += context.contrary ? 25 : -8;
	}
	if (move.self?.volatileStatus === 'lockedmove') score -= 15;
	if (move.isNonstandard === 'Past') score -= 10;
	if (context.doubles && move.target === 'allAdjacent') score -= 25;
	if (context.trusted.has(move.id)) score += 40;
	if (CURATED_MOVES.has(move.id)) score += 20;
	if (context.types.includes(move.type)) score += 10;

	return score;
}

function bestLearnable(species, context, filter) {
	let best = null;
	let bestScore = -Infinity;

	for (const id of learnable(species)) {
		const move = dex.moves.get(id);

		if (!filter(move)) continue;

		const score = moveValue(move, context);

		if (score > bestScore) {
			best = move;
			bestScore = score;
		}
	}

	return best;
}

/*
 * ===========================================================
 * SET ANALYSIS
 * ===========================================================
 */
const BULKY_ROLES = new Set([
	'Bulky Support', 'Bulky Attacker', 'Bulky Setup', 'Staller', 'AV Pivot',
	'Bulky Protect', 'Doubles Support', 'Doubles Bulky Attacker', 'Doubles Bulky Setup',
]);
const FAST_ROLES = new Set([
	'Fast Attacker', 'Setup Sweeper', 'Fast Support', 'Fast Bulky Setup',
	'Offensive Protect', 'Doubles Fast Attacker', 'Doubles Setup Sweeper', 'Wallbreaker',
	'Doubles Wallbreaker',
]);

const SUPPORT_ROLES = new Set(['Bulky Support', 'Staller', 'Doubles Support']);

function setSide(set) {
	const {physical, special} = category.classify(set);

	// A support set with a single attack is still a support set.
	if (SUPPORT_ROLES.has(set.role) && physical.length + special.length <= 1) return 'Support';

	if (physical.length > special.length) return 'Physical';
	if (special.length > physical.length) return 'Special';
	if (physical.length) return 'Mixed';

	return 'Support';
}

function statWeights(set, side) {
	const moves = set.movepool.map(toID);
	const w = {hp: 0.5, atk: 0, def: 0.3, spa: 0, spd: 0.3, spe: 0.35};

	if (side === 'Physical') w.atk = 1;
	else if (side === 'Special') w.spa = 1;
	else if (side === 'Mixed') w.atk = w.spa = 0.65;
	else {
		w.atk = w.spa = 0.1;
		w.def = w.spd = 0.7;
	}

	if (BULKY_ROLES.has(set.role)) {
		w.def += 0.3;
		w.spd += 0.3;
		w.atk *= 0.8;
		w.spa *= 0.8;
	}

	if (FAST_ROLES.has(set.role)) w.spe = 0.8;
	if (moves.includes('trickroom')) w.spe = -0.4;

	// Body Press uses Defence to attack.
	if (moves.includes('bodypress')) w.def += 0.5;
	// Foul Play doesn't use the user's Attack.
	if (side === 'Support' && moves.includes('foulplay')) w.atk = 0;

	return w;
}

// Forme-change abilities are lost after Mega Evolving, so compare
// the mix with the forme the Pokémon normally fights in.
function referenceStats(species, set) {
	const abilities = (set.abilities || []).map(toID);
	const get = name => dex.species.get(name).baseStats;
	const avg = (a, b) => Object.fromEntries(STATS.map(s => [s, (a[s] + b[s]) / 2]));

	if (species.id === 'aegislash' && abilities.includes('stancechange')) {
		return avg(get('Aegislash'), get('Aegislash-Blade'));
	}
	if (species.id === 'wishiwashi' && abilities.includes('schooling')) return get('Wishiwashi-School');
	if (species.id === 'palafin' && abilities.includes('zerotohero')) return get('Palafin-Hero');
	if (species.id === 'minior' && abilities.includes('shieldsdown')) {
		return avg(get('Minior-Meteor'), get('Minior'));
	}
	if (species.id === 'terapagos') return get('Terapagos-Terastal');

	return species.baseStats;
}

/*
 * ===========================================================
 * ABILITY VALUES (in "useful stat point" units)
 * ===========================================================
 */

// Abilities that need an item (orb, berry, consumable) or rely on
// a forme change: worth nothing once the Pokémon holds a Mega Stone.
const DEAD_NATIVE_ABILITIES = new Set([
	'guts', 'toxicboost', 'flareboost', 'poisonheal', 'quickfeet', 'unburden',
	'stancechange', 'schooling', 'zerotohero', 'shieldsdown', 'powerconstruct',
	'battlebond', 'multitype', 'rkssystem', 'terashift', 'gluttony', 'ripen',
	'cheekpouch', 'harvest', 'magician', 'pickpocket', 'klutz', 'forecast',
	'flowergift', 'mimicry', 'hungerswitch', 'gulpmissile', 'iceface',
]);

const NATIVE_OVERRIDES = {
	hugepower: 100, purepower: 100, parentalbond: 60, speedboost: 45, adaptability: 40,
	protean: 35, libero: 35, regenerator: 30, magicguard: 30, multiscale: 25,
	intimidate: 20, toughclaws: 30, sheerforce: 30, technician: 25, skilllink: 35,
	drought: 30, drizzle: 30, sandstream: 20, snowwarning: 20, disguise: 30,
	orichalcumpulse: 40, hadronengine: 40, goodasgold: 30, beadsofruin: 30,
	swordofruin: 30, tabletsofruin: 25, vesselofruin: 25, prankster: 30,
	magicbounce: 25, levitate: 20, thickfat: 15, unaware: 25, sturdy: 15,
	naturalcure: 12, moxie: 25, contrary: 30, triage: 25, galewings: 25,
	aerilate: 35, pixilate: 35, refrigerate: 35, galvanize: 35, dragonize: 35,
};

function nativeValue(set, side) {
	let best = 0;
	let total = 0;
	let count = 0;

	for (const name of set.abilities || []) {
		const ability = dex.abilities.get(name);

		if (!ability.exists) continue;

		let value;

		if (DEAD_NATIVE_ABILITIES.has(ability.id)) value = 0;
		else if (ability.id in NATIVE_OVERRIDES) value = NATIVE_OVERRIDES[ability.id];
		else value = Math.max(0, (ability.rating - 2) * 12);

		if (['hugepower', 'purepower'].includes(ability.id) && side !== 'Physical') value = 0;

		best = Math.max(best, value);
		total += value;
		count++;
	}

	// The Pokémon keeps its own ability until it Mega Evolves, and
	// the generator picks among the listed abilities.
	return count ? (best + total / count) / 2 : 0;
}

function countMoves(moveIDs, test) {
	return moveIDs.filter(id => test(dex.moves.get(id))).length;
}

function sideAttack(move, side) {
	if (move.category === 'Status' || isUtility(move)) return false;
	if (side === 'Physical' || side === 'Special') return move.category === side;

	return true;
}

// Learnable attack of the set's side that passes `test` and is
// good enough to add.
function canLearnAttack(species, side, test, context) {
	return !!bestLearnable(species, context, move => sideAttack(move, side) && test(move));
}

function effectiveness(type, types) {
	if (!dex.getImmunity(type, types)) return 0;

	return 2 ** dex.getEffectiveness(type, types);
}

function megaAbilityValue(abilityID, ctx) {
	const {side, set, species, types, doubles} = ctx;
	const moves = set.movepool.map(toID);
	const attacker = side !== 'Support';
	const physical = side === 'Physical' || side === 'Mixed';
	const special = side === 'Special' || side === 'Mixed';
	const bulky = BULKY_ROLES.has(set.role) || side === 'Support';
	const fast = FAST_ROLES.has(set.role);
	const stabAttacks = countMoves(moves, m => sideAttack(m, side) && types.includes(m.type));
	const learn = test => canLearnAttack(species, side, test, ctx.moveContext);
	const count = test => countMoves(moves, m => sideAttack(m, side) && test(m));
	const flagValue = (flag, full, half) => {
		const n = count(m => !!m.flags[flag]);
		if (n >= 2) return full;
		if (n === 1) return (full + half) / 2;
		return learn(m => !!m.flags[flag]) ? half : 0;
	};
	const statusCount = countMoves(moves, m => m.category === 'Status');
	const weak = type => effectiveness(type, types) > 1;

	switch (abilityID) {
	case 'hugepower':
	case 'purepower':
		// Doubling Attack is worth about as much as the Attack itself.
		return side === 'Physical' ? ctx.stats.atk : side === 'Mixed' ? ctx.stats.atk / 2 : 0;
	case 'parentalbond':
		return attacker ? 60 : 10;
	case 'adaptability':
		return attacker ? (stabAttacks >= 2 ? 45 : stabAttacks ? 35 : 10) : 5;
	case 'speedboost':
		if (moves.includes('trickroom')) return -20;
		return attacker ? (fast ? 45 : 30) : 20;
	case 'toughclaws':
		return physical ? flagValue('contact', 35, 15) : 0;
	case 'strongjaw':
		return physical ? flagValue('bite', 40, 20) : 0;
	case 'ironfist':
		return physical ? flagValue('punch', 30, 15) : 0;
	case 'sharpness':
		return physical ? flagValue('slicing', 40, 20) : 0;
	case 'megalauncher':
		return special ? flagValue('pulse', 40, 20) : 0;
	case 'technician': {
		const n = count(m => m.basePower > 0 && m.basePower <= 60);
		if (n) return physical ? 30 : 15;
		return learn(m => m.basePower > 0 && m.basePower <= 60 && (m.priority > 0 || !!m.multihit)) ? 20 : 0;
	}
	case 'skilllink': {
		const n = count(m => Array.isArray(m.multihit));
		if (n) return 40;
		return learn(m => Array.isArray(m.multihit)) ? 25 : 0;
	}
	case 'sheerforce': {
		const n = count(m => secondariesOf(m).length > 0);
		return n >= 2 ? 30 : n ? 18 : 0;
	}
	case 'pixilate':
	case 'aerilate':
	case 'refrigerate':
	case 'dragonize':
	case 'galvanize': {
		if (!attacker) return 0;
		const newType = {pixilate: 'Fairy', aerilate: 'Flying', refrigerate: 'Ice', dragonize: 'Dragon',
			galvanize: 'Electric'}[abilityID];
		const normal = learn(m => m.type === 'Normal' && m.basePower >= 80);
		if (!normal) return 0;
		return types.includes(newType) ? 45 : 30;
	}
	case 'noguard': {
		const n = count(m => m.accuracy !== true && m.accuracy < 90);
		const extra = learn(m => m.accuracy !== true && m.accuracy <= 80 && m.basePower >= 100);
		return Math.min(35, n * 12 + (extra ? 15 : 0));
	}
	case 'contrary': {
		const setup = moves.filter(id => raisesOwnStats(dex.moves.get(id))).length;
		if (setup) return -40 * setup;
		const drop = count(m => !!m.self?.boosts && Object.values(m.self.boosts).some(v => v < 0));
		const canLearn = learn(m => !!m.self?.boosts && Object.values(m.self.boosts).some(v => v < 0) &&
			m.basePower >= 100);
		return drop ? 55 : canLearn ? 45 : 0;
	}
	case 'prankster':
		return statusCount >= 2 ? (bulky ? 35 : 25) : statusCount ? 15 : 0;
	case 'magicbounce':
		return bulky ? 30 : 22;
	case 'intimidate':
		return (doubles ? 30 : 18) + (bulky ? 5 : 0);
	case 'regenerator': {
		const pivot = moves.some(id => ['uturn', 'voltswitch', 'flipturn', 'teleport', 'partingshot',
			'chillyreception'].includes(id));
		return bulky || pivot ? 40 : 22;
	}
	case 'multiscale':
		return bulky || moves.some(id => ['roost', 'recover', 'moonlight', 'synthesis', 'slackoff',
			'softboiled', 'morningsun', 'shoreup', 'milkdrink', 'strengthsap'].includes(id)) ? 30 : 15;
	case 'filter':
		return bulky ? 25 : 18;
	case 'levitate':
	case 'eelevate': {
		const base = abilityID === 'eelevate' && attacker ? 10 : 0;
		if (effectiveness('Ground', types) === 0) return base;
		return base + (weak('Ground') ? 35 : 18);
	}
	case 'flashfire':
		return weak('Fire') ? 25 : effectiveness('Fire', types) === 1 ? 15 : 6;
	case 'voltabsorb':
	case 'lightningrod':
		return (weak('Electric') ? 25 : 10) + (doubles ? 10 : 0);
	case 'stormdrain':
		return (weak('Water') ? 25 : 10) + (doubles ? 10 : 0);
	case 'thickfat':
		return weak('Fire') || weak('Ice') ? 30 : 15;
	case 'bulletproof':
		return 12;
	case 'shellarmor':
	case 'stalwart':
	case 'steadfast':
		return 5;
	case 'innerfocus':
		return doubles ? 12 : 6;
	case 'insomnia':
		return 8;
	case 'infiltrator':
		return 10;
	case 'healer':
		return doubles ? 8 : 0;
	case 'trace':
		return 10;
	case 'scrappy':
		return attacker && count(m => ['Normal', 'Fighting'].includes(m.type)) ? 20 : 8;
	case 'defiant':
		return physical ? (doubles ? 22 : 15) : 3;
	case 'berserk':
		return special ? 15 : 5;
	case 'piercingdrill':
	case 'unseenfist':
		return physical && count(m => !!m.flags.contact) ? (doubles ? 25 : 18) : 0;
	case 'moldbreaker':
		return attacker ? 15 : 5;
	case 'thermalexchange':
		return physical ? 15 : 8;
	case 'baddreams':
		return moves.some(id => ['spore', 'sleeppowder', 'hypnosis', 'yawn', 'darkvoid'].includes(id)) ? 15 : 3;
	case 'auraguard':
		return 20;
	case 'aurabreak':
		return 0;
	case 'fairyaura':
		return count(m => m.type === 'Fairy') ? 30 : learn(m => m.type === 'Fairy' && m.basePower >= 80) ? 18 : 0;
	case 'firemane':
		return count(m => m.type === 'Fire') ? 35 : learn(m => m.type === 'Fire' && m.basePower >= 80) ? 20 : 0;
	case 'electricsurge':
		return count(m => m.type === 'Electric') ? 30 : 5;
	case 'megasol': {
		const fire = count(m => m.type === 'Fire');
		const water = count(m => m.type === 'Water');
		const grass = count(m => m.type === 'Grass');
		return fire * 18 + (grass && learn(m => m.id === 'solarbeam') ? 15 : 0) - water * 20 +
			(moves.includes('synthesis') || moves.includes('morningsun') || moves.includes('moonlight') ? 10 : 0);
	}
	case 'drought': {
		const fire = count(m => m.type === 'Fire');
		const water = count(m => m.type === 'Water');
		return fire * 15 - water * 20 + (types.includes('Grass') ? 10 : 0) + 3;
	}
	case 'snowwarning':
		return (types.includes('Ice') ? 22 : 0) + (learn(m => m.id === 'blizzard') ? 12 : 0) + 3;
	case 'sandstream':
		return types.includes('Rock') ? 25 : ['Ground', 'Steel'].some(t => types.includes(t)) ? 8 : -5;
	case 'sandforce':
		return count(m => ['Rock', 'Ground', 'Steel'].includes(m.type)) ? 6 : 0;
	case 'solarpower':
		return -5;
	case 'swiftswim':
		return 0;
	case 'soulheart':
		return special ? 30 : 5;
	case 'spicyspray':
		return bulky ? 25 : 15;
	case 'innardsout':
		return bulky ? 10 : 5;
	case 'protean':
		return attacker ? 35 : 10;
	default:
		return 5;
	}
}

// Defensive typing: lower is better.
function typeScore(types) {
	let score = 0;

	for (const type of dex.types.names()) {
		if (type === 'Stellar') continue;

		const eff = effectiveness(type, types);

		score += eff === 0 ? -2.5 : Math.log2(eff);
	}

	return score;
}

/*
 * ===========================================================
 * SCORING
 * ===========================================================
 */
const STONES = stones();
const STONE_INFO = new Map(STONES.map(stone => {
	const d = deltas(stone.id);
	return [stone.id, {stone, mega: megaOf(stone.id), deltas: d, ability: toID(d.ability)}];
}));

function evaluate(species, set, stoneID, doubles) {
	const info = STONE_INFO.get(stoneID);
	const mixed = mix(species.name, stoneID);
	const side = setSide(set);
	const w = statWeights(set, side);
	const moveContext = {
		types: mixed.types,
		doubles,
		trusted: new Set(set.movepool.map(toID)),
		contrary: info.ability === 'contrary',
		noGuard: info.ability === 'noguard',
		skillLink: info.ability === 'skilllink',
		technician: info.ability === 'technician',
	};
	const ctx = {side, set, species, types: mixed.types, stats: mixed.baseStats, doubles, moveContext};

	let statScore = 0;
	for (const stat of STATS) {
		let weight = w[stat];

		// Extra Speed matters less on Pokémon that are already fast.
		if (stat === 'spe' && weight > 0) {
			const spe = species.baseStats.spe;
			weight *= spe >= 125 ? 0.4 : spe >= 105 ? 0.65 : 1;
		}

		statScore += weight * (mixed.baseStats[stat] - species.baseStats[stat]);
	}

	const abilityScore = megaAbilityValue(info.ability, ctx);

	// Type change: better defensive profile and new STAB options.
	let typeChange = 0;
	if (mixed.types.join('/') !== species.types.join('/')) {
		typeChange += (typeScore(species.types) - typeScore(mixed.types)) * 3;

		for (const type of mixed.types) {
			if (species.types.includes(type) || side === 'Support') continue;
			if (canLearnAttack(species, side, m => m.type === type && m.basePower >= 70, moveContext)) {
				typeChange += 10;
			}
		}

		for (const type of species.types) {
			if (mixed.types.includes(type)) continue;
			// Losing a STAB the set relies on.
			const used = set.movepool.some(name => {
				const m = dex.moves.get(name);
				return m.type === type && sideAttack(m, side);
			});
			if (used) typeChange -= 15;
		}
	}

	typeChange = Math.max(-30, Math.min(25, typeChange));

	// Keeping the Pokémon's own ability (e.g. Huge Power Azumarill
	// with Mawilite, Drought Torkoal with Charizardite Y) means it
	// loses nothing when it Mega Evolves.
	const keepsAbility = (set.abilities || []).some(a => toID(a) === info.ability);
	const keepBonus = keepsAbility ? nativeValue(set, side) : 0;

	// A different weather would undo the Pokémon's own weather.
	const WEATHER = {drought: 'sun', drizzle: 'rain', sandstream: 'sand', snowwarning: 'snow',
		megasol: 'sun', orichalcumpulse: 'sun'};
	const ownWeather = (set.abilities || []).map(a => WEATHER[toID(a)]).find(Boolean);
	const megaWeather = WEATHER[info.ability];
	const weatherClash = ownWeather && megaWeather && ownWeather !== megaWeather ? -40 : 0;

	const score = statScore + abilityScore + typeChange + keepBonus + weatherClash;

	// Strength change for levels: compare with how the Pokémon
	// normally fights (forme-change abilities are lost).
	const reference = referenceStats(species, set);
	let formeLoss = 0;
	for (const stat of STATS) formeLoss += w[stat] * (species.baseStats[stat] - reference[stat]);

	const strengthChange = score + formeLoss - nativeValue(set, side);

	return {stoneID, score, statScore, abilityScore, typeChange, strengthChange, mixed, side};
}

function allowed(species, stoneID) {
	if (MANUAL_EXCLUSIONS[stoneID]?.includes(species.id)) return false;

	if (POWER_STONES.has(stoneID)) {
		const bst = Object.values(referenceStatsForBST(species)).reduce((a, b) => a + b, 0);
		if (bst > POWER_STONE_MAX_BST) return false;
	}

	return true;
}

function referenceStatsForBST(species) {
	if (species.id === 'wishiwashi') return dex.species.get('Wishiwashi-School').baseStats;
	if (species.id === 'palafin') return dex.species.get('Palafin-Hero').baseStats;
	if (species.id === 'terapagos') return dex.species.get('Terapagos-Terastal').baseStats;

	return species.baseStats;
}

module.exports = {
	raisesOwnStats, STONES, STONE_INFO, POWER_STONES, legalPool, evaluate, allowed, setSide, learnable,
	bestLearnable, moveValue, sideAttack, ITEM_RELIANT_MOVES, toID, typeScore, effectiveness,
	MANUAL_PAIRINGS, MANUAL_EXCLUSIONS, POWER_STONE_MAX_USES, SRC, OUT, REPORT, dex,
};
