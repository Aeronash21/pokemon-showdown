// Data files may only import types (see test/sim/data.js), so these
// helpers read the PokéRogue info that scripts.ts init() puts on species.

/** The passive ability name of a species (or form), or null. */
function passiveOf(species: Species): string | null {
	const data = species as AnyObject;
	return data.cosmeticPassives?.[species.id] || data.passive || null;
}

/** The PokéRogue move list a species uses (battle-only forms use their base form's). */
function pokeRogueLearnset(species: Species, dex: ModdedDex): {[moveid: string]: string[]} | null {
	let current: Species | null = species;
	for (let i = 0; current && i < 3; i++) {
		const data = dex.data.Learnsets[current.id] as AnyObject | undefined;
		if (data?.pokeRogue && data.learnset) return data.learnset;
		const from: string | string[] | undefined = current.battleOnly || current.changesFrom ||
			(current.isCosmeticForme ? current.baseSpecies : undefined);
		const next: Species = dex.species.get(Array.isArray(from) ? from[0] : from || '');
		current = next.exists && next.id !== current.id ? next : null;
	}
	return null;
}

/** Every form a set can end up in during a battle (for passive bans). */
function reachableFormes(this: TeamValidator, set: PokemonSet, species: Species, tierSpecies: Species) {
	const dex = this.dex;
	const item = dex.items.get(set.item);
	const formes = [{species, ability: set.ability}];
	if (tierSpecies !== species) formes.push({species: tierSpecies, ability: tierSpecies.abilities[0]});

	const base = dex.species.get(species.baseSpecies);
	for (const name of base.otherFormes || []) {
		const forme = dex.species.get(name);
		if (!forme.battleOnly || forme.id === tierSpecies.id) continue;
		const from = Array.isArray(forme.battleOnly) ? forme.battleOnly : [forme.battleOnly];
		if (!from.includes(species.name)) continue;
		// Item forms (Megas, Primals, Gigantamax...) only count with their item.
		if (forme.requiredItems && !forme.requiredItems.map(dex.toID).includes(item.id)) continue;
		// Mega Rayquaza is only reachable with Dragon Ascent.
		if (forme.requiredMove && !set.moves.map(dex.toID).includes(dex.toID(forme.requiredMove))) continue;
		formes.push({species: forme, ability: forme.abilities[0]});
	}
	return formes;
}

export const Rulesets: import('../../../sim/dex-formats').ModdedFormatDataTable = {
	pokeroguemod: {
		effectType: 'Rule',
		name: 'PokeRogue Mod',
		desc: "Pok&eacute;Rogue Pok&eacute;mon, move lists, passives (with an on/off toggle) and Gigantamax via Galarica Wreath (or Max Mushrooms).",
		ruleset: ['NatDex Mod', '+Light of Ruin'],
		onChangeSet(set) {
			// "Charizard-Gmax" means "Charizard holding Galarica Wreath (or Max
			// Mushrooms)" here; there is no Dynamax flag.
			if (set.gigantamax) {
				delete set.gigantamax;
				if (!['galaricawreath', 'maxmushrooms'].includes(this.dex.toID(set.item))) {
					return [`${set.name || set.species} can only Gigantamax by holding Galarica Wreath in PokéRogue formats.`];
				}
			}
		},
		onValidateSet(set, format, setHas) {
			const dex = this.dex;
			const species = dex.species.get(set.species);
			const item = dex.items.get(set.item);
			const name = set.name || set.species;
			const problems: string[] = [];

			if (!(species as AnyObject).pokeRogue) {
				return [`${species.name} is not available in PokéRogue.`];
			}

			// PokéRogue has Mega Evolution and Gigantamax, but no Dynamax. The only
			// Z-Move is Ultra Necrozma's: Necrozma-Dusk-Mane / Dawn-Wings holding
			// Ultranecrozium Z Ultra Burst and get Light That Burns the Sky.
			if (item.id === 'ultranecroziumz') {
				if (!['Necrozma-Dusk-Mane', 'Necrozma-Dawn-Wings'].includes(species.name)) {
					problems.push(`${name} can't hold ${item.name}: only Necrozma-Dusk-Mane and Necrozma-Dawn-Wings can ` +
						`Ultra Burst.`);
				}
			} else if (item.zMove) {
				problems.push(`${name}'s item ${item.name} can't be used: the only Z-Crystal in PokéRogue formats is ` +
					`Ultranecrozium Z (for Ultra Necrozma).`);
			}
			if (item.id === 'maxmushrooms' &&
				!item.megaStone?.[species.isCosmeticForme ? species.baseSpecies : species.name]) {
				problems.push(`${name} has no Gigantamax form, so it can't use Max Mushrooms.`);
			}

			// A passive the format bans (as an ability, or as "Pokemon + Ability") is
			// switched off; the Pokémon stays legal.
			if (set.passive !== false) {
				const {tierSpecies} = this.getValidationSpecies(set);
				for (const forme of reachableFormes.call(this, set, species, tierSpecies)) {
					const passive = passiveOf(forme.species);
					if (!passive || dex.toID(passive) === dex.toID(forme.ability)) continue;
					const passiveID = 'ability:' + dex.toID(passive);
					// A banned passive is switched off (the Pokémon stays legal).
					if (this.ruleTable.check(passiveID)) {
						set.passive = false;
						break;
					}
					// "Pokemon + Ability" bans apply to the passive too.
					for (const [, , limit, bans] of this.ruleTable.complexBans) {
						if (limit || !bans.includes(passiveID)) continue;
						const matches = bans.every(ban => ban === passiveID ||
							ban === 'pokemon:' + forme.species.id ||
							ban === 'basepokemon:' + dex.toID(forme.species.baseSpecies) ||
							(!ban.startsWith('pokemon:') && !ban.startsWith('basepokemon:') && !ban.startsWith('ability:') &&
								setHas[ban]));
						if (matches) set.passive = false;
					}
				}
			}
			return problems;
		},
		checkCanLearn(move, species, setSources, set) {
			const learnset = pokeRogueLearnset(species, this.dex) || {};
			if (learnset[move.id]) return null;
			// Smeargle's Sketch.
			if (learnset['sketch'] && !move.flags['nosketch'] && !move.isZ && !move.isMax) return null;
			return ` can't learn ${move.name} in PokéRogue.`;
		},

		// ---------------------------------------------------
		// Battle: the passive is an innate ability.
		// ---------------------------------------------------
		onBegin() {
			for (const pokemon of this.getAllPokemon()) {
				// Pokémon holding their Mega Stone, Max Mushrooms or Ultranecrozium Z
				// can't Terastallize, even before they can use it (Zygarde needs
				// Power Construct first).
				const item = pokemon.getItem();
				if (item.megaStone && Object.keys(item.megaStone).some(
					name => this.dex.species.get(name).baseSpecies === pokemon.baseSpecies.baseSpecies
				)) {
					pokemon.canTerastallize = null;
				}
				if (item.id === 'ultranecroziumz' && pokemon.baseSpecies.baseSpecies === 'Necrozma') {
					pokemon.canTerastallize = null;
				}

				pokemon.m.passiveOn = pokemon.set.passive !== false;
				pokemon.m.innates = [];
				if (!pokemon.m.passiveOn) continue;
				const passive = passiveOf(pokemon.species);
				if (!passive) continue;
				pokemon.m.passive = this.toID(passive);
				if (pokemon.m.passive !== pokemon.ability) pokemon.m.innates = [pokemon.m.passive];
			}
		},
		onBeforeSwitchIn(pokemon) {
			// (clears a passive copied by Transform last time it was in)
			if (!pokemon.m.passiveOn) {
				pokemon.m.innates = [];
				return;
			}
			// The passive follows the current form (it may have changed while
			// switched out, e.g. Mega Evolution is permanent).
			const passive = passiveOf(pokemon.species);
			if (passive) pokemon.m.passive = this.toID(passive);
			pokemon.m.innates = pokemon.m.passive && pokemon.m.passive !== pokemon.ability ? [pokemon.m.passive] : [];
			for (const innate of pokemon.m.innates) {
				if (pokemon.hasAbility(innate)) continue;
				const effect = 'ability:' + innate;
				pokemon.volatiles[effect] = this.initEffectState({id: effect, target: pokemon});
			}
		},
		onSwitchInPriority: 101,
		onSwitchIn(pokemon) {
			// Behind an Illusion, show the passive of the Pokémon it looks like
			// (the real one is shown when the Illusion breaks).
			const shown = pokemon.illusion || pokemon;
			const innates: ID[] = pokemon.illusion ?
				(shown.m.passiveOn && shown.m.passive ? [shown.m.passive] : []) : (pokemon.m.innates || []);
			for (const innate of innates) {
				// (named after the ability, so every client shows it as that ability's name)
				this.add('-start', pokemon, this.dex.abilities.get(innate).name, '[silent]');
			}
		},
		onSwitchOut(pokemon) {
			delete pokemon.m.teraShellResisted;
			for (const innate of Object.keys(pokemon.volatiles).filter(i => i.startsWith('ability:'))) {
				pokemon.removeVolatile(innate);
			}
		},
		onFaint(pokemon) {
			for (const innate of Object.keys(pokemon.volatiles).filter(i => i.startsWith('ability:'))) {
				const innateEffect = this.dex.conditions.get(innate) as Effect;
				this.singleEvent('End', innateEffect, null, pokemon);
			}
		},
	},
};
