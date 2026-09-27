/*
 * ===========================================================
 * ND MIX AND MEGA
 * ===========================================================
 *
 * Mix and Mega mechanics on top of the National Dex Shared Power
 * data: every Pokémon can Mega Evolve with any Mega Stone and
 * gains that Mega's stat changes, ability and type change.
 *
 * - Data (Pokédex, items, moves, abilities, learnsets) is
 *   inherited from ndsharedpower, so the Legends Z-A Megas keep
 *   the same abilities as in the Shared Power formats.
 * - Battle scripts come from the mixandmega mod.
 * - Shared Power's ability-pool behaviour is NOT used: `field`
 *   and `pokemon` are reset to the standard behaviour.
 */
import {Scripts as MixAndMegaScripts} from '../mixandmega/scripts';

export const Scripts: ModdedBattleScriptsData = {
	...MixAndMegaScripts,

	inherit: 'ndsharedpower',

	gen: 9,

	// No Shared Power ability volatiles in these formats.
	field: {},
	pokemon: {},
};
