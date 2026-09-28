/**
 * Pokémon Champions' move and ability changes (data/mods/champions), for
 * mods that aren't built on the Champions data (PokéRogue, ND Mix and
 * Mega teambuilder formats).
 *
 * Applied: every changed move field (power, accuracy, PP, flags, effects,
 * targets...), the 20 PP cap, and the ability changes. Not applied:
 * which moves exist (Champions marks many moves "Past"), so no move is
 * taken away from these formats.
 *
 * Also see calculatePP (Champions' PP formula) and the Rage Fist counter
 * reset on switching, which the mods' scripts add.
 */
import {Moves as ChampionsMoves} from '../champions/moves';
import {Abilities as ChampionsAbilities} from '../champions/abilities';

export function applyChampionsChanges(dex: ModdedDex) {
	for (const [id, data] of Object.entries(ChampionsMoves)) {
		const {inherit, isNonstandard, ...changes} = data as AnyObject;
		if (!dex.data.Moves[id] || !Object.keys(changes).length) continue;
		Object.assign(dex.modData('Moves', id), changes);
	}
	for (const [id, data] of Object.entries(ChampionsAbilities)) {
		const {inherit, ...changes} = data as AnyObject;
		if (!dex.data.Abilities[id]) continue;
		Object.assign(dex.modData('Abilities', id), changes);
	}
	// Champions: no move has more than 20 PP.
	for (const id in dex.data.Moves) {
		if (dex.data.Moves[id].pp > 20) dex.modData('Moves', id).pp = 20;
	}
}

/** Champions' PP formula (PP Ups don't exist). */
export function championsCalculatePP(move: Move, ppUps?: number) {
	return move.noPPBoosts ? move.pp : (move.pp / 5 + 1) * 4;
}
