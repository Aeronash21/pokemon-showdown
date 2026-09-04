import type { PRNG, PRNGSeed } from "../../../sim/prng";
import RandomFFATeams from "./teams";

const fs = require('fs');
const path = require('path');

/*
 * false = add EVERY fully evolved Past Pokemon.
 *
 * If no official Smogon doubles set exists, that Pokemon falls back
 * to its latest historical Random Battle data.
 *
 * Change to true if you ever want to completely exclude Pokemon
 * without an official Smogon doubles set.
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

const EXTRA_DOUBLES_SETS: ImportedSetTable =
	readJSON(
		'data/random-battles/gen9ffa/extra-doubles-sets.json'
	) || {};

/*
 * Historical Random Battle files are NOT our preferred movesets.
 *
 * They are used for:
 * - sensible RandBat levels for old Pokemon
 * - a fallback movepool for Pokemon for which Smogon never published
 *   a doubles analysis
 */
const HISTORICAL_RANDOM_SETS: Record<string, any>[] = [];

for (const gen of [8, 7, 6, 5, 4, 3]) {
	const data = readJSON(
		`data/random-battles/gen${gen}/sets.json`
	);

	if (data) HISTORICAL_RANDOM_SETS.push(data);
}

export class MegaNationalDexRandomFFATeams extends RandomFFATeams {
	megaStonesBySpecies: Record<string, string[]> = {};

	/*
	 * Species listed here use their imported Smogon doubles set
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

			if (EXTRA_DOUBLES_SETS[species.id]?.length) {
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
			!!EXTRA_DOUBLES_SETS[species.id]?.length;

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
		for (const table of HISTORICAL_RANDOM_SETS) {
			const entry = table[species.id];

			if (!entry?.sets?.length) continue;

			const result: string[] = [];

			for (const set of entry.sets) {
				for (const moveName of set.movepool || []) {
					const move = this.dex.moves.get(moveName);

					if (!move.exists) continue;
					if (move.isZ || move.isMax) continue;

					if (!result.includes(move.name)) {
						result.push(move.name);
					}
				}
			}

			if (result.length >= 4) return result;
		}

		return [];
	}

	private getGenericMovePool(species: Species): string[] {
		let result = this.getHistoricalMovePool(species);

		if (result.length >= 4) return result;

		result = [];

		for (
			const moveID of this.dex.species.getMovePool(species.id)
		) {
			const move = this.dex.moves.get(moveID);

			if (!move.exists) continue;
			if (move.isZ || move.isMax) continue;

			/*
			 * National Dex permits Past moves, but don't pull in
			 * Future/unreleased/nonstandard nonsense.
			 */
			if (
				move.isNonstandard &&
				move.isNonstandard !== 'Past'
			) {
				continue;
			}

			if (!result.includes(move.name)) {
				result.push(move.name);
			}
		}

		return result;
	}

	private ensurePoolEntry(species: Species) {
		if (this.randomSets[species.id]) return;

		const movepool = this.getGenericMovePool(species);

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
			EXTRA_DOUBLES_SETS[species.id];

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
		 * Imported Past / competitive-NFE Pokemon use an actual
		 * Smogon doubles set.
		 */
		if (this.importedSpecies.has(species.id)) {
			const imported =
				this.importedRandomSet(species);

			if (imported) {
				return this.applySpecialItem(
					species,
					imported
				);
			}
		}

		/*
		 * Native Gen 9 FFA Pokemon and the rare no-Smogon-set
		 * fallback still use Showdown's normal FFA set generator.
		 */
		const set = super.randomSet(
			species,
			teamDetails,
			isLead,
			isDoubles
		);

		return this.applySpecialItem(species, set);
	}
}

export default MegaNationalDexRandomFFATeams;
