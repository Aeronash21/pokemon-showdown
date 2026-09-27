'use strict';

/*
 * Mix and Mega calculator for the ND Mix and Mega tools.
 * Uses the mixandmega mod's own getMixedSpecies code, so results
 * match what happens in battle.
 *
 * Works for every transformation item Mix and Mega supports:
 * Mega Stones, Primal Orbs, Rusted Sword/Shield, Origin items,
 * Ogerpon Masks, Arceus Plates, Silvally Memories, Genesect Drives.
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

// Gengarite gives Shadow Tag, banned in NDSP.
const EXCLUDED_ITEMS = new Set(['gengarite']);

function kindOf(item) {
	if (item.megaStone) return 'mega';
	if (item.isPrimalOrb) return 'primal';
	if (item.id === 'rustedsword' || item.id === 'rustedshield') return 'rusted';
	if (item.onPlate) return 'plate';
	if (item.onMemory) return 'memory';
	if (item.onDrive) return 'drive';
	if (/mask$/.test(item.id)) return 'mask';
	if (item.forcedForme) return 'origin';

	return null;
}

function transformationItems() {
	return dex.items.all().filter(item =>
		item.exists && !item.zMove && !EXCLUDED_ITEMS.has(item.id) &&
		!['CAP', 'LGPE', 'Custom'].includes(item.isNonstandard) &&
		kindOf(item) && formeOf(item.id).exists
	);
}

// The forme whose changes an item applies.
function formeOf(itemID) {
	const item = dex.items.get(itemID);

	if (item.megaStone) return dex.species.get(Object.values(item.megaStone)[0]);
	if (item.id === 'redorb') return dex.species.get('Groudon-Primal');
	if (item.id === 'blueorb') return dex.species.get('Kyogre-Primal');
	if (item.id === 'rustedsword') return dex.species.get('Zacian-Crowned');
	if (item.id === 'rustedshield') return dex.species.get('Zamazenta-Crowned');

	return dex.species.get(item.forcedForme || '');
}

// With `abilityName`: a forme item's holder that uses its hidden
// ability gets the forme's hidden ability (Mix and Mega rule), e.g.
// Embody Aspect from a Mask, Telepathy from an Origin item.
function mix(speciesName, itemID, abilityName = null) {
	const species = dex.species.get(speciesName);
	const pokemon = abilityName ? {baseSpecies: species, getAbility: () => dex.abilities.get(abilityName)} : null;

	return ctx.getMixedSpecies(species.name, formeOf(itemID).name, pokemon);
}

function deltas(itemID) {
	return ctx.getFormeChangeDeltas(formeOf(itemID), null);
}

// Back-compatible names.
const stones = () => transformationItems().filter(item => item.megaStone);
const megaOf = formeOf;

module.exports = {dex, transformationItems, kindOf, formeOf, mix, deltas, stones, megaOf};
