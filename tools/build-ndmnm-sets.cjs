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
 * 2. Score every (set, stone) pair and give each Pokémon its
 *    1-2 best stones. Stone usage is capped, every stone is given
 *    out at least MIN_USES times, and power stones only go to
 *    weaker Pokémon.
 * 3. Adapt moves to each mix: STAB for the new type, and moves
 *    that the Mega's ability wants (Normal moves for -ate
 *    abilities, pulse moves for Mega Launcher, stat-dropping
 *    moves for Contrary...). These are stored as `required` so
 *    the generator always includes them.
 * 4. Set each template's level from how much the mix changes the
 *    Pokémon's strength compared with a typical pairing
 *    (about 1 level per 10.5 points, fitted on Smogon's levels
 *    for the real Gen 6-7 Megas).
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

const MIN_USES = 5;
const MAX_USES = 14;
const SECOND_STONE_MIN_GAIN = 0.06;
const SAME_SET_RATIO = 0.9;
const LEVEL_POINTS = 10.5;
const MIN_LEVEL = 60;
const MAX_LEVEL = 100;

/*
 * ===========================================================
 * 1. CLEAN NDSP SETS FOR MIX AND MEGA
 * ===========================================================
 */
const DROP_ROLES = new Set(['Z-Move user', 'Dynamax User']);
const PROTECT_MOVES = new Set(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker',
	'silktrap', 'burningbulwark', 'obstruct']);

function hasSetup(movepool) {
	return movepool.some(name => {
		const move = dex.moves.get(name);
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

	// Keep at least four moves.
	while (out.movepool.length < 4) {
		const context = moveContextFor(species, out, doubles);
		const covered = new Set(out.movepool.map(n => dex.moves.get(n)).filter(m => m.category !== 'Status')
			.map(m => m.type));
		const filler =
			S.bestLearnable(species, context, m => S.sideAttack(m, side === 'Support' ? 'Mixed' : side) &&
				!covered.has(m.type) && !out.movepool.some(n => toID(n) === m.id)) ||
			S.bestLearnable(species, context, m => S.sideAttack(m, side === 'Support' ? 'Mixed' : side) &&
				!out.movepool.some(n => toID(n) === m.id));

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

	return out;
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

function assignStones(entries) {
	const usage = new Map(STONES.map(s => [s.id, 0]));
	const cap = id => POWER_STONES.has(id) ? S.POWER_STONE_MAX_USES : MAX_USES;
	const available = id => usage.get(id) < cap(id);

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

	// Make sure every stone is used at least MIN_USES times: give it
	// to the sets that lose the least by using it.
	for (const stone of STONES) {
		while (usage.get(stone.id) < MIN_USES) {
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
const RECOVERY = new Set(['recover', 'roost', 'softboiled', 'moonlight', 'morningsun', 'synthesis',
	'slackoff', 'milkdrink', 'shoreup', 'strengthsap', 'wish', 'rest']);

// NDSP pools, used by the physical/special fixer to find moves
// a species already uses.
const NDSP_TABLES = ['sets.json', 'doubles-sets.json']
	.map(file => JSON.parse(fs.readFileSync(path.join(S.SRC, file), 'utf8')));

function adapt(species, set, stoneID, result, doubles) {
	const info = STONE_INFO.get(stoneID);
	const ability = info.ability;
	// A forme's signature move (Secret Sword for Keldeo-Resolute) must stay.
	const formeMove = species.requiredMove ? dex.moves.get(species.requiredMove).name : null;

	// The stone can push a balanced Pokémon to one side (e.g. +45 SpA):
	// make the set's attacks match the mixed Pokémon.
	const fixed = {role: set.role, movepool: [...set.movepool], abilities: [info.deltas.ability]};
	const mixedSpecies = {...result.mixed, id: species.id, name: species.name, isMega: true};
	category.fixSet(mixedSpecies, fixed, NDSP_TABLES, doubles);
	if (formeMove && !fixed.movepool.includes(formeMove)) fixed.movepool.push(formeMove);

	const side = S.setSide({...set, movepool: fixed.movepool});
	const attackSide = side === 'Support' ? null : side;
	const pool = [...fixed.movepool];
	const required = formeMove ? [formeMove] : [];
	const ids = () => new Set(pool.map(toID));
	const context = {
		types: result.mixed.types,
		doubles,
		trusted: new Set(set.movepool.map(toID)),
		contrary: ability === 'contrary',
		noGuard: ability === 'noguard',
		skillLink: ability === 'skilllink',
		technician: ability === 'technician',
	};
	const onSide = move => attackSide ? S.sideAttack(move, attackSide) : false;
	const has = test => pool.some(name => test(dex.moves.get(name)));
	const addBest = (test, reason) => {
		const move = S.bestLearnable(species, context, m => onSide(m) && test(m) && !ids().has(m.id));

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
			if (S.raisesOwnStats(dex.moves.get(name))) pool.splice(pool.indexOf(name), 1);
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
			if (attackSide === 'Physical') requireExisting(m => !!m.flags.contact);
			break;
		case 'technician':
			ensure(m => m.basePower > 0 && m.basePower <= 60 && (m.priority > 0 || !!m.multihit));
			break;
		case 'skilllink':
			ensure(m => Array.isArray(m.multihit));
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
			if (attackSide !== 'Physical' && species.types.includes('Grass') && learnableID(species, 'solarbeam')) {
				if (!ids().has('solarbeam')) pool.push('Solar Beam');
				required.push('Solar Beam');
			}
			break;
		case 'snowwarning':
			if (attackSide !== 'Physical' && learnableID(species, 'blizzard') && !ids().has('blizzard')) {
				const icebeam = pool.findIndex(n => toID(n) === 'icebeam');
				if (icebeam >= 0) pool[icebeam] = 'Blizzard';
				else pool.push('Blizzard');
				required.push('Blizzard');
			}
			break;
		case 'noguard': {
			// Swap accurate moves for stronger inaccurate ones of the same type.
			for (let i = 0; i < pool.length; i++) {
				const current = dex.moves.get(pool[i]);
				if (!onSide(current) || current.name === formeMove) continue;

				const stronger = S.bestLearnable(species, {...context, trusted: new Set()}, m =>
					m.type === current.type && m.category === current.category && m.accuracy !== true &&
					m.accuracy < 90 && m.basePower > current.basePower && !ids().has(m.id));

				if (stronger && S.moveValue(stronger, context) > S.moveValue(current, context)) {
					pool[i] = stronger.name;
					required.push(stronger.name);
				}
			}
			break;
		}
		}
	}

	if (ability === 'speedboost' && !doubles && !pool.some(n => PROTECT_MOVES.has(toID(n))) &&
		learnableID(species, 'protect') && attackSide) {
		pool.push('Protect');
		required.push('Protect');
	}

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

	// Always leave the generator at least four moves.
	while (pool.length < 4) {
		const fillSide = attackSide || 'Mixed';
		const covered = new Set(pool.map(n => dex.moves.get(n)).filter(m => m.category !== 'Status').map(m => m.type));
		const filler =
			S.bestLearnable(species, context, m => S.sideAttack(m, fillSide) && !covered.has(m.type) && !ids().has(m.id)) ||
			S.bestLearnable(species, context, m => S.sideAttack(m, fillSide) && !ids().has(m.id));

		if (!filler) break;

		pool.push(filler.name);
	}

	// Setup sets that lost their setup move (Contrary) become attackers.
	let role = set.role;
	if (ability === 'contrary' && /Setup/.test(role) && !hasSetup(pool)) {
		role = doubles ? 'Doubles Bulky Attacker' : (BULKY_SETUP.has(role) ? 'Bulky Attacker' : 'Fast Attacker');
	}

	return {
		role,
		movepool: [...new Set(pool)].sort(),
		required: [...new Set(required)].filter(name => pool.includes(name)).slice(0, formeMove ? 3 : 2),
	};
}

const BULKY_SETUP = new Set(['Bulky Setup', 'Doubles Bulky Setup']);

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
		const species = dex.species.get(id);
		const sets = cleanSpecies(species, source[id].sets, doubles);

		if (!sets.length) continue;

		entries.push({species, level: source[id].level, sets, scored: scoreSpecies(species, sets, doubles)});
	}

	const usage = assignStones(entries);

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
					abilities: set.abilities,
					teraTypes: result.mixed.types,
					megaStone: STONE_INFO.get(result.stoneID).stone.name,
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
			if (entry.templates.some(t => toID(t.megaStone) === id)) continue;

			const {set, scores} = entry.scored
				.slice()
				.sort((a, b) => (b.scores.get(id)?.score ?? -Infinity) - (a.scores.get(id)?.score ?? -Infinity))[0];
			const result = scores.get(id);
			const adapted = adapt(entry.species, set, id, result, doubles);
			const template = {
				role: adapted.role,
				movepool: adapted.movepool,
				abilities: set.abilities,
				teraTypes: result.mixed.types,
				megaStone: STONE_INFO.get(id).stone.name,
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
			const key = JSON.stringify([template.role, template.movepool, template.megaStone]);
			const twin = merged.find(t => JSON.stringify([t.role, t.movepool, t.megaStone]) === key);

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

	return {output, entries, usage, median};
}

/*
 * ===========================================================
 * MAIN
 * ===========================================================
 */
function main() {
	fs.mkdirSync(S.OUT, {recursive: true});

	for (const [file, doubles, label] of [['sets.json', false, 'Singles'], ['doubles-sets.json', true, 'Doubles/FFA/2v2']]) {
		const {output, entries, usage, median} = buildPool(file, doubles);

		fs.writeFileSync(path.join(S.OUT, file), JSON.stringify(output, null, 2) + '\n');

		const templates = Object.values(output).reduce((n, e) => n + e.sets.length, 0);
		const unused = STONES.filter(s => !usage.get(s.id));
		const counts = [...usage.values()];

		console.log(`${label}: ${entries.length} Pokémon, ${templates} templates, ` +
			`stones used ${STONES.length - unused.length}/${STONES.length} ` +
			`(min ${Math.min(...counts)}, max ${Math.max(...counts)}), median strength ${median.toFixed(0)}`);

		if (S.REPORT) {
			const byStone = [...usage.entries()].sort((a, b) => b[1] - a[1]);
			console.log('  usage:', byStone.map(([id, n]) => `${STONE_INFO.get(id).stone.name} ${n}`).join(', '));
		}
	}
}

module.exports = {buildPool, cleanSpecies, adapt};

if (require.main === module) main();
