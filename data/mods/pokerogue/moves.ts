export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	// The original (Let's Go) Zippy Zap, as in PokéRogue: 50 BP, always a
	// critical hit, no Evasion boost (instead of 80 BP with +1 Evasion).
	zippyzap: {
		inherit: true,
		basePower: 50,
		pp: 15,
		willCrit: true,
		secondary: undefined, // no Evasion boost
		desc: "Nearly always goes first. This move is always a critical hit unless the target is under the effect of " +
			"Lucky Chant or has the Battle Armor or Shell Armor Abilities.",
		shortDesc: "Nearly always goes first. Always results in a critical hit.",
	},
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
