import { toID } from '../../sim/dex';
const LEGACY_MEGA_SETS =
	require('./gen7/sets.json') as Record<string, any>;

type Sampler = <T>(values: T[]) => T;

function flattenOptions(value: any): string[] {
	if (value === undefined || value === null) return [];

	if (Array.isArray(value)) {
		return value.flatMap(flattenOptions);
	}

	return typeof value === 'string' ? [value] : [];
}

function rawSetUsesStone(raw: any, stone: string): boolean {
	return flattenOptions(raw.item)
		.some(item => toID(item) === toID(stone));
}

function resolveRawMoves(
	dex: any,
	rawMoves: any[],
	sample: Sampler
): string[] {
	const result: string[] = [];

	for (const slot of rawMoves.slice(0, 4)) {
		const choices = flattenOptions(slot)
			.map(move => dex.moves.get(move))
			.filter((move: any) =>
				move.exists &&
				!move.isZ &&
				!move.isMax
			);

		if (!choices.length) continue;

		const move = sample(choices);

		if (!result.includes(move.id)) {
			result.push(move.id);
		}
	}

	return result;
}

function normalizeStats(
	raw: any,
	defaultValue: number
) {
	const value = Array.isArray(raw) ? raw[0] : raw || {};

	return {
		hp: typeof value.hp === 'number' ? value.hp : defaultValue,
		atk: typeof value.atk === 'number' ? value.atk : defaultValue,
		def: typeof value.def === 'number' ? value.def : defaultValue,
		spa: typeof value.spa === 'number' ? value.spa : defaultValue,
		spd: typeof value.spd === 'number' ? value.spd : defaultValue,
		spe: typeof value.spe === 'number' ? value.spe : defaultValue,
	};
}

function chooseBaseAbility(
	base: any,
	currentAbility: string
): string {
	const legal = Object.values(base.abilities)
		.filter(Boolean) as string[];

	if (
		legal.some(
			ability => toID(ability) === toID(currentAbility)
		)
	) {
		return currentAbility;
	}

	return legal[0] || currentAbility;
}

function applyCurrentSmogonMegaSet(
	dex: any,
	base: any,
	stone: string,
	set: any,
	sourceSets: Record<string, any[]>,
	sample: Sampler
): boolean {
	const candidates = (sourceSets[base.id] || [])
		.filter(raw => rawSetUsesStone(raw, stone));

	if (!candidates.length) return false;

	const raw = sample(candidates);

	const moves = resolveRawMoves(
		dex,
		raw.moves || [],
		sample
	);

	if (moves.length >= 4) {
		set.moves = moves.slice(0, 4);
	}

	const natureOptions = flattenOptions(raw.nature);

	if (natureOptions.length) {
		const nature = dex.natures.get(sample(natureOptions));
		if (nature.exists) set.nature = nature.name;
	}

	if (raw.evs) {
		set.evs = normalizeStats(raw.evs, 0);
	}

	if (raw.ivs) {
		set.ivs = normalizeStats(raw.ivs, 31);
	}

	const teraOptions = flattenOptions(
		raw.teratypes ?? raw.teraType
	);

	if (teraOptions.length) {
		set.teraType = sample(teraOptions);
	}

	set.item = stone;
	set.ability = chooseBaseAbility(base, set.ability);

	return true;
}

function applyLegacyMegaSet(
	dex: any,
	base: any,
	mega: any,
	stone: string,
	set: any,
	sample: Sampler
): boolean {
	const entry = LEGACY_MEGA_SETS[mega.id];

	if (!entry?.sets?.length) return false;

	const legacy = sample(entry.sets);
	const pool = [...new Set(legacy.movepool || [])] as string[];

	const valid = pool
		.map(move => dex.moves.get(move))
		.filter((move: any) =>
			move.exists &&
			!move.isZ &&
			!move.isMax
		);

	if (valid.length < 4) return false;

	/*
	 * Historical Showdown already separated the Mega forms.
	 * e.g. Charizard-Mega-X has DD / Flare Blitz / Dragon Claw,
	 * whereas Charizard-Mega-Y has Fire Blast / Solar Beam.
	 */
	const status = valid.filter(
		(move: any) => move.category === 'Status'
	);

	const attacks = valid.filter(
		(move: any) => move.category !== 'Status'
	);

	const selected: any[] = [];

	if (status.length) selected.push(sample(status));

	while (selected.length < 4 && attacks.length) {
		const move = sample(attacks);
		const index = attacks.indexOf(move);
		attacks.splice(index, 1);

		if (!selected.some(m => m.id === move.id)) {
			selected.push(move);
		}
	}

	while (selected.length < 4 && status.length) {
		const move = sample(status);
		const index = status.indexOf(move);
		status.splice(index, 1);

		if (!selected.some(m => m.id === move.id)) {
			selected.push(move);
		}
	}

	if (selected.length < 4) return false;

	set.moves = selected.slice(0, 4).map(move => move.id);
	set.item = stone;
	set.ability = chooseBaseAbility(base, set.ability);

	tuneOffensiveSpread(dex, mega, set);

	return true;
}

function offensiveBias(mega: any): 'physical' | 'special' | 'mixed' {
	const atk = mega.baseStats.atk;
	const spa = mega.baseStats.spa;

	if (atk >= spa + 15) return 'physical';
	if (spa >= atk + 15) return 'special';

	return 'mixed';
}

function moveScore(
	move: any,
	mega: any,
	bias: 'physical' | 'special' | 'mixed'
): number {
	if (move.category === 'Status') return -9999;
	if (!move.basePower) return -9999;

	if (
		bias === 'physical' &&
		move.category !== 'Physical'
	) return -9999;

	if (
		bias === 'special' &&
		move.category !== 'Special'
	) return -9999;

	let score = move.basePower;

	if (mega.types.includes(move.type)) {
		score += 45;
	}

	const ability = toID(mega.abilities['0']);

	// Ability-driven move selection.
	if (
		ability === 'toughclaws' &&
		move.flags?.contact
	) score += 40;

	if (
		ability === 'strongjaw' &&
		move.flags?.bite
	) score += 45;

	if (
		ability === 'sharpness' &&
		move.flags?.slicing
	) score += 45;

	if (
		ability === 'megalauncher' &&
		move.flags?.pulse
	) score += 45;

	if (
		ability === 'ironfist' &&
		move.flags?.punch
	) score += 30;

	if (
		ability === 'piercingdrill' &&
		move.flags?.contact
	) score += 25;

	if (
		[
			'aerilate',
			'pixilate',
			'refrigerate',
			'galvanize',
			'dragonize',
		].includes(ability) &&
		move.type === 'Normal'
	) score += 55;

	if (
		ability === 'adaptability' &&
		mega.types.includes(move.type)
	) score += 30;

	if (
		ability === 'technician' &&
		move.basePower <= 60
	) score += 30;

	if (
		ability === 'noguard' &&
		move.accuracy !== true &&
		typeof move.accuracy === 'number' &&
		move.accuracy < 90
	) score += 30;

	if (ability === 'megasol') {
		if (move.id === 'solarbeam') score += 100;
		if (move.id === 'weatherball') score += 90;
		if (move.type === 'Fire') score += 30;
	}

	if (
		move.accuracy !== true &&
		typeof move.accuracy === 'number'
	) {
		score += move.accuracy / 10;
	}

	return score;
}

function bestStatusMoves(
	dex: any,
	base: any,
	mega: any,
	isDoublesStyle: boolean
): any[] {
	const pool = [...dex.species.getMovePool(base.id)]
		.map((id: string) => dex.moves.get(id))
		.filter((move: any) =>
			move.exists &&
			move.category === 'Status'
		);

	const ability = toID(mega.abilities['0']);
	const bias = offensiveBias(mega);

	const priority: Record<string, number> = {
		protect: isDoublesStyle ? 200 : 40,

		dragondance:
			bias === 'physical' ? 180 : 20,

		swordsdance:
			bias === 'physical' ? 170 : 20,

		bulkup:
			bias === 'physical' ? 140 : 30,

		nastyplot:
			bias === 'special' ? 170 : 20,

		calmmind:
			bias === 'special' ? 150 : 40,

		quiverdance:
			bias === 'special' ? 190 : 80,

		shellsmash: 200,
		agility: 100,
		rockpolish: 100,

		roost: 110,
		recover: 110,
		slackoff: 110,
		synthesis: ability === 'megasol' ? 170 : 105,
		morningsun: ability === 'megasol' ? 170 : 105,

		stealthrock: 55,
		taunt: 55,
		willowisp: 50,
		thunderwave: 50,
	};

	return pool
		.filter((move: any) => priority[move.id])
		.sort(
			(a: any, b: any) =>
				priority[b.id] - priority[a.id]
		);
}

function tuneOffensiveSpread(
	dex: any,
	mega: any,
	set: any
) {
	const bias = offensiveBias(mega);

	if (bias === 'physical') {
		set.evs = {
			hp: 0,
			atk: 252,
			def: 0,
			spa: 0,
			spd: 4,
			spe: 252,
		};

		set.ivs = {
			hp: 31,
			atk: 31,
			def: 31,
			spa: 31,
			spd: 31,
			spe: 31,
		};

		set.nature =
			mega.baseStats.spe >= 100 ?
				'Jolly' :
				'Adamant';
	}

	if (bias === 'special') {
		set.evs = {
			hp: 0,
			atk: 0,
			def: 0,
			spa: 252,
			spd: 4,
			spe: 252,
		};

		set.ivs = {
			hp: 31,
			atk: 0,
			def: 31,
			spa: 31,
			spd: 31,
			spe: 31,
		};

		set.nature =
			mega.baseStats.spe >= 100 ?
				'Timid' :
				'Modest';
	}
}

function applyMegaStatAbilityFallback(
	dex: any,
	base: any,
	mega: any,
	stone: string,
	set: any,
	isDoublesStyle: boolean
): void {
	const bias = offensiveBias(mega);

	const allMoves = [...dex.species.getMovePool(base.id)]
		.map((id: string) => dex.moves.get(id))
		.filter((move: any) =>
			move.exists &&
			!move.isZ &&
			!move.isMax
		);

	const attacks = allMoves
		.filter(
			(move: any) =>
				move.category !== 'Status'
		)
		.map((move: any) => ({
			move,
			score: moveScore(move, mega, bias),
		}))
		.filter((entry: any) => entry.score > -9000)
		.sort(
			(a: any, b: any) =>
				b.score - a.score
		);

	const statuses = bestStatusMoves(
		dex,
		base,
		mega,
		isDoublesStyle
	);

	const chosen: any[] = [];

	/*
	 * Usually 3 attacks + one setup/support move.
	 * In doubles, Protect gets very high priority.
	 */
	if (statuses.length) {
		chosen.push(statuses[0]);
	}

	for (const entry of attacks) {
		if (chosen.length >= 4) break;

		if (
			!chosen.some(
				move => move.id === entry.move.id
			)
		) {
			chosen.push(entry.move);
		}
	}

	/*
	 * If we still don't have four, use the next useful
	 * status moves.
	 */
	for (const move of statuses.slice(1)) {
		if (chosen.length >= 4) break;

		if (
			!chosen.some(
				current => current.id === move.id
			)
		) {
			chosen.push(move);
		}
	}

	if (chosen.length >= 4) {
		set.moves = chosen
			.slice(0, 4)
			.map(move => move.id);
	}

	set.item = stone;
	set.ability = chooseBaseAbility(base, set.ability);

	tuneOffensiveSpread(dex, mega, set);
}

export function fixSetForMega(options: {
	dex: any;
	base: any;
	mega: any;
	stone: string;
	set: any;
	sourceSets: Record<string, any[]>;
	sample: Sampler;
	isDoublesStyle: boolean;
}) {
	const {
		dex,
		base,
		mega,
		stone,
		set,
		sourceSets,
		sample,
		isDoublesStyle,
	} = options;

	/*
	 * Priority 1:
	 * Current Smogon set specifically carrying THIS stone.
	 */
	if (
		applyCurrentSmogonMegaSet(
			dex,
			base,
			stone,
			set,
			sourceSets,
			sample
		)
	) {
		return set;
	}

	/*
	 * Priority 2:
	 * Old official Showdown Mega-specific RandBat set.
	 * This catches essentially all classic Megas.
	 */
	if (
		applyLegacyMegaSet(
			dex,
			base,
			mega,
			stone,
			set,
			sample
		)
	) {
		return set;
	}

	/*
	 * Priority 3:
	 * New Z-A / Champions Mega with no historical set.
	 *
	 * Build from the actual Mega's:
	 * - Attack vs Sp. Atk
	 * - typing
	 * - Ability
	 * - learnset
	 */
	applyMegaStatAbilityFallback(
		dex,
		base,
		mega,
		stone,
		set,
		isDoublesStyle
	);

	return set;
}
