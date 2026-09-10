import RandomTeams, { MoveCounter } from '../gen9/teams';

const Z_CRYSTALS: { [type: string]: string } = {
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
	/*
	 * STATUS ORB SAFETY OVERRIDE
	 *
	 * Upstream RandBats can hand out Flame/Toxic Orb simply
	 * because the moveset contains Facade.
	 *
	 * For ND Shared Power, only abilities which directly
	 * benefit from self-status are allowed to keep a status Orb.
	 */
	override getPriorityItem(
		...args: Parameters<RandomTeams['getPriorityItem']>
	) {
		const ability = args[0];

		const statusOrbAbilities = new Set([
			'Guts',
			'Poison Heal',
			'Quick Feet',
			'Toxic Boost',
			'Flare Boost',
		]);

		/*
		 * Explicit support for abilities which upstream does not
		 * always directly assign an Orb to.
		 */
		if (ability === 'Toxic Boost') {
			return 'Toxic Orb';
		}

		if (ability === 'Flare Boost') {
			return 'Flame Orb';
		}

		const item = super.getPriorityItem(...args);

		/*
		 * Any non-status item is untouched.
		 */
		if (item !== 'Flame Orb' && item !== 'Toxic Orb') {
			return item;
		}

		/*
		 * Guts / Poison Heal / Quick Feet / Toxic Boost /
		 * Flare Boost may use their status Orb.
		 */
		if (statusOrbAbilities.has(ability)) {
			return item;
		}

		/*
		 * IMPORTANT:
		 * Returning undefined tells RandBats to continue into
		 * getItem() / getDoublesItem() and choose a normal item.
		 *
		 * Therefore Scrappy Stoutland + Facade can NEVER get
		 * Flame Orb merely because it has Facade.
		 */
		return undefined;
	}

	override getForme(species: Species): string {
		/*
		 * Mega Zygarde can originate from multiple base formes.
		 * Normal Gen 9 RandBats only automatically handles a
		 * single battleOnly string.
		 */
		if (Array.isArray(species.battleOnly)) {
			return this.sample(species.battleOnly);
		}
		return super.getForme(species);
	}

	override randomSets: AnyObject = require('./sets.json');
	override randomDoublesSets: AnyObject = require('./doubles-sets.json');

	override getPriorityItem(
		ability: string,
		types: Set<string>,
		moves: Set<string>,
		counter: MoveCounter,
		teamDetails: RandomTeamsTypes.TeamDetails,
		species: Species,
		isLead: boolean,
		teraType: string,
		role: RandomTeamsTypes.Role,
		isDoubles: boolean,
	): string | undefined {
		/*
		 * Mega / Primal / Ultra formes are represented in the random
		 * dataset so their own stats and curated movepools drive set
		 * construction, but they enter battle in their base forme.
		 */
		if (
			species.isMega ||
			species.isPrimal ||
			species.forme === 'Ultra'
		) {
			if (species.requiredItem) return species.requiredItem;
			if (species.requiredItems?.length) {
				return this.sample(species.requiredItems);
			}
		}

		/*
		 * Restore Gen 7 Z-Move item selection.
		 */
		if (String(role).toLowerCase() === 'z-move user') {
			if (
				species.baseSpecies === 'Arceus' &&
				species.requiredItems?.[1]
			) {
				return species.requiredItems[1];
			}

			if (species.name === 'Raichu-Alola') return 'Aloraichium Z';
			if (species.name === 'Decidueye') return 'Decidium Z';
			if (species.name === 'Incineroar') return 'Incinium Z';
			if (species.name === 'Kommo-o') return 'Kommonium Z';
			if (species.name === 'Lunala') return 'Lunalium Z';
			if (species.baseSpecies === 'Lycanroc') return 'Lycanium Z';
			if (species.name === 'Marshadow') return 'Marshadium Z';
			if (species.name === 'Mew') return 'Mewnium Z';
			if (species.name === 'Mimikyu') return 'Mimikium Z';

			if (
				species.name === 'Necrozma-Dusk-Mane' ||
				species.name === 'Necrozma-Dawn-Wings'
			) {
				if (
					moves.has('autotomize') &&
					moves.has('sunsteelstrike')
				) return 'Solganium Z';

				if (
					moves.has('autotomize') &&
					moves.has('moongeistbeam')
				) return 'Lunalium Z';

				return 'Ultranecrozium Z';
			}

			if (Z_CRYSTALS[teraType]) {
				return Z_CRYSTALS[teraType];
			}

			for (const type of types) {
				if (Z_CRYSTALS[type]) return Z_CRYSTALS[type];
			}
		}

		return super.getPriorityItem(
			ability,
			types,
			moves,
			counter,
			teamDetails,
			species,
			isLead,
			teraType,
			role,
			isDoubles
		);
	}

	override randomSet(
		species: string | Species,
		teamDetails: RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const set = super.randomSet(
			species,
			teamDetails,
			isLead,
			isDoubles
		);

		/*
		 * Full Dynamax level for every generated Pokémon.
		 */
		set.dynamaxLevel = 10;

		/*
		 * If the ordinary species has an official Gmax forme,
		 * generate it as Gmax-capable unless its held item is being
		 * used for a Mega Evolution or Z-Move.
		 */
		const generatedSpecies = this.dex.species.get(set.species);
		const item = this.dex.items.get(set.item);

		if (
			generatedSpecies.canGigantamax &&
			!item.zMove &&
			!item.megaStone
		) {
			set.gigantamax = true;
		}

		return set;
	}
}

export default NDSharedPowerTeams;
