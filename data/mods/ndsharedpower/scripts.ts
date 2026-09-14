import {Scripts as SharedPowerScripts} from '../sharedpower/scripts';

export const Scripts: ModdedBattleScriptsData = {
	...SharedPowerScripts,
	gen: 9,

	field: {
		inherit: true,
		...(SharedPowerScripts.field || {}),
	},

	pokemon: {
		inherit: true,
		...(SharedPowerScripts.pokemon || {}),
	},
};
