export const Formats: import('../sim/dex-formats').FormatList = [
	{
		section: "Friends",
		column: 3,
	},
	{
		name: "[Gen 9] Free-For-All Random Battle (SP B12P6)",
		desc: `Four-player Free-For-All Random Battle with Shared Power,
			Bring 12 Pick 6, and official Mega Evolutions.`,

		mod: 'sharedpower',
		team: 'randomFFA',
		gameType: 'freeforall',

		searchShow: false,
		tournamentShow: false,
		rated: false,

		ruleset: [
			'Obtainable',
			'NatDex Mod',
			'Species Clause',
			'HP Percentage Mod',
			'Cancel Mod',
			'Sleep Clause Mod',
			'Illusion Level Mod',
			'Team Preview',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		/*
		 * Shared Power:
		 * an Ability joins your shared pool once its owner has switched in.
		 */
		getSharedPower(pokemon) {
			const sharedPower = new Set<string>();

			for (const ally of pokemon.side.pokemon) {
				/*
				 * Once a Pokemon has switched in, remember the ability
				 * it permanently contributed to Shared Power.
				 *
				 * m.sharedPowerAbility survives switching and fainting.
				 */
				if (
					ally.previouslySwitchedIn <= 0 &&
					!ally.m.sharedPowerAbility
				) {
					continue;
				}

				const ability = (
					ally.m.sharedPowerAbility ||
					ally.baseAbility
				) as string;

				if (!ability) continue;

				if (
					pokemon.battle.ruleTable.isRestricted(
						`ability:${ability}`
					)
				) {
					continue;
				}

				if (
					pokemon.battle.dex.currentMod !== 'sharedpower' &&
					['trace', 'mirrorarmor'].includes(ability)
				) {
					sharedPower.add('noability');
					continue;
				}

				sharedPower.add(ability);
			}

			/*
			 * A Pokemon doesn't receive a second copy of its own
			 * permanent ability.
			 */
			const ownAbility = (
				pokemon.m.sharedPowerAbility ||
				pokemon.baseAbility
			) as string;

			sharedPower.delete(ownAbility);

			return sharedPower;
		},

		onBeforeSwitchIn(pokemon) {
			/*
			 * The first time a Pokemon reaches the field, permanently
			 * record the ability it contributes to Shared Power.
			 */
			if (!pokemon.m.sharedPowerAbility) {
				pokemon.m.sharedPowerAbility = pokemon.baseAbility;
			}

			for (const ability of this.format.getSharedPower!(pokemon)) {
				const effect = 'ability:' + this.toID(ability);

				pokemon.volatiles[effect] =
					this.initEffectState({
						id: effect,
						target: pokemon,
					});

				if (!pokemon.m.abils) {
					pokemon.m.abils = [];
				}

				if (!pokemon.m.abils.includes(effect)) {
					pokemon.m.abils.push(effect);
				}
			}
		},

		/*
		 * Mega Rayquaza is special: it uses Dragon Ascent instead of a stone.
		 * Current FFA Rayquaza sets already contain Dragon Ascent.
		 */
		onBegin() {
			for (const pokemon of this.getAllPokemon()) {
				if (
					pokemon.baseSpecies.id === 'rayquaza' &&
					pokemon.baseMoves.includes(this.toID('Dragon Ascent'))
				) {
					pokemon.canMegaEvo = 'Rayquaza-Mega';
				}
			}
		},

		/*
		 * Rebuild the Mega Pokemon's Shared Power volatiles after Mega
		 * Evolution. Its own Ability has just changed, so this prevents a
		 * duplicate if a teammate happens to share the same Ability.
		 */
		onAfterMega(pokemon) {
			/*
			 * Get the official ability of the Mega form.
			 */
			const megaAbility = pokemon.species.abilities['0'];

			if (megaAbility) {
				const megaAbilityID = this.toID(megaAbility);

				/*
				 * Make the Mega ability the Pokemon's permanent
				 * in-battle ability.
				 */
				if (pokemon.ability !== megaAbilityID) {
					pokemon.setAbility(
						megaAbility,
						null,
						null,
						true
					);
				}

				pokemon.baseAbility = megaAbilityID;

				/*
				 * CRITICAL:
				 *
				 * Save the Mega ability separately from the Pokemon's
				 * forme/volatile state. This value remains even after
				 * the Mega faints.
				 */
				pokemon.m.sharedPowerAbility = megaAbilityID;
			}

			/*
			 * Tell the client which Mega ability is active.
			 */
			this.add(
				'-ability',
				pokemon,
				pokemon.getAbility().name,
				'[from] Mega Evolution'
			);

			/*
			 * Rebuild this Pokemon's currently inherited Shared Power
			 * abilities after Mega Evolution.
			 */
			if (pokemon.m.abils) {
				for (const effect of pokemon.m.abils) {
					if (pokemon.volatiles[effect]) {
						pokemon.removeVolatile(effect);
					}
				}
			}

			pokemon.m.abils = [];

			for (const ability of this.format.getSharedPower!(pokemon)) {
				const effect =
					'ability:' + this.toID(ability);

				pokemon.volatiles[effect] =
					this.initEffectState({
						id: effect,
						target: pokemon,
					});

				pokemon.m.abils.push(effect);
			}
		},
	},

	{
		name: "[Gen 9] Random Battle (SP B12P6 Singles)",
		desc: `Two-player Singles Random Battle with Shared Power,
			Bring 12 Pick 6, National Dex Pokemon, and Mega Evolution.`,

		mod: 'sharedpower',
		team: 'random',
		gameType: 'singles',

		searchShow: false,
		tournamentShow: false,
		rated: false,

		ruleset: [
			'Obtainable',
			'NatDex Mod',
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
				/*
				 * Once a Pokemon has switched in, remember the ability
				 * it permanently contributed to Shared Power.
				 *
				 * m.sharedPowerAbility survives switching and fainting.
				 */
				if (
					ally.previouslySwitchedIn <= 0 &&
					!ally.m.sharedPowerAbility
				) {
					continue;
				}

				const ability = (
					ally.m.sharedPowerAbility ||
					ally.baseAbility
				) as string;

				if (!ability) continue;

				if (
					pokemon.battle.ruleTable.isRestricted(
						`ability:${ability}`
					)
				) {
					continue;
				}

				if (
					pokemon.battle.dex.currentMod !== 'sharedpower' &&
					['trace', 'mirrorarmor'].includes(ability)
				) {
					sharedPower.add('noability');
					continue;
				}

				sharedPower.add(ability);
			}

			/*
			 * A Pokemon doesn't receive a second copy of its own
			 * permanent ability.
			 */
			const ownAbility = (
				pokemon.m.sharedPowerAbility ||
				pokemon.baseAbility
			) as string;

			sharedPower.delete(ownAbility);

			return sharedPower;
		},

		onBeforeSwitchIn(pokemon) {
			/*
			 * The first time a Pokemon reaches the field, permanently
			 * record the ability it contributes to Shared Power.
			 */
			if (!pokemon.m.sharedPowerAbility) {
				pokemon.m.sharedPowerAbility = pokemon.baseAbility;
			}

			for (const ability of this.format.getSharedPower!(pokemon)) {
				const effect = 'ability:' + this.toID(ability);

				pokemon.volatiles[effect] =
					this.initEffectState({
						id: effect,
						target: pokemon,
					});

				if (!pokemon.m.abils) {
					pokemon.m.abils = [];
				}

				if (!pokemon.m.abils.includes(effect)) {
					pokemon.m.abils.push(effect);
				}
			}
		},

		// Mega Rayquaza doesn't use a Mega Stone.
		onBegin() {
			for (const pokemon of this.getAllPokemon()) {
				if (
					pokemon.baseSpecies.id === 'rayquaza' &&
					pokemon.baseMoves.includes(this.toID('Dragon Ascent'))
				) {
					pokemon.canMegaEvo = 'Rayquaza-Mega';
				}
			}
		},

		onAfterMega(pokemon) {
			/*
			 * Get the official ability of the Mega form.
			 */
			const megaAbility = pokemon.species.abilities['0'];

			if (megaAbility) {
				const megaAbilityID = this.toID(megaAbility);

				/*
				 * Make the Mega ability the Pokemon's permanent
				 * in-battle ability.
				 */
				if (pokemon.ability !== megaAbilityID) {
					pokemon.setAbility(
						megaAbility,
						null,
						null,
						true
					);
				}

				pokemon.baseAbility = megaAbilityID;

				/*
				 * CRITICAL:
				 *
				 * Save the Mega ability separately from the Pokemon's
				 * forme/volatile state. This value remains even after
				 * the Mega faints.
				 */
				pokemon.m.sharedPowerAbility = megaAbilityID;
			}

			/*
			 * Tell the client which Mega ability is active.
			 */
			this.add(
				'-ability',
				pokemon,
				pokemon.getAbility().name,
				'[from] Mega Evolution'
			);

			/*
			 * Rebuild this Pokemon's currently inherited Shared Power
			 * abilities after Mega Evolution.
			 */
			if (pokemon.m.abils) {
				for (const effect of pokemon.m.abils) {
					if (pokemon.volatiles[effect]) {
						pokemon.removeVolatile(effect);
					}
				}
			}

			pokemon.m.abils = [];

			for (const ability of this.format.getSharedPower!(pokemon)) {
				const effect =
					'ability:' + this.toID(ability);

				pokemon.volatiles[effect] =
					this.initEffectState({
						id: effect,
						target: pokemon,
					});

				pokemon.m.abils.push(effect);
			}
		},
	},

];
