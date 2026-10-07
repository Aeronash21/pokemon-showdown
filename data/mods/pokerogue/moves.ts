export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	// Dark Void works for any Pokémon that has it (Gengar, Hypno, Meowstic...), not just Darkrai.
	darkvoid: {
		inherit: true,
		onTry: undefined,
		desc: "Causes the target to fall asleep.",
		shortDesc: "Causes the foe(s) to fall asleep.",
	},
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
				// Gastro Acid suppresses the passive too (unless it can't be
				// suppressed, like Battle Bond; same as Neutralizing Gas).
				for (const innate of pokemon.m.innates || []) {
					if (this.dex.abilities.get(innate).flags['cantsuppress']) continue;
					pokemon.removeVolatile('ability:' + innate);
				}
			},
			onCopy(pokemon) {
				if (pokemon.getAbility().flags['cantsuppress']) pokemon.removeVolatile('gastroacid');
			},
		},
	},
};
