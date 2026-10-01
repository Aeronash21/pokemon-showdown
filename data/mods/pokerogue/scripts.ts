/*
 * ===========================================================
 * POKÉROGUE MOD
 * ===========================================================
 *
 * Gen 9 National Dex with PokéRogue data (see tools/pokerogue):
 *
 *  - PokéRogue stats / abilities / move lists (pokedex.ts, learnsets.ts)
 *  - passives, handled like Pokébilities innates
 *  - Gigantamax forms work like Mega Evolutions: hold Galarica Wreath
 *    (or Max Mushrooms)
 *  - singles tiers (tiers.ts)
 *  - Pokémon Champions' move / ability changes (champions-changes.ts)
 *
 * init() puts the PokéRogue info on each species' data:
 *   species.pokeRogue  true for everything in the PokéRogue dex
 *   species.passive    its passive ability's name
 *   species.eggMoves   its four egg moves (the 4th is the rare one)
 *
 * Validation and the passive's battle hooks live in the
 * 'PokeRogue Mod' rule (rulesets.ts).
 *
 * A passive is ON unless the set says `passive: false` (teambuilder
 * toggle, "Passive: Off" in exported teams). It follows the Pokémon's
 * current form: Mega Evolving, Gigantamaxing, Primal Reversion and
 * in-battle form changes (Aegislash, Minior...) switch to that form's
 * passive, as in PokéRogue.
 */

import {Pokemon} from '../../../sim/pokemon';
import {BattleActions} from '../../../sim/battle-actions';
import {Scripts as PokebilitiesScripts} from '../pokebilities/scripts';
import {Abilities as PokebilitiesAbilities} from '../pokebilities/abilities';
import {Abilities as PokeRogueAbilities} from './abilities';
import {PokeRogueData} from './pokerogue-data';
import {PokeRogueTiers} from './tiers';
import {applyChampionsChanges, championsCalculatePP} from './champions-changes';

/** In the PokéRogue dex but impossible to get in these formats. */
const EXCLUDED_SPECIES = new Set([
	// Eternamax is only a boss form; nothing turns Eternatus into it.
	'eternatuseternamax',
]);

/**
 * Not in the PokéRogue dex, but available here (their passive is in
 * PASSIVE_CHANGES). Female Meowstic Mega Evolves like the male one.
 */
const EXTRA_SPECIES = ['meowsticfmega'];

/**
 * Passives changed from PokéRogue's (pokerogue-data.ts is generated, so
 * the changes live here).
 */
const PASSIVE_CHANGES: {[speciesid: string]: string} = {
	// Honey Gather does nothing in a battle.
	illumise: 'Lingering Aroma',
	pachirisu: 'Cheek Pouch',
	volbeat: 'Tinted Lens',
	// Pickup barely does anything in a battle.
	ribombee: 'Aroma Veil',
	spidops: 'Prankster',
	gholdengo: 'Super Luck',
	// Pickup barely does anything in a battle.
	eevee: 'Fluffy',
	eeveestarter: 'Fluffy',
	liepard: 'Stakeout',
	// Magician / Unburden / Poison Heal need the item slot, but these hold
	// their Mega Stone or Max Mushrooms.
	alakazammega: 'Magic Guard',
	kinglergmax: 'Anger Shell',
	eelektrossmega: 'Electromorphosis',
	delphoxmega: 'Magic Guard',
	// PokéRogue balances these around stacks of held items (see ABILITY_CHANGES).
	machampgmax: 'Iron Fist',
	snorlaxgmax: 'Comatose',
	// Balance changes (the old passive in brackets).
	minun: 'Friend Guard', // (Power Spot)
	swampertmega: 'Regenerator', // (Drizzle)
	garchompmegaz: 'Intimidate', // (Levitate, now its ability)
	absolmegaz: 'Super Luck', // (Sharpness, now its ability)
	lucariomegaz: 'Neuroforce', // (Mega Launcher)
	// (EXTRA_SPECIES) the same passive as the male Mega
	meowsticfmega: 'Psychic Surge',
};

/**
 * Egg moves changed from PokéRogue's, for a whole evolution family (keyed by
 * its first stage; Mega forms included). The 4th is the rare egg move.
 */
const EGG_MOVE_CHANGES: {[familyRoot: string]: string[]} = {
	absol: ['Spirit Break', 'First Impression', 'Cross Poison', 'Bitter Blade'],
	gible: ['Nasty Plot', 'Bitter Blade', "Land's Wrath", 'Dragon Dance'],
	glimmet: ['Earth Power', 'Giga Drain', 'Mystical Fire', 'Malignant Chain'],
	clobbopus: ['Knock Off', 'Jet Punch', 'Flip Turn', 'Surging Strikes'],
};

/**
 * Moves that only Pokémon learning them naturally can use: PokéRogue hands
 * them out as egg moves, and those egg-move users can't have them.
 * Sizzly Slide (100% burn): Partner Eevee and Flareon only.
 */
const NATURAL_ONLY_MOVES = ['sizzlyslide'];

/** Abilities changed from PokéRogue's (the form's only ability). */
const ABILITY_CHANGES: {[speciesid: string]: string} = {
	machampgmax: 'No Guard', // was Guts (needs a Flame Orb; it holds Max Mushrooms)
	snorlaxgmax: 'Thick Fat', // was Harvest (needs a Berry)
	// The Legends: Z-A Megas' official abilities (PokéRogue has its own).
	absolmegaz: 'Sharpness', // was Super Luck
	garchompmegaz: 'Levitate', // was Rough Skin
	lucariomegaz: 'Aura Guard', // was Inner Focus
};

/**
 * PokéRogue's Multi Lens, on Prism Scale (an item every Showdown client knows,
 * which does nothing in a battle). The holder's single-hit attacks hit one more
 * time: the first hit does 75% of the normal damage and the extra hit 25%, so
 * the total is the same, split in two. With Parental Bond (ability or passive)
 * it's three hits: 75% / 25% / 25%.
 * Like PokéRogue's, it skips multi-hit, charge, self-KO and spread moves, Fling,
 * Uproar, Rollout, Ice Ball and Endeavor; here also fixed-damage moves
 * (Seismic Toss, Super Fang...), which would otherwise do their damage twice.
 */
const MULTI_LENS = {
	desc: "PokéRogue formats (Multi Lens): the holder's single-hit attacks hit one extra time; the first hit deals " +
		"75% damage and the extra hit 25%. Not for multi-hit, charge, spread, self-KO or fixed-damage moves.",
	shortDesc: "Multi Lens: the holder's single-hit attacks hit twice (75% + 25% damage).",
	onPrepareHit(this: Battle, source: Pokemon, target: Pokemon, move: ActiveMove) {
		if (move.category === 'Status' || move.flags['noparentalbond'] || move.flags['charge'] ||
			move.flags['futuremove'] || move.spreadHit || move.isZ || move.isMax || move.selfdestruct ||
			move.damage || move.damageCallback || move.id === 'uproar') return;
		// (Parental Bond's own extra hit may or may not have been added yet)
		if (move.multihit && move.multihitType !== 'parentalbond') return;
		const bond = move.multihitType === 'parentalbond' || source.hasAbility('parentalbond');
		move.multihit = bond ? 3 : 2;
		if (bond) move.multihitType = 'parentalbond';
		(move as AnyObject).multiLens = true;
	},
	onModifyDamage(this: Battle, damage: number, source: Pokemon, target: Pokemon, move: ActiveMove) {
		if (!(move as AnyObject).multiLens) return;
		if (move.hit === 1) return this.chainModify(0.75);
		// (Parental Bond's 25% already applies to its hits after the first)
		if (move.multihitType !== 'parentalbond') return this.chainModify(0.25);
	},
};

/**
 * The passive ability name of a species (or form), or null if it has none.
 * Some cosmetic forms have their own (Unown letters, Sawsbuck seasons):
 * those are kept on the base species as `cosmeticPassives`.
 */
export function passiveOf(species: Species): string | null {
	const data = species as AnyObject;
	return data.cosmeticPassives?.[species.id] || data.passive || null;
}

/**
 * Set the Pokémon's passive to the one of its current form and
 * start / stop the innate ability volatiles to match.
 */
export function updatePassive(pokemon: Pokemon, announce = true) {
	const battle = pokemon.battle;
	if (!pokemon.m.passiveOn) return;
	const passiveName = passiveOf(pokemon.species);
	// Forms without their own PokéRogue entry keep their current passive.
	const passive = passiveName ? battle.toID(passiveName) : (pokemon.m.passive as ID | undefined);
	if (!passive) return;

	const oldInnates: ID[] = pokemon.m.innates || [];
	const newInnates: ID[] = passive !== pokemon.ability ? [passive] : [];
	pokemon.m.passive = passive;
	if (oldInnates.join() === newInnates.join()) return;
	pokemon.m.innates = newInnates;

	if (!pokemon.isActive) return;
	for (const innate of oldInnates) {
		if (!newInnates.includes(innate)) pokemon.removeVolatile('ability:' + innate);
	}
	for (const innate of oldInnates) {
		if (announce && !newInnates.includes(innate)) battle.add('-end', pokemon, battle.dex.abilities.get(innate).name, '[silent]');
	}
	for (const innate of newInnates) {
		if (oldInnates.includes(innate)) continue;
		// (a foe's Neutralizing Gas keeps it off until the gas goes away)
		if (!battle.dex.abilities.get(innate).flags['cantsuppress'] && neutralizedByFoe(pokemon)) continue;
		if (announce) battle.add('-start', pokemon, battle.dex.abilities.get(innate).name, '[silent]');
		pokemon.addVolatile('ability:' + innate, pokemon);
	}
}

/**
 * Is a foe's Neutralizing Gas (its ability or its passive) switching off
 * this Pokémon's ability and passive? It only affects the holder's foes, and
 * never a Pokémon that has Neutralizing Gas itself.
 */
export function neutralizedByFoe(pokemon: Pokemon) {
	if (pokemon.hasItem('Ability Shield') || pokemon.volatiles['commanding']) return false;
	if (pokemon.ability === 'neutralizinggas' || pokemon.m.innates?.includes('neutralizinggas')) return false;
	for (const foe of pokemon.foes()) {
		if (foe.volatiles['gastroacid'] || foe.transformed) continue;
		if (foe.ability === 'neutralizinggas' && !foe.abilityState.ending) return true;
		const gas = foe.volatiles['ability:neutralizinggas'];
		if (gas && !gas.ending) return true;
	}
	return false;
}

export const Scripts: ModdedBattleScriptsData = {
	gen: 9,

	// Pokémon Champions' PP formula (see champions-changes.ts).
	calculatePP: championsCalculatePP,

	init() {
		const toID = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
		const legal = [...PokeRogueData.species, ...EXTRA_SPECIES].filter(id => !EXCLUDED_SPECIES.has(id));

		const fallbackTier = (id: string): string => {
			const species = this.data.Pokedex[id];
			const from = species.battleOnly || species.changesFrom || species.baseSpecies;
			const baseID = toID(Array.isArray(from) ? from[0] : from || '');
			const baseTier = baseID !== id ? this.data.FormatsData[baseID]?.natDexTier : undefined;
			if (baseTier && !['Illegal', 'Unreleased', 'LC', 'NFE'].includes(baseTier)) return baseTier;
			return 'RU';
		};

		for (const id of legal) {
			if (this.data.Learnsets[id]) (this.data.Learnsets[id] as AnyObject).pokeRogue = true;
			if (!this.data.Pokedex[id]) {
				// A cosmetic form listed only in its base species' cosmeticFormes
				// (Unown-B...): keep its own passive on the base species.
				const base = Object.values(this.data.Pokedex).find(entry =>
					entry.cosmeticFormes?.some(forme => toID(forme) === id));
				const passive = PokeRogueData.passives[id];
				if (base && passive) {
					const baseEntry = this.modData('Pokedex', toID(base.name)) as AnyObject;
					if (passive !== PokeRogueData.passives[toID(base.name)]) {
						baseEntry.cosmeticPassives = {...(baseEntry.cosmeticPassives || {}), [id]: passive};
					}
				}
				continue;
			}
			// PokéRogue info on the species itself (cosmetic forms like the
			// Alcremie flavours copy it from their base species).
			const pokedexEntry = this.modData('Pokedex', id) as AnyObject;
			pokedexEntry.pokeRogue = true;
			const passive = PASSIVE_CHANGES[id] || PokeRogueData.passives[id];
			if (passive) pokedexEntry.passive = passive;
			if (PokeRogueData.eggMoves[id]) pokedexEntry.eggMoves = PokeRogueData.eggMoves[id];
			if (ABILITY_CHANGES[id]) pokedexEntry.abilities = {0: ABILITY_CHANGES[id]};

			const species = this.data.Pokedex[id];
			if (species.isCosmeticForme) continue;

			let formatsData = this.modData('FormatsData', id);
			if (!formatsData) formatsData = this.data.FormatsData[id] = {};
			formatsData.isNonstandard = null;

			const tier = PokeRogueTiers[species.name];
			if (tier) {
				formatsData.natDexTier = tier;
			} else if (!formatsData.natDexTier || ['Illegal', 'Unreleased'].includes(formatsData.natDexTier)) {
				formatsData.natDexTier = fallbackTier(id);
			}

			// Mega Stones (including the Legends: Z-A ones) are legal items.
			const requiredItem = species.requiredItem;
			if (requiredItem) {
				const item = this.modData('Items', toID(requiredItem));
				if (item?.isNonstandard) item.isNonstandard = null;
			}
		}

		// Gigantamax item: Galarica Wreath, which every Showdown client knows
		// (Max Mushrooms, PokéRogue's own item, still works too).
		// Partner Pikachu and Partner Eevee Gigantamax too, into the regular
		// G-Max forms (with their stats).
		const partnerGmax = {'Pikachu-Starter': 'Pikachu-Gmax', 'Eevee-Starter': 'Eevee-Gmax'};
		const mushroomData = this.modData('Items', 'maxmushrooms') as AnyObject;
		mushroomData.megaStone = {...mushroomData.megaStone, ...partnerGmax};
		mushroomData.itemUser = [...mushroomData.itemUser, ...Object.keys(partnerGmax)];
		const mushrooms = this.data.Items['maxmushrooms'] as AnyObject;
		Object.assign(this.modData('Items', 'galaricawreath'), {
			megaStone: {...mushrooms.megaStone},
			itemUser: [...mushrooms.itemUser],
			onTakeItem: mushrooms.onTakeItem,
			desc: "PokéRogue formats: if held by a Pokemon with a Gigantamax form, it can Gigantamax like a Mega Evolution.",
			shortDesc: "PokéRogue formats: lets a Pokemon with a Gigantamax form Gigantamax (like a Mega Evolution).",
		});
		// Multi Lens (see MULTI_LENS)
		Object.assign(this.modData('Items', 'prismscale'), MULTI_LENS);

		for (const id of legal) {
			if (this.data.Pokedex[id]?.requiredItem !== 'Max Mushrooms') continue;
			Object.assign(this.modData('Pokedex', id), {
				requiredItem: 'Galarica Wreath', requiredItems: ['Galarica Wreath', 'Max Mushrooms'],
			});
		}

		// Pokébilities' fixes for abilities that deal with other abilities
		// (Mummy, Trace...) also cover passives. (Neutralizing Gas has its own
		// version in abilities.ts.)
		for (const [id, data] of Object.entries(PokebilitiesAbilities)) {
			if (id in PokeRogueAbilities) continue;
			const {inherit, ...fields} = data as AnyObject;
			Object.assign(this.modData('Abilities', id), fields);
		}

		const legalSet = new Set(legal);

		// Egg move changes: the old egg moves go (unless learned another way),
		// the new ones come in, for the whole family.
		const familyRoot = (id: string) => {
			let entry = this.data.Pokedex[id];
			for (let i = 0; entry && i < 6; i++) {
				const base = entry.baseSpecies && toID(entry.baseSpecies) !== toID(entry.name) ?
					this.data.Pokedex[toID(entry.baseSpecies)] : undefined;
				const next = base || (entry.prevo ? this.data.Pokedex[toID(entry.prevo)] : undefined);
				if (!next) break;
				entry = next;
			}
			return entry ? toID(entry.name) : id;
		};
		for (const id of legal) {
			const newEggMoves = EGG_MOVE_CHANGES[familyRoot(id)];
			if (!newEggMoves || !this.data.Pokedex[id]) continue;
			const oldIDs = (PokeRogueData.eggMoves[id] || []).map(toID);
			const newIDs = newEggMoves.map(toID);
			(this.modData('Pokedex', id) as AnyObject).eggMoves = newEggMoves;
			if (!this.data.Learnsets[id]?.learnset) continue;
			const learnset = this.modData('Learnsets', id).learnset as {[moveid: string]: string[]};
			for (const moveid of oldIDs) {
				if (newIDs.includes(moveid) || !learnset[moveid]) continue;
				const kept = learnset[moveid].filter(source => !/^\d+E/.test(source));
				if (kept.length) learnset[moveid] = kept;
				else delete learnset[moveid];
			}
			for (const moveid of newIDs) {
				const sources = learnset[moveid] || [];
				if (!sources.some(source => /^\d+E/.test(source))) learnset[moveid] = [...sources, '9E'];
			}
		}

		// Evolutions can use their pre-evolutions' moves too (Slaking gets
		// Slakoth's Slack Off, Raichu gets Pichu's moves, ...).
		for (const id of legal) {
			if (!this.data.Learnsets[id]?.learnset || !(this.data.Learnsets[id] as AnyObject).pokeRogue) continue;
			// (cosmetic forms with their own move list, like the Vivillon patterns,
			// use their base species' pre-evolution)
			const entry = this.data.Pokedex[id];
			let prevo = entry?.prevo || (entry?.baseSpecies ? this.data.Pokedex[toID(entry.baseSpecies)]?.prevo : undefined);
			for (let i = 0; prevo && i < 3; i++) {
				const prevoID = toID(prevo);
				const prevoMoves = legalSet.has(prevoID) ? this.data.Learnsets[prevoID]?.learnset : undefined;
				for (const moveid in prevoMoves || {}) {
					if (this.data.Learnsets[id].learnset![moveid]) continue;
					this.modData('Learnsets', id).learnset![moveid] = prevoMoves![moveid];
				}
				prevo = this.data.Pokedex[prevoID]?.prevo;
			}
		}

		// Moves only the Pokémon that learn them naturally (level-up, TM...) keep:
		// as a PokéRogue egg move (inherited by evolutions too) they're gone.
		for (const id of legal) {
			const learnset = this.data.Learnsets[id]?.learnset as {[moveid: string]: string[]} | undefined;
			if (!learnset) continue;
			for (const moveid of NATURAL_ONLY_MOVES) {
				const sources = learnset[moveid];
				if (!sources) continue;
				const kept = sources.filter(source => !/^\d+E/.test(source));
				if (kept.length === sources.length) continue;
				const modLearnset = this.modData('Learnsets', id).learnset as {[moveid: string]: string[]};
				if (kept.length) modLearnset[moveid] = kept;
				else delete modLearnset[moveid];
			}
		}

		// Pokémon Champions' move and ability changes (not its move bans).
		applyChampionsChanges(this);

		// Every move in a PokéRogue move list is usable (LGPE partner moves,
		// Legends: Z-A moves, ...).
		for (const id in this.data.Learnsets) {
			if (!legalSet.has(id)) continue;
			for (const moveid in this.data.Learnsets[id].learnset || {}) {
				const move = this.modData('Moves', moveid);
				if (move?.isNonstandard) move.isNonstandard = null;
			}
		}
	},

	field: {
		// Cloud Nine / Air Lock, as the ability or the passive. Like the core
		// version, one that is ending (switching out) no longer counts.
		suppressingWeather() {
			for (const pokemon of this.battle.getAllActive()) {
				if (!pokemon || pokemon.fainted || pokemon.ignoringAbility()) continue;
				if (pokemon.getAbility().suppressWeather && !pokemon.abilityState.ending) return true;
				for (const innate of pokemon.m.innates || []) {
					const state = pokemon.volatiles['ability:' + innate];
					if (state && !state.ending && this.battle.dex.abilities.get(innate).suppressWeather) return true;
				}
			}
			return false;
		},
	},

	actions: {
		canMegaEvo(pokemon) {
			const item = pokemon.getItem();
			// Galarica Wreath / Max Mushrooms: only the exact species listed can
			// Gigantamax (Urshifu-Rapid-Strike -> Urshifu-Rapid-Strike-Gmax, not Urshifu-Gmax).
			if (item.id === 'galaricawreath' || item.id === 'maxmushrooms') {
				const species = pokemon.baseSpecies;
				const name = species.isCosmeticForme ? species.baseSpecies : species.name;
				return item.megaStone?.[name] || null;
			}
			return BattleActions.prototype.canMegaEvo.call(this, pokemon);
		},
	},

	pokemon: {
		ignoringAbility() {
			if (this.battle.gen >= 5 && !this.isActive) return true;
			// Certain Abilities won't activate while Transformed, even if they ordinarily couldn't be suppressed (e.g. Disguise)
			if (this.getAbility().flags['notransform'] && this.transformed) return true;
			if (this.getAbility().flags['cantsuppress']) return false;
			if (this.volatiles['gastroacid']) return true;
			return neutralizedByFoe(this);
		},
		hasAbility: PokebilitiesScripts.pokemon!.hasAbility,
		// Champions: Rage Fist's counter resets when the Pokémon switches out.
		clearVolatile(includeSwitchFlags) {
			Pokemon.prototype.clearVolatile.call(this, includeSwitchFlags);
			this.timesAttacked = 0;
		},
		// Transform / Imposter copy the target's passive along with its ability.
		transformInto(pokemon, effect) {
			const transformed = Pokemon.prototype.transformInto.call(this, pokemon, effect || undefined);
			if (transformed) {
				for (const innate of this.m.innates || []) {
					this.removeVolatile('ability:' + innate);
					this.battle.add('-end', this, this.battle.dex.abilities.get(innate).name, '[silent]');
				}
				this.m.innates = [...(pokemon.m.innates || [])];
				this.m.passive = pokemon.m.passive;
				for (const innate of this.m.innates) {
					this.battle.add('-start', this, this.battle.dex.abilities.get(innate).name, '[silent]');
					this.addVolatile('ability:' + innate, this);
				}
			}
			return transformed;
		},

		formeChange(speciesId, source, isPermanent, abilitySlot, message) {
			// Innate Disguise / Ice Face must not reset the Pokémon's real ability.
			if (isPermanent && source && ['ability:disguise', 'ability:iceface'].includes(source.id)) {
				const ability = this.ability;
				const changed = Pokemon.prototype.formeChange.call(this, speciesId, source, isPermanent, abilitySlot, message);
				if (changed) {
					this.setAbility(ability, null, null, true);
					this.baseAbility = ability;
				}
				return changed;
			}
			const changed = Pokemon.prototype.formeChange.call(this, speciesId, source, isPermanent, abilitySlot, message);
			if (changed) updatePassive(this);
			return changed;
		},

		// Tera Shell (Glimmora's passive) works for any Pokémon at full HP,
		// not only Terastal Terapagos.
		runEffectiveness(move) {
			const typeMod = Pokemon.prototype.runEffectiveness.call(this, move);
			if (this.species.name === 'Terapagos-Terastal' || !this.hasAbility('terashell') ||
				this.battle.suppressingAbility(this)) {
				return typeMod;
			}
			// Hazards and status moves are never affected.
			if (move.category === 'Status' || move.id === 'struggle') return typeMod;
			// Every hit of a multi-hit move is resisted once the first one was.
			if (!move.hit || move.hit <= 1) delete this.m.teraShellResisted;
			if (this.m.teraShellResisted) return -1;
			if (!this.runImmunity(move) || typeMod < 0 || this.hp < this.maxhp) return typeMod;
			this.battle.add('-activate', this, 'ability: Tera Shell');
			this.m.teraShellResisted = true;
			return -1;
		},

		// Let the client show the passive: its name, "Off", or nothing if the
		// Pokémon has none.
		getSwitchRequestData(this: Pokemon, forAlly?: boolean) {
			const entry = Pokemon.prototype.getSwitchRequestData.call(this, forAlly);
			if (this.m.passiveOn) {
				(entry as AnyObject).passive = this.battle.dex.abilities.get(this.m.passive || '').name || '';
			} else {
				(entry as AnyObject).passive = passiveOf(this.species) ? 'Off' : '';
			}
			return entry;
		},
	} as ModdedBattlePokemon,
};
