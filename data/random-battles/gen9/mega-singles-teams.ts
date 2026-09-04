import type { PRNG, PRNGSeed } from "../../../sim/prng";
import RandomGen9Teams from "./teams";
import {fixSetForMega} from "../mega-set-fixer";
import { toID } from '../../../sim/dex';

const fs = require('fs');
const path = require('path');

/*
 * false = add EVERY fully evolved Past Pokemon.
 *
 * If no official Smogon singles set exists, that Pokemon falls back
 * to its latest historical Random Battle data.
 *
 * Change to true if you ever want to completely exclude Pokemon
 * without an official Smogon singles set.
 */
const STRICT_SMOGON_ONLY = false;

/*
 * Normally an NFE Pokemon is only included if the downloaded Smogon
 * doubles database contains an actual doubles set for it.
 *
 * Pikachu is explicitly allowed regardless, and always gets Light Ball.
 */
const FORCED_COMPETITIVE_NFE = new Set([
	'pikachu',
]);

type SmogonImportedSet = {
	source?: string;
	setName?: string;

	moves?: any[];
	ability?: any;
	item?: any;
	nature?: any;
	evs?: any;
	ivs?: any;
	teratypes?: any;

	gender?: any;
	shiny?: any;
	happiness?: any;
};

type ImportedSetTable = Record<string, SmogonImportedSet[]>;

function readJSON(relativePath: string): any {
	const filename = path.resolve(process.cwd(), relativePath);

	try {
		return JSON.parse(fs.readFileSync(filename, 'utf8'));
	} catch {
		return null;
	}
}

const EXTRA_SINGLES_SETS: ImportedSetTable =
	readJSON(
		'data/random-battles/gen9ffa/extra-singles-sets.json'
	) || {};

/*
 * Historical Random Battle files are NOT our preferred movesets.
 *
 * They are used for:
 * - sensible RandBat levels for old Pokemon
 * - a fallback movepool for Pokemon for which Smogon never published
 *   a singles analysis
 */
const HISTORICAL_RANDOM_SETS: Record<string, any>[] = [];

for (const gen of [8, 7, 6, 5, 4, 3]) {
	const data = readJSON(
		`data/random-battles/gen${gen}/sets.json`
	);

	if (data) HISTORICAL_RANDOM_SETS.push(data);
}

export class MegaNationalDexRandomFFATeams extends RandomGen9Teams {
	megaStonesBySpecies: Record<string, string[]> = {};

	/*
	 * Species listed here use their imported Smogon singles set
	 * instead of the ordinary FFA randomSet algorithm.
	 */
	importedSpecies = new Set<string>();

	constructor(
		format: Format | string,
		prng: PRNG | PRNGSeed | null
	) {
		super(format, prng);

		/*
		 * Add:
		 *
		 * - every official Pokemon missing from Gen 9 (Past)
		 *   if fully evolved
		 *
		 * - NFEs only if Smogon has a doubles set for them
		 *   or they are explicitly whitelisted
		 */
		for (const species of this.dex.species.all()) {
			if (!this.shouldAddSpecies(species)) continue;

			if (EXTRA_SINGLES_SETS[species.id]?.length) {
				this.importedSpecies.add(species.id);
			}

			this.ensurePoolEntry(species);
		}

		/*
		 * Mega support.
		 *
		 * Read every actual Mega Stone from Showdown's item data,
		 * including old Megas and officially implemented Z-A Megas.
		 */
		for (const item of this.dex.items.all()) {
			if (!item.megaStone) continue;

			const megaEntries =
				Object.entries(item.megaStone) as [string, string][];

			for (const [baseName, megaName] of megaEntries) {
				const base = this.dex.species.get(baseName);
				const mega = this.dex.species.get(megaName);

				if (!base.exists || !mega.exists) continue;
				if (!mega.isMega) continue;
				if (base.num <= 0 || mega.num <= 0) continue;

				const megaAbility = mega.abilities['0'];

				// Ignore unfinished placeholder Mega data.
				if (
					!megaAbility ||
					megaAbility === 'No Ability' ||
					!this.dex.abilities.get(megaAbility).exists
				) {
					continue;
				}

				(
					this.megaStonesBySpecies[base.id] ??= []
				).push(item.name);

				/*
				 * Ensures newly Mega-capable Pokemon can enter the
				 * random pool even if normal Gen 9 FFA did not
				 * originally have a set for them.
				 */
				this.ensurePoolEntry(base);
			}
		}
	}

	private shouldAddSpecies(species: Species): boolean {
		if (!species.exists) return false;

		// Official Pokemon only.
		if (species.num <= 0) return false;

		// Mega/Primal/etc forms should never appear directly.
		if (species.battleOnly) return false;
		if (species.isMega) return false;

		const hasSmogonDoublesSet =
			!!EXTRA_SINGLES_SETS[species.id]?.length;

		/*
		 * Pre-evolutions only enter if they have evidence of actual
		 * competitive doubles usage via a Smogon set.
		 */
		if (species.nfe) {
			return (
				hasSmogonDoublesSet ||
				FORCED_COMPETITIVE_NFE.has(species.id)
			);
		}

		/*
		 * Fully evolved Pokemon absent from Scarlet/Violet are marked
		 * "Past" by Showdown.
		 */
		if (species.isNonstandard === 'Past') {
			if (STRICT_SMOGON_ONLY) {
				return hasSmogonDoublesSet;
			}

			return true;
		}

		return false;
	}

	private getHistoricalLevel(species: Species): number {
		for (const table of HISTORICAL_RANDOM_SETS) {
			const entry = table[species.id];

			if (
				entry &&
				typeof entry.level === 'number'
			) {
				return entry.level;
			}
		}

		/*
		 * Only reached for Pokemon with no historical RandBat entry.
		 * 84 is a reasonable neutral RandBat fallback.
		 */
		return 84;
	}

	private getHistoricalMovePool(species: Species): string[] {
		/*
		 * IMPORTANT:
		 * Never merge the movepools from several historical roles.
		 *
		 * Gen 9 Random Battles expects one curated role-specific
		 * movepool. Combining several roles can create combinations
		 * its move-culling code was never designed to process.
		 */
		for (const table of HISTORICAL_RANDOM_SETS) {
			const entry = table[species.id];

			if (!entry?.sets?.length) continue;

			const usablePools: string[][] = [];

			for (const set of entry.sets) {
				if (!Array.isArray(set.movepool)) continue;

				const pool: string[] = [];

				for (const moveName of set.movepool) {
					const move = this.dex.moves.get(moveName);

					if (!move.exists) continue;
					if (move.isZ || move.isMax) continue;

					if (
						move.isNonstandard &&
						move.isNonstandard !== 'Past'
					) {
						continue;
					}

					if (!pool.includes(move.id)) {
						pool.push(move.id);
					}
				}

				if (pool.length) {
					usablePools.push(pool);
				}
			}

			if (usablePools.length) {
				// Pick ONE historical role, never union them.
				return [...this.sample(usablePools)];
			}
		}

		return [];
	}

	private getGenericMovePool(species: Species): string[] {
		/*
		 * Smogon imported sets don't use this function.
		 *
		 * This is only the emergency fallback for a Pokemon for
		 * which we have no imported competitive set.
		 *
		 * The important rule is that we return at most four moves.
		 * That means Showdown never tries to run its complex
		 * RandBat move-culling algorithm on a giant raw learnset.
		 */
		let candidates = this.getHistoricalMovePool(species);

		if (!candidates.length) {
			candidates = [
				...this.dex.species.getMovePool(
					species.id,
					true
				),
			]
				.map(moveID => this.dex.moves.get(moveID))
				.filter(move =>
					move.exists &&
					!move.isZ &&
					!move.isMax &&
					(
						!move.isNonstandard ||
						move.isNonstandard === 'Past'
					)
				)
				.map(move => move.id);
		}

		candidates = [...new Set(candidates)];

		/*
		 * Some battle-only/form-changing Pokemon REQUIRE a move.
		 * randomMoveset() assumes this move exists in its movepool,
		 * so explicitly add it before reducing the pool.
		 */
		const requiredMove = species.requiredMove ?
			this.dex.moves.get(species.requiredMove).id :
			'';

		if (
			requiredMove &&
			!candidates.includes(requiredMove)
		) {
			candidates.unshift(requiredMove);
		}

		if (candidates.length <= this.maxMoveCount) {
			return candidates;
		}

		const chosen: string[] = [];

		const add = (moveID: string | undefined) => {
			if (!moveID) return;
			if (!candidates.includes(moveID)) return;
			if (chosen.includes(moveID)) return;
			if (chosen.length >= this.maxMoveCount) return;

			chosen.push(moveID);
		};

		// A required transformation/form move always comes first.
		add(requiredMove);

		const damagingMoves = candidates
			.map(moveID => this.dex.moves.get(moveID))
			.filter(move =>
				move.exists &&
				move.category !== 'Status' &&
				!!(move.basePower || move.basePowerCallback)
			);

		/*
		 * Prefer the attacking side matching the Pokemon's stats.
		 * This also makes the emergency fallback noticeably less
		 * likely to produce nonsense physical/special combinations.
		 */
		const preferredCategory =
			species.baseStats.atk >= species.baseStats.spa ?
				'Physical' :
				'Special';

		const moveScore = (move: Move) => {
			let score = move.basePower || 60;

			if (move.category === preferredCategory) {
				score += 35;
			}

			if (species.types.includes(move.type)) {
				score += 45;
			}

			if (move.priority > 0) {
				score += 10;
			}

			if (move.accuracy === true) {
				score += 5;
			} else if (
				typeof move.accuracy === 'number'
			) {
				score += Math.floor(move.accuracy / 20);
			}

			return score;
		};

		/*
		 * First try to provide one attacking move for each STAB type.
		 */
		for (const type of species.types) {
			const stab = damagingMoves
				.filter(move => move.type === type)
				.sort((a, b) =>
					moveScore(b) - moveScore(a)
				)[0];

			add(stab?.id);
		}

		/*
		 * Useful status/setup/recovery moves are preferable to
		 * grabbing four random attacks from a full learnset.
		 */
		const usefulUtility = [
			'recover',
			'roost',
			'slackoff',
			'softboiled',
			'morningsun',
			'moonlight',
			'synthesis',
			'strengthsap',
			'shoreup',
			'wish',

			'quiverdance',
			'shellsmash',
			'dragondance',
			'swordsdance',
			'nastyplot',
			'calmmind',
			'bulkup',
			'coil',
			'agility',

			'spore',
			'willowisp',
			'thunderwave',
			'toxic',

			'stealthrock',
			'stickyweb',
			'spikes',
			'toxicspikes',

			'rapidspin',
			'defog',

			'tailwind',
			'trickroom',

			'protect',
			'substitute',
			'taunt',
			'encore',
		];

		for (const moveID of usefulUtility) {
			if (chosen.length >= this.maxMoveCount) break;
			add(moveID);
		}

		/*
		 * Add the best remaining coverage/damaging attacks.
		 */
		for (
			const move of damagingMoves.sort(
				(a, b) => moveScore(b) - moveScore(a)
			)
		) {
			if (chosen.length >= this.maxMoveCount) break;
			add(move.id);
		}

		/*
		 * Last-resort fill. This should almost never be needed,
		 * but guarantees a usable pool.
		 */
		for (const moveID of candidates) {
			if (chosen.length >= this.maxMoveCount) break;
			add(moveID);
		}

		return chosen.slice(0, this.maxMoveCount);
	}


	private ensurePoolEntry(species: Species) {
		if (this.randomSets[species.id]) return;

		const movepool = this.getGenericMovePool(species);

		/*
		 * Some legal formes require a particular move.
		 *
		 * Showdown's randomMoveset() forcibly adds species.requiredMove.
		 * addMove() assumes that required move is already present in
		 * movePool, so synthetic National Dex fallback sets MUST include it.
		 */
		if (species.requiredMove) {
			const requiredMove = this.dex.moves.get(species.requiredMove);

			if (
				requiredMove.exists &&
				!movepool.some(
					move => this.dex.moves.get(move).id === requiredMove.id
				)
			) {
				movepool.push(requiredMove.name);
			}
		}

		if (!movepool.length) return;

		const abilities =
			Object.values(species.abilities)
				.filter((ability): ability is string => !!ability);

		if (!abilities.length) return;

		this.randomSets[species.id] = {
			level: this.getHistoricalLevel(species),

			sets: [
				{
					role: 'Fast Attacker',
					movepool,
					abilities,
					teraTypes: [...species.types],
				},
			],
		};
	}

	private pick(value: any): any {
		if (Array.isArray(value)) {
			if (!value.length) return undefined;
			return this.sample(value);
		}

		return value;
	}

	private resolveMoves(rawMoves: any[]): string[] {
		const selected: string[] = [];

		for (const slot of rawMoves.slice(0, 4)) {
			const options =
				Array.isArray(slot) ?
					[...slot] :
					[slot];

			this.prng.shuffle(options);

			let chosen: string | null = null;

			for (const option of options) {
				if (typeof option !== 'string') continue;

				const move = this.dex.moves.get(option);

				if (!move.exists) continue;
				if (move.isZ || move.isMax) continue;
				if (selected.includes(move.id)) continue;

				chosen = move.id;
				break;
			}

			if (chosen) selected.push(chosen);
		}

		return selected;
	}

	private makeStats(
		raw: any,
		defaultValue: number
	): StatsTable {
		const selected = this.pick(raw) || {};

		return {
			hp:
				typeof selected.hp === 'number' ?
					selected.hp :
					defaultValue,

			atk:
				typeof selected.atk === 'number' ?
					selected.atk :
					defaultValue,

			def:
				typeof selected.def === 'number' ?
					selected.def :
					defaultValue,

			spa:
				typeof selected.spa === 'number' ?
					selected.spa :
					defaultValue,

			spd:
				typeof selected.spd === 'number' ?
					selected.spd :
					defaultValue,

			spe:
				typeof selected.spe === 'number' ?
					selected.spe :
					defaultValue,
		};
	}

	private applySpecialItem(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): RandomTeamsTypes.RandomSet {
		/*
		 * Pikachu is intentionally a competitive NFE.
		 */
		if (species.id === 'pikachu') {
			set.item = 'Light Ball';
		}

		/*
		 * Mega-capable Pokemon get one compatible Mega Stone.
		 *
		 * Pokemon with multiple Megas (Charizard, Mewtwo, Lucario,
		 * Garchomp, etc.) randomly receive one compatible stone.
		 */
		const stones = this.megaStonesBySpecies[species.id];

		if (stones?.length) {
			set.item = this.sample(stones);
		}

		return set;
	}

	private importedRandomSet(
		species: Species
	): RandomTeamsTypes.RandomSet | null {
		const possibilities =
			EXTRA_SINGLES_SETS[species.id];

		if (!possibilities?.length) return null;

		const raw = this.sample(possibilities);

		if (!raw.moves?.length) return null;

		const moves = this.resolveMoves(raw.moves);

		if (!moves.length) return null;

		/*
		 * Resolve Smogon's slash options at random.
		 */
		const requestedAbility = this.pick(raw.ability);

		const legalAbilities =
			Object.values(species.abilities)
				.filter((ability): ability is string => !!ability);

		let ability = legalAbilities[0];

		if (typeof requestedAbility === 'string') {
			const actual =
				this.dex.abilities.get(requestedAbility);

			if (
				actual.exists &&
				legalAbilities.includes(actual.name)
			) {
				ability = actual.name;
			}
		}

		const requestedItem = this.pick(raw.item);

		let item = '';

		if (typeof requestedItem === 'string') {
			const actual =
				this.dex.items.get(requestedItem);

			if (actual.exists) item = actual.name;
		}

		const requestedNature = this.pick(raw.nature);

		let nature = 'Serious';

		if (typeof requestedNature === 'string') {
			const actual =
				this.dex.natures.get(requestedNature);

			if (actual.exists) nature = actual.name;
		}

		const requestedTera = this.pick(raw.teratypes);

		const teraType =
			typeof requestedTera === 'string' ?
				requestedTera :
				this.sample(species.types);

		const set: RandomTeamsTypes.RandomSet = {
			name: species.baseSpecies,
			species: species.name,

			gender:
				typeof this.pick(raw.gender) === 'string' ?
					this.pick(raw.gender) :
					species.gender,

			shiny:
				typeof raw.shiny === 'boolean' ?
					raw.shiny :
					this.randomChance(1, 1024),

			/*
			 * Keep RandBat-style level balancing rather than
			 * making imported Smogon sets Level 100.
			 */
			level: this.getHistoricalLevel(species),

			moves,
			ability,

			/*
			 * Smogon spreads are preserved exactly.
			 */
			evs: this.makeStats(raw.evs, 0),
			ivs: this.makeStats(raw.ivs, 31),

			item,
			nature,
			teraType,

			/*
			 * This role is only bookkeeping for the FFA generator;
			 * the actual moves/item/EVs above come from Smogon.
			 */
			role: 'Fast Attacker',
		};

		if (raw.happiness !== undefined) {
			const happiness = this.pick(raw.happiness);

			if (typeof happiness === 'number') {
				set.happiness = happiness;
			}
		}

		return set;
	}

	override randomSet(
		s: string | Species,
		teamDetails: RandomTeamsTypes.TeamDetails = {},
		isLead = false,
		isDoubles = false
	): RandomTeamsTypes.RandomSet {
		const species = this.dex.species.get(s);

		/*
		 * First generate the base Pokemon's normal set.
		 */
		let set: RandomTeamsTypes.RandomSet;

		if (this.importedSpecies.has(species.id)) {
			set =
				this.importedRandomSet(species) ??
				super.randomSet(
					species,
					teamDetails,
					isLead,
					isDoubles
				);
		} else {
			set = super.randomSet(
				species,
				teamDetails,
				isLead,
				isDoubles
			);
		}

		/*
		 * Competitive NFE exception.
		 */
		if (species.id === 'pikachu') {
			set.item = 'Light Ball';
		}

		const stones =
			this.megaStonesBySpecies[species.id];

		if (!stones?.length) return set;

		/*
		 * IMPORTANT:
		 *
		 * We choose the Mega Stone BEFORE finalising the
		 * moveset. This prevents situations such as:
		 *
		 * special Charizard + Charizardite X.
		 */
		const stone = this.sample(stones);
		const item = this.dex.items.get(stone);

		const megaName =
			item.megaStone?.[species.baseSpecies] ??
			item.megaStone?.[species.name];

		if (!megaName) {
			set.item = stone;
			return set;
		}

		const mega = this.dex.species.get(megaName);

		if (!mega.exists) {
			set.item = stone;
			return set;
		}

		return fixSetForMega({
			dex: this.dex,
			base: species,
			mega,
			stone,
			set,
			sourceSets: EXTRA_SINGLES_SETS,
			sample: <T>(values: T[]) =>
				this.sample(values),
			isDoublesStyle: false,
		});
	}
}

export default MegaNationalDexRandomFFATeams;
