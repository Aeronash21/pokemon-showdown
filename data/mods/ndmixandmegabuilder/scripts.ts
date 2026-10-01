/*
 * ===========================================================
 * ND MIX AND MEGA (TEAMBUILDER FORMATS)
 * ===========================================================
 *
 * The official Mix and Mega mod (full National Dex with NatDex Mod),
 * plus Pokémon Champions' move, ability, status and battle changes
 * (data/mods/pokerogue/champions-changes.ts).
 */
import {Pokemon} from '../../../sim/pokemon';
import {Scripts as MixAndMegaScripts} from '../mixandmega/scripts';
import {applyChampionsChanges, championsCalculatePP, CHAMPIONS_ACTIONS, CHAMPIONS_POKEMON} from '../pokerogue/champions-changes';

export const Scripts: ModdedBattleScriptsData = {
	...MixAndMegaScripts,
	inherit: 'mixandmega',
	gen: 9,

	init() {
		applyChampionsChanges(this);
	},

	calculatePP: championsCalculatePP,

	actions: {
		...(MixAndMegaScripts.actions || {}),
		...CHAMPIONS_ACTIONS,
	} as ModdedBattleActions,

	pokemon: {
		...(MixAndMegaScripts.pokemon || {}),
		...CHAMPIONS_POKEMON,
		// Champions: Rage Fist's counter resets when the Pokémon switches out.
		clearVolatile(includeSwitchFlags?: boolean) {
			Pokemon.prototype.clearVolatile.call(this, includeSwitchFlags);
			this.timesAttacked = 0;
		},
	} as ModdedBattlePokemon,
};
