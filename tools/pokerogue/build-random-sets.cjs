'use strict';

/*
 * ===========================================================
 * POKÉROGUE RANDOM BATTLE SETS
 * ===========================================================
 *
 * Builds the set data for the PokeRogue Random Battle formats:
 *
 *   data/random-battles/pokerogue/sets.json          singles
 *   data/random-battles/pokerogue/doubles-sets.json  FFA
 *
 * Starting point: the ND Shared Power random sets (Showdown's
 * National Dex random battle sets with physical / special fixes),
 * or Showdown's Gen 9 sets. Every set is then made into a
 * PokéRogue set:
 *
 *  1. Only moves in the Pokémon's PokéRogue move list, only its
 *     PokéRogue abilities.
 *  2. Attacks are upgraded to the strongest PokéRogue option of the
 *     same type, counting STAB, the passive (Aerilate, Technician,
 *     Strong Jaw, Sheer Force, Drizzle, Contrary...) and drawbacks.
 *     This is how most egg moves get in (Dragon Hammer, Bolt Beak,
 *     V-create, Surging Strikes...). Upgraded STAB moves are
 *     `required`, so the final set always keeps them.
 *  3. Egg moves that aren't attacks are worked in by role: setup
 *     egg moves get a setup set (Dragon Dance Garchomp, Shell Smash
 *     Mew...), recovery goes on bulky sets, Spore / Revival Blessing
 *     / pivots / hazards on support sets.
 *  4. Level: the set's normal random battle level, lowered by how
 *     much the passive and egg moves add (up to 12 levels).
 *
 * Gigantamax forms (Max Mushrooms) and Megas without a set of their
 * own are built from their base form's sets with their own stats.
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
]);
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

function makeContext(species, template, isDoubles) {
	const passiveName = passiveOf(species);
	const passiveID = toID(passiveName);
	const abilityIDs = (template.abilities || []).map(toID);
	// The passive counts; for the ability, only count one that every option shares.
	const effects = new Set([passiveID]);
	if (abilityIDs.length === 1) effects.add(abilityIDs[0]);
	let weather = '';
	for (const e of effects) if (WEATHER_SETTERS[e]) weather = WEATHER_SETTERS[e];
	const stats = species.baseStats;
	let atk = stats.atk;
	let spa = stats.spa;
	if (effects.has('hugepower') || effects.has('purepower')) atk *= 2;
	if (effects.has('gorillatactics') || effects.has('hustle')) atk *= 1.5;
	if (effects.has('solarpower') && weather === 'sun') spa *= 1.5;
	const bulky = stats.hp + stats.def + stats.spd >= 300 && stats.spe < 90;
	return {species, types: species.types, passiveName, passiveID, abilityIDs, effects, weather, atk, spa, bulky, isDoubles};
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
	if (move.self?.volatileStatus === 'lockedmove') power *= 0.9;
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
function convertTemplate(species, source, isDoubles, notes) {
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

	const ctx = makeContext(species, template, isDoubles);
	const eggMoves = eggMovesOf(species);
	const required = new Set();
	const levelNotes = [];
	let eggLevels = 0;

	// 2. PokéRogue-legal moves only (and nothing that only helps an ally:
	// these sets are for singles and FFA).
	const illegal = [];
	template.movepool = template.movepool.filter(name => {
		const id = toID(name);
		if (ALLY_MOVES.has(id)) return false;
		if (canLearn(learnset, id)) return true;
		illegal.push(dex.moves.get(id).name);
		return false;
	}).map(name => dex.moves.get(name).name);
	if (illegal.length) notes.push(`${species.name} (${template.role}): not in PokéRogue move list: ${illegal.join(', ')}`);

	let side = templateSide(template, ctx);
	const statSide = ctx.atk >= ctx.spa * 1.5 ? 'Physical' : ctx.spa >= ctx.atk * 1.5 ? 'Special' : null;
	const allLearnable = [...learnset].map(id => dex.moves.get(id))
		.filter(m => m.exists && !m.isZ && !m.isMax && (!NO_AUTO.has(m.id) || conditionalOK(m, ctx)));
	if (learnset.has('sketch')) {
		for (const id of eggMoves) if (!learnset.has(id)) allLearnable.push(dex.moves.get(id));
	}

	const inPool = id => template.movepool.some(m => toID(m) === id);
	const addMove = move => { if (!inPool(move.id)) template.movepool.push(move.name); };
	const removeMove = id => { template.movepool = template.movepool.filter(m => toID(m) !== id); };
	const attacksInPool = () => template.movepool.map(m => dex.moves.get(m))
		.filter(m => m.category !== 'Status' && !UTILITY_ATTACKS.has(m.id));

	// 3a. A passive or PokéRogue stats can change which side a Pokémon attacks
	// from (Huge Power Wigglytuff / Delibird...): rebuild the attacks.
	if (statSide && side !== 'Mixed' && side !== statSide && attacksInPool().length) {
		const oldAttacks = attacksInPool().map(m => m.name);
		for (const m of attacksInPool()) removeMove(m.id);
		side = statSide;
		const options = allLearnable.filter(m => m.category === statSide && !m.priority && !UTILITY_ATTACKS.has(m.id))
			.sort((a, b) => effectivePower(b, ctx) - effectivePower(a, ctx));
		const used = new Set();
		for (const m of options) {
			const type = effectiveType(m, ctx);
			if (used.has(type) || used.size >= 3) continue;
			if (!isStab(type, ctx) && used.size < 1 && options.some(o => isStab(effectiveType(o, ctx), ctx))) continue;
			used.add(type);
			addMove(m);
			if (isStab(type, ctx)) required.add(m.id);
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
		const best = Math.max(0, ...current.map(m => effectivePower(m, ctx)));
		const candidates = allLearnable.filter(m => m.category !== 'Status' && effectiveType(m, ctx) === type &&
			fitsSide(m, side) && attackCategory(m) !== 'Either' && !UTILITY_ATTACKS.has(m.id) && !m.priority);
		if (!candidates.length) continue;
		candidates.sort((a, b) => effectivePower(b, ctx) - effectivePower(a, ctx));
		const top = candidates[0];
		const topPower = effectivePower(top, ctx);
		const isStabType = stabTypes.has(type);
		if (!current.length) {
			// A missing STAB (e.g. an -ate Normal move, a new type from PokéRogue data)
			if (!isStabType || topPower < 60 * (side === 'Special' ? ctx.spa : ctx.atk) / 100) continue;
			addMove(top);
			if (attackRole) required.add(top.id);
			const egg = eggMoves.includes(top.id);
			levelNotes.push(`+${top.name}${egg ? ' (egg)' : ''}`);
			if (egg) eggLevels += 1;
			continue;
		}
		if (topPower <= best * 1.12 || inPool(top.id)) {
			if (inPool(top.id) && isStabType && eggMoves.includes(top.id) && attackRole) required.add(top.id);
			continue;
		}
		for (const m of current) {
			if (effectivePower(m, ctx) < topPower * 0.9) removeMove(m.id);
		}
		addMove(top);
		if (isStabType && attackRole) required.add(top.id);
		const egg = eggMoves.includes(top.id);
		const gain = Math.min(2.5, (topPower / Math.max(best, 1) - 1) * (isStabType ? 5 : 2.5));
		if (egg) eggLevels += gain;
		levelNotes.push(`${current.map(m => m.name).join('/')} -> ${top.name}${egg ? ' (egg)' : ''}`);
	}
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
			if (SETUP_ROLES.has(template.role)) required.add(priority[0].id);
			levelNotes.push(`+${priority[0].name} (${ctx.passiveName})`);
		}
	}

	// 4. Other egg moves, by what they do.
	for (const id of eggMoves) {
		const move = dex.moves.get(id);
		if (!move.exists || !canLearn(learnset, id) || inPool(id)) continue;
		if (move.category !== 'Status') {
			// Priority and strong coverage attacks on attacking sets.
			const power = effectivePower(move, ctx);
			if (!attackRole || !fitsSide(move, side)) continue;
			if (move.priority > 0 && power >= 40 * (side === 'Special' ? ctx.spa : ctx.atk) / 100 &&
				!attacksInPool().some(m => m.priority > 0)) {
				addMove(move);
				levelNotes.push(`+${move.name} (egg, priority)`);
				eggLevels += 0.5;
			} else if (!attacksInPool().some(m => effectiveType(m, ctx) === effectiveType(move, ctx)) &&
				power >= 0.8 * Math.max(...attacksInPool().map(m => effectivePower(m, ctx)), 1) &&
				(!NO_AUTO.has(id) || conditionalOK(move, ctx))) {
				addMove(move);
				levelNotes.push(`+${move.name} (egg, coverage)`);
				eggLevels += 0.5;
			} else if (UTILITY_ATTACKS.has(id) && PIVOTS.has(id) && !template.movepool.some(m => PIVOTS.has(toID(m)))) {
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
			if (!fits || !SETUP_ROLES.has(template.role)) continue;
			const currentSetup = template.movepool.filter(m => SETUP[toID(m)]);
			const currentBest = Math.max(0, ...currentSetup.map(m => SETUP[toID(m)][1]));
			if (strength > currentBest) {
				for (const m of currentSetup) removeMove(toID(m));
				addMove(move);
				required.add(id);
				eggLevels += strength - currentBest;
				levelNotes.push(`${currentSetup.join('/') || 'no setup'} -> ${move.name} (egg)`);
			}
			continue;
		}
		if (RECOVERY.has(id)) {
			if (!BULKY_ROLES.has(template.role) && !SETUP_ROLES.has(template.role)) continue;
			if (template.movepool.some(m => RECOVERY.has(toID(m)))) continue;
			if (template.role === 'AV Pivot') continue;
			addMove(move);
			required.add(id);
			eggLevels += 1;
			levelNotes.push(`+${move.name} (egg, recovery)`);
			continue;
		}
		if (SUPPORT_EGG[id] !== undefined) {
			if (!SUPPORT_ROLES.has(template.role)) continue;
			if (isDoubles !== true && ['followme', 'ragepowder', 'wideguard', 'matblock'].includes(id)) continue;
			addMove(move);
			if (SUPPORT_EGG[id] >= 1) required.add(id);
			eggLevels += SUPPORT_EGG[id];
			levelNotes.push(`+${move.name} (egg)`);
		}
	}

	// 5. Keep the move pool a sensible size: drop the weakest optional attacks.
	while (template.movepool.length > 8) {
		const optional = template.movepool.map(m => dex.moves.get(m))
			.filter(m => !required.has(m.id) && m.category !== 'Status' && !UTILITY_ATTACKS.has(m.id));
		if (!optional.length) break;
		optional.sort((a, b) => effectivePower(a, ctx) - effectivePower(b, ctx));
		removeMove(optional[0].id);
	}
	if (template.movepool.length < 5) {
		// Refill from the strongest PokéRogue attacks that fit the set, then
		// useful status moves.
		const extra = allLearnable.filter(m => m.category !== 'Status' && fitsSide(m, side) && !inPool(m.id) &&
			!NO_AUTO.has(m.id)).sort((a, b) => effectivePower(b, ctx) - effectivePower(a, ctx));
		const typesUsed = new Set(attacksInPool().map(m => effectiveType(m, ctx)));
		for (const m of extra) {
			if (template.movepool.length >= 5) break;
			if (typesUsed.has(effectiveType(m, ctx))) continue;
			typesUsed.add(effectiveType(m, ctx));
			addMove(m);
		}
		const status = [...learnset].map(id => dex.moves.get(id))
			.filter(m => m.category === 'Status' && !inPool(m.id) && !ALLY_MOVES.has(m.id) &&
				(RECOVERY.has(m.id) || SUPPORT_EGG[m.id] >= 0.3 || m.id === 'protect'))
			.sort((a, b) => (RECOVERY.has(b.id) ? 2 : SUPPORT_EGG[b.id] || 0) - (RECOVERY.has(a.id) ? 2 : SUPPORT_EGG[a.id] || 0));
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

	// At most 3 required moves, strongest first (setup, then STAB upgrades).
	let req = [...required].filter(id => inPool(id));
	req.sort((a, b) => (SETUP[b] ? 10 : 0) - (SETUP[a] ? 10 : 0));
	req = req.slice(0, 3);
	if (req.length) template.required = req.map(id => dex.moves.get(id).name);

	const passiveLv = passiveLevels(ctx, template);
	const eggLv = Math.min(eggLevels, 5);
	template.levelDrop = Math.round(Math.min(12, passiveLv + eggLv));
	template.notes = {passive: ctx.passiveName, passiveLv: +passiveLv.toFixed(1), eggLv: +eggLv.toFixed(1), changes: levelNotes};
	return template;
}

/*
 * A setup set built from a Pokémon's attacking set when its only
 * setup move comes from its egg moves (Dragon Dance Garchomp...).
 */
function buildEggSetupTemplate(species, templates, isDoubles) {
	const oob = outOfBattle(species);
	const learnset = prLearnset(species);
	const eggSetup = eggMovesOf(species).filter(id => SETUP[id] && canLearn(learnset, id) && SETUP[id][1] >= 1.5);
	if (!eggSetup.length) return null;
	if (templates.some(t => SETUP_ROLES.has(t.role))) return null;
	const attacker = templates.find(t => !SUPPORT_ROLES.has(t.role)) || templates[0];
	if (!attacker) return null;
	const ctx = makeContext(species, attacker, isDoubles);
	const side = templateSide(attacker, ctx);
	const id = eggSetup.find(s => ['Both', side].includes(SETUP[s][0]) || side === 'Mixed');
	if (!id) return null;
	const setup = JSON.parse(JSON.stringify(attacker));
	setup.role = isDoubles ? 'Doubles Setup Sweeper' : (ctx.bulky ? 'Bulky Setup' : 'Setup Sweeper');
	setup.movepool = setup.movepool.filter(m => {
		const move = dex.moves.get(m);
		return move.category !== 'Status' || RECOVERY.has(move.id) || move.id === 'protect';
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
/** Moves that only help an ally: useless in singles and FFA. */
const ALLY_MOVES = new Set([
	'followme', 'ragepowder', 'allyswitch', 'helpinghand', 'afteryou', 'coaching', 'decorate', 'instruct',
	'aromaticmist', 'holdhands', 'spotlight',
]);
function levelFromBST(species) {
	const bst = Object.values(species.baseStats).reduce((a, b) => a + b, 0);
	return Math.max(68, Math.min(98, Math.round(110 - bst / 20)));
}

function build(mode) {
	const isDoubles = mode === 'doubles';
	const base = {...GEN9[mode], ...NDSP[mode]};
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
		const extra = buildEggSetupTemplate(species, sources.map(t => ({...t})), isDoubles);
		if (extra) sources.push(extra);
		for (const source of sources) {
			if (isDoubles !== true && source.role.startsWith('Doubles')) continue;
			const template = convertTemplate(species, source, isDoubles, notes);
			if (template.movepool.length < 2) continue;
			template.level = Math.max(55, baseLevel - template.levelDrop);
			sets.push(template);
		}
		if (!sets.length) continue;

		// Merge identical sets
		const unique = [];
		for (const t of sets) {
			const key = JSON.stringify([t.role, [...t.movepool].sort(), t.abilities, t.required]);
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
	return {out, review, notes};
}

function main() {
	fs.mkdirSync(OUT, {recursive: true});
	const lines = [];
	for (const mode of ['singles', 'doubles']) {
		const {out, review, notes} = build(mode);
		const file = mode === 'singles' ? 'sets.json' : 'doubles-sets.json';
		fs.writeFileSync(path.join(OUT, file), JSON.stringify(out, null, '\t') + '\n');
		const setCount = Object.values(out).reduce((a, s) => a + s.sets.length, 0);
		const withRequired = Object.values(out).reduce((a, s) => a + s.sets.filter(t => t.required).length, 0);
		console.log(`${file}: ${Object.keys(out).length} Pokémon, ${setCount} sets, ${withRequired} with egg / passive moves they must keep`);
		lines.push(`==== ${mode === 'singles' ? 'SINGLES' : 'FFA (doubles sets)'} ====`, ...review, '',
			`-- moves dropped because they aren't in PokéRogue move lists --`, ...notes, '');
	}
	const reviewArg = process.argv.indexOf('--review');
	if (reviewArg > 0 && process.argv[reviewArg + 1]) {
		fs.writeFileSync(process.argv[reviewArg + 1], lines.join('\n') + '\n');
	}
}

if (require.main === module) main();
module.exports = {build, effectivePower, makeContext, convertTemplate};
