/*
 * ===========================================================
 * POKÉROGUE FUSION RANDOM TEAMS
 * ===========================================================
 *
 * [Gen 9] PokeRogue Fusion Random Battle: every Pokémon is fused with a
 * second one, by PokéRogue's DNA Splicer rules (PokeRogue Fusion Mod in
 * data/mods/pokerogue/rulesets.ts: the first Pokémon's primary type and
 * passive, the second one's secondary type and ability, averaged base
 * stats, moves from both).
 *
 * The PokeRogue random teams (./teams.ts) pick each Pokémon and one of its
 * sets as usual. Then, for that set:
 *
 *  1. Partner. A sample of random battle Pokémon is scored on what the
 *     fusion would gain: a new type (and its weaknesses, also against the
 *     rest of the team), the stats the set's role needs (Attack or Special
 *     Attack, plus Speed for fast roles and bulk for bulky ones) and the
 *     best ability it would bring. The best-scoring one is the partner.
 *  2. Ability. The partner's ability that suits the fused Pokémon best:
 *     the abilities its own random battle sets use come first; abilities
 *     that boost one kind of move only if the fusion learns a strong one;
 *     weather abilities only with that weather on the team or from the
 *     passive; immunities that cover a weakness of the fused typing count
 *     extra. Abilities banned in PokeRogue Fusion (Wonder Guard, Shadow Tag,
 *     Arena Trap, Moody, Simple, Gorilla Tactics) and ones that make no
 *     sense on a fusion (Imposter, Illusion) are never picked.
 *  3. Moves. The set's own move pool, plus what the partner brings: a
 *     strong attack of each fused type the pool has none of (the partner's
 *     random battle moves first, then anything either Pokémon learns), the
 *     partner's priority and coverage attacks, and setup, recovery, hazards
 *     or a pivot when the role wants one and the set has none.
 *
 * Then the usual set building runs on the fused Pokémon (its types, stats
 * and ability), so the moves, the item (Choice items, Heavy-Duty Boots,
 * Assault Vest, status orbs...) and the passive fitting follow the fusion.
 * The level is the average of the two Pokémon's random battle levels, lower
 * when the ability is worth more on the fusion than on the partner (Huge
 * Power on a stronger attacker) or the first Pokémon loses a drawback
 * ability (Truant, Slow Start, Defeatist).
 */
import {PokeRogueTeams, ALLY_ONLY_ABILITIES, MOVE_ABILITIES, PASSIVE_MOVE_BANS, ATE} from './teams';
import type {PokeRogueTemplate} from './teams';
import {fuseSpecies, NO_FUSION_ABILITIES} from '../../mods/pokerogue/rulesets';

type Category = 'Physical' | 'Special';
type Weather = 'sun' | 'rain' | 'sand' | 'snow';

/** How many random partners are scored for each Pokémon. */
const PARTNER_SAMPLE = 20;

/**
 * Abilities never given to a fusion: PokeRogue Fusion's bans (its banlist
 * is PokeRogue OU's plus Wonder Guard), and ones that hide or replace what
 * the fusion is.
 */
const NEVER_ABILITIES = new Set([
	'wonderguard', 'shadowtag', 'arenatrap', 'moody', 'simple', 'gorillatactics',
	'imposter', 'illusion',
	// Ogerpon / Terapagos only do something in their own forms
	'embodyaspectcornerstone', 'embodyaspecthearthflame', 'embodyaspectteal', 'embodyaspectwellspring', 'teraformzero',
]);
/**
 * Pokémon left out: their sets need their form-changing ability, which a
 * fusion loses (Wishiwashi stays Solo, Terapagos never takes its Terastal
 * form, Palafin stays Zero, Minior stays in its shell, Aegislash in Shield
 * Forme).
 */
const UNFUSABLE = new Set(['wishiwashi', 'terapagos', 'palafin', 'minior', 'aegislash']);
/** Abilities that only boost physical (or only special) attacks. */
const PHYSICAL_ABILITIES = new Set([
	'hugepower', 'purepower', 'guts', 'toxicboost', 'hustle', 'toughclaws', 'ironfist', 'strongjaw', 'sharpness', 'reckless',
	'moxie', 'defiant', 'intrepidsword', 'rockypayload', 'unseenfist',
]);
const SPECIAL_ABILITIES = new Set(['solarpower', 'flareboost', 'competitive', 'megalauncher']);
/** Abilities that boost one type of move. */
const TYPE_ABILITIES: {[id: string]: string} = {
	blaze: 'Fire', torrent: 'Water', overgrow: 'Grass', swarm: 'Bug', transistor: 'Electric', dragonsmaw: 'Dragon',
	steelworker: 'Steel', steelyspirit: 'Steel', rockypayload: 'Rock', waterbubble: 'Water',
};
/** Abilities that need weather to do anything. */
const WEATHER_ABILITIES: {[id: string]: Weather} = {
	chlorophyll: 'sun', solarpower: 'sun', leafguard: 'sun', swiftswim: 'rain', raindish: 'rain', hydration: 'rain',
	sandrush: 'sand', sandforce: 'sand', sandveil: 'sand', slushrush: 'snow', icebody: 'snow', snowcloak: 'snow',
};
const WEATHER_SETTERS: {[id: string]: Weather} = {
	drought: 'sun', orichalcumpulse: 'sun', desolateland: 'sun', drizzle: 'rain', primordialsea: 'rain',
	sandstream: 'sand', sandspit: 'sand', snowwarning: 'snow',
};
const WEATHER_TYPES: {[weather in Weather]: string} = {sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice'};
/** Types an ability makes the Pokémon immune to (or take much less from). */
const ABILITY_IMMUNITIES: {[id: string]: string[]} = {
	levitate: ['Ground'], eartheater: ['Ground'], flashfire: ['Fire'], wellbakedbody: ['Fire'], heatproof: ['Fire'],
	waterbubble: ['Fire'], waterabsorb: ['Water'], stormdrain: ['Water'], dryskin: ['Water'], voltabsorb: ['Electric'],
	lightningrod: ['Electric'], motordrive: ['Electric'], sapsipper: ['Grass'], thickfat: ['Fire', 'Ice'],
	purifyingsalt: ['Ghost'],
};
/** Good on bulky sets. */
const BULKY_ABILITIES = new Set([
	'regenerator', 'intimidate', 'multiscale', 'shadowshield', 'fluffy', 'icescales', 'furcoat', 'stamina', 'unaware',
	'magicbounce', 'naturalcure', 'thickfat', 'purifyingsalt', 'roughskin', 'ironbarbs', 'flamebody', 'static',
	'poisonpoint', 'effectspore', 'goodasgold', 'magicguard', 'filter', 'solidrock', 'prismarmor', 'marvelscale',
	'poisonheal', 'triage', 'wellbakedbody', 'eartheater', 'toxicdebris',
]);
/** Good on attacking sets. */
const OFFENSIVE_ABILITIES = new Set([
	'hugepower', 'purepower', 'adaptability', 'sheerforce', 'technician', 'toughclaws', 'strongjaw', 'sharpness', 'ironfist',
	'megalauncher', 'punkrock', 'tintedlens', 'speedboost', 'moxie', 'beastboost', 'supremeoverlord', 'protean', 'libero',
	'hustle', 'guts', 'aerilate', 'pixilate', 'refrigerate', 'galvanize', 'dragonize', 'transistor', 'dragonsmaw',
	'rockypayload', 'steelworker', 'waterbubble', 'noguard', 'skilllink', 'contrary', 'intrepidsword', 'download',
	'unseenfist', 'sniper', 'superluck', 'toxicchain', 'orichalcumpulse', 'hadronengine', 'quarkdrive', 'protosynthesis',
	'unburden', 'swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'surgesurfer', 'drought', 'drizzle',
]);
/** Drawback abilities: the first Pokémon's level is set with them in mind. */
const DRAWBACK_ABILITIES = new Set(['truant', 'slowstart', 'defeatist', 'klutz', 'stall', 'normalize']);
/** Moves that only make sense with the ability of the set they're from. */
const ABILITY_MOVES: {[moveid: string]: string[]} = {
	facade: ['guts', 'toxicboost', 'flareboost', 'quickfeet', 'marvelscale', 'poisonheal'],
};

const RECOVERY = ['recover', 'roost', 'slackoff', 'softboiled', 'milkdrink', 'moonlight', 'morningsun', 'synthesis',
	'shoreup', 'strengthsap', 'healorder', 'lunarblessing', 'junglehealing'];
const HAZARDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'];
const PIVOTS = ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'chillyreception'];
const SETUP: {[category in Category]: string[]} = {
	Physical: ['swordsdance', 'dragondance', 'bulkup', 'victorydance', 'coil', 'shiftgear', 'curse', 'howl', 'honeclaws',
		'tidyup', 'noretreat', 'shellsmash', 'bellydrum'],
	Special: ['nastyplot', 'calmmind', 'quiverdance', 'takeheart', 'tailglow', 'geomancy', 'torchsong', 'shellsmash'],
};
/** Attacks kept for what they do, not their type. */
const KEEP_ATTACKS = new Set([...PIVOTS, 'knockoff', 'rapidspin', 'mortalspin', 'nuzzle', 'seismictoss', 'nightshade',
	'superfang', 'foulplay', 'bodypress', 'saltcure', 'dragontail', 'circlethrow', 'icywind', 'electroweb', 'snarl',
	'terablast', 'facade', 'fakeout', 'suckerpunch', 'firstimpression', 'trick', 'finalgambit', 'endeavor']);
/** Most moves a fusion's move pool gets from the partner. */
const MAX_PARTNER_MOVES = 4;

interface FusionPlan {
	first: Species;
	partner: Species;
	fused: Species;
	ability: string;
	template: PokeRogueTemplate;
}

interface PartnerScore {
	partner: Species;
	fused: Species;
	ability: ID;
	learnable: Set<ID>;
	score: number;
}

interface FusionContext {
	first: Species;
	template: PokeRogueTemplate;
	role: string;
	category: Category;
	passive: ID;
	teamDetails: RandomTeamsTypes.TeamDetails;
	/** the set's own moves (the template's move pool) */
	ownMoves: Set<ID>;
	/** everything the first Pokémon learns in PokéRogue */
	firstLearnable: Set<ID>;
}

export class PokeRogueFusionTeams extends PokeRogueTeams {
	/** Base species already on the team (as a first Pokémon or a partner). */
	protected usedSpecies = new Set<string>();
	/** The team's fused types and weaknesses so far. */
	protected fusedTypeCount: {[type: string]: number} = {};
	protected fusedWeaknesses: {[type: string]: number} = {};
	protected fusedDoubleWeaknesses: {[type: string]: number} = {};
	/** The team's fusion abilities so far (a team gets a mix). */
	protected teamAbilities: {[ability: string]: number} = {};
	protected learnableCache = new Map<ID, Set<ID>>();
	protected partnerPoolCache: {[baseSpecies: string]: Species[]} | null = null;

	override randomTeam() {
		this.usedSpecies = new Set();
		this.fusedTypeCount = {};
		this.fusedWeaknesses = {};
		this.fusedDoubleWeaknesses = {};
		this.teamAbilities = {};
		return super.randomTeam();
	}

	override getPokemonPool(
		type: string,
		pokemonToExclude: RandomTeamsTypes.RandomSet[] = [],
		isMonotype = false,
		pokemonList: string[]
	): [{[k: string]: string[]}, string[]] {
		const fusable = pokemonList.filter(id => !UNFUSABLE.has(this.dex.toID(this.dex.species.get(id).baseSpecies)));
		return super.getPokemonPool(type, pokemonToExclude, isMonotype, fusable);
	}

	override randomSet(
		s: string | Species,
		teamDetails: RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const first = this.dex.species.get(s);
		const table = isDoubles ? this.randomDoublesSets : this.randomSets;
		const data = table[first.id];
		const original = data.sets as PokeRogueTemplate[];
		// (the Gen 9 generator would skip a second Tera Blast user and leave no set)
		let templates = original.filter(t => !(t.role === 'Tera Blast user' && teamDetails.teraBlast));
		if (!templates.length) templates = original;

		let lastError: unknown = null;
		for (let attempt = 0; attempt < 6; attempt++) {
			const template = this.sample(templates);
			const plan = this.planFusion(first, template, teamDetails);
			if (!plan) continue;
			data.sets = [plan.template];
			try {
				const set = super.randomSet(plan.fused, teamDetails, isLead, isDoubles);
				set.fusion = plan.partner.name;
				set.ability = plan.ability;
				this.ensureFusedStab(set, plan);
				// (Earth Eater, from Orthworm, already makes it immune to Ground)
				if (set.item === 'Air Balloon' && ABILITY_IMMUNITIES[this.dex.toID(set.ability)]?.includes('Ground')) {
					set.item = 'Leftovers';
				}
				this.recordFusion(plan);
				return set;
			} catch (err) {
				lastError = err;
			} finally {
				data.sets = original;
			}
		}
		if (lastError) throw lastError;
		// (no partner fits at all: an unfused Pokémon)
		this.usedSpecies.add(first.baseSpecies);
		return super.randomSet(first, teamDetails, isLead, isDoubles);
	}

	/** A fused Pokémon can use moves from both halves. */
	protected override pokeRogueMoves(species: Species): Set<ID> {
		const own = this.cachedMoves(species);
		const fusion = (species as AnyObject).fusion;
		if (!fusion) return own;
		return new Set([...own, ...this.cachedMoves(this.dex.species.get(fusion))]);
	}

	protected cachedMoves(species: Species): Set<ID> {
		let moves = this.learnableCache.get(species.id);
		if (!moves) {
			moves = super.pokeRogueMoves(species);
			this.learnableCache.set(species.id, moves);
		}
		return moves;
	}

	// ---------------------------------------------------
	// Choosing the partner
	// ---------------------------------------------------

	/** Random battle Pokémon that can be a fusion's second half, by base species. */
	protected partnerPool(): {[baseSpecies: string]: Species[]} {
		if (this.partnerPoolCache) return this.partnerPoolCache;
		const pool: {[baseSpecies: string]: Species[]} = {};
		for (const id of Object.keys(this.randomSets)) {
			const species = this.dex.species.get(id);
			if (!species.exists || !(species as AnyObject).pokeRogue) continue;
			// (as PokeRogue Fusion's validator: no form only reached in battle)
			if (species.battleOnly || species.isMega || species.isPrimal || species.name.endsWith('-Gmax')) continue;
			if (this.isTransformation(species)) continue;
			if (!this.fusionAbilities(species).length) continue;
			(pool[species.baseSpecies] ||= []).push(species);
		}
		this.partnerPoolCache = pool;
		return pool;
	}

	/** The abilities a Pokémon could give a fusion. */
	protected fusionAbilities(partner: Species): ID[] {
		return Object.values(partner.abilities).map(name => this.dex.toID(name)).filter((id, i, list) => {
			if (!id || id === 'noability' || list.indexOf(id) !== i) return false;
			if (NEVER_ABILITIES.has(id) || NO_FUSION_ABILITIES.has(id)) return false;
			if (!this.hasAllies && ALLY_ONLY_ABILITIES.has(id)) return false;
			return (this.dex.abilities.get(id).rating ?? 1) > 0;
		});
	}

	/** The fusion for this set: the best of a sample of partners, its ability and its move pool. */
	protected planFusion(
		first: Species, template: PokeRogueTemplate, teamDetails: RandomTeamsTypes.TeamDetails
	): FusionPlan | null {
		const ctx: FusionContext = {
			first,
			template,
			role: template.role,
			category: this.setCategory(template, first),
			passive: this.dex.toID((first as AnyObject).passive || ''),
			teamDetails,
			ownMoves: new Set(template.movepool.map(m => this.dex.toID(m))),
			firstLearnable: this.cachedMoves(first),
		};
		const pool = this.partnerPool();
		const bases = Object.keys(pool).filter(base => base !== first.baseSpecies && !this.usedSpecies.has(base));
		let best: PartnerScore | null = null;
		for (let i = 0; i < PARTNER_SAMPLE && bases.length; i++) {
			const partner = this.sample(pool[this.sampleNoReplace(bases)]);
			const result = this.scorePartner(ctx, partner);
			if (result && (!best || result.score > best.score)) best = result;
		}
		if (!best) return null;
		const {partner, fused, ability, learnable} = best;
		const fusedTemplate = this.fusionTemplate(ctx, partner, fused, ability, learnable);
		fusedTemplate.level = this.fusionLevel(ctx, partner, fused, ability);
		return {first, partner, fused, ability: this.dex.abilities.get(ability).name, template: fusedTemplate};
	}

	/** How good a fusion this partner makes (null: it can't make one). */
	protected scorePartner(ctx: FusionContext, partner: Species): PartnerScore | null {
		const {first, role, category} = ctx;
		const learnable = new Set([...ctx.firstLearnable, ...this.cachedMoves(partner)]);
		const draft = fuseSpecies(this.dex, first, partner);

		// the partner's best ability for this fusion
		let ability: ID | null = null;
		let abilityScore = -Infinity;
		const partnerAbilities = this.partnerSetAbilities(partner);
		for (const id of this.fusionAbilities(partner)) {
			const score = this.abilityScore(id, ctx, draft, learnable, partnerAbilities);
			if (score > abilityScore) {
				ability = id;
				abilityScore = score;
			}
		}
		if (!ability || abilityScore < 1) return null;
		const fused = fuseSpecies(this.dex, first, partner, this.dex.abilities.get(ability).name);
		const effects = [ability, ctx.passive].filter(Boolean) as ID[];

		let score = abilityScore;
		// a new type, with an attack of it to use
		const gained = fused.types.filter(type => !first.types.includes(type));
		score += gained.length ? 1.5 : -1;
		for (const type of gained) {
			if (!this.bestAttack(type, category, learnable, fused, effects)) score -= 1.5;
		}
		// weaknesses, also against the rest of the team
		let firstWeak = 0;
		let fusedWeak = 0;
		for (const type of this.dex.types.names()) {
			if (type === 'Stellar') continue;
			const before = this.typeEffect(type, first);
			const after = this.typeEffect(type, fused, ability);
			if (before > 0) firstWeak++;
			if (after > 0) {
				fusedWeak++;
				if (after > 1) score -= 2;
				if ((this.fusedWeaknesses[type] || 0) >= 3) score -= 2;
				if (after > 1 && this.fusedDoubleWeaknesses[type]) score -= 3;
			}
			if (after < -1 && before > -2) score += 0.75;
		}
		score += (firstWeak - fusedWeak) * 0.4;
		for (const type of fused.types) {
			if ((this.fusedTypeCount[type] || 0) >= 2) score -= 3;
		}
		// the stats the role needs
		const stat = category === 'Physical' ? 'atk' : 'spa';
		const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
		score += clamp((fused.baseStats[stat] - first.baseStats[stat]) / 12, -4, 2.5);
		if (/Fast|Sweeper|Wallbreaker/.test(role)) {
			score += clamp((fused.baseStats.spe - first.baseStats.spe) / 15, -3, 2);
		}
		if (/Bulky|Support|Staller|AV Pivot/.test(role)) {
			const bulk = (sp: Species) => sp.baseStats.hp + sp.baseStats.def + sp.baseStats.spd;
			score += clamp((bulk(fused) - bulk(first)) / 36, -3, 2);
		}
		// (some variety: the best of the sample isn't always the same partner)
		score += this.prng.random() * 4;
		return {partner, fused, ability, learnable, score};
	}

	/** Physical or special: what most of the set's attacks are. */
	protected setCategory(template: PokeRogueTemplate, species: Species): Category {
		let physical = 0;
		let special = 0;
		for (const name of template.movepool) {
			const move = this.dex.moves.get(name);
			if (move.category === 'Physical' && !['bodypress', 'foulplay'].includes(move.id)) physical++;
			if (move.category === 'Special') special++;
		}
		if (physical !== special) return physical > special ? 'Physical' : 'Special';
		return species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special';
	}

	/** Every ability the partner's own random battle sets use. */
	protected partnerSetAbilities(partner: Species): Set<ID> {
		const abilities = new Set<ID>();
		for (const set of this.randomSets[partner.id]?.sets || []) {
			for (const name of set.abilities || []) abilities.add(this.dex.toID(name));
		}
		return abilities;
	}

	/** Every move the partner's own random battle sets use. */
	protected partnerSetMoves(partner: Species): Set<ID> {
		const moves = new Set<ID>();
		for (const set of this.randomSets[partner.id]?.sets || []) {
			for (const name of set.movepool) moves.add(this.dex.toID(name));
		}
		return moves;
	}

	/** Effectiveness of a type against a Pokémon: -9 immune, else -2..2 (counting an ability's immunity). */
	protected typeEffect(type: string, species: Species, ability?: ID) {
		if (ability && ABILITY_IMMUNITIES[ability]?.includes(type)) return -9;
		if (!this.dex.getImmunity(type, species)) return -9;
		return this.dex.getEffectiveness(type, species);
	}

	protected hasWeather(weather: Weather, ctx: FusionContext) {
		if (weather === 'snow' ? ctx.teamDetails.snow || ctx.teamDetails.hail : ctx.teamDetails[weather]) return true;
		return WEATHER_SETTERS[ctx.passive] === weather;
	}

	// ---------------------------------------------------
	// The ability
	// ---------------------------------------------------

	/** How well an ability suits the fused Pokémon (its dex rating, adjusted). */
	protected abilityScore(
		id: ID, ctx: FusionContext, fused: Species, learnable: Set<ID>, partnerAbilities: Set<ID>
	): number {
		const {category, role, passive} = ctx;
		let score = this.dex.abilities.get(id).rating ?? 1;
		// (the random battle sets already chose it for the partner)
		if (partnerAbilities.has(id)) score += 1.5;
		// the passive already does it, or another Pokémon on the team has it
		if (id === passive) score -= 3;
		score -= 1.5 * (this.teamAbilities[id] || 0);
		if (PHYSICAL_ABILITIES.has(id) && category !== 'Physical') score -= 4;
		if (SPECIAL_ABILITIES.has(id) && category !== 'Special') score -= 4;
		const effects = [id, passive].filter(Boolean) as ID[];
		// abilities that boost one kind of move need a strong one of that kind
		if (MOVE_ABILITIES.includes(id) && !this.hasStrongMoveFor(id, learnable, category, fused, effects)) score -= 3;
		const boosted = TYPE_ABILITIES[id];
		if (boosted) {
			if (!this.bestAttack(boosted, category, learnable, fused, effects)) {
				score -= 3;
			} else if (fused.types.includes(boosted)) {
				score += 0.5;
			}
		}
		// weather
		const needs = WEATHER_ABILITIES[id];
		if (needs) score += this.hasWeather(needs, ctx) ? 2 : -4;
		const sets = WEATHER_SETTERS[id];
		if (sets) {
			if ((['sun', 'rain', 'sand', 'snow'] as Weather[]).some(w => w !== sets && this.hasWeather(w, ctx))) score -= 2.5;
			if (fused.types.includes(WEATHER_TYPES[sets])) score += 0.5;
			// sun halves Water attacks, rain Fire ones
			if ((sets === 'sun' && fused.types.includes('Water')) || (sets === 'rain' && fused.types.includes('Fire'))) {
				score -= 4;
			}
		}
		if (id === 'protosynthesis' || id === 'quarkdrive') {
			// only with Booster Energy (Fast Bulky Setup sets), sun or Electric Terrain
			const active = role === 'Fast Bulky Setup' || (id === 'protosynthesis' && this.hasWeather('sun', ctx)) ||
				(id === 'quarkdrive' && ['electricsurge', 'hadronengine'].includes(passive));
			if (!active) return 0.5;
		}
		if (id === 'prankster' && ![...ctx.ownMoves].some(m => this.dex.moves.get(m).category === 'Status')) score -= 4;
		if (id === 'unburden') score -= 1;
		// immunities that cover a weakness of the fused typing
		let covers = 0;
		for (const type of ABILITY_IMMUNITIES[id] || []) {
			const effect = this.typeEffect(type, fused);
			if (effect > 0) covers += effect > 1 ? 2 : 1;
		}
		score += Math.min(covers, 2.5);
		if ((id === 'dryskin' || id === 'fluffy') && this.typeEffect('Fire', fused) > 0) score -= 2;
		// what the role wants
		if (/Bulky|Support|Staller|AV Pivot/.test(role) && BULKY_ABILITIES.has(id)) score += 1;
		if (/Fast Attacker|Wallbreaker|Sweeper|Fast Bulky Setup/.test(role) && OFFENSIVE_ABILITIES.has(id)) score += 1;
		return score;
	}

	protected usableAttack(move: Move) {
		return move.exists && move.category !== 'Status' && !PASSIVE_MOVE_BANS.has(move.id) && !move.isZ && !move.isMax &&
			!move.id.startsWith('hiddenpower') && !this.noStab.includes(move.id);
	}

	/** Is there a strong move of the kind the ability boosts (Iron Fist: a strong punch)? */
	protected hasStrongMoveFor(id: ID, learnable: Set<ID>, category: Category, fused: Species, effects: ID[]) {
		for (const moveid of learnable) {
			const move = this.dex.moves.get(moveid);
			if (!this.usableAttack(move) || move.category !== category) continue;
			if (this.strongBoostedMove(id, move, fused, effects)) return true;
		}
		return false;
	}

	/** The strongest attack of a type (and category) out of a list of moves, if any is decent. */
	protected bestAttack(
		type: string, category: Category, moves: Iterable<ID>, fused: Species, effects: ID[], minPower = 60
	): Move | null {
		const ate = effects.find(e => ATE[e]);
		let best: Move | null = null;
		let bestPower = 0;
		for (const moveid of moves) {
			const move = this.dex.moves.get(moveid);
			if (!this.usableAttack(move) || move.category !== category) continue;
			const moveType = move.type === 'Normal' && ate ? ATE[ate] : move.type;
			if (moveType !== type || this.rawPower(move, effects) < minPower) continue;
			const power = this.passivePower(effects, move, fused);
			if (power > bestPower) {
				best = move;
				bestPower = power;
			}
		}
		return best;
	}

	// ---------------------------------------------------
	// The move pool and level
	// ---------------------------------------------------

	/** The set's template for the fused Pokémon: its own moves plus the partner's that fit. */
	protected fusionTemplate(
		ctx: FusionContext, partner: Species, fused: Species, ability: ID, learnable: Set<ID>
	): PokeRogueTemplate {
		const {template, role, category} = ctx;
		const effects = [ability, ctx.passive].filter(Boolean) as ID[];
		const required = new Set((template.required || []).map(m => this.dex.toID(m)));
		// moves that needed the first Pokémon's own ability
		const movepool = template.movepool.map(m => this.dex.toID(m)).filter(id => {
			const needs = ABILITY_MOVES[id];
			return !needs || required.has(id) || needs.some(a => effects.includes(a as ID));
		});
		const partnerMoves = this.partnerSetMoves(partner);
		const added: ID[] = [];
		const has = (id: ID) => movepool.includes(id) || added.includes(id);
		const add = (move: Move | null | undefined) => {
			if (!move?.exists || has(move.id) || added.length >= MAX_PARTNER_MOVES) return false;
			added.push(move.id);
			return true;
		};
		const ate = effects.find(e => ATE[e]);
		const typeOf = (move: Move) => (move.type === 'Normal' && ate) ? ATE[ate] : move.type;
		const pool = () => [...movepool, ...added].map(id => this.dex.moves.get(id));
		const attacks = () => pool().filter(m => m.category !== 'Status' && !this.noStab.includes(m.id));
		const extraRequired: ID[] = [];

		// 1. A strong attack of each fused type (the partner's own moves first)
		for (const type of fused.types) {
			if (attacks().some(m => m.category === category && typeOf(m) === type)) continue;
			const pick = this.bestAttack(type, category, partnerMoves, fused, effects) ||
				this.bestAttack(type, category, learnable, fused, effects, 70);
			// (the type the fusion gains: its attack is much of what the fusion is for)
			if (add(pick) && !ctx.first.types.includes(type) && required.size + extraRequired.length < 2) {
				extraRequired.push(pick!.id);
			}
		}
		// 2. Facade for Guts and the like, and the partner's priority attack (Aqua Jet,
		// Bullet Punch...) of a fused type
		if (category === 'Physical' && ABILITY_MOVES.facade.includes(ability) && learnable.has('facade' as ID)) {
			if (add(this.dex.moves.get('facade')) && required.size + extraRequired.length < 2) extraRequired.push('facade' as ID);
		}
		if (!attacks().some(m => m.priority > 0)) {
			const priority = [...partnerMoves].map(id => this.dex.moves.get(id)).filter(m => this.usableAttack(m) &&
				m.priority > 0 && m.category === category && fused.types.includes(typeOf(m)));
			if (priority.length) add(this.sample(priority));
		}
		// 3. What the role wants and the set has none of
		const status = (ids: string[], from: Iterable<ID>) => [...from].find(id => ids.includes(id));
		if (/Setup|Tera Blast/.test(role) && !pool().some(m => SETUP[category].includes(m.id))) {
			add(this.dex.moves.get(status(SETUP[category], partnerMoves) || ''));
		}
		if (/Bulky|Staller/.test(role) && !pool().some(m => RECOVERY.includes(m.id))) {
			add(this.dex.moves.get(status(RECOVERY, partnerMoves) || ''));
		}
		if (/Support/.test(role) && !pool().some(m => HAZARDS.includes(m.id))) {
			add(this.dex.moves.get(status(HAZARDS, partnerMoves) || ''));
		}
		if (/Fast Attacker|Fast Support|AV Pivot|Bulky Attacker/.test(role) && !pool().some(m => PIVOTS.includes(m.id))) {
			add(this.dex.moves.get(status(PIVOTS, partnerMoves) || ''));
		}
		// 4. The partner's best coverage attack of a type the pool doesn't have
		const types = new Set(attacks().map(typeOf));
		let coverage: Move | null = null;
		for (const id of partnerMoves) {
			const move = this.dex.moves.get(id);
			if (!this.usableAttack(move) || move.category !== category || types.has(typeOf(move))) continue;
			if (this.rawPower(move, effects) < 70) continue;
			if (!coverage || this.passivePower(effects, move, fused) > this.passivePower(effects, coverage, fused)) {
				coverage = move;
			}
		}
		add(coverage);

		const fusedTemplate: PokeRogueTemplate = {
			...template,
			movepool: [...movepool, ...added].map(id => this.dex.moves.get(id).name),
			abilities: [this.dex.abilities.get(ability).name],
			required: [...(template.required || []), ...extraRequired.map(id => this.dex.moves.get(id).name)],
		};
		// (a hand-written set's moves and ability were chosen for the Pokémon on its own)
		delete fusedTemplate.fixed;
		delete fusedTemplate.nature;
		return fusedTemplate;
	}

	/**
	 * The average of the two Pokémon's random battle levels, lower when the
	 * fusion's ability does more on it than on the partner.
	 */
	protected fusionLevel(ctx: FusionContext, partner: Species, fused: Species, ability: ID) {
		const {first, template} = ctx;
		let firstLevel = template.level ?? this.randomSets[first.id]?.level ?? 80;
		// it loses a drawback ability (Slaking's Truant)
		if ((template.abilities || []).every(a => DRAWBACK_ABILITIES.has(this.dex.toID(a)))) firstLevel -= 8;
		const partnerLevel = this.randomSets[partner.id]?.level ?? 80;
		let level = (firstLevel + partnerLevel) / 2;
		if (ability === 'hugepower' || ability === 'purepower') {
			level -= Math.max(0, (fused.baseStats.atk - partner.baseStats.atk) / 4);
		} else if (!this.partnerSetAbilities(partner).has(ability)) {
			// (the partner's level doesn't count this ability)
			level -= Math.max(0, (this.dex.abilities.get(ability).rating ?? 1) - 3) * 1.5;
		}
		level = Math.min(level, Math.max(firstLevel, partnerLevel));
		level = Math.max(level, Math.min(firstLevel, partnerLevel) - 6);
		return Math.max(60, Math.min(100, Math.round(level)));
	}

	/**
	 * An attacking set gets an attack of each fused type when its move pool
	 * has one: it takes the place of the weakest coverage attack, or of a
	 * second attack of a type the set already has (never a move the set is
	 * built around, a priority attack, or one kept for what it does, like
	 * U-turn).
	 */
	protected ensureFusedStab(set: RandomTeamsTypes.RandomSet, plan: FusionPlan) {
		const {first, fused, template} = plan;
		const effects = [this.dex.toID(plan.ability), this.dex.toID((fused as AnyObject).passive || '')].filter(Boolean) as ID[];
		const ate = effects.find(e => ATE[e]);
		const typeOf = (move: Move) => (move.type === 'Normal' && ate) ? ATE[ate] : move.type;
		const required = new Set((template.required || []).map(m => this.dex.toID(m)));
		const category = this.setCategory(template, first);
		const pool = template.movepool.map(m => this.dex.toID(m));
		for (const type of fused.types) {
			const moves = set.moves.map(m => this.dex.moves.get(m));
			const attacks = moves.filter(m => m.category !== 'Status');
			if (attacks.length < 2 || attacks.some(m => typeOf(m) === type)) continue;
			const option = this.bestAttack(type, category, pool.filter(id => !set.moves.includes(id)), fused, effects, 0);
			if (!option) continue;
			let worst = -1;
			for (const [i, move] of moves.entries()) {
				if (move.category === 'Status' || required.has(move.id) || KEEP_ATTACKS.has(move.id) || move.priority > 0) continue;
				// (Contrary's Superpower, Iron Fist's punch...)
				if (effects.some(e => MOVE_ABILITIES.includes(e) && this.strongBoostedMove(e, move, fused, effects))) continue;
				const sameType = attacks.filter(m => typeOf(m) === typeOf(move)).length;
				if (fused.types.includes(typeOf(move)) && sameType < 2) continue;
				if (worst < 0 || this.passivePower(effects, move, fused) < this.passivePower(effects, moves[worst], fused)) {
					worst = i;
				}
			}
			if (worst >= 0) set.moves[worst] = option.id;
		}
	}

	/** Counts the fusion's types and weaknesses for the rest of the team. */
	protected recordFusion(plan: FusionPlan) {
		const {first, partner, fused} = plan;
		const ability = this.dex.toID(plan.ability);
		this.teamAbilities[ability] = (this.teamAbilities[ability] || 0) + 1;
		this.usedSpecies.add(first.baseSpecies);
		this.usedSpecies.add(partner.baseSpecies);
		for (const type of fused.types) this.fusedTypeCount[type] = (this.fusedTypeCount[type] || 0) + 1;
		for (const type of this.dex.types.names()) {
			if (type === 'Stellar') continue;
			const effect = this.typeEffect(type, fused, ability);
			if (effect > 0) this.fusedWeaknesses[type] = (this.fusedWeaknesses[type] || 0) + 1;
			if (effect > 1) this.fusedDoubleWeaknesses[type] = (this.fusedDoubleWeaknesses[type] || 0) + 1;
		}
	}
}

export default PokeRogueFusionTeams;
