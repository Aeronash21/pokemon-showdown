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
 * Also the status changes (data/mods/champions/conditions.ts):
 * - paralysis: 1/8 chance to be fully paralyzed (instead of 1/4);
 * - sleep: 1-2 turns (instead of 1-3);
 * - freeze: 25% chance to thaw each turn (instead of 20%), at most 3 turns.
 *
 * Also see calculatePP (Champions' PP formula), the Rage Fist counter reset
 * on switching, and CHAMPIONS_ACTIONS / CHAMPIONS_POKEMON below, which the
 * mods' scripts add.
 */
import {Moves as ChampionsMoves} from '../champions/moves';
import {Abilities as ChampionsAbilities} from '../champions/abilities';
import {Conditions as ChampionsConditions} from '../champions/conditions';
import {Scripts as ChampionsScripts} from '../champions/scripts';

/**
 * Champions' battle script changes, for a mod's `actions`: a move's after-hit
 * effect (Rapid Spin's hazard removal, Knock Off's item removal...) still
 * happens if the user faints during the hit (Rocky Helmet, Rough Skin...).
 */
export const CHAMPIONS_ACTIONS = {
	spreadMoveHit: ChampionsScripts.actions!.spreadMoveHit!,
};
/**
 * ...and for a mod's `pokemon`: no Trick Room speed underflow (in Trick Room,
 * every Pokémon simply moves in reverse Speed order).
 */
export const CHAMPIONS_POKEMON = {
	getActionSpeed: ChampionsScripts.pokemon!.getActionSpeed!,
};

/**
 * A copy of a piece of Champions data. The Champions mod's own data objects
 * must never end up in another mod: Showdown freezes a move's data once a
 * battle uses it, and the Champions-based mods (ND Shared Power, ND Mix and
 * Mega random battles) edit those same objects when they load.
 */
function copyData(value: any): any {
	if (Array.isArray(value)) return value.map(copyData);
	if (value && typeof value === 'object') {
		const copy: AnyObject = {};
		for (const key in value) copy[key] = copyData(value[key]);
		return copy;
	}
	return value;
}

/**
 * Apply a Champions entry's changes on top of this mod's entry. A changed
 * `condition` marked `inherit` (Disable, Encore, Salt Cure) only replaces
 * the parts it lists; the rest of the original effect is kept.
 */
function applyChanges(entry: AnyObject, changes: AnyObject) {
	for (const [key, value] of Object.entries(changes)) {
		if (key === 'condition' && value?.inherit) {
			const {inherit, ...parts} = value;
			entry.condition = {...(entry.condition || {}), ...copyData(parts)};
		} else {
			entry[key] = copyData(value);
		}
	}
}

/** Same data? (Functions by reference: a merged entry keeps the base entry's functions.) */
function sameData(a: any, b: any): boolean {
	if (a === b) return true;
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		if (!sameData(a[key], b[key])) return false;
	}
	return true;
}

/**
 * What a Champions data entry changes from the base (Gen 9) entry.
 *
 * Only the fields that differ from the base data count: once a
 * Champions-based dex (Champions, ND Shared Power...) has loaded, Showdown
 * has filled the Champions modules' data tables with every base entry and
 * merged each changed entry with its base entry, so taking every field
 * would copy base data over this mod's own changes (PokéRogue's Zippy Zap,
 * Gastro Acid, Neutralizing Gas...) whenever such a format was played first.
 */
function championsChanges(data: AnyObject, base: AnyObject | undefined, skip: string[]) {
	const changes: AnyObject = {};
	if (data === base) return changes;
	for (const key in data) {
		if (key === 'inherit' || skip.includes(key)) continue;
		if (base && sameData(data[key], base[key])) continue;
		changes[key] = data[key];
	}
	return changes;
}

export function applyChampionsChanges(dex: ModdedDex) {
	const base = dex.mod('gen9').data;
	for (const [id, data] of Object.entries(ChampionsConditions)) {
		const changes = championsChanges(data, base.Conditions[id], []);
		if (!dex.data.Conditions[id] || !Object.keys(changes).length) continue;
		applyChanges(dex.modData('Conditions', id), changes);
	}
	for (const [id, data] of Object.entries(ChampionsMoves)) {
		const changes = championsChanges(data, base.Moves[id], ['isNonstandard']);
		if (!dex.data.Moves[id] || !Object.keys(changes).length) continue;
		applyChanges(dex.modData('Moves', id), changes);
	}
	for (const [id, data] of Object.entries(ChampionsAbilities)) {
		const changes = championsChanges(data, base.Abilities[id], []);
		if (!dex.data.Abilities[id] || !Object.keys(changes).length) continue;
		applyChanges(dex.modData('Abilities', id), changes);
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
