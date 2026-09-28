/*
 * ===========================================================
 * POKÉROGUE RANDOM TEAMS
 * ===========================================================
 *
 * Random teams for [Gen 9] PokeRogue Random Battle (singles),
 * [Gen 9] PokeRogue FFA Random Battle and [Gen 9] PokeRogue 2v2.
 * Built on Showdown's Gen 9 generator with set data from
 * tools/pokerogue/build-random-sets.cjs:
 *
 *   sets.json          singles
 *   ffa-sets.json      FFA: singles-style, self-sufficient sets, generated
 *                      with the singles logic (no ally in a free-for-all)
 *   doubles-sets.json  2v2: doubles sets (Protect, Fake Out, redirection,
 *                      Helping Hand, speed control, spread attacks...)
 *
 * The builder adds these fields to each set:
 *
 *   level      this set's level (lower when its passive / egg moves
 *              make it stronger)
 *   required   moves the set is built around (egg moves, passive
 *              moves like Aerilate Extreme Speed); always kept
 *   item       an item the set always holds (Ultranecrozium Z, fixed sets)
 *   fixed      a set the user wrote (FIXED_SETS in the builder): its four
 *              moves and its ability are used exactly as written, with
 *   nature     its nature and
 *   gender     its gender
 *
 * Megas and Gigantamax forms (Max Mushrooms) have their own entries;
 * a team gets at most one of them, since only one can transform per
 * battle.
 */
import RandomTeams, {MoveCounter} from '../gen9/teams';
import type {PRNG, PRNGSeed} from '../../../sim/prng';

interface PokeRogueTemplate extends RandomTeamsTypes.RandomSetData {
	level?: number;
	required?: string[];
	item?: string;
	fixed?: boolean;
	nature?: string;
	gender?: string;
}

/** Moves that only help an ally: useless when every other Pokémon is a foe. */
const FFA_REMOVED_MOVES = new Set([
	'followme', 'ragepowder', 'allyswitch', 'helpinghand', 'afteryou', 'coaching', 'decorate', 'instruct',
	'aromaticmist', 'holdhands', 'spotlight', 'healpulse', 'floralhealing', 'lifedew', 'quash', 'wideguard',
	'quickguard', 'matblock', 'craftyshield',
]);
/** Abilities that only affect an ally (useless in singles and FFA). */
const ALLY_ONLY_ABILITIES = new Set([
	'battery', 'commander', 'costar', 'curiousmedicine', 'friendguard', 'healer', 'hospitality', 'minus', 'plus',
	'powerofalchemy', 'powerspot', 'receiver', 'symbiosis', 'telepathy',
]);
const KEEP_STATUS = new Set([
	'protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'recover',
	'roost', 'softboiled', 'moonlight', 'morningsun', 'synthesis', 'slackoff', 'milkdrink', 'shoreup',
	'strengthsap', 'wish', 'healorder', 'lunarblessing', 'spore', 'revivalblessing', 'stealthrock', 'stickyweb',
]);
/** 2v2: moves a doubles set is built around (kept over optional moves). */
const DOUBLES_KEEP = new Set([
	'followme', 'ragepowder', 'fakeout', 'helpinghand', 'tailwind', 'trickroom', 'wideguard', 'coaching', 'decorate',
	'instruct', 'pollenpuff', 'icywind', 'electroweb', 'snarl',
]);
/** Status moves that still work with a Choice item. */
const CHOICE_STATUS = new Set(['trick', 'switcheroo', 'healingwish', 'lunardance', 'memento', 'partingshot']);
const ATE: {[passive: string]: string} = {
	aerilate: 'Flying', pixilate: 'Fairy', refrigerate: 'Ice', galvanize: 'Electric', dragonize: 'Dragon',
};

export class PokeRogueTeams extends RandomTeams {
	override randomSets: {[species: string]: RandomTeamsTypes.RandomSpeciesData} = require('./sets.json');
	override randomDoublesSets: {[species: string]: RandomTeamsTypes.RandomSpeciesData} = require('./doubles-sets.json');
	randomFFASets: {[species: string]: RandomTeamsTypes.RandomSpeciesData} = require('./ffa-sets.json');

	constructor(format: Format | string, prng: PRNG | PRNGSeed | null) {
		super(format, prng);
		// FFA: its own pool, for both the team (species list) and the sets.
		if (this.isFFA) {
			this.randomSets = this.randomFFASets;
			this.randomDoublesSets = this.randomFFASets;
		}
	}

	protected get isFFA() {
		return this.format.gameType === 'freeforall';
	}

	/** Formats where each Pokémon has an ally next to it. */
	protected get hasAllies() {
		return this.format.gameType === 'doubles' || this.format.gameType === 'multi';
	}

	/**
	 * The Gen 9 move pool culling can look up a MOVE_PAIRS move that an
	 * earlier pair already removed (Protect with both Wish and Leech Seed).
	 */
	override fastPop(list: any[], index: number) {
		if (index === -1) return undefined;
		return super.fastPop(list, index);
	}

	/** Megas and Gigantamax forms: species that need their transformation item. */
	protected isTransformation(species: Species) {
		return !!(species.battleOnly && (species.requiredItem || species.requiredItems));
	}

	/**
	 * Base forms are listed as often as their Mega / Gigantamax forms,
	 * so a Pokémon with a transformation shows up transformed about
	 * half of the time.
	 */
	override getPokemonPool(
		type: string,
		pokemonToExclude: RandomTeamsTypes.RandomSet[] = [],
		isMonotype = false,
		pokemonList: string[]
	): [{[k: string]: string[]}, string[]] {
		const [pool, baseSpeciesPool] = super.getPokemonPool(type, pokemonToExclude, isMonotype, pokemonList);
		for (const baseSpecies in pool) {
			const formes = pool[baseSpecies];
			const transformations = formes.filter(id => this.isTransformation(this.dex.species.get(id)));
			const others = formes.filter(id => !transformations.includes(id));
			if (!transformations.length || !others.length) continue;
			while (others.length < transformations.length) others.push(...others.slice(0, transformations.length - others.length));
			pool[baseSpecies] = [...others, ...transformations];
		}
		return [pool, baseSpeciesPool];
	}

	/**
	 * Only forms that exist in PokéRogue (no Pikachu in caps, which the
	 * Gen 9 generator hands out).
	 */
	override getForme(species: Species): string {
		const forme = super.getForme(species);
		const result = this.dex.species.get(forme);
		if ((result as AnyObject).pokeRogue) return forme;
		if (typeof species.battleOnly === 'string') return species.battleOnly;
		return species.name;
	}

	/** Only one Mega / Gigantamax Pokémon per team. */
	override getPokemonCompatibility(
		species: Species,
		pokemon: RandomTeamsTypes.RandomSet[],
		isDoubles = false
	): boolean {
		if (this.isTransformation(species) && pokemon.some(set => {
			const item = this.dex.items.get(set.item);
			return !!item.megaStone;
		})) {
			return false;
		}
		return super.getPokemonCompatibility(species, pokemon, isDoubles);
	}

	override getAbility(
		types: Set<string>,
		moves: Set<string>,
		abilities: string[],
		counter: MoveCounter,
		teamDetails: RandomTeamsTypes.TeamDetails,
		species: Species,
		isLead: boolean,
		isDoubles: boolean,
		teraType: string,
		role: RandomTeamsTypes.Role,
	): string {
		// No allies in singles or FFA (and no Dondozo to command in 2v2).
		const useful = abilities.filter(a => {
			const id = this.dex.toID(a);
			return this.hasAllies ? id !== 'commander' : !ALLY_ONLY_ABILITIES.has(id);
		});
		return super.getAbility(types, moves, useful.length ? useful : abilities, counter, teamDetails, species,
			isLead, isDoubles, teraType, role);
	}

	override randomSet(
		s: string | Species,
		teamDetails: RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const species = this.dex.species.get(s);
		const isFFA = this.isFFA;
		// FFA sets are singles sets: no ally, so the singles move / item logic fits.
		if (isFFA) isDoubles = false;
		const table = isDoubles ? this.randomDoublesSets : this.randomSets;
		const data = table[species.id];
		const all = data.sets as PokeRogueTemplate[];

		const options = [...all];
		let template!: PokeRogueTemplate;
		let set!: RandomTeamsTypes.RandomSet;
		// Try another template if the Gen 9 move selection fails on one.
		for (let attempt = 0; ; attempt++) {
			const index = this.random(options.length);
			template = options[index];
			const trimmed: PokeRogueTemplate = isFFA ? {
				...template,
				movepool: template.movepool.filter(m => !FFA_REMOVED_MOVES.has(this.dex.toID(m))),
			} : template;
			const paradoxLead = isLead && template.role === 'Fast Bulky Setup' &&
				template.abilities?.some(a => ['Protosynthesis', 'Quark Drive'].includes(a));
			data.sets = [trimmed];
			try {
				set = super.randomSet(species, teamDetails, paradoxLead ? false : isLead, isDoubles);
				template = trimmed;
				break;
			} catch (err) {
				options.splice(index, 1);
				if (!options.length || attempt >= 5) throw err;
			} finally {
				data.sets = all;
			}
		}

		if (template.fixed) return this.applyFixedSet(set, template);
		this.addRequiredMoves(set, template, species);
		this.trimMoves(set, template, species);
		this.fillMoves(set, template);
		if (typeof template.level === 'number' && !this.adjustLevel) set.level = template.level;
		if (template.item) set.item = template.item;
		// Gigantamax with Galarica Wreath (an item every client knows)
		if (set.item === 'Max Mushrooms') set.item = 'Galarica Wreath';
		this.fixChoiceItem(set);
		this.fixPassiveItem(set, species);
		// No EVs in PokéRogue random battles (the teambuilder formats keep them).
		set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		return set;
	}

	/**
	 * The Gen 9 generator hands out Choice Scarf for moves like Dragon
	 * Energy or Water Spout (and always to Rampardos in doubles), which
	 * can clash with PokéRogue egg moves like Dragon Dance or Recover.
	 */
	protected fixChoiceItem(set: RandomTeamsTypes.RandomSet) {
		if (!set.item.startsWith('Choice')) return;
		const moves = set.moves.map(m => this.dex.moves.get(m));
		const status = moves.filter(m => m.category === 'Status' && !CHOICE_STATUS.has(m.id));
		if (!status.length) return;
		const setupOnly = status.every(m => m.boosts && m.target === 'self' && !m.heal);
		const hpBased = moves.some(m => ['dragonenergy', 'eruption', 'waterspout'].includes(m.id));
		set.item = setupOnly && !hpBased ? 'Life Orb' : 'Leftovers';
	}

	/**
	 * Put the moves the set is built around back in if the Gen 9
	 * generator left them out, replacing the least important move
	 * (same-type attack, then an optional status move, then the
	 * weakest coverage attack).
	 */
	protected addRequiredMoves(set: RandomTeamsTypes.RandomSet, template: PokeRogueTemplate, species: Species) {
		const required = (template.required || []).map(name => this.dex.moves.get(name).id)
			.filter(id => template.movepool.some(m => this.dex.toID(m) === id));
		const passive = this.dex.toID((species as AnyObject).passive || '');
		const typeOf = (move: Move) => (move.type === 'Normal' && ATE[passive]) ? ATE[passive] : move.type;

		for (const id of required) {
			const moveIDs = set.moves.map(m => this.dex.toID(m));
			if (moveIDs.includes(id)) continue;
			const needed = this.dex.moves.get(id);
			const candidates = moveIDs
				.map((moveID, index) => ({index, move: this.dex.moves.get(moveID)}))
				.filter(c => !required.includes(c.move.id));
			if (!candidates.length) continue;

			const rank = ({move}: {move: Move}) => {
				if (needed.category !== 'Status' && move.category !== 'Status' && typeOf(move) === typeOf(needed)) return 0;
				if (this.hasAllies && DOUBLES_KEEP.has(move.id)) return 5;
				if (move.category === 'Status') {
					if (KEEP_STATUS.has(move.id) || (move.boosts && move.target === 'self')) return 5;
					return 1;
				}
				const stab = species.types.includes(typeOf(move));
				// never replace the only STAB attack
				const stabAttacks = set.moves.map(m => this.dex.moves.get(m))
					.filter(m => m.category !== 'Status' && species.types.includes(typeOf(m)));
				if (stab && stabAttacks.length === 1) return 6;
				return (stab ? 4 : 2) + move.basePower / 1000;
			};
			candidates.sort((a, b) => rank(a) - rank(b));
			set.moves[candidates[0].index] = id;
		}
	}

	/**
	 * The Gen 9 generator can enforce more than four moves when a set has
	 * several must-have moves (setup, STAB, recovery...). Keep four:
	 * drop extra attacks of a type already covered, then optional status
	 * moves, then the weakest coverage.
	 */
	protected trimMoves(set: RandomTeamsTypes.RandomSet, template: PokeRogueTemplate, species: Species) {
		if (set.moves.length <= this.maxMoveCount) return;
		const required = new Set((template.required || []).map(name => this.dex.moves.get(name).id));
		while (set.moves.length > this.maxMoveCount) {
			const moves = set.moves.map(id => this.dex.moves.get(id));
			const typeCount: {[type: string]: number} = {};
			for (const m of moves) if (m.category !== 'Status') typeCount[m.type] = (typeCount[m.type] || 0) + 1;
			const score = (m: Move) => {
				if (required.has(m.id)) return 100;
				if (m.category === 'Status') {
					return KEEP_STATUS.has(m.id) || (m.boosts && m.target === 'self') ? 50 : 10;
				}
				const stab = species.types.includes(m.type);
				return (typeCount[m.type] > 1 ? 0 : 20) + (stab ? 20 : 0) + m.basePower / 10;
			};
			let worst = 0;
			for (let i = 1; i < moves.length; i++) if (score(moves[i]) < score(moves[worst])) worst = i;
			set.moves.splice(worst, 1);
		}
	}

	/** A set written by hand: exactly its moves, ability, item, nature and gender. */
	protected applyFixedSet(set: RandomTeamsTypes.RandomSet, template: PokeRogueTemplate) {
		set.moves = template.movepool.map(m => this.dex.toID(m));
		// Hidden Power's type comes from the move name (Hidden Power Rock)
		const hiddenPower = set.moves.find(id => id.startsWith('hiddenpower') && id !== 'hiddenpower');
		if (hiddenPower) set.hpType = this.dex.types.get(hiddenPower.slice(11)).name;
		set.ability = template.abilities![0];
		if (template.item) set.item = template.item;
		if (template.nature) set.nature = template.nature;
		if (template.gender) set.gender = template.gender;
		if (typeof template.level === 'number' && !this.adjustLevel) set.level = template.level;
		set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		return set;
	}

	/**
	 * The Gen 9 generator can stop at three moves when the only moves left
	 * are MOVE_PAIRS it has no room for (Leech Seed + Protect / Substitute).
	 */
	protected fillMoves(set: RandomTeamsTypes.RandomSet, template: PokeRogueTemplate) {
		const have = new Set(set.moves.map(m => this.dex.toID(m)));
		const rest = template.movepool.map(m => this.dex.toID(m)).filter(id => !have.has(id));
		while (set.moves.length < this.maxMoveCount && rest.length) {
			set.moves.push(this.sampleNoReplace(rest));
		}
	}

	/** Items the passive wants (the Gen 9 generator only looks at the ability). */
	protected fixPassiveItem(set: RandomTeamsTypes.RandomSet, species: Species) {
		if (!set.item || this.dex.items.get(set.item).megaStone) return;
		const passive = this.dex.toID((species as AnyObject).passive || '');
		const moves = new Set<string>(set.moves.map(m => this.dex.toID(m)));
		const types = species.types;
		const attacks = set.moves.filter(m => this.dex.moves.get(m).category !== 'Status').length;
		const swappable = ['Leftovers', 'Heavy-Duty Boots', 'Sitrus Berry', 'Expert Belt', 'Life Orb', 'Black Sludge'];
		if (!swappable.includes(set.item) && !set.item.startsWith('Choice')) return;

		if ((passive === 'poisonheal' || passive === 'toxicboost') && !types.includes('Poison') &&
			!types.includes('Steel') && !set.item.startsWith('Choice')) {
			set.item = 'Toxic Orb';
		} else if (['guts', 'flareboost', 'marvelscale', 'quickfeet'].includes(passive) && moves.has('facade') &&
			!types.includes('Fire')) {
			set.item = 'Flame Orb';
		} else if (passive === 'magicguard' && attacks >= 3 && !set.item.startsWith('Choice')) {
			set.item = 'Life Orb';
		} else if (passive === 'unburden' && !set.item.startsWith('Choice')) {
			set.item = moves.has('shellsmash') ? 'White Herb' : 'Sitrus Berry';
		} else if (['harvest', 'cheekpouch', 'ripen'].includes(passive) && set.item === 'Leftovers') {
			set.item = 'Sitrus Berry';
		}
	}
}

export default PokeRogueTeams;
