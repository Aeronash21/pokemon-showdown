/*
 * Shared Power fixes (as in ND Shared Power), on top of the PokéRogue
 * abilities.
 */
export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	hugepower: {
		inherit: true,
		onModifyAtkPriority: 5,
		onModifyAtk() {
			return this.chainModify(2);
		},
	},
	// Huge Power and Pure Power never stack (both can be shared to a Pokémon).
	purepower: {
		inherit: true,
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (pokemon.hasAbility('hugepower')) return;
			return this.chainModify(2);
		},
	},
	// A shared Tera Shift must never change a Terastallized Terapagos back.
	terashift: {
		inherit: true,
		onSwitchInPriority: 2,
		onSwitchIn(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Terapagos') return;
			if (pokemon.terastallized || pokemon.species.name === 'Terapagos-Stellar') return;
			if (pokemon.species.forme !== 'Terastal') {
				this.add('-activate', pokemon, 'ability: Tera Shift');
				pokemon.formeChange('Terapagos-Terastal', this.effect, true);
			}
		},
	},
};
