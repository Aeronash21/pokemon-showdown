// Pokébilities' versions of Mummy, Neutralizing Gas, Trace... (which also
// have to handle passives) are merged in by scripts.ts init().

export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	// Signature abilities that PokéRogue hands out as passives work for
	// any Pokémon there.

	// Greninja: turns into Ash-Greninja the first time it KOs a foe (as in
	// Gen 7), for the rest of the battle.
	// Charizard, Infernape (passive): +1 Atk / Sp. Atk / Spe the first time
	// it KOs a foe.
	battlebond: {
		inherit: true,
		onSourceAfterFaint(length, target, source, effect) {
			if (effect?.effectType !== 'Move') return;
			if (!source.hp || source.transformed || !source.side.foePokemonLeft()) return;
			if (['Greninja', 'Greninja-Bond'].includes(source.species.name)) {
				this.add('-activate', source, 'ability: Battle Bond');
				source.formeChange('Greninja-Ash', this.effect, true);
				return;
			}
			if (source.bondTriggered || source.species.name === 'Greninja-Ash') return;
			this.boost({atk: 1, spa: 1, spe: 1}, source, source, this.effect);
			this.add('-activate', source, 'ability: Battle Bond');
			source.bondTriggered = true;
		},
	},
	// Neutralizing Gas, as the ability or the passive: switches off the
	// abilities AND passives of the holder's foes. The holder keeps its own
	// ability / passive, and its allies keep theirs. Pokémon with Neutralizing
	// Gas themselves aren't affected. (The suppression check is
	// Pokemon#ignoringAbility in scripts.ts; passives are also removed here, so
	// that ones on unsuppressable abilities' holders, like Aegislash, go too.)
	neutralizinggas: {
		inherit: true,
		onSwitchInPriority: 2,
		onSwitchIn(pokemon) {
			this.add('-ability', pokemon, 'Neutralizing Gas');
			this.effectState.ending = false;
			const strongWeathers = ['desolateland', 'primordialsea', 'deltastream'];
			for (const target of pokemon.foes()) {
				if (target.hasItem('Ability Shield')) {
					this.add('-block', target, 'item: Ability Shield');
					continue;
				}
				// Can't suppress a Tatsugiri inside of Dondozo already
				if (target.volatiles['commanding']) continue;
				if (target.ability === 'neutralizinggas' || target.m.innates?.includes('neutralizinggas')) continue;
				if (target.illusion && target.ability === 'illusion') {
					this.singleEvent('End', this.dex.abilities.get('Illusion'), target.abilityState, target, pokemon, 'neutralizinggas');
				}
				if (target.volatiles['slowstart']) {
					delete target.volatiles['slowstart'];
					this.add('-end', target, 'Slow Start', '[silent]');
				}
				if (strongWeathers.includes(target.getAbility().id)) {
					this.singleEvent('End', target.getAbility(), target.abilityState, target, pokemon, 'neutralizinggas');
				}
				// The passive goes away until the gas does.
				for (const innate of target.m.innates || []) {
					if (!target.volatiles['ability:' + innate]) continue;
					const ability = this.dex.abilities.get(innate);
					if (ability.flags['cantsuppress']) continue;
					target.removeVolatile('ability:' + innate);
					this.add('-end', target, ability.name, '[silent]');
				}
			}
		},
		onEnd(source) {
			if (source.transformed) return;
			const state = source.ability === 'neutralizinggas' ? source.abilityState : source.volatiles['ability:neutralizinggas'];
			if (!state || state.ending) return;
			// Mark it as ending so Pokemon#ignoringAbility skips it
			state.ending = true;
			// Another Neutralizing Gas on the holder's side keeps the foes suppressed.
			for (const ally of source.alliesAndSelf()) {
				if (ally === source || ally.volatiles['gastroacid'] || ally.transformed) continue;
				const gas = ally.ability === 'neutralizinggas' ? ally.abilityState : ally.volatiles['ability:neutralizinggas'];
				if (gas && !gas.ending) return;
			}
			this.add('-end', source, 'ability: Neutralizing Gas');

			const foes = source.foes();
			this.speedSort(foes);
			for (const pokemon of foes) {
				if (pokemon.hasItem('abilityshield')) continue; // weren't suppressed
				if (pokemon.ability === 'neutralizinggas' || pokemon.m.innates?.includes('neutralizinggas')) continue;
				// (Start / the passives' handlers are skipped by Pokemon#ignoringAbility if
				// something else still suppresses them)
				if (!pokemon.getAbility().flags['cantsuppress']) {
					this.singleEvent('Start', pokemon.getAbility(), pokemon.abilityState, pokemon);
					if (pokemon.ability === 'gluttony') pokemon.abilityState.gluttony = false;
				}
				for (const innate of pokemon.m.innates || []) {
					if (pokemon.volatiles['ability:' + innate]) continue;
					this.add('-start', pokemon, this.dex.abilities.get(innate).name, '[silent]');
					pokemon.addVolatile('ability:' + innate, pokemon);
				}
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
