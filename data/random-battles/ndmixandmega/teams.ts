/*
 * ===========================================================
 * ND MIX AND MEGA RANDOM TEAMS
 * ===========================================================
 *
 * Random teams for the ND Mix and Mega formats. Every Pokémon
 * holds a transformation item from its curated template: usually
 * a Mega Stone, sometimes a Primal Orb, Rusted Sword / Shield,
 * Origin item, Ogerpon Mask, Arceus Plate, Silvally Memory or
 * Genesect Drive (Mix and Mega rules).
 *
 * Templates come from tools/build-ndmnm-sets.cjs and add three
 * fields to the usual random set data:
 *
 *   item       the item this template is built around
 *   level      the level for this Pokémon + stone
 *   required   moves the mix relies on (e.g. a Normal move for
 *              Pixilate); always included in the final set
 *
 * Built on the NDSP generator, so ally-only abilities are avoided
 * outside 2v2. FFA and 2v2 share the doubles pool: in FFA, moves
 * that only help an ally (Helping Hand, Follow Me, Coaching...) are
 * taken out of the template first (the builder leaves every doubles
 * template at least four other moves).
 */
import {NDSharedPowerTeams} from '../ndsharedpower/teams';

interface NDMnMTemplate extends RandomTeamsTypes.RandomSetData {
	item: string;
	level?: number;
	required?: string[];
}

/** Moves that only help an ally: useless when every other Pokémon is a foe. */
const FFA_REMOVED_MOVES = new Set([
	'followme', 'ragepowder', 'allyswitch', 'helpinghand', 'afteryou', 'coaching', 'decorate', 'instruct',
	'aromaticmist', 'holdhands', 'spotlight', 'wideguard',
]);

const PROTECTED_STATUS = new Set([
	'protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap',
	'burningbulwark', 'recover', 'roost', 'softboiled', 'moonlight', 'morningsun',
	'synthesis', 'slackoff', 'milkdrink', 'shoreup', 'strengthsap', 'wish',
]);

export class NDMixAndMegaTeams extends NDSharedPowerTeams {
	override randomSets: {[species: string]: RandomTeamsTypes.RandomSpeciesData} =
		require('./sets.json');

	override randomDoublesSets: {[species: string]: RandomTeamsTypes.RandomSpeciesData} =
		require('./doubles-sets.json');

	// Stones already on the team being built (one of each where possible).
	protected ndmnmUsedStones = new Set<string>();

	override getTeam(options: PlayerOptions | null = null): PokemonSet[] {
		this.ndmnmUsedStones = new Set();

		const team = super.getTeam(options);

		// The NDSP finaliser can set items (e.g. Thick Club for
		// Marowak); every Pokémon here holds its transformation item.
		for (const set of team) {
			const stone = (set as AnyObject).ndmnmStone;

			if (stone) set.item = stone;

			delete (set as AnyObject).ndmnmStone;
			delete (set as AnyObject).gigantamax;
		}

		return team;
	}

	/*
	 * Skip a Pokémon when every item it can hold is already on the
	 * team (one of each item per team, like Mix and Mega).
	 */
	/*
	 * Keep Pikachu in its usual forme: the cap formes can't learn some
	 * of the moves its templates give it (Double-Edge for Aerilate...).
	 */
	override getForme(species: Species): string {
		if (species.baseSpecies === 'Pikachu') return species.name;

		return super.getForme(species);
	}

	override getPokemonCompatibility(
		species: Species,
		pokemon: RandomTeamsTypes.RandomSet[],
		isDoubles = false
	): boolean {
		const table = isDoubles ? this.randomDoublesSets : this.randomSets;
		const templates = (table[species.id]?.sets || []) as NDMnMTemplate[];
		const used = new Set(pokemon.map(set => this.dex.toID(set.item)));

		if (templates.length && templates.every(t => used.has(this.dex.toID(t.item)))) return false;

		return super.getPokemonCompatibility(species, pokemon, isDoubles);
	}

	override randomSet(
		s: string | Species,
		teamDetails: RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const species = this.dex.species.get(s);
		const table = isDoubles ? this.randomDoublesSets : this.randomSets;
		const data = table[species.id];
		const all = data.sets as NDMnMTemplate[];
		const isFFA = this.format.gameType === 'freeforall';

		// Prefer a stone the team doesn't have yet.
		const fresh = all.filter(t => !this.ndmnmUsedStones.has(this.dex.toID(t.item)));
		const options = [...(fresh.length ? fresh : all)];

		let template!: NDMnMTemplate;
		let set!: RandomTeamsTypes.RandomSet;

		// Try another template if the Gen 9 move selection fails on one.
		for (let attempt = 0; ; attempt++) {
			const index = this.random(options.length);
			template = options[index];

			// No allies to help in FFA.
			if (isFFA) {
				const useful = (name: string) => !FFA_REMOVED_MOVES.has(this.dex.toID(name));
				template = {
					...template,
					movepool: template.movepool.filter(useful),
					...(template.required ? {required: template.required.filter(useful)} : {}),
				};
			}

			// The Gen 9 generator skips Fast Bulky Setup sets for
			// Paradox leads; don't let that leave it with no set.
			const paradoxLead = isLead && template.role === 'Fast Bulky Setup' &&
				template.abilities?.some(a => ['Protosynthesis', 'Quark Drive'].includes(a));

			data.sets = [template];

			try {
				set = super.randomSet(s, teamDetails, paradoxLead ? false : isLead, isDoubles);
				break;
			} catch (err) {
				options.splice(index, 1);
				if (!options.length || attempt >= 5) throw err;
			} finally {
				data.sets = all;
			}
		}

		this.addRequiredMoves(set, template);

		set.item = template.item;
		if (typeof template.level === 'number') set.level = template.level;
		delete (set as AnyObject).gigantamax;

		(set as AnyObject).ndmnmStone = template.item;
		this.ndmnmUsedStones.add(this.dex.toID(template.item));

		return set;
	}

	/*
	 * Make sure the moves the mix relies on are in the set,
	 * replacing the least important move (same type first, then
	 * the weakest attack, then optional status moves).
	 */
	protected addRequiredMoves(set: RandomTeamsTypes.RandomSet, template: NDMnMTemplate) {
		const required = (template.required || []).map(name => this.dex.moves.get(name).id);

		for (const id of required) {
			const moveIDs = set.moves.map(m => this.dex.toID(m));

			if (moveIDs.includes(id)) continue;

			const needed = this.dex.moves.get(id);
			const candidates = moveIDs
				.map((moveID, index) => ({index, move: this.dex.moves.get(moveID)}))
				.filter(c => !required.includes(c.move.id));

			if (!candidates.length) continue;

			const rank = (c: {move: Move}) => {
				const move = c.move;

				if (move.category !== 'Status' && move.type === needed.type) return 0;
				if (move.category !== 'Status') return 1 + move.basePower / 1000;
				if (!PROTECTED_STATUS.has(move.id) && !(move.boosts && move.target === 'self')) return 2;

				return 3;
			};

			candidates.sort((a, b) => rank(a) - rank(b));

			set.moves[candidates[0].index] = id;
		}
	}
}

export default NDMixAndMegaTeams;
