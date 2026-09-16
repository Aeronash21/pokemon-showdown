import RandomTeams from '../gen9/teams';

const Z_CRYSTALS: {[type: string]: string} = {
	Normal: 'Normalium Z',
	Fire: 'Firium Z',
	Water: 'Waterium Z',
	Electric: 'Electrium Z',
	Grass: 'Grassium Z',
	Ice: 'Icium Z',
	Fighting: 'Fightinium Z',
	Poison: 'Poisonium Z',
	Ground: 'Groundium Z',
	Flying: 'Flyinium Z',
	Psychic: 'Psychium Z',
	Bug: 'Buginium Z',
	Rock: 'Rockium Z',
	Ghost: 'Ghostium Z',
	Dragon: 'Dragonium Z',
	Dark: 'Darkinium Z',
	Steel: 'Steelium Z',
	Fairy: 'Fairium Z',
};

const NDSP_FFA_REMOVED_MOVES = new Set([
	'wideguard',
	'ragepowder',
	'followme',
]);

export class NDSharedPowerTeams extends RandomTeams {

	/*
	 * =========================================================
	 * NDSP FFA MOVE FILTER AND MOVE COUNT SAFETY
	 * =========================================================
	 *
	 * - Free-For-All:
	 *     Wide Guard / Rage Powder / Follow Me are excluded.
	 *
	 * - Multi / 2v2:
	 *     These moves remain completely available.
	 *
	 * - Every generated set:
	 *     hard maximum of maxMoveCount moves (normally 4).
	 */
	override randomMoveset(
		types: Set<string>,
		abilities: string[],
		teamDetails: RandomTeamsTypes.TeamDetails,
		species: Species,
		isLead: boolean,
		movePool: string[],
		teraType: string,
		role: RandomTeamsTypes.Role,
		isDoubles: boolean,
	): Set<string> {
		let effectiveMovePool = [...movePool];

		if (this.format.gameType === 'freeforall') {
			effectiveMovePool =
				effectiveMovePool.filter(
					move =>
						!NDSP_FFA_REMOVED_MOVES.has(move)
				);

			/*
			 * If removing an FFA-only support move leaves this
			 * particular role with fewer than four options,
			 * supplement it using other curated NDSP movepools
			 * for the same species.
			 *
			 * This avoids creating accidental three-move sets
			 * while still ensuring the banned FFA support moves
			 * never return.
			 */
			if (
				effectiveMovePool.length <
					this.maxMoveCount
			) {
				const speciesIDs = new Set([
					species.id,
					this.dex.species.get(
						species.baseSpecies
					).id,
				]);

				const candidateMoves: string[] = [];

				for (const id of speciesIDs) {
					for (const table of [
						this.randomDoublesSets,
						this.randomSets,
					]) {
						const data = table[id];

						if (!data?.sets) continue;

						for (const template of data.sets) {
							for (
								const move of
								template.movepool || []
							) {
								if (
									NDSP_FFA_REMOVED_MOVES
										.has(move)
								) {
									continue;
								}

								if (
									effectiveMovePool
										.includes(move)
								) {
									continue;
								}

								if (
									candidateMoves
										.includes(move)
								) {
									continue;
								}

								candidateMoves.push(move);
							}
						}
					}
				}

				/*
				 * Give the normal RandBats selector enough
				 * alternatives to construct a proper set.
				 */
				effectiveMovePool.push(
					...candidateMoves
				);
			}
		}

		const moves = super.randomMoveset(
			types,
			abilities,
			teamDetails,
			species,
			isLead,
			effectiveMovePool,
			teraType,
			role,
			isDoubles,
		);

		/*
		 * Upstream has several separate enforced-move passes.
		 * In unusual imported / legacy movepools those passes
		 * can collectively push the Set beyond four.
		 *
		 * Keep insertion order so required / early-enforced
		 * moves take priority over later additions.
		 */
		while (moves.size > this.maxMoveCount) {
			const array = [...moves];

			moves.delete(
				array[array.length - 1]
			);
		}

		return moves;
	}


	/*
	 * =========================================================
	 * NDSP 2v2 MEGA GUARANTEE
	 * =========================================================
	 *
	 * A Multi battle has four independent players/sides.
	 * Each call to getTeam() builds one player's three-Pokemon
	 * team.
	 *
	 * For [Gen 9] ND Shared Power 2v2, regenerate that player's
	 * full team until at least one generated set is holding a
	 * genuine Mega Stone.
	 *
	 * This guarantees EACH player independently receives at
	 * least one Pokemon that can Mega Evolve.
	 *
	 * It does NOT force the Mega into the lead slot.
	 * It does NOT restrict the team to exactly one Mega-capable
	 * Pokemon; a player may randomly receive more than one.
	 */
	override getTeam(
		options: PlayerOptions | null = null
	): PokemonSet[] {
		const forbiddenFFAMoves = new Set([
			'wideguard',
			'ragepowder',
			'followme',
		]);

		/*
		 * FINAL NDSP SET SANITIZER
		 *
		 * This runs AFTER upstream Random Battle generation.
		 *
		 * That is important because Doubles Support generation
		 * can explicitly enforce redirect/support moves.
		 */
		const finalizeTeam = (
			team: PokemonSet[]
		): PokemonSet[] => {
			for (const set of team) {
				const species =
					this.dex.species.get(
						set.species
					);

				/*
				 * Normalize + deduplicate final moves.
				 */
				let moves = [
					...new Set(
						set.moves.map(
							move =>
								this.dex.moves.get(
									move
								).id
						)
					),
				];

				/*
				 * =================================================
				 * FFA ONLY
				 * =================================================
				 *
				 * Wide Guard / Rage Powder / Follow Me must
				 * disappear from FFA, but remain untouched in
				 * Multi/2v2.
				 */
				if (
					this.format.gameType ===
						'freeforall'
				) {
					moves = moves.filter(
						move =>
							!forbiddenFFAMoves
								.has(move)
					);

					/*
					 * Refill any removed slots using OTHER
					 * curated moves already present in this
					 * species' NDSP Singles/Doubles data.
					 *
					 * This prevents things like:
					 *
					 * Amoonguss:
					 *   4 moves -> remove Rage Powder -> 3 moves
					 *
					 * Instead it receives another curated move.
					 */
					if (
						moves.length <
							this.maxMoveCount
					) {
						const candidates:
							string[] = [];

						const speciesIDs =
							new Set<string>([
								species.id,
								this.dex.species.get(
									species.baseSpecies
								).id,
							]);

						for (const table of [
							this.randomDoublesSets,
							this.randomSets,
						]) {
							for (
								const speciesID
								of speciesIDs
							) {
								const data =
									table[
										speciesID
									];

								if (
									!data?.sets
								) {
									continue;
								}

								for (
									const template
									of data.sets
								) {
									for (
										const rawMove
										of
										template
											.movepool ||
										[]
									) {
										const move =
											this.dex.moves
												.get(
													rawMove
												).id;

										if (!move) {
											continue;
										}

										if (
											forbiddenFFAMoves
												.has(move)
										) {
											continue;
										}

										if (
											moves.includes(
												move
											)
										) {
											continue;
										}

										if (
											candidates
												.includes(
													move
												)
										) {
											continue;
										}

										candidates
											.push(move);
									}
								}
							}
						}

						while (
							moves.length <
								this.maxMoveCount &&
							candidates.length
						) {
							const index =
								this.random(
									candidates.length
								);

							const [move] =
								candidates.splice(
									index,
									1
								);

							moves.push(move);
						}
					}
				}

				/*
				 * =================================================
				 * HARD FOUR-MOVE LIMIT
				 * =================================================
				 *
				 * Final protection against imported/legacy set
				 * logic ever creating five moves.
				 */
				set.moves =
					moves.slice(
						0,
						this.maxMoveCount
					);

				/*
				 * =================================================
				 * MAROWAK
				 * =================================================
				 *
				 * All generated Marowak formes always use
				 * Thick Club.
				 */
				if (
					species.baseSpecies ===
						'Marowak'
				) {
					set.item = 'Thick Club';
				}
			}

			return team;
		};

		/*
		 * Every individual player in all NDSP 2v2 variants
		 * must receive at least one genuine Mega Stone option.
		 */
		const megaGuaranteed2v2Formats =
			new Set([
				'gen9ndsharedpower2v2',
				'gen9ndsharedpower2v2b6p3',
				'gen9ndsharedpower2v2b12p6',
			]);

		if (
			!megaGuaranteed2v2Formats.has(
				this.format.id
			)
		) {
			return finalizeTeam(
				super.getTeam(options)
			);
		}

		const MAX_ATTEMPTS = 1000;

		for (
			let attempt = 1;
			attempt <= MAX_ATTEMPTS;
			attempt++
		) {
			const team =
				finalizeTeam(
					super.getTeam(options)
				);

			const hasMega =
				team.some(set => {
					const item =
						this.dex.items.get(
							set.item
						);

					return !!item.megaStone;
				});

			if (hasMega) {
				return team;
			}
		}

		throw new Error(
			'ND Shared Power 2v2 could not generate ' +
			'a Mega-capable player team after ' +
			MAX_ATTEMPTS +
			' attempts.'
		);
	}

	randomSets:
		{[species: string]: RandomTeamsTypes.RandomSpeciesData} =
		require('./sets.json');

	randomDoublesSets:
		{[species: string]: RandomTeamsTypes.RandomSpeciesData} =
		require('./doubles-sets.json');

	override getForme(species: Species): string {
		if (Array.isArray(species.battleOnly)) {
			return this.sample(species.battleOnly);
		}

		return super.getForme(species);
	}

	getCustomZCrystal(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): string | undefined {
		const moves = set.moves.map(
			move => this.dex.moves.get(move)
		);

		const has = (move: string) =>
			moves.some(m => m.id === this.dex.toID(move));

		const id = species.id;

		const signature: {[id: string]: [string, string][]} = {
			raichualola: [
				['Thunderbolt', 'Aloraichium Z'],
			],
			decidueye: [
				['Spirit Shackle', 'Decidium Z'],
			],
			eevee: [
				['Last Resort', 'Eevium Z'],
			],
			incineroar: [
				['Darkest Lariat', 'Incinium Z'],
			],
			kommoo: [
				['Clanging Scales', 'Kommonium Z'],
			],
			lycanroc: [
				['Stone Edge', 'Lycanium Z'],
			],
			marshadow: [
				['Spectral Thief', 'Marshadium Z'],
			],
			mew: [
				['Psychic', 'Mewnium Z'],
			],
			mimikyu: [
				['Play Rough', 'Mimikium Z'],
			],
			pikachu: [
				['Volt Tackle', 'Pikanium Z'],
			],
			primarina: [
				['Sparkling Aria', 'Primarium Z'],
			],
			snorlax: [
				['Giga Impact', 'Snorlium Z'],
			],
			solgaleo: [
				['Sunsteel Strike', 'Solganium Z'],
			],
			lunala: [
				['Moongeist Beam', 'Lunalium Z'],
			],
			necrozmaduskmane: [
				['Sunsteel Strike', 'Solganium Z'],
			],
			necrozmadawnwings: [
				['Moongeist Beam', 'Lunalium Z'],
			],
		};

		for (const [move, item] of signature[id] || []) {
			if (
				has(move) &&
				this.dex.items.get(item).exists
			) {
				return item;
			}
		}

		if (
			id.startsWith('tapu') &&
			has("Nature's Madness") &&
			this.dex.items.get('Tapunium Z').exists
		) {
			return 'Tapunium Z';
		}

		const damaging = moves.filter(
			move =>
				move.exists &&
				move.category !== 'Status'
		);

		let selected =
			damaging.find(
				move => move.type === set.teraType
			);

		if (!selected) {
			selected =
				damaging.find(
					move =>
						species.types.includes(
							move.type
						)
				);
		}

		selected ||= damaging[0];

		if (!selected) return undefined;

		const crystal =
			Z_CRYSTALS[selected.type];

		if (
			crystal &&
			this.dex.items.get(crystal).exists
		) {
			return crystal;
		}

		return undefined;
	}

	override randomSet(
		s: string | Species,
		teamDetails:
			RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const targetSpecies =
			this.dex.species.get(s);

		const set = super.randomSet(
			s,
			teamDetails,
			isLead,
			isDoubles
		);

		const moveIDs =
			new Set(set.moves.map(m => this.dex.toID(m)));

		/*
		 * Restore a proper Z-Crystal to imported Gen 7
		 * Z-Move roles.
		 */
		if (
			/z[- ]?move/i.test(set.role || '') &&
			!targetSpecies.requiredItem
		) {
			const zItem =
				this.getCustomZCrystal(
					targetSpecies,
					set
				);

			if (zItem) set.item = zItem;
		}

		/*
		 * Choice Scarf Gallade.
		 */
		if (
			targetSpecies.id === 'gallade' &&
			moveIDs.has('trick') &&
			moveIDs.has('sacredsword') &&
			moveIDs.has('psychocut')
		) {
			set.item = 'Choice Scarf';
		}

		/*
		 * Strong Stoutland wallbreaker.
		 */
		if (
			targetSpecies.id === 'stoutland' &&
			moveIDs.has('return') &&
			moveIDs.has('superpower') &&
			moveIDs.has('switcheroo')
		) {
			set.item = 'Choice Band';
		}

		/*
		 * Mega Stones, Primal Orbs and
		 * Ultranecrozium Z take priority.
		 */
		if (targetSpecies.requiredItem) {
			set.item = targetSpecies.requiredItem;
		}

		/*
		 * Status Orb safety.
		 *
		 * Facade by itself is NOT enough.
		 */
		const statusOrbAbilities =
			new Set([
				'Guts',
				'Poison Heal',
				'Quick Feet',
				'Toxic Boost',
				'Flare Boost',
			]);

		if (
			(
				set.item === 'Flame Orb' ||
				set.item === 'Toxic Orb'
			) &&
			!statusOrbAbilities.has(set.ability)
		) {
			set.item = 'Leftovers';
		}

		/*
		 * Explicit status-benefiting abilities.
		 */
		if (
			set.ability === 'Toxic Boost'
		) {
			set.item = 'Toxic Orb';
		}

		if (
			set.ability === 'Flare Boost'
		) {
			set.item = 'Flame Orb';
		}

		/*
		 * Full Dynamax level.
		 */
		set.dynamaxLevel = 10;

		/*
		 * Give legal G-Max-capable base species
		 * Gigantamax unless their held item is being
		 * used for Mega Evolution / Z-Move.
		 */
		const actualSpecies =
			this.dex.species.get(set.species);

		const item =
			this.dex.items.get(set.item);

		if (
			actualSpecies.canGigantamax &&
			!item.zMove &&
			!item.megaStone &&
			!item.isPrimalOrb
		) {
			set.gigantamax = true;
		}

		return set;
	}
}

export default NDSharedPowerTeams;
