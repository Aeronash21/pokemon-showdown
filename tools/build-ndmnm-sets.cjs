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
 * Steps (scoring lives in tools/ndmnm-score.cjs):
 *
 * 1. Clean the NDSP sets for Mix and Mega: every Pokémon holds a
 *    Mega Stone, so Z-Move / Dynamax / Tera Blast roles and
 *    item-reliant moves (Trick, Acrobatics, Fling...) go.
 *    A Pokémon Mega Evolves (or transforms) before it first moves,
 *    so it fights with the item's ability, not its own. NDSP sets
 *    that only work with their own ability are replaced
 *    (SET_OVERRIDES: Truant Slaking, Slow Start Regigigas, Defeatist
 *    Archeops, Unburden Slurpuff), and moves that only made sense
 *    with an own ability no item gives back go: Giga Impact for
 *    Truant, Facade for Guts, Rest + Sleep Talk for Guts / Slow Start,
 *    Head Smash for Rock Head, berry Belly Drum for Unburden, Protect
 *    for Hunger Switch... (1b). Transformation items can't be removed,
 *    so Knock Off is a plain 65 BP attack (swapped for a stronger Dark
 *    move where there is one) and Thief / Covet go. Wishiwashi (Solo
 *    forme for good once it Mega Evolves) is dropped.
 * 2. Score every (set, item) pair and give each Pokémon its
 *    1-2 best transformation items. Items are Mega Stones plus
 *    Primal Orbs, Rusted Sword / Shield, Origin items, Ogerpon
 *    Masks, Arceus Plates, Silvally Memories and Genesect Drives.
 *    USES sets how often each kind is handed out (so about a fifth
 *    of Pokémon hold something other than a Mega Stone), and power
 *    items only go to weaker Pokémon. Formes that need one of these
 *    items (Arceus / Silvally types, Ogerpon masks, Crowned Zacian /
 *    Zamazenta, Origin formes) join the pool holding their own.
 * 3. Adapt moves to each mix: STAB for the new type, and moves
 *    that the Mega's ability wants (Normal moves for -ate
 *    abilities, pulse moves for Mega Launcher, stat-dropping
 *    moves for Contrary, status moves for Prankster, inaccurate
 *    moves for No Guard, physical attacks for Huge Power...), and
 *    attacks are swapped for ones the ability boosts when that is
 *    stronger (High Horsepower over Earthquake with Tough Claws,
 *    Psycho Cut over Zen Headbutt with Sharpness...). Weather-reliant
 *    abilities (Swift Swim, Solar Power, Sand Force) get the weather:
 *    the holder's own Drizzle / Drought / Sand Stream, or the weather
 *    move as a required move (ITEM_USES lets those items go only to
 *    such holders).
 *    These are stored as `required` so the generator always
 *    includes them. Moves built around an own ability the item
 *    replaces are swapped (Leaf Storm without Contrary, Bullet
 *    Seed without Skill Link / Technician, Rain Dance without
 *    Swift Swim, Solar Beam / Weather Ball without the weather...),
 *    and moves the new ability makes pointless go (hazard removal
 *    with Magic Bounce, Magnet Rise with Levitate, Thunder /
 *    Hurricane in sun...). Doubles templates keep four moves that
 *    aren't ally-only, as the FFA generator drops those.
 * 4. Set each template's level from how much the mix changes the
 *    Pokémon's strength compared with a typical pairing
 *    (about 1 level per 10.5 points, fitted on Smogon's levels
 *    for the real Gen 6-7 Megas). Losing a drawback ability
 *    (Truant, Slow Start, Defeatist) counts as a big power gain.
 *
 * Usage (after `node build`):
 *   node tools/build-ndmnm-sets.cjs            write the pools
 *   node tools/build-ndmnm-sets.cjs --report   also print a report
 */

const fs = require('fs');
const path = require('path');

const S = require('./ndmnm-score.cjs');
const category = require('./ndsp-fix-set-categories.cjs');

const {dex, toID, STONES, STONE_INFO, POWER_STONES} = S;

// How often each kind of item is handed out, as [minimum, maximum]
// Pokémon per item. Mega Stones are the default; the other
// transformation items are given out enough to keep teams varied.
const USES = {
	mega: [4, 13],
	primal: [8, 10],
	rusted: [9, 12],
	origin: [7, 10],
	mask: [9, 14],
	plate: [6, 9],
	memory: [4, 7],
	drive: [5, 7],
};
// Items whose ability only works in a weather (Swift Swim, Solar
// Power, Sand Force) only go to Pokémon that can set that weather
// (with their own ability or a move), so they need fewer holders.
const ITEM_USES = {
	swampertite: [2, 13],
	houndoominite: [2, 13],
	garchompite: [2, 13],
	steelixite: [2, 13],
};
const usesOf = id => ITEM_USES[id] || USES[STONE_INFO.get(id).kind];
const minUses = id => usesOf(id)[0];
const maxUses = id => Math.min(usesOf(id)[1],
	POWER_STONES.has(id) ? S.POWER_STONE_MAX_USES : Infinity);
const SECOND_STONE_MIN_GAIN = 0.06;
const SAME_SET_RATIO = 0.9;
const LEVEL_POINTS = 10.5;
const MIN_LEVEL = 60;
const MAX_LEVEL = 100;
// Moves the generator is always given (besides a forme's own move).
const MAX_REQUIRED = 3;

/*
 * ===========================================================
 * SET OVERRIDES
 * ===========================================================
 *
 * NDSP sets that only work with the Pokémon's own ability, which
 * is gone once it Mega Evolves: Truant Slaking (Giga Impact),
 * Slow Start Regigigas (Rest / Sleep Talk and Protect / Substitute
 * stalling) and Defeatist Archeops (Roost to stay above half HP).
 * These replace the NDSP sets before items are picked, so the
 * items (and levels) fit the sets the Pokémon really uses. Every
 * move is checked against the learnsets.
 */
const SET_OVERRIDES = {
	slaking: {
		singles: [
			{role: 'Bulky Setup',
				movepool: ['Body Slam', 'Bulk Up', 'Drain Punch', 'Earthquake', 'Knock Off', 'Slack Off']},
			{role: 'Wallbreaker',
				movepool: ['Double-Edge', 'Earthquake', 'Hammer Arm', 'Knock Off', 'Slack Off', 'Sucker Punch']},
		],
		doubles: [
			{role: 'Doubles Bulky Setup',
				movepool: ['Body Slam', 'Bulk Up', 'Drain Punch', 'Knock Off', 'Protect', 'Slack Off']},
			{role: 'Doubles Wallbreaker',
				movepool: ['Double-Edge', 'Hammer Arm', 'High Horsepower', 'Knock Off', 'Protect', 'Sucker Punch']},
		],
	},
	regigigas: {
		singles: [
			{role: 'Bulky Attacker',
				movepool: ['Body Slam', 'Drain Punch', 'Earthquake', 'Knock Off', 'Substitute', 'Thunder Wave']},
			{role: 'Setup Sweeper',
				movepool: ['Double-Edge', 'Drain Punch', 'Earthquake', 'Knock Off', 'Rock Polish']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker',
				movepool: ['Body Slam', 'Drain Punch', 'High Horsepower', 'Knock Off', 'Protect', 'Thunder Wave']},
			{role: 'Doubles Wallbreaker',
				movepool: ['Double-Edge', 'Drain Punch', 'High Horsepower', 'Ice Punch', 'Knock Off', 'Protect']},
		],
	},
	// Belly Drum with Unburden and a berry: no berry here, and its only
	// other physical moves are Play Rough, Drain Punch and Facade. Its
	// special side is much deeper.
	slurpuff: {
		singles: [
			{role: 'Bulky Setup', abilities: ['Sweet Veil'],
				movepool: ['Calm Mind', 'Dazzling Gleam', 'Flamethrower', 'Surf', 'Thunderbolt']},
			{role: 'Bulky Support', abilities: ['Sweet Veil'],
				movepool: ['Dazzling Gleam', 'Flamethrower', 'Protect', 'Sticky Web', 'Wish', 'Yawn']},
		],
		doubles: [
			{role: 'Doubles Bulky Setup', abilities: ['Sweet Veil'],
				movepool: ['Calm Mind', 'Dazzling Gleam', 'Flamethrower', 'Protect', 'Thunderbolt']},
		],
	},
	archeops: {
		singles: [
			{role: 'Fast Attacker',
				movepool: ['Dual Wingbeat', 'Earthquake', 'Knock Off', 'Roost', 'Stone Edge', 'U-turn']},
			{role: 'Wallbreaker',
				movepool: ['Dual Wingbeat', 'Earthquake', 'Head Smash', 'Knock Off', 'U-turn']},
		],
		doubles: [
			{role: 'Doubles Fast Attacker',
				movepool: ['Dual Wingbeat', 'Knock Off', 'Protect', 'Rock Slide', 'Tailwind', 'U-turn']},
		],
	},
};

/*
 * Pokémon that are hopeless once they Mega Evolve: Wishiwashi mixes
 * from its Solo forme (175 BST) and loses Schooling for good.
 */
const DROP_SPECIES = new Set(['wishiwashi']);

function overrideSets(species, data, doubles) {
	const override = SET_OVERRIDES[species.id]?.[doubles ? 'doubles' : 'singles'];

	if (!override) return data.sets;

	const abilities = data.sets[0]?.abilities ||
		[species.abilities['0']];

	return override.map(set => {
		for (const name of set.movepool) {
			const move = dex.moves.get(name);
			if (!move.exists || !S.learnable(species).has(move.id)) {
				throw new Error(`SET_OVERRIDES: ${species.name} can't learn ${name}`);
			}
		}

		return {role: set.role, movepool: [...set.movepool], abilities: [...(set.abilities || abilities)],
			teraTypes: [...species.types]};
	});
}

/*
 * ===========================================================
 * 1. CLEAN NDSP SETS FOR MIX AND MEGA
 * ===========================================================
 */
const DROP_ROLES = new Set(['Z-Move user', 'Dynamax User']);
const PROTECT_MOVES = new Set(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker',
	'silktrap', 'burningbulwark', 'obstruct']);

// The Gen 9 generator's setup moves (what it enforces on Setup roles).
const GEN9_SETUP = new Set([
	'acidarmor', 'agility', 'autotomize', 'bellydrum', 'bulkup', 'calmmind', 'clangoroussoul', 'coil', 'cosmicpower',
	'curse', 'dragondance', 'flamecharge', 'growth', 'honeclaws', 'howl', 'irondefense', 'meditate', 'nastyplot',
	'noretreat', 'poweruppunch', 'quiverdance', 'rockpolish', 'shellsmash', 'shelter', 'shiftgear', 'swordsdance',
	'tailglow', 'takeheart', 'tidyup', 'trailblaze', 'workup', 'victorydance',
]);

function hasSetup(movepool) {
	return movepool.some(name => {
		const move = dex.moves.get(name);
		if (GEN9_SETUP.has(move.id)) return true;
		return move.category === 'Status' && move.boosts && move.target === 'self' &&
			Object.values(move.boosts).some(v => v > 0);
	});
}

function moveContextFor(species, set, doubles, extra = {}) {
	return {
		types: species.types,
		doubles,
		trusted: new Set(set.movepool.map(toID)),
		...extra,
	};
}

function cleanSet(species, set, doubles) {
	const out = {
		role: set.role,
		movepool: [...set.movepool],
		abilities: [...set.abilities],
		teraTypes: [...(set.teraTypes || species.types)],
	};

	// Tera Blast users: turn into ordinary attackers.
	if (out.role === 'Tera Blast user') {
		const setup = hasSetup(out.movepool);
		const protect = out.movepool.some(m => PROTECT_MOVES.has(toID(m)));

		out.role = doubles ?
			(setup ? 'Doubles Setup Sweeper' : protect ? 'Offensive Protect' : 'Doubles Fast Attacker') :
			(setup ? 'Setup Sweeper' : 'Fast Attacker');
	}

	if (DROP_ROLES.has(out.role)) {
		out.role = hasSetup(out.movepool) ?
			(doubles ? 'Doubles Setup Sweeper' : 'Setup Sweeper') :
			(doubles ? 'Doubles Fast Attacker' : 'Fast Attacker');

		// Two-turn moves were only there for Max / Z-Moves.
		for (const name of [...out.movepool]) {
			const move = dex.moves.get(name);

			if (!move.flags.charge || move.category === 'Status') continue;

			const context = moveContextFor(species, out, doubles);
			context.trusted = new Set();
			const replacement = S.bestLearnable(species, context, m =>
				m.type === move.type && m.category === move.category && !m.flags.charge &&
				!out.movepool.some(n => toID(n) === m.id));

			out.movepool.splice(out.movepool.indexOf(name), 1);
			if (replacement && replacement.basePower >= 60) out.movepool.push(replacement.name);
		}
	}

	// Hidden Power's type is random in Gen 9 random battles.
	out.movepool = out.movepool.filter(m => toID(m) !== 'hiddenpower');

	// Item-reliant / Z-only / Tera moves.
	const side = S.setSide(out);
	const removed = out.movepool.filter(m => S.ITEM_RELIANT_MOVES.has(toID(m)));

	out.movepool = out.movepool.filter(m => !S.ITEM_RELIANT_MOVES.has(toID(m)));

	for (const name of removed) {
		const old = dex.moves.get(name);

		if (old.category === 'Status' || old.id === 'terablast') continue;

		const context = moveContextFor(species, out, doubles);
		const replacement = S.bestLearnable(species, context, m =>
			m.type === old.type && m.category === old.category &&
			!out.movepool.some(n => toID(n) === m.id));

		if (replacement) out.movepool.push(replacement.name);
	}

	// Moves that only worked with the Pokémon's own ability.
	retargetNativeMoves(species, out, doubles);

	// Keep at least four moves (in doubles, four that aren't ally-only:
	// the FFA generator drops those).
	const counted = () => doubles ? out.movepool.filter(n => !ALLY_ONLY_MOVES.has(toID(n))).length :
		out.movepool.length;
	while (counted() < 4) {
		const filler = pickFiller(species, moveContextFor(species, out, doubles), side === 'Support' ? 'Mixed' : side,
			out.movepool);

		if (!filler) break;

		out.movepool.push(filler.name);
	}

	// Abilities: Power Construct can't be used with a Mega Stone,
	// and item-reliant abilities are replaced when there is a
	// better legal option (they only matter before Mega Evolving).
	if (species.baseSpecies === 'Zygarde') out.abilities = ['Aura Break'];

	const legal = Object.entries(species.abilities)
		.filter(([slot]) => slot !== 'S')
		.map(([, name]) => dex.abilities.get(name))
		.filter(a => a.exists && !['shadowtag', 'arenatrap', 'moody', 'simple', 'powerconstruct'].includes(a.id));
	const deadNative = new Set(['guts', 'toxicboost', 'flareboost', 'poisonheal', 'quickfeet', 'unburden',
		'gluttony', 'ripen', 'cheekpouch', 'harvest', 'klutz']);

	if (out.abilities.every(a => deadNative.has(toID(a)))) {
		const better = legal.filter(a => !deadNative.has(a.id)).sort((a, b) => b.rating - a.rating)[0];

		if (better && better.rating >= 1.5) out.abilities = [better.name];
	}

	out.movepool = [...new Set(out.movepool)];
	out.role = attackerRoleIfNoSetup(out.role, out.movepool, doubles);

	return out;
}

/*
 * -----------------------------------------------------------
 * 1b. Moves built around an own ability no item gives back
 * -----------------------------------------------------------
 *
 * No transformation item has Truant, Guts, Quick Feet, Marvel
 * Scale, Poison Heal, Slow Start, Rock Head, Serene Grace or the
 * berry abilities, so these fixes apply whatever item the
 * Pokémon gets. (Abilities some item does give, like Technician
 * or Contrary, are handled per item in adapt().)
 */
const STATUS_BOOST_ABILITIES = new Set(['guts', 'quickfeet', 'marvelscale', 'toxicboost', 'flareboost']);
// Rest + Sleep Talk sets that were there to trigger the ability
// (Guts) or to wait out Slow Start.
const REST_ABILITIES = new Set([...STATUS_BOOST_ABILITIES, 'slowstart', 'comatose']);
// A lone Rest that the ability cured early (or on switching out).
const REST_CURE_ABILITIES = new Set(['shedskin', 'earlybird', 'hydration', 'naturalcure']);
// Belly Drum with a berry (Unburden, Gluttony...) or behind Ice Face.
const BELLY_DRUM_ABILITIES = new Set(['unburden', 'gluttony', 'ripen', 'cheekpouch', 'harvest', 'iceface']);
const PHYSICAL_SETUP_MOVES = ['swordsdance', 'bulkup', 'dragondance', 'coil', 'honeclaws', 'howl'];
const SPECIAL_SETUP_MOVES = ['nastyplot', 'calmmind', 'quiverdance', 'tailglow', 'geomancy', 'takeheart'];
const RECOVERY_MOVES = ['roost', 'recover', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'softboiled',
	'milkdrink', 'shoreup', 'strengthsap'];

function firstLearnable(species, ids, exclude = new Set()) {
	const id = ids.find(m => !exclude.has(m) && learnableID(species, m));

	return id ? dex.moves.get(id).name : null;
}

function retargetNativeMoves(species, out, doubles) {
	const own = out.abilities.map(toID);
	const plain = {...moveContextFor(species, out, doubles), trusted: new Set()};
	const ids = () => new Set(out.movepool.map(toID));
	const at = id => out.movepool.findIndex(n => toID(n) === id);
	const remove = id => {
		const index = at(id);
		if (index >= 0) out.movepool.splice(index, 1);
	};
	// Replace a move with the best learnable one passing `filter`;
	// drop it (or keep it with `keep`) if there is none.
	const swap = (id, filter, keep = false) => {
		const index = at(id);
		if (index < 0) return null;

		const replacement = S.bestLearnable(species, plain, m => filter(m) && !ids().has(m.id));

		if (replacement) out.movepool[index] = replacement.name;
		else if (!keep) out.movepool.splice(index, 1);

		return replacement;
	};

	// Truant's recharge moves (Giga Impact, Hyper Beam...).
	for (const name of [...out.movepool]) {
		const old = dex.moves.get(name);
		if (!old.flags.recharge) continue;

		swap(old.id, m => m.type === old.type && m.category === old.category && !m.flags.recharge &&
			m.basePower >= 80);
	}

	// Facade is a 70 BP move without Guts / Quick Feet / a status Orb:
	// a Normal-type gets another Normal move, others a missing STAB
	// or new coverage.
	if (ids().has('facade')) {
		const normal = species.types.includes('Normal');
		const covered = new Set(out.movepool.map(n => dex.moves.get(n))
			.filter(m => m.category !== 'Status' && m.id !== 'facade').map(m => m.type));
		const fits = m => m.category === 'Physical' && !category.isUtility(m) && m.basePower >= 70;

		if (normal) {
			swap('facade', m => fits(m) && m.type === 'Normal');
		} else if (!swap('facade', m => fits(m) && species.types.includes(m.type) && !covered.has(m.type), true) &&
			!swap('facade', m => fits(m) && !covered.has(m.type), true)) {
			swap('facade', fits);
		}
	}

	// Rest + Sleep Talk that only triggered Guts (or sat out Slow Start).
	if (own.some(a => REST_ABILITIES.has(a)) && ids().has('rest') && ids().has('sleeptalk')) {
		remove('rest');
		remove('sleeptalk');
	}

	// A lone Rest woke up early with Shed Skin / Early Bird / Hydration
	// (or was cured by switching with Natural Cure): real recovery.
	if (own.some(a => REST_CURE_ABILITIES.has(a)) && ids().has('rest') && !ids().has('sleeptalk')) {
		const recovery = firstLearnable(species, RECOVERY_MOVES, ids());
		if (recovery) out.movepool[at('rest')] = recovery;
	}

	// Poison Heal was the recovery: bring real recovery.
	if (own.includes('poisonheal') && !out.movepool.some(n => RECOVERY_MOVES.includes(toID(n)))) {
		const recovery = firstLearnable(species, RECOVERY_MOVES);

		if (recovery) {
			const slot = ['substitute', 'protect'].map(at).find(i => i >= 0);
			if (slot !== undefined && !doubles) out.movepool[slot] = recovery;
			else out.movepool.push(recovery);
		}
	}

	// Head Smash's recoil was free with Rock Head.
	if (own.includes('rockhead')) {
		swap('headsmash', m => m.type === 'Rock' && m.category === 'Physical' && !m.recoil && m.basePower >= 75, true);
	}

	// Headbutt was there for Serene Grace flinches.
	if (own.includes('serenegrace')) {
		swap('headbutt', m => m.type === 'Normal' && m.category === 'Physical' && m.basePower >= 80, true);
	}

	// Hunger Switch is gone once Morpeko Mega Evolves: Protect was
	// there to flip its forme.
	if (own.includes('hungerswitch') && !doubles && !/Protect/.test(out.role)) remove('protect');

	// Transformation items can't be removed in Mix and Mega, so Knock
	// Off is a plain 65 BP Dark attack: use a stronger Dark attack of
	// the set's kind when there is one (Crunch, Throat Chop, Dark
	// Pulse...), and drop it next to another Dark attack.
	if (ids().has('knockoff')) {
		const side = S.setSide(out);
		const otherDark = out.movepool.some(n => {
			const m = dex.moves.get(n);
			return m.type === 'Dark' && m.category !== 'Status' && m.id !== 'knockoff' && !category.isUtility(m);
		});

		if (otherDark) {
			remove('knockoff');
		} else {
			swap('knockoff', m => m.type === 'Dark' && m.category !== 'Status' && !category.isUtility(m) &&
				m.basePower >= 70 && (side === 'Physical' || side === 'Special' ? m.category === side :
				m.category === 'Physical'), true);
		}
	}

	// Belly Drum relied on a berry (Unburden, Gluttony...) or Ice Face.
	if (own.some(a => BELLY_DRUM_ABILITIES.has(a)) && ids().has('bellydrum') &&
		!out.movepool.some(n => {
			const m = dex.moves.get(n);
			return m.priority > 0 && m.category !== 'Status';
		})) {
		const setup = firstLearnable(species, PHYSICAL_SETUP_MOVES, ids());

		if (setup) out.movepool[at('bellydrum')] = setup;
		else remove('bellydrum');
	}
}

// Setup roles that lost every setup move become attackers.
function attackerRoleIfNoSetup(role, movepool, doubles) {
	if (!/Setup/.test(role) || hasSetup(movepool)) return role;

	if (doubles) return role === 'Doubles Bulky Setup' ? 'Doubles Bulky Attacker' : 'Doubles Fast Attacker';

	return BULKY_SETUP.has(role) ? 'Bulky Attacker' : 'Fast Attacker';
}

// An attack to top a pool up to four moves: new coverage if a good
// one exists, otherwise the best attack the pool doesn't have.
const FILLER_MIN_VALUE = 80;

function pickFiller(species, context, side, pool, excluded = new Set()) {
	const has = new Set(pool.map(toID));
	const covered = new Set(pool.map(n => dex.moves.get(n)).filter(m => m.category !== 'Status').map(m => m.type));
	const fresh = m => S.sideAttack(m, side) && !has.has(m.id) && !excluded.has(m.id);
	const coverage = S.bestLearnable(species, context, m => fresh(m) && !covered.has(m.type));

	if (coverage && S.moveValue(coverage, {...context, trusted: new Set()}) >= FILLER_MIN_VALUE) return coverage;

	return S.bestLearnable(species, context, fresh) || coverage;
}

function cleanSpecies(species, sets, doubles) {
	const cleaned = [];

	for (const set of sets) {
		const out = cleanSet(species, set, doubles);
		const key = JSON.stringify([out.role, [...out.movepool].sort()]);

		const twin = cleaned.find(s => JSON.stringify([s.role, [...s.movepool].sort()]) === key);

		if (twin) {
			twin.abilities = [...new Set([...twin.abilities, ...out.abilities])];
			continue;
		}

		cleaned.push(out);
	}

	return cleaned;
}

/*
 * ===========================================================
 * 2. STONE ASSIGNMENT
 * ===========================================================
 */
function scoreSpecies(species, sets, doubles) {
	const allowed = STONES.filter(stone => S.allowed(species, stone.id));

	return sets.map(set => {
		const scores = new Map();

		for (const stone of allowed) scores.set(stone.id, S.evaluate(species, set, stone.id, doubles));

		return {set, scores};
	});
}

function pairTotal(scored, stoneIDs) {
	let total = 0;

	for (const {scores} of scored) {
		let best = -Infinity;

		for (const id of stoneIDs) {
			const result = scores.get(id);
			if (result && result.score > best) best = result.score;
		}

		total += best;
	}

	return total;
}

function assignStones(entries, fixedUsage = new Map()) {
	const usage = new Map(STONES.map(s => [s.id, fixedUsage.get(s.id) || 0]));
	const available = id => usage.get(id) < maxUses(id);

	// Pokémon with the clearest favourite pick first.
	for (const entry of entries) {
		const singles = [...entry.scored[0].scores.keys()]
			.map(id => ({id, total: pairTotal(entry.scored, [id])}))
			.sort((a, b) => b.total - a.total);

		entry.ranked = singles;
		// How much better the best stone is than the 4th best: high
		// for Pokémon that depend on one kind of stone (Huge Power
		// Azumarill wants a Huge Power stone).
		entry.margin = singles.length > 3 ? singles[0].total - singles[3].total : 0;
	}

	entries.sort((a, b) => b.margin - a.margin);

	for (const entry of entries) {
		const manual = S.MANUAL_PAIRINGS[entry.species.id];

		if (manual) {
			entry.stones = manual.map(toID);
			for (const id of entry.stones) usage.set(id, (usage.get(id) || 0) + 1);
			continue;
		}

		const candidates = entry.ranked.filter(r => available(r.id)).slice(0, 25);

		if (!candidates.length) {
			entry.stones = [entry.ranked[0].id];
			usage.set(entry.ranked[0].id, usage.get(entry.ranked[0].id) + 1);
			continue;
		}

		const first = candidates[0].id;
		let best = {stones: [first], total: pairTotal(entry.scored, [first])};

		// A second stone only when it clearly helps another set.
		if (entry.scored.length > 1) {
			for (const other of candidates.slice(1)) {
				const total = pairTotal(entry.scored, [first, other.id]);

				if (total > best.total * (1 + SECOND_STONE_MIN_GAIN) && total > best.total) {
					best = {stones: [first, other.id], total};
				}
			}
		}

		entry.stones = best.stones;
		for (const id of entry.stones) usage.set(id, usage.get(id) + 1);
	}

	// Make sure every item is used at least its minimum number of
	// times: give it to the sets that lose the least by using it.
	for (const stone of STONES) {
		while (usage.get(stone.id) < minUses(stone.id)) {
			let pick = null;

			for (const entry of entries) {
				if (entry.stones.includes(stone.id) || entry.stones.length >= 3) continue;
				if (S.MANUAL_PAIRINGS[entry.species.id]) continue;

				for (const {scores} of entry.scored) {
					const result = scores.get(stone.id);
					if (!result) continue;

					const current = Math.max(...entry.stones.map(id => scores.get(id)?.score ?? -Infinity));
					const ratio = result.score / Math.max(1, current);

					if (!pick || ratio > pick.ratio) pick = {entry, ratio};
				}
			}

			if (!pick) break;

			pick.entry.stones.push(stone.id);
			pick.entry.coverage = [...(pick.entry.coverage || []), stone.id];
			usage.set(stone.id, usage.get(stone.id) + 1);
		}
	}

	return usage;
}

/*
 * ===========================================================
 * 3. MOVE ADAPTATION
 * ===========================================================
 */
const ATE_TYPES = {pixilate: 'Fairy', aerilate: 'Flying', refrigerate: 'Ice', dragonize: 'Dragon',
	galvanize: 'Electric'};

// NDSP pools, used by the physical/special fixer to find moves
// a species already uses.
const NDSP_TABLES = ['sets.json', 'doubles-sets.json']
	.map(file => JSON.parse(fs.readFileSync(path.join(S.SRC, file), 'utf8')));

// Weather an ability brings (an item's ability or the Pokémon's own).
const WEATHER_OF = {
	drought: 'sun', desolateland: 'sun', orichalcumpulse: 'sun', megasol: 'sun',
	drizzle: 'rain', primordialsea: 'rain', sandstream: 'sand', snowwarning: 'snow',
};
// Abilities that want a weather (a set ran Rain Dance for Swift Swim...).
const WEATHER_USERS = {
	rain: ['swiftswim', 'raindish', 'dryskin', 'hydration'],
	sun: ['chlorophyll', 'solarpower', 'flowergift', 'leafguard', 'harvest', 'protosynthesis'],
	sand: ['sandrush', 'sandforce', 'sandveil'],
	snow: ['slushrush', 'icebody', 'snowcloak'],
};
const WEATHER_MOVES = {raindance: 'rain', sunnyday: 'sun', sandstorm: 'sand', snowscape: 'snow', hail: 'snow'};
const WEATHER_BALL_TYPE = {rain: 'Water', sun: 'Fire', sand: 'Rock', snow: 'Ice'};
const HAZARD_REMOVAL = ['defog', 'rapidspin', 'mortalspin', 'courtchange'];
const SLEEP_MOVES = ['spore', 'sleeppowder', 'yawn', 'hypnosis', 'darkvoid', 'lovelykiss', 'sing'];
const TERRAIN_MOVES = ['grassyglide', 'risingvoltage', 'expandingforce', 'mistyexplosion', 'terrainpulse'];
// Status moves worth giving priority with Prankster, best first.
const PRANKSTER_MOVES = {
	singles: ['thunderwave', 'willowisp', 'encore', 'taunt', 'spore', 'sleeppowder', 'glare', 'partingshot',
		'toxic', 'reflect', 'lightscreen', 'substitute'],
	doubles: ['tailwind', 'thunderwave', 'willowisp', 'encore', 'taunt', 'spore', 'sleeppowder', 'reflect',
		'lightscreen'],
};
// Moves that only help an ally: the FFA generator drops them, so
// doubles templates keep at least four other moves.
const ALLY_ONLY_MOVES = new Set(['followme', 'ragepowder', 'allyswitch', 'helpinghand', 'afteryou', 'coaching',
	'decorate', 'instruct', 'aromaticmist', 'holdhands', 'spotlight', 'wideguard']);
// Items' abilities that boost a kind of move, with the boost.
const MOVE_BOOSTS = {
	toughclaws: {test: m => !!m.flags.contact, mult: 1.3},
	strongjaw: {test: m => !!m.flags.bite, mult: 1.5},
	ironfist: {test: m => !!m.flags.punch, mult: 1.2},
	sharpness: {test: m => !!m.flags.slicing, mult: 1.5},
	megalauncher: {test: m => !!m.flags.pulse, mult: 1.5},
	sheerforce: {test: m => secondariesOf(m).length > 0, mult: 1.3},
};

function secondariesOf(move) {
	return move.secondaries || (move.secondary ? [move.secondary] : []);
}

// Attacks that lower the user's attacking stat (Leaf Storm,
// Superpower, Draco Meteor...): Contrary turns them into boosts.
function lowersAttack(move) {
	const boosts = move.self?.boosts;

	return !!boosts && ((boosts.atk || 0) < 0 || (boosts.spa || 0) < 0);
}

// The weather a set was built around, from its own abilities.
function ownWeatherOf(abilities) {
	for (const id of abilities) {
		if (WEATHER_OF[id]) return WEATHER_OF[id];

		const weather = Object.keys(WEATHER_USERS).find(w => WEATHER_USERS[w].includes(id));
		if (weather) return weather;
	}

	return null;
}

// Moves this species uses in any NDSP set.
function speciesMoves(species) {
	const moves = new Set();
	const ids = new Set([species.id, dex.species.get(species.baseSpecies).id]);

	for (const table of NDSP_TABLES) {
		for (const id of ids) {
			for (const set of table[id]?.sets || []) {
				for (const move of set.movepool) moves.add(toID(move));
			}
		}
	}

	return moves;
}

function adapt(species, set, stoneID, result, doubles) {
	const info = STONE_INFO.get(stoneID);
	const ability = info.ability;
	// The Pokémon's own ability is gone once it Mega Evolves (or
	// transforms), so moves built around it are replaced below.
	const own = (set.abilities || []).map(toID);
	const lost = id => own.includes(id) && ability !== id;
	const megaWeather = WEATHER_OF[ability] || null;
	const ownWeather = ownWeatherOf(own);
	// A forme's signature move (Secret Sword for Keldeo-Resolute) must stay.
	const formeMove = species.requiredMove ? dex.moves.get(species.requiredMove).name : null;

	// The stone can push a balanced Pokémon to one side (e.g. +45 SpA):
	// make the set's attacks match the mixed Pokémon.
	const fixed = {role: set.role, movepool: [...set.movepool], abilities: [info.deltas.ability]};
	const mixedSpecies = {...result.mixed, id: species.id, name: species.name, isMega: true};
	category.fixSet(mixedSpecies, fixed, NDSP_TABLES, doubles);
	if (formeMove && !fixed.movepool.includes(formeMove)) fixed.movepool.push(formeMove);

	const pool = [...fixed.movepool];
	const required = formeMove ? [formeMove] : [];
	const dropped = new Set();
	const ids = () => new Set(pool.map(toID));
	const context = {
		types: result.mixed.types,
		doubles,
		trusted: new Set(set.movepool.map(toID)),
		contrary: ability === 'contrary',
		noGuard: ability === 'noguard',
		skillLink: ability === 'skilllink',
		technician: ability === 'technician',
		ate: !!ATE_TYPES[ability],
		powerMod: moveBoost(ability),
	};
	// For swaps: how good a move is on its own, without the bonus for
	// moves the NDSP set already had.
	const plain = {...context, trusted: new Set()};
	const at = id => pool.findIndex(n => toID(n) === id);
	const removeID = id => {
		const index = at(id);
		if (index < 0) return;
		pool.splice(index, 1);
		dropped.add(id);
	};
	const attacks = () => pool.map(n => dex.moves.get(n))
		.filter(m => m.category !== 'Status' && m.name !== formeMove);
	const sameKind = move => m => m.type === move.type && m.category === move.category && !category.isUtility(m);
	// Swap `move` for the best learnable move passing `filter` when
	// that is at least `ratio` times as good; otherwise keep it (or
	// drop it with `drop`).
	const swap = (move, filter, {ratio = 1, drop = false} = {}) => {
		const index = at(move.id);
		if (index < 0) return null;

		const current = S.moveValue(move, plain);
		const replacement = S.bestLearnable(species, plain, m => filter(m) && m.id !== move.id && !ids().has(m.id));

		if (replacement && (!Number.isFinite(current) || S.moveValue(replacement, plain) >= current * ratio)) {
			pool[index] = replacement.name;
			dropped.add(move.id);
			return replacement;
		}

		if (drop) removeID(move.id);

		return null;
	};
	// A move that only worked in the right weather / terrain: drop it
	// if the set has another attack of its type, else swap it.
	const retire = (move, filter) => {
		if (attacks().some(m => m !== move && m.id !== move.id && m.type === move.type && !category.isUtility(m))) {
			removeID(move.id);
		} else {
			swap(move, filter, {ratio: 0, drop: true});
		}
	};
	const trade = (from, to) => {
		const index = at(from);
		if (index < 0 || ids().has(to) || !learnableID(species, to)) return;
		pool[index] = dex.moves.get(to).name;
		dropped.add(from);
	};

	/*
	 * Huge Power / Pure Power only double Attack.
	 */
	if (ability === 'hugepower' || ability === 'purepower') {
		for (const move of attacks()) {
			if (move.category !== 'Special' || category.isUtility(move)) continue;
			swap(move, m => m.type === move.type && m.category === 'Physical' && !category.isUtility(m),
				{ratio: 0, drop: true});
		}
		for (const name of [...pool]) {
			const id = toID(name);
			if (!SPECIAL_SETUP_MOVES.includes(id)) continue;

			const setup = firstLearnable(species, PHYSICAL_SETUP_MOVES, ids());
			if (setup) pool[at(id)] = setup;
			else removeID(id);
		}
	}

	/*
	 * Moves built around the Pokémon's own ability, which the item
	 * replaces.
	 */
	// Contrary: Leaf Storm, Superpower... now lower the user's stats.
	if (lost('contrary')) {
		const drops = attacks().some(lowersAttack);

		for (const move of attacks()) {
			if (lowersAttack(move)) swap(move, m => sameKind(move)(m) && !lowersAttack(m), {ratio: 0.75});
		}
		// Rest (+ Sleep Talk) kept a Contrary Superpower / Leaf Storm
		// user boosting; without Contrary it only resets the drops.
		if (drops && ids().has('rest')) {
			removeID('rest');
			removeID('sleeptalk');
		}
	}

	// Skill Link / Technician: multi-hit and weak moves lose their boost.
	if (lost('skilllink') && ability !== 'technician') {
		for (const move of attacks()) {
			if (Array.isArray(move.multihit) && move.priority <= 0) swap(move, m => sameKind(move)(m) && !m.multihit);
		}
	}
	if (lost('technician')) {
		for (const move of attacks()) {
			if (move.priority > 0 || category.isUtility(move)) continue;

			const weak = Array.isArray(move.multihit) ? ability !== 'skilllink' :
				!move.multihit && move.basePower > 0 && move.basePower <= 60;

			if (weak) swap(move, m => sameKind(move)(m) && !m.multihit && m.basePower > move.basePower);
		}
	}

	// Strong Jaw / Mega Launcher: weak bites and pulses.
	for (const [id, flag] of [['strongjaw', 'bite'], ['megalauncher', 'pulse']]) {
		if (!lost(id)) continue;

		for (const move of attacks()) {
			if (move.flags[flag] && move.basePower <= 65) swap(move, m => sameKind(move)(m) && m.basePower > move.basePower);
		}
	}

	// No Guard: very inaccurate moves (Dynamic Punch, Zap Cannon...).
	if (lost('noguard')) {
		for (const move of attacks()) {
			if (move.accuracy !== true && move.accuracy <= 60) swap(move, sameKind(move));
		}
	}

	// Speed Boost: Protect was there to get a free boost.
	if (lost('speedboost') && !doubles && !/Protect/.test(set.role) &&
		!['wish', 'leechseed', 'toxic'].some(id => ids().has(id))) {
		for (const id of ['protect', 'detect']) removeID(id);
	}

	// Weather: Rain Dance / Sunny Day... only help an ability that
	// uses the weather (Swift Swim, Chlorophyll...).
	for (const name of [...pool]) {
		const weather = WEATHER_MOVES[toID(name)];
		if (!weather) continue;

		const builtForOwn = own.some(a => WEATHER_USERS[weather].includes(a) || WEATHER_OF[a] === weather);
		const itemUses = WEATHER_USERS[weather].includes(ability) && megaWeather !== weather;
		// Hydro Steam is stronger in sun (Walking Wake).
		const keep = weather === 'sun' && ids().has('hydrosteam');

		if (megaWeather === weather || (builtForOwn && !itemUses && !keep)) removeID(toID(name));
	}

	// Solar Beam / Solar Blade take two turns without sun.
	if (megaWeather !== 'sun') {
		for (const move of attacks()) {
			if (move.id === 'solarbeam' || move.id === 'solarblade') retire(move, m => sameKind(move)(m) && !m.flags.charge);
		}
	}

	// Weather Ball is a 50 BP Normal move without weather.
	if (!megaWeather && ids().has('weatherball')) {
		const weather = ownWeather || Object.values(WEATHER_MOVES).find(w => pool.some(n => WEATHER_MOVES[toID(n)] === w));
		const type = WEATHER_BALL_TYPE[weather] || null;
		const ball = dex.moves.get('weatherball');

		if (type && attacks().some(m => m.type === type && !category.isUtility(m))) {
			removeID('weatherball');
		} else {
			swap(ball, m => (!type || m.type === type) && m.category === ball.category && !category.isUtility(m) &&
				m.basePower >= 70, {ratio: 0, drop: true});
		}
	}

	// Thunder / Blizzard were accurate in the Pokémon's own rain / snow,
	// and Thunder / Hurricane hit only half the time in sun.
	if (ability !== 'noguard') {
		if (ownWeather === 'rain' && megaWeather !== 'rain') trade('thunder', 'thunderbolt');
		if (ownWeather === 'snow' && megaWeather !== 'snow') trade('blizzard', 'icebeam');
		if (megaWeather === 'sun') {
			trade('thunder', 'thunderbolt');
			trade('hurricane', 'airslash');
		}
	}

	// Terrain moves that needed the Pokémon's own terrain (no item
	// gives Grassy / Psychic / Misty Surge).
	for (const move of attacks()) {
		if (move.id === 'mistyexplosion') removeID(move.id);
		if (move.id === 'grassyglide' || move.id === 'terrainpulse' ||
			(move.id === 'risingvoltage' && ability !== 'electricsurge')) {
			retire(move, m => sameKind(move)(m) && !TERRAIN_MOVES.includes(m.id));
		}
	}

	// The item's ability boosts a kind of move (Tough Claws contact
	// moves, Strong Jaw bites, Sharpness slicing moves...): swap attacks
	// for a boosted move of the same type and category when that is
	// stronger (Earthquake -> High Horsepower with Tough Claws, Zen
	// Headbutt -> Psycho Cut with Sharpness, Focus Blast -> Aura Sphere
	// with Mega Launcher...).
	const boost = MOVE_BOOSTS[ability];
	if (boost) {
		for (const move of attacks()) {
			// Priority moves keep their job (Sucker Punch, Bullet Punch...).
			if (boost.test(move) || category.isUtility(move) || required.includes(move.name) ||
				move.priority > 0) continue;

			const better = S.bestLearnable(species, plain, m => sameKind(move)(m) && boost.test(m) &&
				!ids().has(m.id) && !dropped.has(m.id) && !(m.recoil && m.recoil[0] / m.recoil[1] >= 0.5));
			// The current move's own value (it may be one that is never
			// added on its own, like Sucker Punch).
			const current = S.moveValue(move, {...plain, trusted: new Set([move.id])}) - 40;

			if (better && S.moveValue(better, plain) > current + 5) {
				pool[at(move.id)] = better.name;
				dropped.add(move.id);
			}
		}
	}

	// Refill what the swaps above dropped before deciding the set's
	// side (a support set down to one attack is still an attacker).
	const fillTo4 = fillSide => {
		while (pool.length < 4) {
			const filler = pickFiller(species, context, fillSide, pool, dropped);
			if (!filler) break;
			pool.push(filler.name);
		}
	};
	const firstSide = S.setSide({...set, movepool: fixed.movepool});
	fillTo4(firstSide === 'Support' ? 'Mixed' : firstSide);

	/*
	 * What the item's ability wants.
	 */
	const side = S.setSide({...set, movepool: pool});
	const attackSide = side === 'Support' ? null : side;
	const onSide = move => attackSide ? S.sideAttack(move, attackSide) : false;
	const addBest = test => {
		const move = S.bestLearnable(species, context, m => onSide(m) && test(m) && !ids().has(m.id) &&
			!dropped.has(m.id));

		if (!move) return null;

		pool.push(move.name);
		required.push(move.name);

		return move;
	};
	const requireExisting = test => {
		const found = pool
			.map(name => dex.moves.get(name))
			.filter(m => onSide(m) && test(m))
			.sort((a, b) => S.moveValue(b, context) - S.moveValue(a, context))[0];

		if (found && !required.includes(found.name)) required.push(found.name);

		return found;
	};
	const ensure = test => requireExisting(test) || addBest(test);

	// Contrary: moves that raise the user's stats would lower them.
	if (ability === 'contrary') {
		for (const name of [...pool]) {
			if (S.raisesOwnStats(dex.moves.get(name))) removeID(toID(name));
		}
	}

	if (attackSide) {
		// STAB for a type the Mega adds (an -ate ability's Normal
		// moves already give that STAB).
		for (const type of result.mixed.types) {
			if (species.types.includes(type) || ATE_TYPES[ability] === type) continue;
			ensure(m => m.type === type && m.basePower >= 70);
		}

		switch (ability) {
		case 'pixilate': case 'aerilate': case 'refrigerate': case 'dragonize': case 'galvanize':
			ensure(m => m.type === 'Normal' && m.basePower >= 70 && m.id !== 'facade');
			break;
		case 'megalauncher':
			ensure(m => !!m.flags.pulse);
			break;
		case 'strongjaw':
			ensure(m => !!m.flags.bite);
			break;
		case 'ironfist':
			ensure(m => !!m.flags.punch);
			break;
		case 'sharpness':
			ensure(m => !!m.flags.slicing);
			break;
		case 'toughclaws':
		case 'unseenfist':
		case 'piercingdrill':
			// Contact moves: boosted / hit through Protect.
			if (attackSide === 'Physical') ensure(m => !!m.flags.contact && m.basePower >= 70);
			break;
		case 'technician':
			ensure(m => m.basePower > 0 && m.basePower <= 60 && (m.priority > 0 || !!m.multihit));
			break;
		case 'skilllink':
			ensure(m => Array.isArray(m.multihit));
			break;
		case 'sheerforce':
			ensure(m => secondariesOf(m).length > 0 && m.basePower >= 60 && !category.isUtility(m));
			break;
		case 'parentalbond':
			// Multi-hit moves don't get the second hit.
			for (const move of attacks()) {
				if (move.multihit) swap(move, m => sameKind(move)(m) && !m.multihit, {ratio: 0.8});
			}
			break;
		case 'contrary':
			ensure(m => !!m.self?.boosts && Object.values(m.self.boosts).some(v => v < 0) && m.basePower >= 90);
			break;
		case 'fairyaura':
			ensure(m => m.type === 'Fairy' && m.basePower >= 70);
			break;
		case 'firemane':
			ensure(m => m.type === 'Fire' && m.basePower >= 70);
			break;
		case 'electricsurge':
			ensure(m => m.type === 'Electric' && m.basePower >= 70);
			break;
		case 'megasol':
		case 'drought':
			// Sun boosts Fire attacks and powers Solar Beam.
			if (!/Support|Staller/.test(set.role)) ensure(m => m.type === 'Fire' && m.basePower >= 70);
			if (attackSide !== 'Physical' && species.types.includes('Grass') && learnableID(species, 'solarbeam')) {
				if (!ids().has('solarbeam')) pool.push('Solar Beam');
				required.push('Solar Beam');
			}
			break;
		case 'snowwarning':
			if (attackSide !== 'Physical' && learnableID(species, 'blizzard') && !ids().has('blizzard')) {
				const icebeam = at('icebeam');
				if (icebeam >= 0) pool[icebeam] = 'Blizzard';
				else pool.push('Blizzard');
				required.push('Blizzard');
			}
			break;
		case 'noguard': {
			// Swap accurate moves for stronger inaccurate ones of the same type.
			for (let i = 0; i < pool.length; i++) {
				const current = dex.moves.get(pool[i]);
				if (!onSide(current) || current.name === formeMove || category.isUtility(current)) continue;

				const stronger = S.bestLearnable(species, plain, m =>
					m.type === current.type && m.category === current.category && m.accuracy !== true &&
					m.accuracy < 90 && m.basePower > current.basePower && !ids().has(m.id) &&
					!(m.recoil && m.recoil[0] / m.recoil[1] >= 0.5));

				if (stronger && S.moveValue(stronger, plain) > S.moveValue(current, plain)) {
					pool[i] = stronger.name;
					required.push(stronger.name);
				}
			}
			// At least one move that No Guard makes accurate.
			ensure(m => m.accuracy !== true && m.accuracy < 90 && m.basePower >= 90);
			break;
		}
		}
	}

	// Primal weather: the opposite weather's attacks fail outright.
	if (attackSide && (ability === 'desolateland' || ability === 'primordialsea')) {
		const blocked = ability === 'desolateland' ? 'Water' : 'Fire';
		const boosted = ability === 'desolateland' ? 'Fire' : 'Water';

		for (const name of [...pool]) {
			const move = dex.moves.get(name);
			if (move.type === blocked && move.category !== 'Status') removeID(move.id);
		}

		ensure(m => m.type === boosted && m.basePower >= 70);

		// Thunder and Hurricane never miss in rain.
		if (ability === 'primordialsea' && attackSide !== 'Physical') {
			for (const [weak, strong] of [['thunderbolt', 'Thunder'], ['airslash', 'Hurricane']]) {
				const index = at(weak);
				if (index >= 0 && learnableID(species, toID(strong)) && !ids().has(toID(strong))) {
					pool[index] = strong;
					required.push(strong);
				}
			}
		}
	}

	// Weather-reliant abilities (Swift Swim, Solar Power, Sand Force):
	// without a weather of its own the Pokémon sets it with the move,
	// and brings attacks that use it.
	const need = S.WEATHER_NEEDS[ability];
	if (need && attackSide) {
		const ownSetter = weatherSetterOf(species, set.abilities, ability);

		if (!ownSetter && learnableID(species, need.move)) {
			const name = dex.moves.get(need.move).name;
			if (!ids().has(need.move)) pool.push(name);
			required.splice(formeMove ? 1 : 0, 0, name);
		}

		if (ownSetter || ids().has(need.move)) {
			if (ability === 'solarpower') {
				ensure(m => m.type === 'Fire' && m.category === 'Special' && m.basePower >= 70);
				for (const move of attacks()) {
					if (move.type === 'Water' && !result.mixed.types.includes('Water')) removeID(move.id);
				}
			} else if (ability === 'sandforce') {
				ensure(m => ['Rock', 'Ground', 'Steel'].includes(m.type) && m.basePower >= 70);
			} else if (ability === 'swiftswim' && attackSide !== 'Physical') {
				// Thunder and Hurricane never miss in rain.
				for (const [weak, strong] of [['thunderbolt', 'thunder'], ['airslash', 'hurricane']]) {
					const index = at(weak);
					if (index >= 0 && learnableID(species, strong) && !ids().has(strong)) {
						pool[index] = dex.moves.get(strong).name;
						required.push(pool[index]);
					}
				}
			}
		}
	}

	// Sun (Drought, Mega Sol) halves Water attacks: keep only STAB ones.
	if (megaWeather === 'sun' && ability !== 'desolateland') {
		for (const move of attacks()) {
			if (move.type === 'Water' && !result.mixed.types.includes('Water')) removeID(move.id);
		}
	}

	// Rusted Sword / Shield turn Iron Head into Behemoth Blade / Bash.
	if (info.kind === 'rusted' && attackSide === 'Physical' && learnableID(species, 'ironhead')) {
		if (!ids().has('ironhead')) pool.push('Iron Head');
		required.push('Iron Head');
	}

	if (ability === 'speedboost' && !doubles && !pool.some(n => PROTECT_MOVES.has(toID(n))) &&
		learnableID(species, 'protect') && attackSide) {
		pool.push('Protect');
		required.push('Protect');
	}

	// Prankster: a status move to use with priority.
	if (ability === 'prankster' && !pool.some(n => dex.moves.get(n).category === 'Status')) {
		const list = PRANKSTER_MOVES[doubles ? 'doubles' : 'singles'];
		const usual = speciesMoves(species);
		const pick = firstLearnable(species, list.filter(id => usual.has(id)), ids()) ||
			firstLearnable(species, list, ids());

		if (pick) {
			pool.push(pick);
			required.push(pick);
		}
	}

	// Bad Dreams hurts sleeping foes: bring a sleep move.
	if (ability === 'baddreams' && !SLEEP_MOVES.some(id => ids().has(id))) {
		const sleep = firstLearnable(species, SLEEP_MOVES, ids());

		if (sleep) {
			pool.push(sleep);
			required.push(sleep);
		}
	}

	// Magic Bounce reflects hazards: no need for hazard removal.
	if (ability === 'magicbounce') {
		for (const id of HAZARD_REMOVAL) removeID(id);
	}

	// Levitate already makes the Pokémon immune to Ground.
	if (ability === 'levitate' || ability === 'eelevate') removeID('magnetrise');

	// Keep the pool from growing too much: drop the weakest
	// optional attacks while keeping one attack per type.
	const limit = Math.max(fixed.movepool.length, 5);

	while (pool.length > limit) {
		const removable = pool
			.map(name => dex.moves.get(name))
			.filter(m => !required.includes(m.name) && m.category !== 'Status' &&
				pool.filter(n => {
					const o = dex.moves.get(n);
					return o.type === m.type && o.category !== 'Status';
				}).length > 1)
			.sort((a, b) => S.moveValue(a, context) - S.moveValue(b, context));

		const victim = removable[0] || pool
			.map(name => dex.moves.get(name))
			.filter(m => !required.includes(m.name) && m.category !== 'Status' &&
				!result.mixed.types.includes(m.type))
			.sort((a, b) => S.moveValue(a, context) - S.moveValue(b, context))[0];

		if (!victim) break;

		pool.splice(pool.indexOf(victim.name), 1);
	}

	// The Gen 9 generator can crash on Leech Seed + Protect +
	// Substitute together (its move pairs overlap): keep two.
	const idsNow = ids();
	if (idsNow.has('leechseed') && idsNow.has('protect') && idsNow.has('substitute')) {
		const drop = required.includes('Substitute') ? 'Protect' : 'Substitute';
		pool.splice(pool.indexOf(drop), 1);
	}

	// Always leave the generator at least four moves, and in doubles
	// four that aren't ally-only (the FFA generator drops those).
	fillTo4(attackSide || 'Mixed');
	while (doubles && pool.filter(n => !ALLY_ONLY_MOVES.has(toID(n))).length < 4) {
		const filler = pickFiller(species, context, attackSide || 'Mixed', pool, dropped);
		if (!filler) break;
		pool.push(filler.name);
	}

	return {
		// Setup sets that lost their setup move (Contrary...) become attackers.
		role: attackerRoleIfNoSetup(set.role, pool, doubles),
		movepool: [...new Set(pool)].sort(),
		required: [...new Set(required)].filter(name => pool.includes(name))
			.slice(0, formeMove ? MAX_REQUIRED + 1 : MAX_REQUIRED),
	};
}

// Own abilities listed on a template: the Pokémon has them until
// it Mega Evolves. Drop a weather of its own that the item's
// weather would fight with (Drought with Abomasite).
function templateAbilities(species, abilities, stoneID) {
	// Swift Swim / Solar Power / Sand Force holders that can set the
	// weather on switching in always do (Drizzle Pelipper with
	// Swampertite, Drought Ninetales with Houndoominite...).
	const weatherSetter = weatherSetterOf(species, abilities, STONE_INFO.get(stoneID).ability);
	if (weatherSetter) return [weatherSetter];

	const megaWeather = WEATHER_OF[STONE_INFO.get(stoneID).ability];
	const setter = id => ['drought', 'drizzle', 'sandstream', 'snowwarning', 'orichalcumpulse'].includes(id);
	const clash = name => megaWeather && setter(toID(name)) && WEATHER_OF[toID(name)] !== megaWeather;
	const kept = abilities.filter(name => !clash(name));

	if (kept.length) return kept;

	const legal = Object.entries(species.abilities)
		.filter(([slot]) => slot !== 'S')
		.map(([, name]) => dex.abilities.get(name))
		.filter(a => a.exists && !clash(a.name) && !['shadowtag', 'arenatrap', 'moody', 'simple'].includes(a.id))
		.sort((a, b) => b.rating - a.rating);

	return legal.length ? [legal[0].name] : abilities;
}

const BULKY_SETUP = new Set(['Bulky Setup', 'Doubles Bulky Setup']);

// The Pokémon's own ability that sets the weather an item's ability
// needs (Drizzle for Swift Swim...): one listed on the set, or else a
// legal one of the species.
function weatherSetterOf(species, abilities, abilityID) {
	const need = S.WEATHER_NEEDS[abilityID];
	if (!need) return null;

	const listed = (abilities || []).find(a => need.setters.includes(toID(a)));
	if (listed) return listed;

	return Object.entries(species.abilities)
		.filter(([slot]) => slot !== 'S')
		.map(([, name]) => name)
		.find(name => need.setters.includes(toID(name))) || null;
}

// Power multiplier from an item's ability for picking moves.
function moveBoost(abilityID) {
	const boost = MOVE_BOOSTS[abilityID];
	return boost ? move => boost.test(move) ? boost.mult : 1 : null;
}

function learnableID(species, id) {
	return S.learnable(species).has(id);
}

/*
 * ===========================================================
 * BUILD ONE POOL
 * ===========================================================
 */
function buildPool(file, doubles) {
	const source = JSON.parse(fs.readFileSync(path.join(S.SRC, file), 'utf8'));
	const ids = S.legalPool(source);
	const entries = [];

	for (const id of ids) {
		if (DROP_SPECIES.has(id)) continue;

		const species = dex.species.get(id);
		const sets = cleanSpecies(species, overrideSets(species, source[id], doubles), doubles);

		if (!sets.length) continue;

		entries.push({species, level: source[id].level, sets, scored: scoreSpecies(species, sets, doubles)});
	}

	// Formes that need a transformation item (Arceus / Silvally types,
	// Ogerpon masks, Crowned Zacian / Zamazenta, Origin formes) join
	// the pool holding their own item.
	const fixed = [];
	const fixedUsage = new Map();

	for (const [id, data] of Object.entries(source)) {
		const species = dex.species.get(id);
		const needed = [species.requiredItem, ...(species.requiredItems || [])].filter(Boolean).map(toID);
		const own = needed.find(item => STONE_INFO.has(item) && STONE_INFO.get(item).kind !== 'mega' &&
			STONE_INFO.get(item).kind !== 'primal');

		if (!own || species.isMega || species.isPrimal) continue;

		const sets = cleanSpecies(species, data.sets, doubles);
		if (!sets.length) continue;

		// Crowned Zacian / Zamazenta are generated as their Hero formes
		// holding the Rusted item, which turns Iron Head into Behemoth
		// Blade / Bash at the start of the battle: list Iron Head (the
		// legal move).
		for (const set of sets) {
			set.movepool = set.movepool.map(name =>
				['behemothblade', 'behemothbash'].includes(toID(name)) ? 'Iron Head' : name);
		}

		fixed.push({species, level: data.level, sets, item: STONE_INFO.get(own).stone.name});
		fixedUsage.set(own, (fixedUsage.get(own) || 0) + 1);
	}

	const usage = assignStones(entries, fixedUsage);

	// Build templates.
	const templates = [];

	for (const entry of entries) {
		entry.templates = [];

		for (const {set, scores} of entry.scored) {
			const options = entry.stones.map(id => scores.get(id)).filter(Boolean);
			const best = Math.max(...options.map(o => o.score));
			const chosen = options.filter(o =>
				o.score >= best * SAME_SET_RATIO || entry.coverage?.includes(o.stoneID) &&
				o.score === Math.max(...entry.scored.map(s => s.scores.get(o.stoneID)?.score ?? -Infinity)));

			for (const result of chosen) {
				const adapted = adapt(entry.species, set, result.stoneID, result, doubles);

				const template = {
					role: adapted.role,
					movepool: adapted.movepool,
					abilities: templateAbilities(entry.species, set.abilities, result.stoneID),
					teraTypes: result.mixed.types,
					item: STONE_INFO.get(result.stoneID).stone.name,
					...(adapted.required.length ? {required: adapted.required} : {}),
					_strength: result.strengthChange,
					_score: result.score,
				};

				entry.templates.push(template);
				templates.push(template);
			}
		}

		// A coverage stone that no set picked: attach it to the set
		// it suits best.
		for (const id of entry.stones) {
			if (entry.templates.some(t => toID(t.item) === id)) continue;

			const {set, scores} = entry.scored
				.slice()
				.sort((a, b) => (b.scores.get(id)?.score ?? -Infinity) - (a.scores.get(id)?.score ?? -Infinity))[0];
			const result = scores.get(id);
			const adapted = adapt(entry.species, set, id, result, doubles);
			const template = {
				role: adapted.role,
				movepool: adapted.movepool,
				abilities: templateAbilities(entry.species, set.abilities, id),
				teraTypes: result.mixed.types,
				item: STONE_INFO.get(id).stone.name,
				...(adapted.required.length ? {required: adapted.required} : {}),
				_strength: result.strengthChange,
				_score: result.score,
			};

			entry.templates.push(template);
			templates.push(template);
		}
	}

	// Merge templates that ended up identical.
	for (const entry of entries) {
		const merged = [];

		for (const template of entry.templates) {
			const key = JSON.stringify([template.role, template.movepool, template.item]);
			const twin = merged.find(t => JSON.stringify([t.role, t.movepool, t.item]) === key);

			if (twin) {
				twin.abilities = [...new Set([...twin.abilities, ...template.abilities])];
				continue;
			}

			merged.push(template);
		}

		entry.templates = merged;
	}

	// Levels relative to the median pairing.
	const strengths = templates.map(t => t._strength).sort((a, b) => a - b);
	const median = strengths[Math.floor(strengths.length / 2)];
	const output = {};

	for (const entry of entries) {
		const base = typeof entry.level === 'number' ? entry.level : 84;

		for (const template of entry.templates) {
			const adjust = Math.round((template._strength - median) / LEVEL_POINTS);
			template.level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, base - Math.max(-15, Math.min(15, adjust))));
		}

		output[entry.species.id] = {
			level: base,
			sets: entry.templates.map(({_strength, _score, ...rest}) => rest),
		};
	}

	for (const entry of fixed) {
		const base = typeof entry.level === 'number' ? entry.level : 84;

		output[entry.species.id] = {
			level: base,
			sets: entry.sets.map(set => ({...set, item: entry.item, level: base})),
		};
	}

	return {output, entries, fixed, usage, median};
}

/*
 * ===========================================================
 * MAIN
 * ===========================================================
 */
function main() {
	fs.mkdirSync(S.OUT, {recursive: true});

	for (const [file, doubles, label] of [['sets.json', false, 'Singles'], ['doubles-sets.json', true, 'Doubles/FFA/2v2']]) {
		const {output, entries, fixed, usage, median} = buildPool(file, doubles);

		fs.writeFileSync(path.join(S.OUT, file), JSON.stringify(output, null, 2) + '\n');

		const all = Object.values(output).flatMap(e => e.sets);
		const unused = STONES.filter(s => !usage.get(s.id));
		const byKind = {};
		for (const t of all) {
			const kind = STONE_INFO.get(toID(t.item)).kind;
			byKind[kind] = (byKind[kind] || 0) + 1;
		}
		const nonMega = all.filter(t => STONE_INFO.get(toID(t.item)).kind !== 'mega').length;

		console.log(`${label}: ${entries.length} Pokémon + ${fixed.length} item formes, ${all.length} templates, ` +
			`items used ${STONES.length - unused.length}/${STONES.length}, ` +
			`${Math.round(100 * nonMega / all.length)}% not Mega Stones ${JSON.stringify(byKind)}, ` +
			`median strength ${median.toFixed(0)}`);

		if (S.REPORT) {
			const byStone = [...usage.entries()].sort((a, b) => b[1] - a[1]);
			console.log('  usage:', byStone.map(([id, n]) => `${STONE_INFO.get(id).stone.name} ${n}`).join(', '));
		}
	}
}

module.exports = {buildPool, cleanSpecies, adapt};

if (require.main === module) main();
