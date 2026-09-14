export const Rulesets: import('../../../sim/dex-formats').ModdedFormatDataTable = {
	ndspstandardbans: {
		effectType: 'ValidatorRule',
		name: 'NDSP Standard Bans',

		banlist: [
			'Shadow Tag',
			'Arena Trap',
			'Simple',
			'Moody',

			'Shedinja',
			'Eternatus-Eternamax',

			'Groudon-Primal',
			'Kyogre-Primal',

			// Prevent the banned Primals from being produced
			// through their transformation items.
			'Red Orb',
			'Blue Orb',
		],
	},
};
