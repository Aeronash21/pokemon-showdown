// Pokébilities' versions of Mummy, Neutralizing Gas, Trace... (which also
// have to handle passives) are merged in by scripts.ts init().

export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	// Signature abilities that PokéRogue hands out as passives work for
	// any Pokémon there.

	// Charizard, Infernape: +1 Atk / Sp. Atk / Spe the first time it KOs a foe.
	battlebond: {
		inherit: true,
		onSourceAfterFaint(length, target, source, effect) {
			if (source.bondTriggered) return;
			if (effect?.effectType !== 'Move') return;
			if (source.hp && !source.transformed && source.side.foePokemonLeft()) {
				this.boost({atk: 1, spa: 1, spe: 1}, source, source, this.effect);
				this.add('-activate', source, 'ability: Battle Bond');
				source.bondTriggered = true;
			}
		},
	},
	// Victreebel line: 1.5x Atk and Sp. Def for itself and allies in sun.
	flowergift: {
		inherit: true,
		onAllyModifyAtk(atk, pokemon) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) {
				return this.chainModify(1.5);
			}
		},
		onAllyModifySpD(spd, pokemon) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) {
				return this.chainModify(1.5);
			}
		},
	},
	// Zygarde: clears weather and terrain when it Terastallizes.
	teraformzero: {
		inherit: true,
		onAfterTerastallization(pokemon) {
			if (this.field.weather || this.field.terrain) {
				this.add('-ability', pokemon, 'Teraform Zero');
				this.field.clearWeather();
				this.field.clearTerrain();
			}
		},
	},
	// When an Illusion breaks, show the Pokémon's real passive.
	illusion: {
		inherit: true,
		onEnd(pokemon) {
			if (pokemon.illusion && !pokemon.beingCalledBack) {
				this.debug('illusion cleared');
				const shown = pokemon.illusion;
				pokemon.illusion = null;
				const details = pokemon.getUpdatedDetails();
				this.add('replace', pokemon, details);
				this.add('-end', pokemon, 'Illusion');
				if (this.ruleTable.has('illusionlevelmod')) {
					this.hint("Illusion Level Mod is active, so this Pok\u00e9mon's true level was hidden.", true);
				}
				if (shown.m.passiveOn && shown.m.passive) {
					this.add('-end', pokemon, this.dex.abilities.get(shown.m.passive).name, '[silent]');
				}
				for (const innate of pokemon.m.innates || []) {
					this.add('-start', pokemon, this.dex.abilities.get(innate).name, '[silent]');
				}
			}
		},
	},
	// Tera Shell for Pokémon other than Terapagos is in scripts.ts (runEffectiveness).
};
