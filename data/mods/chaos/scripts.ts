/*
 * ===========================================================
 * CHAOS
 * ===========================================================
 *
 * PokéRogue + Mix and Mega + persistent Shared Power, with every battle
 * gimmick:
 *
 * - PokéRogue (data inherited from the pokerogue mod): stats, move lists
 *   with egg moves, passives, Champions changes, and Gigantamax as a Mega
 *   Evolution with Galarica Wreath (the Pokémon's own G-Max form).
 * - Mix and Mega: any Pokémon can Mega Evolve with any Mega Stone (or use
 *   any Primal Orb, Rusted item, Origin item, Mask, Plate, Memory or
 *   Drive) and gains that forme's stat changes, ability, type change and,
 *   here, its PokéRogue passive. No limit on how many can Mega Evolve.
 * - Shared Power: every ability and passive a team has sent out is shared
 *   with the whole team for the rest of the battle (format hooks in
 *   config/custom-formats.ts).
 * - Terastallization, Dynamax (with Gigantamax), Z-Moves and Ultra Burst.
 */
import {BattleActions} from '../../../sim/battle-actions';
import {Scripts as PokeRogueScripts, passiveOf} from '../pokerogue/scripts';
import {Scripts as MixAndMegaScripts} from '../mixandmega/scripts';
import {Scripts as NDSharedPowerScripts} from '../ndsharedpower/scripts';
import {Items as MixAndMegaItems} from '../mixandmega/items';

const MNM_ACTIONS = MixAndMegaScripts.actions as AnyObject;
const POKEROGUE_ACTIONS = PokeRogueScripts.actions as AnyObject;
const NDSP_QUEUE = NDSharedPowerScripts.queue as AnyObject;

/** A deep copy (Showdown freezes data a battle has used, so the Mix and Mega mod's objects are never shared). */
function copyData(value: any): any {
	if (Array.isArray(value)) return value.map(copyData);
	if (value && typeof value === 'object') {
		const copy: AnyObject = {};
		for (const key in value) copy[key] = copyData(value[key]);
		return copy;
	}
	return value;
}

export const Scripts: ModdedBattleScriptsData = {
	inherit: 'pokerogue',
	gen: 9,

	init() {
		// Mix and Mega's item changes (Primal Orbs make any holder revert, Masks
		// and Origin items boost any holder...) on top of the PokéRogue items.
		// (Here rather than in an items.ts: data files can't import.)
		for (const [id, data] of Object.entries(MixAndMegaItems)) {
			const item = this.modData('Items', id);
			for (const key in data) {
				if (key !== 'inherit') item[key] = copyData((data as AnyObject)[key]);
			}
		}
		// Mix and Mega: transformation items can't be removed from anyone, and
		// every Mega Stone / Mega forme is usable.
		MixAndMegaScripts.init!.call(this);
	},

	// Mix and Mega: Plates, Masks, Rusted items... change any holder's forme.
	start: MixAndMegaScripts.start,
	runAction: MixAndMegaScripts.runAction,

	// ND Shared Power's action order fix (Mega Evolution before moves, with
	// Dynamax around).
	queue: {
		inherit: true,
		resolveAction: NDSP_QUEUE.resolveAction,
		sort: NDSP_QUEUE.sort,
	},

	field: {
		// Cloud Nine / Air Lock as an ability, a passive or a shared ability.
		suppressingWeather() {
			for (const pokemon of this.battle.getAllActive()) {
				if (!pokemon || pokemon.fainted || pokemon.ignoringAbility()) continue;
				if (pokemon.getAbility().suppressWeather && !pokemon.abilityState.ending) return true;
				for (const id in pokemon.volatiles) {
					if (!id.startsWith('ability:') || pokemon.volatiles[id].ending) continue;
					if (this.battle.dex.abilities.get(id.slice(8)).suppressWeather) return true;
				}
			}
			return false;
		},
	},

	actions: {
		...POKEROGUE_ACTIONS,

		canMegaEvo(pokemon) {
			const item = pokemon.getItem();
			// Galarica Wreath / Max Mushrooms: the Pokémon's own G-Max form only.
			if (item.id === 'galaricawreath' || item.id === 'maxmushrooms') {
				return POKEROGUE_ACTIONS.canMegaEvo.call(this, pokemon);
			}
			if (item.megaStone) {
				if (pokemon.species.isMega) return null;
				// Its own Mega if the stone has one for it (Meowsticite...), or the stone's Mega.
				const species = pokemon.baseSpecies;
				return item.megaStone[species.name] || item.megaStone[species.baseSpecies] ||
					Object.values(item.megaStone)[0];
			}
			// Mega Rayquaza (Dragon Ascent)
			return BattleActions.prototype.canMegaEvo.call(this, pokemon);
		},

		runMegaEvo(pokemon) {
			const forme = pokemon.canMegaEvo || pokemon.canUltraBurst;
			if (!forme) return false;
			// Ultra Burst and Mega Rayquaza work as usual.
			if (!pokemon.canMegaEvo || !pokemon.getItem().megaStone) {
				return BattleActions.prototype.runMegaEvo.call(this, pokemon);
			}
			if (pokemon.species.isMega) return false;

			const species: Species = (this as any).getMixedSpecies(pokemon.m.originalSpecies, forme, pokemon);
			const oSpecies = this.dex.species.get(pokemon.m.originalSpecies);
			pokemon.formeChange(species, pokemon.getItem(), true);
			// Show which Mega it took (and the type change), as Mix and Mega does.
			if ((species as AnyObject).originalSpecies) {
				const megaSpecies = this.dex.species.get((species as AnyObject).originalSpecies);
				this.battle.add('-start', pokemon, megaSpecies.requiredItem, '[silent]');
				if (oSpecies.types.join('/') !== pokemon.species.types.join('/')) {
					this.battle.add('-start', pokemon, 'typechange', pokemon.species.types.join('/'), '[silent]',
						'[from] format: Mix and Mega');
				}
			}
			// Mix and Mega: no limit on how many Pokémon can Mega Evolve.
			pokemon.canMegaEvo = false;
			this.battle.runEvent('AfterMega', pokemon);
			return true;
		},

		terastallize: MNM_ACTIONS.terastallize,

		getMixedSpecies(originalForme, formeChange, pokemon) {
			const species = MNM_ACTIONS.getMixedSpecies.call(this, originalForme, formeChange, pokemon);
			const forme = this.dex.species.get(formeChange);
			// A mixed Mega / Primal also gets that forme's PokéRogue passive (its
			// old passive stays in the team's Shared Power pool).
			if (species !== forme && (forme.isMega || forme.isPrimal)) {
				const passive = passiveOf(forme);
				if (passive) species.passive = passive;
			}
			return species;
		},
		getFormeChangeDeltas: MNM_ACTIONS.getFormeChangeDeltas,
		mutateOriginalSpecies: MNM_ACTIONS.mutateOriginalSpecies,
	},
	// pokemon: PokéRogue's (passives, Neutralizing Gas, Tera Shell...)
};
