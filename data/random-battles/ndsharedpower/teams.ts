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

export class NDSharedPowerTeams extends RandomTeams {
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
