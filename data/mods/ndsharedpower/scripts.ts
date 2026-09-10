export const Scripts: ModdedBattleScriptsData = {
	gen: 9,

	/*
	 * Inherit Pokémon Legends: Z-A's current Gen 9 battle data,
	 * including the updated Mega stats used by Showdown.
	 */
	inherit: 'gen9legends',

	init() {
		/*
		 * All Mega Stones introduced in Gen 9 are the new
		 * Legends: Z-A Mega Stones.
		 *
		 * They are normally marked Future, so make the stone,
		 * target forme and its ability legal in this mod.
		 */
		for (const i in this.data.Items) {
			const item = this.data.Items[i];

			if (!item.megaStone || item.gen !== 9) continue;

			const modItem = this.modData('Items', i);
			modItem.isNonstandard = null;

			for (const megaName of Object.values(item.megaStone)) {
				const megaID = this.toID(megaName);

				this.modData('FormatsData', megaID).isNonstandard = null;

				const megaData = this.data.Pokedex[megaID];

				if (!megaData?.abilities) continue;

				for (const abilityName of Object.values(megaData.abilities)) {
					if (!abilityName) continue;

					const abilityID = this.toID(abilityName);
					const ability = this.data.Abilities[abilityID];

					if (
						ability &&
						(
							ability.isNonstandard === 'Future' ||
							ability.isNonstandard === 'Past'
						)
					) {
						this.modData('Abilities', abilityID).isNonstandard = null;
					}
				}
			}
		}
	},

	/*
	 * Shared Power engine.
	 */
	field: {
		suppressingWeather() {
			for (const pokemon of this.battle.getAllActive()) {
				const innates = Object.keys(pokemon.volatiles)
					.filter(x => x.startsWith('ability:'));

				if (
					pokemon &&
					!pokemon.ignoringAbility() &&
					(
						pokemon.getAbility().suppressWeather ||
						innates.some(x =>
							this.battle.dex.abilities
								.get(x.replace('ability:', ''))
								.suppressWeather
						)
					)
				) {
					return true;
				}
			}
			return false;
		},
	},

	pokemon: {
		hasAbility(ability) {
			if (this.ignoringAbility()) return false;

			if (Array.isArray(ability)) {
				return ability.some(abil => this.hasAbility(abil));
			}

			const abilityid = this.battle.toID(ability);

			return (
				this.ability === abilityid ||
				!!this.volatiles['ability:' + abilityid]
			);
		},

		ignoringAbility() {
			let neutralizinggas = false;

			for (const pokemon of this.battle.getAllActive()) {
				if (
					(
						pokemon.ability === ('neutralizinggas' as ID) ||
						pokemon.m.abils?.includes('ability:neutralizinggas')
					) &&
					!pokemon.volatiles['gastroacid'] &&
					!pokemon.abilityState.ending
				) {
					neutralizinggas = true;
					break;
				}
			}

			return !!(
				(this.battle.gen >= 5 && !this.isActive) ||
				(
					(
						this.volatiles['gastroacid'] ||
						(
							neutralizinggas &&
							(
								this.ability !== ('neutralizinggas' as ID) ||
								this.m.abils?.includes('ability:neutralizinggas')
							)
						)
					) &&
					!this.getAbility().flags['cantsuppress']
				)
			);
		},
	},
};
