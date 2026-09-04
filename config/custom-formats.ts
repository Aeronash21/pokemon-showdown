export const Formats: import('../sim/dex-formats').FormatList = [
	{
		section: "Friends",
		column: 3,
	},
	{
		name: "[Gen 9] Free-For-All Random Battle (SP B12P6)",
		desc: `Four-player Free-For-All Random Battle with Shared Power, Team Preview, Bring 12 Pick 6.`,

		mod: 'sharedpower',
		team: 'randomFFA',
		gameType: 'freeforall',

		searchShow: false,
		tournamentShow: false,
		rated: false,

		ruleset: [
			'Obtainable',
			'Species Clause',
			'HP Percentage Mod',
			'Cancel Mod',
			'Sleep Clause Mod',
			'Illusion Level Mod',
			'Team Preview',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		getSharedPower(pokemon) {
			const sharedPower = new Set<string>();

			for (const ally of pokemon.side.pokemon) {
				if (
					pokemon.battle.ruleTable.isRestricted(
						`ability:${ally.baseAbility}`
					)
				) continue;

				if (ally.previouslySwitchedIn > 0) {
					if (
						pokemon.battle.dex.currentMod !== 'sharedpower' &&
						['trace', 'mirrorarmor'].includes(ally.baseAbility)
					) {
						sharedPower.add('noability');
						continue;
					}

					sharedPower.add(ally.baseAbility);
				}
			}

			sharedPower.delete(pokemon.baseAbility);
			return sharedPower;
		},

		onBeforeSwitchIn(pokemon) {
			for (const ability of this.format.getSharedPower!(pokemon)) {
				const effect = 'ability:' + this.toID(ability);

				pokemon.volatiles[effect] =
					this.initEffectState({id: effect, target: pokemon});

				if (!pokemon.m.abils) pokemon.m.abils = [];

				if (!pokemon.m.abils.includes(effect)) {
					pokemon.m.abils.push(effect);
				}
			}
		},
	},
];
