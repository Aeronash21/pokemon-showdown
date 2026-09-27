'use strict';

/*
 * Mix and Mega calculator for the ND Mix and Mega tools.
 * Uses the mixandmega mod's own getMixedSpecies code, so results
 * match what happens in battle.
 */
const {Dex} = require('../dist/sim/dex');

const dex = Dex.mod('ndmixandmega');
const actions = dex.data.Scripts.actions;

const ctx = {
	dex,
	battle: {
		clampIntRange: (n, min, max) => Math.min(Math.max(n, min), max),
		ruleTable: {has: () => false},
	},
};
ctx.getFormeChangeDeltas = actions.getFormeChangeDeltas.bind(ctx);
ctx.mutateOriginalSpecies = actions.mutateOriginalSpecies.bind(ctx);
ctx.getMixedSpecies = actions.getMixedSpecies.bind(ctx);

// Mega Stones usable in these formats (Gengarite gives Shadow Tag, banned in NDSP).
const EXCLUDED_STONES = new Set(['gengarite']);

function stones() {
	return dex.items.all().filter(item =>
		item.exists && item.megaStone && !EXCLUDED_STONES.has(item.id) &&
		!['CAP', 'LGPE', 'Custom'].includes(item.isNonstandard)
	);
}

function megaOf(stone) {
	return dex.species.get(Object.values(dex.items.get(stone).megaStone)[0]);
}

function mix(speciesName, stone) {
	const mega = megaOf(stone);
	return ctx.getMixedSpecies(dex.species.get(speciesName).name, mega.name, null);
}

function deltas(stone) {
	return ctx.getFormeChangeDeltas(megaOf(stone), null);
}

module.exports = {dex, stones, megaOf, mix, deltas};
