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

/** Protect-style moves (Speed Boost / Moody sets want one). */
const PROTECT_MOVES = ['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark',
	'obstruct'];
const PIVOT_MOVES = ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'chillyreception', 'teleport', 'shedtail'];
const PRANKSTER_MOVES = ['thunderwave', 'taunt', 'encore', 'willowisp', 'reflect', 'lightscreen', 'substitute',
	'glare', 'nuzzle', 'haze', 'destinybond', 'memento', 'partingshot', 'nastyplot', 'calmmind', 'bulkup'];
const SETUP_MOVES: {[category: string]: string[]} = {
	Physical: ['dragondance', 'swordsdance', 'bulkup', 'victorydance', 'coil', 'shiftgear', 'curse', 'howl', 'honeclaws'],
	Special: ['nastyplot', 'calmmind', 'quiverdance', 'takeheart', 'tailglow', 'geomancy', 'torchsong', 'growth'],
};
/** Moves never added for a passive (charge / recharge turns, self-KO, only work in special cases...). */
const PASSIVE_MOVE_BANS = new Set([
	'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser',
	'eternabeam', 'meteorassault', 'selfdestruct', 'explosion', 'mistyexplosion', 'finalgambit', 'memento', 'focuspunch',
	'belch', 'lastresort', 'dreameater', 'synchronoise', 'fling', 'naturalgift', 'spitup', 'steelroller', 'burnup',
	'doubleshock', 'hyperspacefury', 'aurawheel', 'shelltrap', 'beakblast', 'dynamaxcannon', 'behemothblade',
	'behemothbash', 'uproar', 'rollout', 'iceball', 'furycutter', 'echoedvoice', 'round', 'lashout', 'revenge',
	'avalanche', 'payback', 'assurance', 'retaliate', 'stompingtantrum', 'temperflare', 'counter', 'mirrorcoat',
	'metalburst', 'comeuppance', 'bide', 'present', 'magnitude', 'trumpcard', 'wringout', 'crushgrip', 'naturepower',
	'secretpower', 'snore', 'firstimpression', 'fakeout', 'mattblock', 'suckerpunch', 'thunderclap', 'upperhand',
	'solarbeam', 'solarblade', 'skyattack', 'skullbash', 'razorwind', 'freezeshock', 'iceburn', 'meteorbeam',
	'electroshot', 'phantomforce', 'shadowforce', 'fly', 'bounce', 'dig', 'dive',
]);
const PASSIVE_ITEM_SWAPPABLE = new Set(['Leftovers', 'Heavy-Duty Boots', 'Sitrus Berry', 'Expert Belt', 'Life Orb',
	'Black Sludge']);

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
		this.fitPassiveMoves(set, template, species);
		this.fixChoiceItem(set);
		this.fitPassiveItem(set, species);
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

	/** Every move the species can have in PokéRogue (battle-only forms use their base form's). */
	protected pokeRogueMoves(species: Species): Set<ID> {
		let current: Species | null = species;
		for (let i = 0; current && i < 3; i++) {
			const data = this.dex.data.Learnsets[current.id] as AnyObject | undefined;
			if (data?.pokeRogue && data.learnset) return new Set(Object.keys(data.learnset) as ID[]);
			const from: string | string[] | undefined = current.battleOnly || current.changesFrom ||
				(current.isCosmeticForme ? current.baseSpecies : undefined);
			const next: Species = this.dex.species.get(Array.isArray(from) ? from[0] : from || '');
			current = next.exists && next.id !== current.id ? next : null;
		}
		return new Set();
	}

	/**
	 * How much the passive (and the weather / terrain it sets) is worth to
	 * a move: 1 = nothing, 1.5 = a 50% boost.
	 */
	protected passiveBoost(passive: ID, move: Move, species: Species) {
		const f = move.flags;
		switch (passive) {
		case 'ironfist': return f['punch'] ? 1.2 : 1;
		case 'strongjaw': return f['bite'] ? 1.5 : 1;
		case 'megalauncher': return f['pulse'] ? 1.5 : 1;
		case 'sharpness': return f['slicing'] ? 1.5 : 1;
		case 'punkrock': return f['sound'] ? 1.3 : 1;
		case 'toughclaws': return f['contact'] ? 1.3 : 1;
		case 'reckless': return move.recoil || move.hasCrashDamage ? 1.2 : 1;
		case 'rockhead': return move.recoil ? 1.15 : 1;
		case 'technician': return move.basePower <= 60 ? 1.5 : 1;
		case 'skilllink': return move.multihit ? 1.4 : 1;
		case 'transistor': return move.type === 'Electric' ? 1.3 : 1;
		case 'dragonsmaw': return move.type === 'Dragon' ? 1.5 : 1;
		case 'steelworker': case 'steelyspirit': return move.type === 'Steel' ? 1.5 : 1;
		case 'rockypayload': return move.type === 'Rock' ? 1.5 : 1;
		case 'waterbubble': return move.type === 'Water' ? 2 : 1;
		case 'sheerforce': return move.secondary || move.secondaries ? 1.3 : 1;
		case 'serenegrace': return move.secondary?.volatileStatus === 'flinch' || move.secondary?.chance ? 1.15 : 1;
		case 'noguard': return typeof move.accuracy === 'number' && move.accuracy < 100 ? 100 / move.accuracy : 1;
		case 'contrary': return move.self?.boosts && Object.values(move.self.boosts).some(v => v! < 0) ? 1.3 : 1;
		case 'drought': case 'orichalcumpulse':
			return move.type === 'Fire' ? 1.5 : move.type === 'Water' ? 0.5 : 1;
		case 'drizzle': case 'primordialsea':
			if (['thunder', 'hurricane'].includes(move.id)) return 100 / (move.accuracy as number);
			return move.type === 'Water' ? 1.5 : move.type === 'Fire' ? 0.5 : 1;
		case 'snowwarning': return move.id === 'blizzard' ? 100 / (move.accuracy as number) : 1;
		case 'electricsurge': case 'hadronengine': return move.id === 'risingvoltage' ? 2 : move.type === 'Electric' ? 1.3 : 1;
		case 'psychicsurge': return move.id === 'expandingforce' ? 1.5 : move.type === 'Psychic' ? 1.3 : 1;
		case 'grassysurge': return move.type === 'Grass' ? 1.3 : 1;
		case 'sniper': case 'superluck': return move.critRatio && move.critRatio > 1 ? 1.2 : 1;
		case 'parentalbond': return move.multihit ? 1 : 1.25;
		}
		if (ATE[passive] && move.type === 'Normal') return 1.2 * (species.types.includes(ATE[passive]) ? 1.5 : 1);
		return 1;
	}

	/** Expected power of an attack for this species with its passive (STAB, accuracy, hits). */
	protected passivePower(passive: ID, move: Move, species: Species) {
		if (move.category === 'Status' || !move.basePower) return 0;
		let power = move.basePower;
		if (move.multihit) {
			power *= Array.isArray(move.multihit) ? (passive === 'skilllink' ? move.multihit[1] : 3) : move.multihit;
		}
		const type = move.type === 'Normal' && ATE[passive] ? ATE[passive] : move.type;
		if (species.types.includes(type)) power *= passive === 'adaptability' ? 2 : 1.5;
		if (typeof move.accuracy === 'number') power *= move.accuracy / 100;
		if (move.priority > 0) power *= 1.1;
		return power * this.passiveBoost(passive, move, species);
	}

	/**
	 * Moves that fit the passive: stronger versions of the set's attacks
	 * that the passive boosts (Iron Fist punches, Strong Jaw bites, No Guard
	 * Stone Edge / Blizzard, Drizzle Thunder...), at least one boosted move
	 * for passives that boost a kind of move, Protect for Speed Boost /
	 * Moody, setup for Simple, a pivot for Regenerator, Facade for Guts,
	 * a status move for Prankster.
	 */
	protected fitPassiveMoves(set: RandomTeamsTypes.RandomSet, template: PokeRogueTemplate, species: Species) {
		const passive = this.dex.toID((species as AnyObject).passive || '');
		if (!passive || passive === this.dex.toID(set.ability)) return;
		const learnable = this.pokeRogueMoves(species);
		if (!learnable.size) return;
		const required = new Set((template.required || []).map(m => this.dex.toID(m)));
		const get = (id: string) => this.dex.moves.get(id);
		const has = (id: string) => set.moves.some(m => this.dex.toID(m) === id);
		const attacks = () => set.moves.map(get).filter(m => m.category !== 'Status');
		const physical = attacks().filter(m => m.category === 'Physical').length;
		const special = attacks().filter(m => m.category === 'Special').length;
		const category = ['hugepower', 'purepower'].includes(passive) || physical > special ? 'Physical' :
			special > physical ? 'Special' : (species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special');
		const usable = (m: Move) => m.exists && learnable.has(m.id) && !PASSIVE_MOVE_BANS.has(m.id) && !m.isZ && !m.isMax &&
			!m.id.startsWith('hiddenpower') && !(this.isFFA && FFA_REMOVED_MOVES.has(m.id));
		const power = (m: Move) => this.passivePower(passive, m, species);
		const typeOf = (m: Move) => (m.type === 'Normal' && ATE[passive]) ? ATE[passive] : m.type;
		// The move the set can best do without (never a required move or the only STAB attack).
		const replaceable = () => {
			let best = -1;
			let bestScore = Infinity;
			const moves = set.moves.map(get);
			for (const [i, m] of moves.entries()) {
				if (required.has(m.id)) continue;
				let score;
				if (m.category === 'Status') {
					const important = KEEP_STATUS.has(m.id) || (m.boosts && m.target === 'self') ||
						(this.hasAllies && DOUBLES_KEEP.has(m.id)) || PROTECT_MOVES.includes(m.id);
					score = important ? 200 : 40;
				} else {
					const stab = species.types.includes(typeOf(m));
					const stabs = moves.filter(x => x.category !== 'Status' && species.types.includes(typeOf(x))).length;
					if (stab && stabs === 1) continue;
					const sameType = moves.filter(x => x.category !== 'Status' && typeOf(x) === typeOf(m)).length;
					score = power(m) - (sameType > 1 ? 60 : 0);
				}
				if (score < bestScore) {
					bestScore = score;
					best = i;
				}
			}
			return best;
		};
		const put = (id: string) => {
			if (has(id)) return true;
			const index = replaceable();
			if (index < 0) return false;
			set.moves[index] = id;
			return true;
		};
		const candidates = [...learnable].map(get).filter(usable);

		// 1. Upgrade attacks to versions the passive boosts (same type; Huge / Pure
		// Power also turns special attacks physical).
		const boostedPassive = candidates.some(m => this.passiveBoost(passive, m, species) > 1);
		if (boostedPassive) {
			for (const [i, name] of set.moves.entries()) {
				const current = get(name);
				if (current.category === 'Status' || required.has(current.id)) continue;
				const wantCategory = ['hugepower', 'purepower'].includes(passive) ? 'Physical' : current.category;
				let best: Move | null = null;
				for (const m of candidates) {
					if (has(m.id) || m.category !== wantCategory || typeOf(m) !== typeOf(current)) continue;
					if (this.passiveBoost(passive, m, species) <= this.passiveBoost(passive, current, species) &&
						wantCategory === current.category) continue;
					if (power(m) < power(current) * 1.1) continue;
					if (!best || power(m) > power(best)) best = m;
				}
				if (best) set.moves[i] = best.id;
			}
		}

		// 2. At least one move the passive boosts.
		const MOVE_PASSIVES = ['ironfist', 'strongjaw', 'megalauncher', 'sharpness', 'punkrock', 'toughclaws', 'reckless',
			'technician', 'skilllink', 'transistor', 'dragonsmaw', 'steelworker', 'rockypayload', 'waterbubble', 'noguard',
			'sheerforce', 'contrary', ...Object.keys(ATE)];
		if (MOVE_PASSIVES.includes(passive) && !attacks().some(m => this.passiveBoost(passive, m, species) > 1)) {
			const coveredTwice = (type: string) => attacks().filter(m => typeOf(m) === type).length >= 2;
			const options = candidates.filter(m => m.category === category && !has(m.id) &&
				this.passiveBoost(passive, m, species) > 1 && !coveredTwice(typeOf(m)) && power(m) >= 70);
			options.sort((a, b) => power(b) - power(a));
			if (options.length) put(options[0].id);
		}

		// 3. Passives that want a particular status move.
		const firstLearnable = (ids: string[]) => ids.find(id => learnable.has(id as ID) && usable(get(id)));
		const hasAny = (ids: string[]) => ids.some(has);
		if ((passive === 'speedboost' || passive === 'moody') && !this.isFFA && !hasAny(PROTECT_MOVES)) {
			const protect = firstLearnable(PROTECT_MOVES);
			if (protect) put(protect);
		} else if (passive === 'simple' && !set.moves.map(get).some(m => m.boosts && m.target === 'self')) {
			const setup = firstLearnable(SETUP_MOVES[category]) || firstLearnable(['curse', 'amnesia', 'irondefense', 'cosmicpower']);
			if (setup) put(setup);
		} else if (passive === 'regenerator' && !hasAny(PIVOT_MOVES) &&
			!set.moves.map(get).some(m => m.boosts && m.target === 'self')) {
			const pivot = firstLearnable(PIVOT_MOVES);
			if (pivot) put(pivot);
		} else if (passive === 'guts' && category === 'Physical' && !has('facade') && learnable.has('facade' as ID)) {
			put('facade');
		} else if (passive === 'prankster' && !set.moves.map(get).some(m => m.category === 'Status')) {
			const status = firstLearnable(PRANKSTER_MOVES);
			if (status) put(status);
		}
	}

	/** Items the passive wants (the Gen 9 generator only looks at the ability). */
	protected fitPassiveItem(set: RandomTeamsTypes.RandomSet, species: Species) {
		const item = this.dex.items.get(set.item);
		if (!set.item || item.megaStone || item.zMove) return;
		const passive = this.dex.toID((species as AnyObject).passive || '');
		if (!passive || passive === this.dex.toID(set.ability)) return;
		const moves = set.moves.map(m => this.dex.moves.get(m));
		const types = species.types;
		const attacks = moves.filter(m => m.category !== 'Status');
		const choice = set.item.startsWith('Choice');
		const swappable = PASSIVE_ITEM_SWAPPABLE.has(set.item);
		const rockWeak = this.dex.getEffectiveness('Rock', species) >= 1 && this.dex.getImmunity('Rock', species);

		switch (passive) {
		case 'poisonheal': case 'toxicboost':
			if (!types.includes('Poison') && !types.includes('Steel')) set.item = 'Toxic Orb';
			return;
		case 'flareboost':
			if (!types.includes('Fire')) set.item = 'Flame Orb';
			return;
		case 'guts': case 'marvelscale': case 'quickfeet':
			// Guts only boosts physical attacks (a burn would just hurt a special attacker)
			if (passive === 'guts' && attacks.filter(m => m.category === 'Physical').length * 2 < attacks.length) return;
			if (!types.includes('Fire')) {
				set.item = 'Flame Orb';
			} else if (!types.includes('Poison') && !types.includes('Steel')) {
				set.item = 'Toxic Orb';
			}
			return;
		case 'magicguard':
			// hazards don't hurt it, so it doesn't need Heavy-Duty Boots
			if (attacks.length >= 2 && (swappable || choice && moves.some(m => m.category === 'Status'))) {
				set.item = 'Life Orb';
			} else if (set.item === 'Heavy-Duty Boots') {
				set.item = 'Leftovers';
			}
			return;
		case 'sheerforce':
			if (swappable && attacks.filter(m => m.secondary || m.secondaries).length >= 2) set.item = 'Life Orb';
			return;
		case 'unburden':
			if (!choice) set.item = moves.some(m => m.id === 'shellsmash') ? 'White Herb' : 'Sitrus Berry';
			return;
		case 'harvest': case 'cheekpouch': case 'ripen': case 'gluttony':
			if (swappable && !(set.item === 'Heavy-Duty Boots' && rockWeak)) set.item = 'Sitrus Berry';
			return;
		case 'superluck': case 'sniper':
			if (swappable && set.item !== 'Heavy-Duty Boots' && attacks.length >= 3) set.item = 'Scope Lens';
			return;
		}
		const ROCKS: {[passive: string]: string} = {
			drought: 'Heat Rock', orichalcumpulse: 'Heat Rock', drizzle: 'Damp Rock', sandstream: 'Smooth Rock',
			snowwarning: 'Icy Rock',
		};
		const TERRAIN = ['electricsurge', 'hadronengine', 'psychicsurge', 'grassysurge', 'mistysurge'];
		if (ROCKS[passive] || TERRAIN.includes(passive)) {
			if (!['Leftovers', 'Heavy-Duty Boots', 'Sitrus Berry', 'Black Sludge'].includes(set.item)) return;
			if (set.item === 'Heavy-Duty Boots' && rockWeak) return;
			set.item = ROCKS[passive] || 'Terrain Extender';
		}
	}
}

export default PokeRogueTeams;
