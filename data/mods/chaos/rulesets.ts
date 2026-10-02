export const Rulesets: import('../../../sim/dex-formats').ModdedFormatDataTable = {
	chaosmod: {
		effectType: 'ValidatorRule',
		name: 'Chaos Mod',
		desc: "Chaos: Pok&eacute;Rogue Pok&eacute;mon and passives, Mix and Mega and persistent Shared Power (passives " +
			"included), with Terastallization, Dynamax / Gigantamax, Z-Moves and Galarica Wreath Gigantamax.",
		ruleset: ['PokeRogue Mod'],
		// Mechanics: data/mods/chaos/scripts.ts and the Chaos format hooks in
		// config/custom-formats.ts. The PokeRogue Mod rule checks for this rule
		// to allow every Z-Crystal and the Gigantamax factor.
	},
};
