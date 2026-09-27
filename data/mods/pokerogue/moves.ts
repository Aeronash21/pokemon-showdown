export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	gastroacid: {
		inherit: true,
		condition: {
			// Ability suppression implemented in Pokemon.ignoringAbility() within sim/pokemon.js
			onStart(pokemon) {
				if (pokemon.hasItem('Ability Shield')) return false;
				this.add('-endability', pokemon);
				this.singleEvent('End', pokemon.getAbility(), pokemon.abilityState, pokemon, pokemon, 'gastroacid');
				// Gastro Acid suppresses the passive too.
				for (const innate of pokemon.m.innates || []) {
					pokemon.removeVolatile('ability:' + innate);
				}
			},
			onCopy(pokemon) {
				if (pokemon.getAbility().flags['cantsuppress']) pokemon.removeVolatile('gastroacid');
			},
		},
	},
};
