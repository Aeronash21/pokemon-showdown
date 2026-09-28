'use strict';

/*
 * ===========================================================
 * POKÉROGUE RANDOM BATTLE SETS
 * ===========================================================
 *
 * Builds the set data for the PokeRogue Random Battle formats:
 *
 *   data/random-battles/pokerogue/sets.json          singles
 *   data/random-battles/pokerogue/ffa-sets.json      FFA (4-way free-for-all)
 *   data/random-battles/pokerogue/doubles-sets.json  2v2 (multi battle, with an ally)
 *
 * Starting point: the ND Shared Power random sets (Showdown's
 * National Dex random battle sets with physical / special fixes),
 * or Showdown's Gen 9 sets: the singles sets for singles and FFA
 * (FFA is singles with three foes: self-sufficient sets, spread
 * attacks count for more, nothing that needs an ally), the doubles
 * sets for 2v2. Every set is then made into a PokéRogue set:
 *
 *  1. Only moves in the Pokémon's PokéRogue move list, only its
 *     PokéRogue abilities.
 *  2. Attacks are upgraded to the strongest PokéRogue option of the
 *     same type, counting STAB, the passive (Aerilate, Technician,
 *     Strong Jaw, Sheer Force, Drizzle, Contrary...), drawbacks and
 *     (in FFA / 2v2) spread damage. Egg moves get a bonus here, so a
 *     comparable egg move wins over a regular one (Dragon Hammer over
 *     Outrage, Pyro Ball over Flare Blitz, Psystrike over Psychic,
 *     Aura Sphere over Focus Blast...). Upgraded STAB moves and egg
 *     moves are `required`, so the final set always keeps them.
 *  3. Other egg moves are worked in by what they do: coverage that
 *     hits new types, priority, setup (a setup set of its own if the
 *     Pokémon has none: Dragon Dance Garchomp, Shell Smash Mew...),
 *     recovery, Spore, better Protect variants (Burning Bulwark...),
 *     pivots, hazards and other support moves on support sets.
 *  4. 2v2 only: doubles moves where the Pokémon learns them (Protect,
 *     Fake Out, Follow Me / Rage Powder, Helping Hand, Tailwind / Trick
 *     Room, Wide Guard, Pollen Puff, Icy Wind / Electroweb / Snarl,
 *     Coaching...) and spread STAB attacks.
 *  5. Level: the set's normal random battle level, lowered by how
 *     much the passive and egg moves add (up to 12 levels).
 *
 * Gigantamax forms (Max Mushrooms) and Megas without a set of their
 * own are built from their base form's sets with their own stats.
 * Necrozma-Dusk-Mane / Dawn-Wings also get Ultra Burst sets (holding
 * Ultranecrozium Z with Photon Geyser; see ULTRA_BURST).
 *
 * Usage (after `node build`):
 *   node tools/pokerogue/build-random-sets.cjs [--review review.txt]
 * --review writes every set with its level change and what changed.
 */

const fs = require('fs');
const path = require('path');
const {Dex} = require('../../dist/sim/dex');

const dex = Dex.mod('pokerogue');
const toID = Dex.toID;
const OUT = path.resolve(__dirname, '../../data/random-battles/pokerogue');

const NDSP = {
	singles: require('../../data/random-battles/ndsharedpower/sets.json'),
	doubles: require('../../data/random-battles/ndsharedpower/doubles-sets.json'),
};
const GEN9 = {
	singles: require('../../data/random-battles/gen9/sets.json'),
	doubles: require('../../data/random-battles/gen9/doubles-sets.json'),
};

/*
 * -----------------------------------------------------------
 * Move lists
 * -----------------------------------------------------------
 */
const SETUP = {
	// id: [side, strength (levels it is worth when new)]
	swordsdance: ['Physical', 1.5], dragondance: ['Physical', 1.5], bulkup: ['Physical', 1], coil: ['Physical', 1.5],
	shiftgear: ['Physical', 2], victorydance: ['Physical', 2], tidyup: ['Physical', 1.5], bellydrum: ['Physical', 2],
	curse: ['Physical', 0.5], howl: ['Physical', 0.5], honeclaws: ['Physical', 0.5],
	nastyplot: ['Special', 1.5], calmmind: ['Special', 1], quiverdance: ['Special', 2], tailglow: ['Special', 2],
	takeheart: ['Special', 1.5], geomancy: ['Special', 2.5],
	shellsmash: ['Both', 2.5], noretreat: ['Both', 2], clangoroussoul: ['Both', 2], filletaway: ['Both', 2],
	workup: ['Both', 0.5], growth: ['Both', 1],
	agility: ['Both', 0.5], rockpolish: ['Both', 0.5], autotomize: ['Both', 0.5],
	irondefense: ['Defense', 0.5], cosmicpower: ['Defense', 1], acidarmor: ['Defense', 0.5],
};
const RECOVERY = new Set([
	'recover', 'roost', 'slackoff', 'softboiled', 'milkdrink', 'moonlight', 'morningsun', 'synthesis', 'shoreup',
	'strengthsap', 'healorder', 'wish', 'lunarblessing', 'junglehealing',
]);
const PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'chillyreception', 'shedtail']);
const HAZARDS = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
// Non-attacking egg moves worth building a support set around (value in levels).
const SUPPORT_EGG = {
	spore: 1.5, revivalblessing: 1.5, shedtail: 1, sleeppowder: 1, lovelykiss: 0.5, glare: 0.5, yawn: 0.3,
	willowisp: 0.3, thunderwave: 0.3, toxic: 0.3, encore: 0.5, taunt: 0.3, stickyweb: 0.5, stealthrock: 0.5,
	spikes: 0.5, toxicspikes: 0.3, defog: 0.3, rapidspin: 0.3, courtchange: 0.3, healbell: 0.3, aromatherapy: 0.3,
	auroraveil: 0.5, reflect: 0.3, lightscreen: 0.3, trickroom: 0.3, tailwind: 0.3, leechseed: 0.3, haze: 0.3,
	partingshot: 0.5, uturn: 0.3, voltswitch: 0.3, flipturn: 0.3, chillyreception: 0.5, teleport: 0.2,
	banefulbunker: 0.3, spikyshield: 0.3, kingsshield: 0.3, silktrap: 0.3, burningbulwark: 0.3, obstruct: 0.3,
	substitute: 0.2, memento: 0.2, painsplit: 0.3, whirlwind: 0.2, roar: 0.2, trick: 0.2, switcheroo: 0.2,
	matblock: 0.2, followme: 0.3, ragepowder: 0.3, wideguard: 0.2, fakeout: 0.3, destinybond: 0.2, saltcure: 0.5,
};
// Attacks that are there for what they do, not their damage (never replaced by upgrades).
const UTILITY_ATTACKS = new Set([
	'uturn', 'voltswitch', 'flipturn', 'knockoff', 'rapidspin', 'mortalspin', 'fakeout', 'firstimpression', 'scald',
	'nuzzle', 'icywind', 'electroweb', 'snarl', 'bulldoze', 'rocktomb', 'mudshot', 'trailblaze', 'flamecharge',
	'seismictoss', 'nightshade', 'superfang', 'ruination', 'naturesmadness', 'foulplay', 'bodypress', 'terablast',
	'saltcure', 'stoneaxe', 'ceaselessedge', 'drainpunch', 'gigadrain', 'hornleech', 'leechlife', 'drainingkiss',
	'paraboliccharge', 'oblivionwing', 'bitterblade', 'matchagotcha', 'suckerpunch', 'extremespeed', 'aquajet',
	'machpunch', 'bulletpunch', 'iceshard', 'shadowsneak', 'accelerock', 'vacuumwave', 'jetpunch', 'quickattack',
	'grassyglide', 'thunderclap', 'upperhand', 'triplearrows', 'spiritshackle', 'thousandwaves', 'thousandarrows',
	'freezedry', 'shellsidearm', 'photongeyser', 'pursuit', 'clearsmog', 'acidspray', 'fierywrath', 'direclaw',
	'barbbarrage', 'infernalparade', 'bittermalice', 'chillingwater', 'spinout', 'lashout', 'poltergeist',
	'psyshock', 'secretsword', 'psystrike', 'bodyslam', 'scaleshot', 'swordsdance',
]);
// Never pulled in automatically (conditional, gimmicky or self-defeating).
const NO_AUTO = new Set([
	'dreameater', 'synchronoise', 'belch', 'lastresort', 'focuspunch', 'skyattack', 'razorwind', 'skullbash',
	'meteorbeam', 'electroshot', 'freezeshock', 'iceburn', 'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant',
	'hydrocannon', 'rockwrecker', 'prismaticlaser', 'eternabeam', 'roaroftime', 'meteorassault', 'selfdestruct',
	'explosion', 'mistyexplosion', 'steelroller', 'hyperspacefury', 'hyperspacehole', 'darkvoid', 'aurawheel',
	'orderup', 'fling', 'naturalgift', 'spitup', 'bide', 'counter', 'mirrorcoat', 'metalburst', 'comeuppance',
	'endeavor', 'finalgambit', 'present', 'magnitude', 'beatup', 'snore', 'lastrespects', 'ragefist', 'terablast',
	'storedpower', 'powertrip', 'punishment', 'trumpcard', 'reversal', 'flail', 'wringout', 'crushgrip',
	'solarbeam', 'solarblade', 'futuresight', 'doomdesire', 'shelltrap', 'beakblast', 'burnup', 'doubleshock',
	'retaliate', 'round', 'echoedvoice', 'furycutter', 'rollout', 'iceball', 'uproar', 'thrash', 'petaldance',
	'ragingfury', 'outrage', 'lunge', 'firstimpression', 'fakeout', 'suckerpunch', 'thief', 'covet', 'pluck',
	'bugbite', 'hex', 'venoshock', 'brine', 'facade', 'acrobatics', 'assurance', 'payback', 'avalanche', 'revenge',
	'stompingtantrum', 'temperflare', 'boltbeak', 'fishiousrend', 'electroball', 'gyroball', 'grassknot', 'lowkick',
	'heavyslam', 'heatcrash', 'weatherball', 'terrainpulse', 'expandingforce', 'risingvoltage', 'mistyexplosion',
	'hardpress', 'ivycudgel', 'ragingbull', 'tripledive', 'populationbomb', 'eruption', 'waterspout', 'dragonenergy',
	'revelationdance', 'relicsong', 'mindblown', 'steelbeam', 'chloroblast',
	'struggle', 'chatter', 'celebrate', 'splash', 'holdhands', 'happyhour', 'spotlight', 'allyswitch',
	'hiddenpower', 'darkvoid', 'fissure', 'sheercold', 'horndrill', 'guillotine', 'covet', 'entrainment', 'powder',
	'fellstinger',
]);
/** Egg moves get this bonus when compared with regular moves (the 4th, rare egg move a bit more). */
const EGG_BONUS = 1.1;
const RARE_EGG_BONUS = 1.15;
/** Protect variants that beat plain Protect / Detect. */
const PROTECT_VARIANTS = new Set(['spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct']);
const PROTECT_LIKE = new Set(['protect', 'detect', ...PROTECT_VARIANTS]);
/** Attacks that raise the user's stats: worth more than their power as coverage. */
function selfBoosting(move) {
	const boosts = move.secondary?.self?.boosts || move.self?.boosts;
	return !!boosts && Object.values(boosts).some(v => v > 0) && !Object.values(boosts).some(v => v < 0);
}
// ...but these conditional moves are fine when the Pokémon clearly supports them.
function conditionalOK(move, ctx) {
	switch (move.id) {
	case 'eruption': case 'waterspout': case 'dragonenergy':
		return !ctx.bulky; // full-HP attacks on offensive sets
	case 'boltbeak': case 'fishiousrend':
		return ctx.species.baseStats.spe >= 80;
	case 'solarbeam': case 'solarblade':
		return ctx.weather === 'sun';
	case 'weatherball':
		return !!ctx.weather;
	case 'facade':
		return ['guts', 'toxicboost', 'flareboost', 'quickfeet', 'marvelscale', 'poisonheal'].includes(ctx.passiveID);
	case 'expandingforce':
		return ctx.passiveID === 'psychicsurge' || ctx.abilityIDs.includes('psychicsurge');
	case 'risingvoltage':
		return ctx.passiveID === 'electricsurge' || ctx.abilityIDs.includes('electricsurge');
	case 'grassyglide':
		return ctx.passiveID === 'grassysurge' || ctx.abilityIDs.includes('grassysurge');
	case 'mindblown': case 'steelbeam': case 'chloroblast':
		return ctx.passiveID === 'magicguard';
	case 'populationbomb':
		return ctx.passiveID === 'technician' || ctx.passiveID === 'skilllink';
	case 'ivycudgel':
		return true;
	case 'fakeout': case 'suckerpunch': case 'firstimpression':
		return true;
	default:
		return false;
	}
}

/*
 * -----------------------------------------------------------
 * PokéRogue data helpers
 * -----------------------------------------------------------
 */
function prLearnset(species) {
	let current = species;
	for (let i = 0; current && i < 3; i++) {
		const data = dex.data.Learnsets[current.id];
		if (data && data.pokeRogue && data.learnset) return new Set(Object.keys(data.learnset));
		const from = current.battleOnly || current.changesFrom || (current.isCosmeticForme ? current.baseSpecies : '');
		const next = dex.species.get(Array.isArray(from) ? from[0] : from);
		current = next.exists && next.id !== current.id ? next : null;
	}
	return new Set();
}
function canLearn(learnset, moveid) {
	if (learnset.has(moveid)) return true;
	if (!learnset.has('sketch')) return false;
	const move = dex.moves.get(moveid);
	return move.exists && !move.flags['nosketch'] && !move.isZ && !move.isMax && !move.isNonstandard;
}
/** The species a set is used by out of battle (Megas / G-Max start as their base form). */
function outOfBattle(species) {
	if (species.battleOnly) return dex.species.get(Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly);
	return species;
}
function passiveOf(species) {
	return species.passive || outOfBattle(species).passive || '';
}
function eggMovesOf(species) {
	return (outOfBattle(species).eggMoves || []).map(toID);
}

/*
 * -----------------------------------------------------------
 * How strong is a move on this Pokémon?
 * -----------------------------------------------------------
 */
const ATE = {aerilate: 'Flying', pixilate: 'Fairy', refrigerate: 'Ice', galvanize: 'Electric', dragonize: 'Dragon'};
const WEATHER_SETTERS = {drizzle: 'rain', primordialsea: 'rain', drought: 'sun', desolateland: 'sun', orichalcumpulse: 'sun',
	megasol: 'sun', snowwarning: 'snow', sandstream: 'sand'};

/** mode: 'singles', 'ffa' or 'doubles' (2v2) */
function makeContext(species, template, mode) {
	const isDoubles = mode === 'doubles';
	const passiveName = passiveOf(species);
	const passiveID = toID(passiveName);
	const abilityIDs = (template.abilities || []).map(toID);
	// The passive counts; for the ability, only count one that every option shares.
	const effects = new Set([passiveID]);
	if (abilityIDs.length === 1) effects.add(abilityIDs[0]);
	// Megas / Primals have a fixed ability in battle (Aerilate Salamence...).
	if (species.battleOnly && species.requiredItem) effects.add(toID(species.abilities[0]));
	let weather = '';
	for (const e of effects) if (WEATHER_SETTERS[e]) weather = WEATHER_SETTERS[e];
	const stats = species.baseStats;
	let atk = stats.atk;
	let spa = stats.spa;
	if (effects.has('hugepower') || effects.has('purepower')) atk *= 2;
	if (effects.has('gorillatactics') || effects.has('hustle')) atk *= 1.5;
	if (effects.has('solarpower') && weather === 'sun') spa *= 1.5;
	const bulky = stats.hp + stats.def + stats.spd >= 300 && stats.spe < 90;
	return {
		species, types: species.types, passiveName, passiveID, abilityIDs, effects, weather, atk, spa, bulky, isDoubles, mode,
		eggMoves: eggMovesOf(species),
	};
}

function eggBonus(move, ctx) {
	const index = ctx.eggMoves.indexOf(move.id);
	return index < 0 ? 1 : index === 3 ? RARE_EGG_BONUS : EGG_BONUS;
}
/** Power with the egg move bonus: what attacks are chosen by. */
function score(move, ctx) {
	return effectivePower(move, ctx) * eggBonus(move, ctx);
}

const TYPE_NAMES = dex.types.names().filter(t => t !== 'Stellar');
function typeEffect(attackType, defenseType) {
	if (!dex.getImmunity(attackType, defenseType)) return 0;
	return 2 ** dex.getEffectiveness(attackType, defenseType);
}
/** How many types an attack of this type hits harder than the attacks already there. */
function coverageGain(type, poolTypes) {
	let gain = 0;
	for (const defense of TYPE_NAMES) {
		const before = Math.max(0, ...poolTypes.map(t => typeEffect(t, defense)));
		const after = typeEffect(type, defense);
		if (after > before) gain += after >= 2 ? 1 : 0.5;
	}
	return gain;
}

function effectiveType(move, ctx) {
	if (move.type === 'Normal' && move.category !== 'Status') {
		for (const e of ctx.effects) if (ATE[e]) return ATE[e];
	}
	if (move.id === 'weatherball' && ctx.weather) {
		return {rain: 'Water', sun: 'Fire', snow: 'Ice', sand: 'Rock'}[ctx.weather];
	}
	if (move.id === 'ivycudgel') return 'Grass';
	// Moves that take the type of the form's item (Plates, Memories, Drives)
	if (['judgment', 'multiattack'].includes(move.id)) return ctx.types[0];
	if (move.id === 'technoblast') {
		return {Douse: 'Water', Shock: 'Electric', Burn: 'Fire', Chill: 'Ice'}[ctx.species.forme] || 'Normal';
	}
	return move.type;
}

function isStab(type, ctx) {
	return ctx.types.includes(type) || ctx.effects.has('protean') || ctx.effects.has('libero');
}

function effectivePower(move, ctx) {
	if (!move.exists || move.category === 'Status') return 0;
	const e = ctx.effects;
	let bp = move.basePower;
	switch (move.id) {
	case 'eruption': case 'waterspout': case 'dragonenergy': bp = 150 * 0.8; break;
	case 'crushgrip': case 'wringout': bp = 120 * 0.8; break;
	case 'boltbeak': case 'fishiousrend': bp = 85 * 1.6; break;
	case 'acrobatics': bp = 90; break;
	case 'facade': bp = conditionalOK(move, ctx) ? 140 : 70; break;
	case 'weatherball': bp = ctx.weather ? 100 : 50; break;
	case 'expandingforce': bp = conditionalOK(move, ctx) ? 120 : 80; break;
	case 'risingvoltage': bp = conditionalOK(move, ctx) ? 140 : 70; break;
	case 'lowkick': case 'grassknot': case 'heavyslam': case 'heatcrash': bp = 80; break;
	case 'gyroball': case 'electroball': bp = 60; break;
	case 'return': case 'frustration': bp = 102; break;
	case 'hex': case 'venoshock': case 'brine': bp = 70; break;
	case 'storedpower': case 'powertrip': bp = 60; break;
	case 'ragefist': bp = 75; break;
	case 'lastrespects': bp = 75; break;
	case 'poltergeist': bp = 105; break;
	case 'firstimpression': bp = 60; break;
	case 'hardpress': bp = 70; break;
	case 'populationbomb': bp = 20 * (e.has('skilllink') ? 10 : 6); break;
	}
	if (!bp) return 0; // fixed damage etc.

	let hits = 1;
	if (move.multihit) {
		if (Array.isArray(move.multihit)) hits = e.has('skilllink') ? move.multihit[1] : 3.1;
		else hits = move.multihit;
		if (move.id === 'populationbomb') hits = 1;
		if (move.id === 'tripleaxel') { bp = 40; hits = e.has('skilllink') ? 3 : 2.6; }
		if (move.id === 'triplekick') { bp = 20; hits = 2.6; }
	}

	let type = effectiveType(move, ctx);
	let power = bp;
	if (type !== move.type && ATE[[...e].find(x => ATE[x]) || '']) power *= 1.2;
	if (e.has('technician') && bp <= 60) power *= 1.5;
	if (e.has('ironfist') && move.flags['punch']) power *= 1.2;
	if (e.has('strongjaw') && move.flags['bite']) power *= 1.5;
	if (e.has('megalauncher') && move.flags['pulse']) power *= 1.5;
	if (e.has('sharpness') && move.flags['slicing']) power *= 1.5;
	if (e.has('toughclaws') && move.flags['contact']) power *= 1.3;
	if (e.has('punkrock') && move.flags['sound']) power *= 1.3;
	if (e.has('reckless') && (move.recoil || move.hasCrashDamage)) power *= 1.2;
	const hasSecondary = !!(move.secondary || move.secondaries || move.hasSheerForceBoost);
	if (e.has('sheerforce') && hasSecondary) power *= 1.3;
	if (e.has('serenegrace') && hasSecondary) power *= 1.1;
	if (e.has('waterbubble') && type === 'Water') power *= 2;
	if (e.has('transistor') && type === 'Electric') power *= 1.3;
	if (e.has('dragonsmaw') && type === 'Dragon') power *= 1.5;
	if (e.has('steelworker') && type === 'Steel') power *= 1.5;
	if (e.has('rockypayload') && type === 'Rock') power *= 1.5;
	if (move.willCrit) power *= e.has('sniper') ? 2.25 : 1.5;
	else if (move.critRatio && move.critRatio >= 2) power *= e.has('superluck') ? 1.3 : 1.1;
	if (e.has('parentalbond') && hits === 1 && !['allAdjacentFoes', 'allAdjacent'].includes(move.target)) power *= 1.25;
	if (ctx.weather === 'rain') { if (type === 'Water') power *= 1.5; if (type === 'Fire') power *= 0.5; }
	if (ctx.weather === 'sun') {
		if (type === 'Fire' || move.id === 'hydrosteam') power *= 1.5; else if (type === 'Water') power *= 0.5;
	}
	if (ctx.weather === 'sand' && e.has('sandforce') && ['Rock', 'Ground', 'Steel'].includes(type)) power *= 1.3;
	// Spread attacks: in FFA every other Pokémon is a foe; in 2v2 "all adjacent" also hits the ally.
	if (ctx.mode === 'ffa' && ['allAdjacentFoes', 'allAdjacent'].includes(move.target)) power *= 1.2;
	if (ctx.mode === 'doubles') {
		if (move.target === 'allAdjacentFoes') power *= 1.2;
		else if (move.target === 'allAdjacent') power *= 1.05;
	}
	power *= hits;

	// STAB
	if (ctx.types.includes(type)) {
		power *= e.has('adaptability') ? 2 : 1.5;
	} else if (e.has('protean') || e.has('libero')) {
		power *= 1.3;
	}

	// accuracy
	let acc = move.accuracy === true ? 1 : move.accuracy / 100;
	if (e.has('noguard')) acc = 1;
	if (e.has('compoundeyes')) acc = Math.min(1, acc * 1.3);
	if (e.has('hustle') && move.category === 'Physical') acc *= 0.8;
	if (ctx.weather === 'rain' && ['thunder', 'hurricane', 'bleakwindstorm', 'wildboltstorm', 'sandsearstorm'].includes(move.id)) acc = 1;
	if (ctx.weather === 'snow' && move.id === 'blizzard') acc = 1;
	power *= acc;

	// drawbacks
	const selfBoosts = move.self?.boosts || (move.selfBoost?.boosts);
	const contrary = e.has('contrary');
	if (selfBoosts && Object.values(selfBoosts).some(v => v < 0)) {
		const drop = Object.entries(selfBoosts).filter(([, v]) => v < 0).reduce((a, [, v]) => a - v, 0);
		power *= contrary ? 1.25 : (drop >= 2 ? 0.85 : 0.95);
	}
	if (move.recoil && !e.has('rockhead') && !e.has('magicguard')) power *= 1 - (move.recoil[0] / move.recoil[1]) * 0.3;
	if (move.mindBlownRecoil || move.id === 'steelbeam' || move.id === 'chloroblast') power *= e.has('magicguard') ? 1 : 0.6;
	if (move.hasCrashDamage && !e.has('magicguard')) power *= 0.92;
	if (move.self?.volatileStatus === 'mustrecharge') power *= 0.5;
	if (move.self?.volatileStatus === 'lockedmove') power *= 0.8;
	if (move.flags['charge'] && !(ctx.weather === 'sun' && ['solarbeam', 'solarblade'].includes(move.id))) power *= 0.45;
	if (move.selfdestruct) power *= 0.25;
	if (move.id === 'boltbeak' || move.id === 'fishiousrend') power *= ctx.species.baseStats.spe >= 100 ? 1 : 0.85;
	if (['focuspunch', 'belch', 'lastresort', 'dreameater', 'synchronoise'].includes(move.id)) power *= 0.2;

	// attacking stat
	const cat = attackCategory(move);
	const stat = move.id === 'bodypress' ? ctx.species.baseStats.def :
		move.id === 'foulplay' ? 100 :
		cat === 'Physical' ? ctx.atk : ctx.spa;
	return power * stat / 100;
}

function attackCategory(move) {
	if (move.category === 'Status') return null;
	if (move.id === 'photongeyser' || move.id === 'shellsidearm' || move.id === 'terablast') return 'Either';
	return move.category;
}

/*
 * -----------------------------------------------------------
 * Roles
 * -----------------------------------------------------------
 */
const SETUP_ROLES = new Set(['Setup Sweeper', 'Bulky Setup', 'Fast Bulky Setup', 'Doubles Setup Sweeper', 'Doubles Bulky Setup']);
const SUPPORT_ROLES = new Set(['Bulky Support', 'Fast Support', 'Staller', 'Doubles Support', 'Bulky Protect']);
const BULKY_ROLES = new Set(['Bulky Attacker', 'Bulky Support', 'Bulky Setup', 'Staller', 'Doubles Bulky Attacker',
	'Doubles Bulky Setup', 'Bulky Protect', 'Doubles Support']);

/** Roles Showdown's Gen 9 generator doesn't know (National Dex gimmicks). */
function normalizeRole(template) {
	if (template.role === 'Z-Move user' || template.role === 'Dynamax User') {
		const hasSetup = template.movepool.some(m => SETUP[toID(m)]);
		template.role = hasSetup ? 'Setup Sweeper' : 'Wallbreaker';
	}
}

function templateSide(template, ctx) {
	let physical = 0;
	let special = 0;
	for (const name of template.movepool) {
		const move = dex.moves.get(name);
		const cat = attackCategory(move);
		if (!cat || cat === 'Either' || UTILITY_ATTACKS.has(move.id)) continue;
		if (cat === 'Physical') physical++; else special++;
	}
	if (physical && !special) return 'Physical';
	if (special && !physical) return 'Special';
	if (!physical && !special) return ctx.atk >= ctx.spa ? 'Physical' : 'Special';
	return physical >= special * 2 ? 'Physical' : special >= physical * 2 ? 'Special' : 'Mixed';
}
function fitsSide(move, side) {
	const cat = attackCategory(move);
	if (!cat || cat === 'Either' || side === 'Mixed') return true;
	return cat === side;
}

/*
 * -----------------------------------------------------------
 * Passive value (levels)
 * -----------------------------------------------------------
 */
const PASSIVE_LEVELS = {
	hugepower: 8, purepower: 8, parentalbond: 4, wonderguard: 4, shadowtag: 2.5, arenatrap: 2, moody: 3,
	speedboost: 4, protean: 3, libero: 3, adaptability: 3.5, magicguard: 2, serenegrace: 2, sheerforce: 2.5,
	toughclaws: 2.5, technician: 2.5, skilllink: 2.5, strongjaw: 2.5, megalauncher: 2.5, sharpness: 2.5, ironfist: 1.5,
	punkrock: 1.5, reckless: 1.5, aerilate: 3.5, pixilate: 3.5, refrigerate: 3.5, galvanize: 3.5, dragonize: 3.5,
	drizzle: 2.5, drought: 2.5, snowwarning: 1, sandstream: 1, primordialsea: 3, desolateland: 3, deltastream: 1,
	orichalcumpulse: 3, hadronengine: 3, beadsofruin: 2.5, swordofruin: 2.5, tabletsofruin: 2, vesselofruin: 2,
	intrepidsword: 3, dauntlessshield: 1.5, supremeoverlord: 2, beastboost: 2, moxie: 2, soulheart: 1.5,
	simple: 3, contrary: 2.5, unaware: 1.5, regenerator: 1.5, multiscale: 1.5, shadowshield: 1.5, intimidate: 1.5,
	prankster: 1.5, magicbounce: 1.5, poisonheal: 1.5, guts: 1.5, toxicboost: 1.5, flareboost: 1.5, quickfeet: 1,
	marvelscale: 1, unburden: 1.5, furcoat: 2.5, fluffy: 1.5, icescales: 1.5, stamina: 1.5, purifyingsalt: 1.5,
	goodasgold: 1.5, filter: 1, solidrock: 1, prismarmor: 1, thickfat: 1, levitate: 1, neuroforce: 1.5,
	tintedlens: 1.5, noguard: 1, compoundeyes: 0.5, neutralizinggas: 1, imposter: 1.5, electricsurge: 1.5,
	psychicsurge: 1.5, grassysurge: 1.5, mistysurge: 1, transistor: 1.5, dragonsmaw: 1.5, steelworker: 1.5,
	waterbubble: 2.5, battlebond: 1, flowergift: 1, terashell: 1.5, teraformzero: 0.3, comatose: 1,
	gorillatactics: 2.5, hustle: 1, zerotohero: 1, download: 1, sturdy: 0.5, berserk: 0.5, defiant: 0.5,
	competitive: 0.5, justified: 0.3, mirrorarmor: 0.5, clearbody: 0.3, naturalcure: 0.5, stakeout: 1.5,
	sniper: 0.5, superluck: 0.5, analytic: 1, heatproof: 0.5, bulletproof: 0.5, earthEater: 0.5,
};
/** How much the passive helps this set, in levels. */
function passiveLevels(ctx, template) {
	const id = ctx.passiveID;
	if (!id) return 0;
	// Redundant when the Pokémon already has it as its ability.
	if ((template.abilities || []).length === 1 && toID(template.abilities[0]) === id) return 0;
	let value = PASSIVE_LEVELS[id];
	if (value === undefined) value = Math.max(0, dex.abilities.get(id).rating - 2) * 0.7;

	const moves = template.movepool.map(m => dex.moves.get(m));
	const attacks = moves.filter(m => m.category !== 'Status');
	const share = test => attacks.length ? attacks.filter(test).length / attacks.length : 0;
	switch (id) {
	case 'hugepower': case 'purepower': case 'gorillatactics': case 'hustle': case 'toughclaws': case 'moxie':
		return value * share(m => m.category === 'Physical');
	case 'technician': return value * Math.min(1, 2 * share(m => m.basePower <= 60));
	case 'skilllink': return value * Math.min(1, 2 * share(m => !!m.multihit));
	case 'ironfist': return value * Math.min(1, 2 * share(m => !!m.flags['punch']));
	case 'strongjaw': return value * Math.min(1, 2 * share(m => !!m.flags['bite']));
	case 'megalauncher': return value * Math.min(1, 2 * share(m => !!m.flags['pulse']));
	case 'sharpness': return value * Math.min(1, 2 * share(m => !!m.flags['slicing']));
	case 'punkrock': return value * Math.min(1, 2 * share(m => !!m.flags['sound']));
	case 'reckless': return value * Math.min(1, 2 * share(m => !!(m.recoil || m.hasCrashDamage)));
	case 'sheerforce': case 'serenegrace':
		return value * Math.min(1, 1.5 * share(m => !!(m.secondary || m.secondaries)));
	case 'aerilate': case 'pixilate': case 'refrigerate': case 'galvanize': case 'dragonize':
		return value * Math.min(1, 2.5 * share(m => m.type === 'Normal'));
	case 'drizzle': case 'primordialsea':
		return value * (ctx.types.includes('Water') || moves.some(m => ['thunder', 'hurricane', 'weatherball'].includes(m.id)) ? 1 : 0.4);
	case 'drought': case 'desolateland': case 'orichalcumpulse':
		return value * (ctx.types.includes('Fire') || moves.some(m => ['solarbeam', 'solarblade', 'weatherball'].includes(m.id)) ? 1 : 0.4);
	case 'hadronengine': return value * share(m => m.category === 'Special') + (ctx.types.includes('Electric') ? 0.5 : 0);
	case 'simple': return value * (moves.some(m => SETUP[m.id]) ? 1 : 0.2);
	case 'contrary': return value * (moves.some(m => m.self?.boosts && Object.values(m.self.boosts).some(v => v < 0)) ? 1 : 0.2);
	case 'guts': case 'toxicboost': case 'flareboost': case 'poisonheal':
		return value * (moves.some(m => m.id === 'facade') || id === 'poisonheal' ? 1 : 0.6);
	case 'unburden': return value * (moves.some(m => SETUP[m.id]) ? 1 : 0.4);
	case 'prankster': return value * Math.min(1, 2 * (1 - share(() => true) + moves.filter(m => m.category === 'Status').length / Math.max(1, moves.length)));
	case 'speedboost': return value * (SUPPORT_ROLES.has(template.role) ? 0.5 : 1);
	}
	return value;
}

/*
 * -----------------------------------------------------------
 * Turning one base set into a PokéRogue set
 * -----------------------------------------------------------
 */
function convertTemplate(species, source, mode, notes) {
	const isDoubles = mode === 'doubles';
	const template = JSON.parse(JSON.stringify(source));
	normalizeRole(template);
	const learnset = prLearnset(species);
	const oob = outOfBattle(species);

	// 1. PokéRogue abilities (the out-of-battle form's).
	const prAbilities = Object.values(oob.abilities).filter(Boolean);
	let abilities = (template.abilities || []).filter(a => prAbilities.includes(a));
	if (!abilities.length) {
		const rated = prAbilities.filter(a => dex.abilities.get(a).rating >= 2);
		abilities = rated.length ? rated : prAbilities;
	}
	template.abilities = abilities;
	if (species.isMega || species.forme.includes('Gmax')) template.abilities = prAbilities;

	// 2v2: singles support roles become doubles support (the Gen 9 generator
	// then enforces redirection, Fake Out and speed control).
	if (isDoubles && ['Bulky Support', 'Fast Support'].includes(template.role)) template.role = 'Doubles Support';
	if (isDoubles && template.role === 'Staller') template.role = 'Bulky Protect';

	const ctx = makeContext(species, template, mode);
	const eggMoves = ctx.eggMoves;
	const isEgg = id => eggMoves.includes(id);
	/** move id -> priority (the three highest are kept as `required`) */
	const required = new Map();
	const need = (id, priority) => required.set(id, Math.max(required.get(id) || 0, priority));
	const levelNotes = [];
	let eggLevels = 0;

	// 2. PokéRogue-legal moves only (and, outside 2v2, nothing that only helps an ally).
	const illegal = [];
	template.movepool = template.movepool.filter(name => {
		const id = toID(name);
		if ((!isDoubles && ALLY_MOVES.has(id)) || USELESS.has(id)) return false;
		if (canLearn(learnset, id)) return true;
		illegal.push(dex.moves.get(id).name);
		return false;
	}).map(name => dex.moves.get(name).name);
	if (illegal.length) notes.push(`${species.name} (${template.role}): not in PokéRogue move list: ${illegal.join(', ')}`);

	let side = templateSide(template, ctx);
	const statSide = ctx.atk >= ctx.spa * 1.5 ? 'Physical' : ctx.spa >= ctx.atk * 1.5 ? 'Special' : null;
	const allLearnable = [...learnset].map(id => dex.moves.get(id))
		.filter(m => m.exists && !m.isZ && !m.isMax && !m.id.startsWith('hiddenpower') &&
			(!NO_AUTO.has(m.id) || conditionalOK(m, ctx)) && (isDoubles || !ALLY_MOVES.has(m.id)));
	if (learnset.has('sketch')) {
		for (const id of eggMoves) if (!learnset.has(id)) allLearnable.push(dex.moves.get(id));
	}
	const statFor = move => (attackCategory(move) === 'Special' ? ctx.spa : ctx.atk);

	const inPool = id => template.movepool.some(m => toID(m) === id);
	const addMove = move => { if (!inPool(move.id)) template.movepool.push(move.name); };
	const removeMove = id => { template.movepool = template.movepool.filter(m => toID(m) !== id); };
	const poolMoves = () => template.movepool.map(m => dex.moves.get(m));
	const attacksInPool = () => poolMoves().filter(m => m.category !== 'Status' && !UTILITY_ATTACKS.has(m.id));
	/** Every attack that does real damage (utility attacks like Psyshock or Knock Off included). */
	const damagingInPool = () => poolMoves().filter(m => m.category !== 'Status' && !m.priority &&
		(m.basePower >= 50 || m.basePowerCallback) && !NO_AUTO.has(m.id));
	const poolTypes = () => [...new Set(damagingInPool().map(m => effectiveType(m, ctx)))];

	// 3a. A passive or PokéRogue stats can change which side a Pokémon attacks
	// from (Huge Power Wigglytuff / Delibird...): rebuild the attacks.
	if (statSide && side !== 'Mixed' && side !== statSide && attacksInPool().length) {
		const oldAttacks = attacksInPool().map(m => m.name);
		for (const m of attacksInPool()) removeMove(m.id);
		side = statSide;
		const options = allLearnable.filter(m => m.category === statSide && !m.priority && !UTILITY_ATTACKS.has(m.id))
			.sort((a, b) => score(b, ctx) - score(a, ctx));
		const used = new Set();
		for (const m of options) {
			const type = effectiveType(m, ctx);
			if (used.has(type) || used.size >= 3) continue;
			if (!isStab(type, ctx) && used.size < 1 && options.some(o => isStab(effectiveType(o, ctx), ctx))) continue;
			if (!isStab(type, ctx) && coverageGain(type, [...used]) < 1) continue;
			used.add(type);
			addMove(m);
			if (isStab(type, ctx)) need(m.id, 6);
		}
		levelNotes.push(`${oldAttacks.join('/')} -> ${statSide.toLowerCase()} attacks (${ctx.passiveName || 'stats'})`);
	}

	// 3. Upgrade attacks type by type (this brings in most attacking egg moves).
	const attackRole = !SUPPORT_ROLES.has(template.role) || attacksInPool().length >= 2;
	const typesInPool = new Set(attacksInPool().map(m => effectiveType(m, ctx)));
	const stabTypes = new Set(ctx.types);
	for (const e of ctx.effects) if (ATE[e]) stabTypes.add(ATE[e]);
	const typesToCheck = new Set([...typesInPool, ...(attackRole ? stabTypes : [])]);
	for (const type of typesToCheck) {
		const current = attacksInPool().filter(m => effectiveType(m, ctx) === type);
		const candidates = allLearnable.filter(m => m.category !== 'Status' && effectiveType(m, ctx) === type &&
			fitsSide(m, side) && attackCategory(m) !== 'Either' && !m.priority &&
			(!UTILITY_ATTACKS.has(m.id) || isEgg(m.id)));
		if (!candidates.length) continue;
		candidates.sort((a, b) => score(b, ctx) - score(a, ctx));
		const top = candidates[0];
		const topPower = effectivePower(top, ctx);
		const isStabType = stabTypes.has(type);
		const egg = isEgg(top.id);
		if (!current.length) {
			// A missing STAB (e.g. an -ate Normal move, a new type from PokéRogue data),
			// unless a utility attack (Psyshock, Knock Off, Photon Geyser...) already covers it.
			if (!isStabType || topPower < 60 * statFor(top) / 100) continue;
			if (poolMoves().some(m => m.category !== 'Status' && !m.priority && effectiveType(m, ctx) === type &&
				(m.basePower >= 60 || attackCategory(m) === 'Either'))) {
				if (egg && inPool(top.id) && attackRole) need(top.id, 8);
				continue;
			}
			addMove(top);
			if (attackRole) need(top.id, egg ? 8 : 6);
			levelNotes.push(`+${top.name}${egg ? ' (egg)' : ''}`);
			if (egg) eggLevels += 1;
			continue;
		}
		const best = Math.max(0, ...current.map(m => effectivePower(m, ctx)));
		const bestScore = Math.max(0, ...current.map(m => score(m, ctx)));
		if (inPool(top.id)) {
			if (egg && attackRole) need(top.id, isStabType ? 8 : 5);
			continue;
		}
		// Egg moves win when they're at least as good (with the egg bonus);
		// regular moves only replace clearly weaker ones.
		if (score(top, ctx) <= bestScore * (egg ? 1 : 1.12)) continue;
		for (const m of current) {
			if (egg ? score(m, ctx) < score(top, ctx) : effectivePower(m, ctx) < topPower * 0.9) removeMove(m.id);
		}
		addMove(top);
		if (attackRole && (isStabType || egg)) need(top.id, isStabType ? (egg ? 8 : 6) : 5);
		const gain = Math.max(0, Math.min(2.5, (topPower / Math.max(best, 1) - 1) * (isStabType ? 5 : 2.5)));
		if (egg) eggLevels += gain;
		levelNotes.push(`${current.map(m => m.name).join('/')} -> ${top.name}${egg ? ' (egg)' : ''}`);
	}
	// Moves an egg move makes redundant
	if (inPool('psystrike')) removeMove('psyshock');
	side = templateSide(template, ctx);

	// 3b. Priority that becomes a strong STAB with the passive (Aerilate / Pixilate
	// Extreme Speed, Technician Bullet Punch...).
	if (attackRole && side !== 'Special') {
		const priority = allLearnable.filter(m => m.priority > 0 && m.category === 'Physical' &&
			stabTypes.has(effectiveType(m, ctx)) && m.type !== effectiveType(m, ctx) &&
			effectivePower(m, ctx) >= 80 * ctx.atk / 100)
			.sort((a, b) => effectivePower(b, ctx) - effectivePower(a, ctx));
		if (priority.length && !inPool(priority[0].id)) {
			addMove(priority[0]);
			if (SETUP_ROLES.has(template.role)) need(priority[0].id, 6);
			levelNotes.push(`+${priority[0].name} (${ctx.passiveName})`);
		}
	}

	// 4. Other egg moves, by what they do.
	const role = template.role;
	/** Coverage egg moves: the best one is kept for sure. */
	const coverageEggs = [];
	for (const id of eggMoves) {
		const move = dex.moves.get(id);
		if (!move.exists || !canLearn(learnset, id)) continue;
		if (!isDoubles && ALLY_MOVES.has(id)) continue;
		const rare = eggMoves.indexOf(id) === 3;
		if (inPool(id)) {
			// Already there (from the base set or an upgrade): keep it when it matters.
			if (move.category !== 'Status') {
				if (attackRole && fitsSide(move, side) && move.basePower >= 50) {
					if (stabTypes.has(effectiveType(move, ctx))) need(id, 7);
					else coverageEggs.push({id, value: score(move, ctx) * (rare ? 2 : 1.5)});
				}
			} else if (SETUP[id] && SETUP_ROLES.has(role)) {
				need(id, 10);
			} else if (RECOVERY.has(id) && (BULKY_ROLES.has(role) || SETUP_ROLES.has(role))) {
				need(id, 7);
			} else if (['spore', 'revivalblessing', 'shedtail'].includes(id) || PROTECT_VARIANTS.has(id)) {
				need(id, 6);
			}
			continue;
		}
		if (move.category !== 'Status') {
			if (NO_AUTO.has(id) && !conditionalOK(move, ctx)) continue;
			if (!attackRole || !fitsSide(move, side) || attackCategory(move) === 'Either') {
				if (PIVOTS.has(id) && SUPPORT_ROLES.has(role) && !template.movepool.some(m => PIVOTS.has(toID(m)))) {
					addMove(move);
					levelNotes.push(`+${move.name} (egg, pivot)`);
					eggLevels += 0.3;
				}
				continue;
			}
			const power = effectivePower(move, ctx);
			const type = effectiveType(move, ctx);
			if (move.priority > 0) {
				// Priority on attacking sets
				if (power >= 40 * statFor(move) / 100 && !poolMoves().some(m => m.category !== 'Status' && m.priority > 0)) {
					addMove(move);
					if (stabTypes.has(type) || rare) need(id, 4);
					levelNotes.push(`+${move.name} (egg, priority)`);
					eggLevels += 0.5;
				}
				continue;
			}
			const types = poolTypes();
			if (types.includes(type)) continue;
			const maxPower = Math.max(1, ...damagingInPool().map(m => effectivePower(m, ctx)));
			const gain = coverageGain(type, types);
			const strongEnough = power * eggBonus(move, ctx) >= 0.6 * maxPower ||
				(selfBoosting(move) && power >= 0.4 * maxPower);
			if (gain >= 1 && strongEnough) {
				// Coverage that hits new types
				addMove(move);
				if (gain >= 2 || rare || selfBoosting(move)) {
					coverageEggs.push({id, value: score(move, ctx) * gain * (rare || selfBoosting(move) ? 1.5 : 1)});
				}
				levelNotes.push(`+${move.name} (egg, coverage)`);
				eggLevels += 0.5;
			} else if (PIVOTS.has(id) && !template.movepool.some(m => PIVOTS.has(toID(m))) && !SETUP_ROLES.has(role)) {
				addMove(move);
				levelNotes.push(`+${move.name} (egg, pivot)`);
				eggLevels += 0.3;
			}
			continue;
		}
		if (SETUP[id]) {
			const [setupSide, strength] = SETUP[id];
			const fits = setupSide === 'Both' || setupSide === side || side === 'Mixed' ||
				(setupSide === 'Defense' && template.movepool.some(m => ['bodypress', 'storedpower'].includes(toID(m))));
			if (!fits || !SETUP_ROLES.has(role)) continue;
			const currentSetup = template.movepool.filter(m => SETUP[toID(m)]);
			const currentBest = Math.max(0, ...currentSetup.map(m => SETUP[toID(m)][1]));
			if (!currentSetup.length || strength >= currentBest - 0.25) {
				for (const m of currentSetup) removeMove(toID(m));
				addMove(move);
				need(id, 10);
				eggLevels += Math.max(0.3, strength - currentBest);
				levelNotes.push(`${currentSetup.join('/') || 'no setup'} -> ${move.name} (egg)`);
			}
			continue;
		}
		if (RECOVERY.has(id)) {
			if (['AV Pivot', 'Choice Item user', 'Wallbreaker', 'Doubles Wallbreaker'].includes(role)) continue;
			if (template.movepool.some(m => RECOVERY.has(toID(m)))) continue;
			addMove(move);
			if (BULKY_ROLES.has(role) || SETUP_ROLES.has(role)) {
				need(id, 7);
				eggLevels += 1;
			} else {
				eggLevels += 0.5;
			}
			levelNotes.push(`+${move.name} (egg, recovery)`);
			continue;
		}
		if (PROTECT_VARIANTS.has(id)) {
			const plain = template.movepool.filter(m => ['protect', 'detect'].includes(toID(m)));
			if (plain.length) {
				for (const m of plain) removeMove(toID(m));
			} else if (!['Staller', 'Bulky Protect', 'Offensive Protect'].includes(role) &&
				!(isDoubles && role !== 'Choice Item user')) {
				continue;
			}
			addMove(move);
			need(id, 6);
			eggLevels += 0.3;
			levelNotes.push(`${plain.join('/') || '+'} -> ${move.name} (egg)`);
			continue;
		}
		if (SUPPORT_EGG[id] !== undefined) {
			const anyRole = id === 'spore' || (id === 'fakeout' && isDoubles) ||
				(['partingshot', 'shedtail'].includes(id) && !SETUP_ROLES.has(role) && role !== 'Choice Item user');
			if (!SUPPORT_ROLES.has(role) && role !== 'Doubles Support' && !anyRole) continue;
			if (!isDoubles && ['followme', 'ragepowder', 'wideguard', 'matblock'].includes(id)) continue;
			if (mode === 'ffa' && ['fakeout'].includes(id)) continue;
			addMove(move);
			if (SUPPORT_EGG[id] >= 1 || id === 'fakeout') need(id, 6);
			eggLevels += SUPPORT_EGG[id];
			levelNotes.push(`+${move.name} (egg)`);
		}
	}

	if (coverageEggs.length) {
		coverageEggs.sort((a, b) => b.value - a.value);
		need(coverageEggs[0].id, eggMoves.indexOf(coverageEggs[0].id) === 3 ? 5 : 4);
	}

	// 4b. 2v2: moves for playing next to an ally.
	if (isDoubles && !inPool('transform')) {
		addDoublesMoves(template, ctx, learnset, allLearnable, {inPool, addMove, need, poolMoves, levelNotes});
	}

	// 5. Keep the move pool a sensible size: drop the weakest optional attacks.
	while (template.movepool.length > 8) {
		// never the only attack of a STAB type; regular coverage goes first
		const isOnlyStab = m => stabTypes.has(effectiveType(m, ctx)) &&
			damagingInPool().filter(o => effectiveType(o, ctx) === effectiveType(m, ctx)).length <= 1;
		const keep = m => score(m, ctx) * (stabTypes.has(effectiveType(m, ctx)) ? 2 : 1) * (isEgg(m.id) ? 1.5 : 1);
		const optional = poolMoves().filter(m => !required.has(m.id) && m.category !== 'Status' &&
			!UTILITY_ATTACKS.has(m.id) && !isOnlyStab(m));
		if (!optional.length) break;
		optional.sort((a, b) => keep(a) - keep(b));
		removeMove(optional[0].id);
	}
	if (template.movepool.length < 5) {
		// Refill from the strongest PokéRogue attacks that fit the set and hit
		// new types (egg moves first), then useful status moves.
		const types = poolTypes();
		const extra = allLearnable.filter(m => m.category !== 'Status' && fitsSide(m, side) && !inPool(m.id) &&
			!NO_AUTO.has(m.id) && !m.priority && attackCategory(m) !== 'Either' && effectivePower(m, ctx) > 0)
			.map(m => ({m, value: score(m, ctx) * (0.4 + 0.3 * Math.min(2, coverageGain(effectiveType(m, ctx), types)))}))
			.sort((a, b) => b.value - a.value);
		for (const {m} of extra) {
			if (template.movepool.length >= 5) break;
			const type = effectiveType(m, ctx);
			const now = poolTypes();
			if (now.includes(type) || (now.length && coverageGain(type, now) < 1 && !stabTypes.has(type))) continue;
			addMove(m);
			if (isEgg(m.id)) levelNotes.push(`+${m.name} (egg, refill)`);
		}
		const status = [...learnset].map(id => dex.moves.get(id))
			.filter(m => m.category === 'Status' && !inPool(m.id) && (isDoubles || !ALLY_MOVES.has(m.id)) &&
				(RECOVERY.has(m.id) || SUPPORT_EGG[m.id] >= 0.3 || m.id === 'protect'))
			.sort((a, b) => (RECOVERY.has(b.id) ? 2 : SUPPORT_EGG[b.id] || 0) + (isEgg(b.id) ? 1 : 0) -
				(RECOVERY.has(a.id) ? 2 : SUPPORT_EGG[a.id] || 0) - (isEgg(a.id) ? 1 : 0));
		for (const m of status) {
			if (template.movepool.length >= 4) break;
			addMove(m);
		}
	}
	// A setup role needs a setup move the generator knows.
	if (SETUP_ROLES.has(template.role) && !template.movepool.some(m => SETUP[toID(m)])) {
		template.role = isDoubles ? 'Doubles Bulky Attacker' : (ctx.bulky ? 'Bulky Attacker' : 'Fast Attacker');
	}
	if (template.role === 'Tera Blast user' && !inPool('terablast')) template.role = 'Wallbreaker';

	// Moves the set must keep: species overrides, then the highest priorities (at most 3).
	const override = OVERRIDES[species.id];
	for (const name of override?.required || []) {
		const move = dex.moves.get(name);
		if (!canLearn(learnset, move.id)) continue;
		addMove(move);
		need(move.id, 100);
	}
	// 2v2 support sets keep room for redirection / speed control / Helping Hand.
	const maxRequired = isDoubles && DOUBLES_SUPPORT_ROLES.has(template.role) ? 2 : 3;
	const req = [...required.entries()].filter(([id]) => inPool(id))
		.sort((a, b) => b[1] - a[1]).slice(0, maxRequired).map(([id]) => id);
	if (req.length) template.required = req.map(id => dex.moves.get(id).name);
	else delete template.required;

	const passiveLv = passiveLevels(ctx, template);
	const eggLv = Math.min(eggLevels, 5);
	template.levelDrop = Math.round(Math.min(12, passiveLv + eggLv));
	template.notes = {passive: ctx.passiveName, passiveLv: +passiveLv.toFixed(1), eggLv: +eggLv.toFixed(1), changes: levelNotes};
	return template;
}

/*
 * -----------------------------------------------------------
 * 2v2: playing next to an ally
 * -----------------------------------------------------------
 */
const DOUBLES_SUPPORT_ROLES = new Set(['Doubles Support', 'Bulky Protect']);
const ATTACKER_ROLES = new Set(['Doubles Fast Attacker', 'Doubles Bulky Attacker', 'Doubles Wallbreaker', 'Offensive Protect',
	'Bulky Attacker', 'Fast Attacker', 'Wallbreaker', 'AV Pivot']);
function addDoublesMoves(template, ctx, learnset, allLearnable, {inPool, addMove, need, poolMoves, levelNotes}) {
	const role = template.role;
	const species = ctx.species;
	const can = id => canLearn(learnset, id) && !inPool(id);
	const added = [];
	const add = id => { addMove(dex.moves.get(id)); added.push(dex.moves.get(id).name); };
	const has = list => list.some(id => inPool(id));
	const choice = role === 'Choice Item user' || role === 'AV Pivot';
	const setup = SETUP_ROLES.has(role) || role === 'Tera Blast user';
	const spe = species.baseStats.spe;

	// Protect (or the egg / signature variant) on everything that isn't choice-locked.
	if (!choice && !has([...PROTECT_LIKE])) {
		const variant = ctx.eggMoves.find(id => PROTECT_VARIANTS.has(id) && canLearn(learnset, id));
		const protect = variant || ['protect', 'detect'].find(id => canLearn(learnset, id));
		if (protect) add(protect);
	}
	// Setup + Protect is the standard doubles setup set.
	if (setup) {
		const protect = poolMoves().find(m => PROTECT_LIKE.has(m.id));
		if (protect) need(protect.id, 6);
	}
	if (DOUBLES_SUPPORT_ROLES.has(role)) {
		let budget = 3;
		const tryAdd = (...ids) => {
			if (budget <= 0 || has(ids)) return;
			const id = ids.find(can);
			if (id) { add(id); budget--; }
		};
		tryAdd('followme', 'ragepowder');
		tryAdd('fakeout');
		if (spe <= 60) tryAdd('trickroom'); else tryAdd('tailwind');
		tryAdd('helpinghand');
		tryAdd('wideguard');
		tryAdd('pollenpuff');
		tryAdd('icywind', 'electroweb', 'snarl');
		tryAdd('coaching', 'decorate', 'instruct');
		tryAdd('lifedew', 'healpulse');
	} else if (!setup && !choice) {
		// Attackers: up to two of Fake Out, speed control (Tailwind when fast,
		// Trick Room when slow), Icy Wind-style control and Helping Hand on bulky ones.
		let budget = 2;
		const tryAdd = (...ids) => {
			if (budget <= 0 || has(ids)) return;
			const id = ids.find(can);
			if (id) { add(id); budget--; }
		};
		const bulky = ['Doubles Bulky Attacker', 'Bulky Attacker', 'Bulky Protect'].includes(role);
		tryAdd('fakeout');
		if (spe >= 70 && !has(['trickroom'])) tryAdd('tailwind');
		if (spe <= 50 && bulky && !has(['tailwind'])) tryAdd('trickroom');
		const side = templateSide(template, ctx);
		if (bulky) {
			const control = ['icywind', 'electroweb', 'snarl'].filter(id => fitsSide(dex.moves.get(id), side) || side === 'Physical');
			tryAdd(...control);
			tryAdd('helpinghand');
		}
	}
	// A spread STAB attack if the set has none and a good one exists.
	if (!DOUBLES_SUPPORT_ROLES.has(role)) {
		const spread = m => m.basePower && ['allAdjacentFoes', 'allAdjacent'].includes(m.target);
		if (!poolMoves().some(m => spread(m) && m.basePower >= 60)) {
			const side = templateSide(template, ctx);
			const best = Math.max(1, ...poolMoves().filter(m => m.category !== 'Status' && !m.priority &&
				ctx.types.includes(effectiveType(m, ctx))).map(m => effectivePower(m, ctx)));
			const options = allLearnable.filter(m => spread(m) && m.basePower >= 60 && !inPool(m.id) &&
				fitsSide(m, side) && ctx.types.includes(effectiveType(m, ctx)) && score(m, ctx) >= 0.8 * best)
				.sort((a, b) => score(b, ctx) - score(a, ctx));
			if (options.length) add(options[0].id);
		}
	}
	if (added.length) levelNotes.push(`+${added.join(', ')} (doubles)`);
}

/*
 * A setup set built from a Pokémon's attacking set when its only
 * setup move comes from its egg moves (Dragon Dance Garchomp...).
 */
function buildEggSetupTemplate(species, templates, mode) {
	const isDoubles = mode === 'doubles';
	const learnset = prLearnset(species);
	const eggSetup = eggMovesOf(species).filter(id => SETUP[id] && canLearn(learnset, id) && SETUP[id][1] >= 1);
	if (!eggSetup.length) return null;
	if (templates.some(t => SETUP_ROLES.has(t.role))) return null;
	const attacker = templates.find(t => !SUPPORT_ROLES.has(t.role) && t.role !== 'Doubles Support') || templates[0];
	if (!attacker) return null;
	const ctx = makeContext(species, attacker, mode);
	const side = templateSide(attacker, ctx);
	const id = eggSetup.find(s => (['Both', side].includes(SETUP[s][0]) || side === 'Mixed') &&
		(SETUP[s][1] >= 1.5 || ctx.bulky || attacker.movepool.some(m => RECOVERY.has(toID(m)))));
	if (!id) return null;
	const setup = JSON.parse(JSON.stringify(attacker));
	setup.role = isDoubles ? 'Doubles Setup Sweeper' : (ctx.bulky ? 'Bulky Setup' : 'Setup Sweeper');
	setup.movepool = setup.movepool.filter(m => {
		const move = dex.moves.get(m);
		return move.category !== 'Status' || RECOVERY.has(move.id) || PROTECT_LIKE.has(move.id);
	});
	setup.movepool.push(dex.moves.get(id).name);
	return setup;
}

/*
 * Gigantamax forms and Megas with no set of their own: copy the base
 * form's sets (they'll be re-fitted to the form's own stats).
 */
function borrowedSets(species, table) {
	const base = outOfBattle(species);
	const data = table[base.id];
	if (!data) return null;
	return {level: data.level, sets: data.sets.filter(t => t.role !== 'Z-Move user')};
}

/*
 * -----------------------------------------------------------
 * Which Pokémon, at what level
 * -----------------------------------------------------------
 */
// Forms the generator produces from their base entry (Genesect drives, Vivillon...),
// in-battle forms, and Pokémon that don't work in random battles.
const SKIP = new Set([
	'eternatuseternamax', 'kyogreprimal', 'groudonprimal', 'shedinja', 'wobbuffet', 'unown', 'meltan',
	'pichuspikyeared', 'pikachucosplay', 'pikachurockstar', 'pikachubelle', 'pikachupopstar', 'pikachuphd',
	'pikachulibre', 'zygardecomplete', 'necrozmaultra', 'ogerponwellspringtera', 'ogerponhearthflametera',
	'ogerponcornerstonetera', 'ogerpontealtera', 'terapagosterastal', 'terapagosstellar', 'zaciancrowned',
	'zamazentacrowned', 'rayquazamega',
	// needs Power Construct to trigger first; far above everything else anyway
	'zygardemega',
]);
/**
 * Moves that only help an ally (or only make sense next to one): left out
 * of the singles and FFA sets, used in 2v2.
 */
const ALLY_MOVES = new Set([
	'followme', 'ragepowder', 'allyswitch', 'helpinghand', 'afteryou', 'coaching', 'decorate', 'instruct',
	'aromaticmist', 'holdhands', 'spotlight', 'healpulse', 'floralhealing', 'lifedew', 'quash', 'wideguard',
	'quickguard', 'matblock', 'craftyshield',
]);
/** Never in a set. */
const USELESS = new Set(['spotlight', 'holdhands', 'aromaticmist', 'celebrate', 'splash']);
/** Moves a set must keep for its form to work. */
const OVERRIDES = {
	keldeoresolute: {required: ['Secret Sword']},
};
/**
 * FIXED SETS (requested by the user): the only singles and FFA set for these
 * Pokémon, exactly as written: moves, ability, item, nature, gender (2v2 keeps
 * its own doubles sets). The generator applies `item` / `nature` / `gender`
 * after the Gen 9 generation, and `fixed` keeps the moves and ability as
 * they are. The level is not hand-picked: fixedSetLevel() uses the same
 * estimate as every other set (the species' random battle level, lowered by
 * the passive and the egg moves in the set). Anything that isn't legal in
 * PokéRogue is kept as written and reported when building (see checkFixedSet).
 */
const FIXED_SETS = {
	hydrapple: {
		role: 'Wallbreaker', item: 'Choice Specs', ability: 'Supersweet Syrup',
		moves: ['Matcha Gotcha', 'Core Enforcer', 'Hidden Power Rock', 'Pollen Puff'],
	},
	fezandipiti: {
		role: 'Fast Attacker', item: 'Loaded Dice', ability: 'Technician', gender: 'M',
		moves: ['Tail Slap', 'Tailwind', 'Triple Axel', 'Bonemerang'],
	},
	braviaryhisui: {
		role: 'Setup Sweeper', item: 'Leftovers', ability: 'Tinted Lens',
		moves: ['Stored Power', 'Aura Sphere', 'Defog', 'No Retreat'],
	},
	wigglytuff: {
		role: 'Bulky Attacker', item: 'Normal Gem', ability: 'Frisk',
		moves: ['Extreme Speed', 'Grav Apple', 'Wish', 'Stealth Rock'],
	},
	whiscash: {
		role: 'Setup Sweeper', item: 'Rocky Helmet', ability: 'Oblivious', nature: 'Adamant',
		moves: ['Triple Dive', 'Earthquake', 'High Horsepower', 'Dragon Dance'],
	},
};
/**
 * Ultra Burst sets: Necrozma-Dusk-Mane / Dawn-Wings holding Ultranecrozium Z
 * with Photon Geyser (Ultra Necrozma is the only Z-Move user). Level: the
 * form's lowest level minus ULTRA_BURST_LEVELS.
 */
const ULTRA_BURST = {
	necrozmaduskmane: {
		movepool: ['Photon Geyser', 'Dragon Dance', 'Earthquake', 'Knock Off', 'Sunsteel Strike'],
		abilities: ['Prism Armor'], teraTypes: ['Psychic', 'Dragon'],
	},
	necrozmadawnwings: {
		movepool: ['Photon Geyser', 'Calm Mind', 'Earth Power', 'Heat Wave', 'Astral Barrage', 'Moongeist Beam'],
		abilities: ['Prism Armor'], teraTypes: ['Psychic', 'Dragon'],
	},
};
const ULTRA_BURST_LEVELS = 3;
function levelFromBST(species) {
	const bst = Object.values(species.baseStats).reduce((a, b) => a + b, 0);
	return Math.max(68, Math.min(98, Math.round(110 - bst / 20)));
}

function ultraBurstTemplate(species, mode, sets) {
	const data = ULTRA_BURST[species.id];
	if (!data || !sets.length) return null;
	const learnset = prLearnset(species);
	const movepool = data.movepool.filter(m => canLearn(learnset, toID(m)));
	if (!movepool.includes('Photon Geyser')) return null;
	if (mode === 'doubles' && canLearn(learnset, 'protect')) movepool.push('Protect');
	return {
		role: mode === 'doubles' ? 'Doubles Setup Sweeper' : 'Setup Sweeper',
		movepool, abilities: data.abilities, teraTypes: data.teraTypes,
		required: ['Photon Geyser'], item: 'Ultranecrozium Z',
		level: Math.min(...sets.map(t => t.level)) - ULTRA_BURST_LEVELS,
	};
}

/** Why a part of a fixed set isn't legal in PokéRogue (empty if it all is). */
function checkFixedSet(species, fixed) {
	const problems = [];
	const learnset = prLearnset(species);
	for (const name of fixed.moves) {
		const move = dex.moves.get(name);
		const id = move.id.startsWith('hiddenpower') ? 'hiddenpower' : move.id;
		if (!move.exists) problems.push(`${name} doesn't exist`);
		else if (!canLearn(learnset, id)) problems.push(`${move.name} isn't in ${species.name}'s PokéRogue move list`);
	}
	if (!Object.values(outOfBattle(species).abilities).includes(fixed.ability)) {
		problems.push(`${fixed.ability} isn't one of ${species.name}'s abilities`);
	}
	const item = dex.items.get(fixed.item);
	if (!item.exists) problems.push(`${fixed.item} doesn't exist`);
	return problems;
}

/**
 * A fixed set's level, by the same estimate as the other sets: the species'
 * random battle level minus what its passive and the egg moves in the set add.
 * Egg attacks count by how much stronger they are than the best regular move
 * of their type (priority 0.5), egg setup by how much it beats the best
 * regular setup move, egg recovery 1, support egg moves their SUPPORT_EGG value.
 */
function fixedSetLevel(species, fixed, baseLevel, mode) {
	const template = {role: fixed.role, abilities: [fixed.ability], movepool: fixed.moves.slice()};
	const ctx = makeContext(species, template, mode);
	const learnset = prLearnset(species);
	const stabTypes = new Set(ctx.types);
	for (const e of ctx.effects) if (ATE[e]) stabTypes.add(ATE[e]);
	const side = templateSide(template, ctx);
	const regular = [...learnset].map(id => dex.moves.get(id))
		.filter(m => m.exists && !ctx.eggMoves.includes(m.id) && !m.isZ && !m.isMax && !m.id.startsWith('hiddenpower'));
	let eggLevels = 0;
	const eggNotes = [];
	for (const name of fixed.moves) {
		const move = dex.moves.get(name);
		if (!ctx.eggMoves.includes(move.id)) continue;
		let value = 0;
		if (move.category !== 'Status') {
			const type = effectiveType(move, ctx);
			const stab = stabTypes.has(type);
			if (move.priority > 0) {
				value = 0.5;
			} else {
				const alternatives = regular.filter(m => m.category !== 'Status' && !m.priority &&
					effectiveType(m, ctx) === type && fitsSide(m, side) && (!NO_AUTO.has(m.id) || conditionalOK(m, ctx)));
				const best = Math.max(0, ...alternatives.map(m => effectivePower(m, ctx)));
				value = best ? Math.max(0, Math.min(2.5, (effectivePower(move, ctx) / best - 1) * (stab ? 5 : 2.5))) :
					(stab ? 1 : 0.5);
			}
		} else if (SETUP[move.id]) {
			const [setupSide, strength] = SETUP[move.id];
			const best = Math.max(0, ...regular.filter(m => SETUP[m.id] &&
				[setupSide, 'Both'].includes(SETUP[m.id][0])).map(m => SETUP[m.id][1]));
			value = Math.max(0.3, strength - best);
		} else if (RECOVERY.has(move.id)) {
			value = 1;
		} else {
			value = SUPPORT_EGG[move.id] || 0;
		}
		eggLevels += value;
		eggNotes.push(`${move.name} ${value.toFixed(1)}`);
	}
	const passiveLv = passiveLevels(ctx, template);
	const eggLv = Math.min(eggLevels, 5);
	const levelDrop = Math.round(Math.min(12, passiveLv + eggLv));
	return {
		level: Math.max(55, baseLevel - levelDrop), levelDrop,
		notes: {passive: ctx.passiveName, passiveLv: +passiveLv.toFixed(1), eggLv: +eggLv.toFixed(1), changes: eggNotes},
	};
}

/** mode: 'singles', 'ffa' (singles sets fitted to a free-for-all) or 'doubles' (2v2) */
function build(mode) {
	const isDoubles = mode === 'doubles';
	const baseMode = isDoubles ? 'doubles' : 'singles';
	const base = {...GEN9[baseMode], ...NDSP[baseMode]};
	const out = {};
	const review = [];
	const notes = [];

	const pool = Object.keys(dex.data.Pokedex).map(id => dex.species.get(id)).filter(species => {
		if (!species.pokeRogue || species.isCosmeticForme || SKIP.has(species.id)) return false;
		if (species.battleOnly && !species.requiredItem && !species.requiredItems) return false;
		if (base[species.id]) return true;
		// no base set: only Gigantamax forms / Megas (from their base form) and a few specials
		return !!(species.requiredItem && borrowedSets(species, base));
	});

	for (const species of pool) {
		let data = base[species.id];
		let baseLevel = data?.level;
		if (!data || !data.sets.length) {
			data = borrowedSets(species, base);
			if (!data) continue;
			// Transformed forms are stronger than the form they start as.
			baseLevel = Math.min(data.level - 4, levelFromBST(species) + 2);
		}
		if (!baseLevel) baseLevel = levelFromBST(species);
		// PokéRogue's own tier changes (e.g. Kyurem to Uber) come from egg moves / passives below.

		const sets = [];
		const sources = data.sets.slice();
		const extra = buildEggSetupTemplate(species, sources.map(t => ({...t})), mode);
		if (extra) sources.push(extra);
		for (const source of sources) {
			if (!isDoubles && source.role.startsWith('Doubles')) continue;
			const template = convertTemplate(species, source, mode, notes);
			if (template.movepool.length < 2) continue;
			template.level = Math.max(55, baseLevel - template.levelDrop);
			sets.push(template);
		}
		if (!sets.length) continue;
		const ultra = ultraBurstTemplate(species, mode, sets);
		if (ultra) sets.push({...ultra, levelDrop: baseLevel - ultra.level, notes: {passive: 'Ultra Burst', passiveLv: 0, eggLv: 0, changes: []}});

		// Merge identical sets
		const unique = [];
		for (const t of sets) {
			const key = JSON.stringify([t.role, [...t.movepool].sort(), t.abilities, t.required, t.item]);
			if (!unique.some(u => u.key === key)) unique.push({key, t});
		}
		const finalSets = unique.map(({t}) => {
			const {notes: n, levelDrop, ...rest} = t;
			review.push(`${species.name.padEnd(26)} ${String(t.level).padStart(3)} (base ${baseLevel}, -${levelDrop}: passive ${n.passive || '-'} ${n.passiveLv}, egg ${n.eggLv})  ${t.role}: ${t.movepool.join(', ')}` +
				(t.required ? `  [required: ${t.required.join(', ')}]` : '') + (n.changes.length ? `  {${n.changes.join('; ')}}` : ''));
			return rest;
		});
		out[species.id] = {level: Math.max(...finalSets.map(t => t.level)), sets: finalSets};
	}

	// The user's fixed sets replace everything else in singles and FFA.
	if (!isDoubles) {
		for (const id in FIXED_SETS) {
			const species = dex.species.get(id);
			const fixed = FIXED_SETS[id];
			const baseLevel = base[id]?.level || levelFromBST(species);
			const {level, levelDrop, notes: n} = fixedSetLevel(species, fixed, baseLevel, mode);
			const template = {
				role: fixed.role, movepool: fixed.moves.slice(), abilities: [fixed.ability], teraTypes: species.types.slice(),
				fixed: true, item: fixed.item, level,
			};
			if (fixed.nature) template.nature = fixed.nature;
			if (fixed.gender) template.gender = fixed.gender;
			out[id] = {level, sets: [template]};
			const problems = checkFixedSet(species, fixed);
			for (const problem of problems) notes.push(`FIXED SET ${species.name}: not legal in PokéRogue: ${problem} (kept as written)`);
			review.push(`${species.name.padEnd(26)} ${String(level).padStart(3)} (base ${baseLevel}, -${levelDrop}: passive ${n.passive || '-'} ${n.passiveLv}, egg ${n.eggLv})  FIXED: ${fixed.moves.join(', ')} @ ${fixed.item} [${fixed.ability}]` +
				(n.changes.length ? `  {egg: ${n.changes.join('; ')}}` : ''));
		}
	}
	return {out, review, notes};
}

const FILES = {singles: 'sets.json', ffa: 'ffa-sets.json', doubles: 'doubles-sets.json'};
const TITLES = {singles: 'SINGLES', ffa: 'FFA', doubles: '2v2 (doubles sets)'};

function main() {
	fs.mkdirSync(OUT, {recursive: true});
	const lines = [];
	for (const mode of ['singles', 'ffa', 'doubles']) {
		const {out, review, notes} = build(mode);
		const file = FILES[mode];
		fs.writeFileSync(path.join(OUT, file), JSON.stringify(out, null, '\t') + '\n');
		const setCount = Object.values(out).reduce((a, s) => a + s.sets.length, 0);
		const withRequired = Object.values(out).reduce((a, s) => a + s.sets.filter(t => t.required).length, 0);
		console.log(`${file}: ${Object.keys(out).length} Pokémon, ${setCount} sets, ${withRequired} with egg / passive moves they must keep`);
		for (const note of notes) if (note.startsWith('FIXED SET')) console.log(`  warning: ${note}`);
		if (mode !== 'doubles') {
			console.log(`  fixed sets: ${Object.keys(FIXED_SETS).map(id => `${dex.species.get(id).name} L${out[id].level}`).join(', ')}`);
		}
		lines.push(`==== ${TITLES[mode]} ====`, ...review, '',
			`-- moves dropped because they aren't in PokéRogue move lists --`, ...notes, '');
	}
	const reviewArg = process.argv.indexOf('--review');
	if (reviewArg > 0 && process.argv[reviewArg + 1]) {
		fs.writeFileSync(process.argv[reviewArg + 1], lines.join('\n') + '\n');
	}
}

if (require.main === module) main();
module.exports = {build, effectivePower, makeContext, convertTemplate};
