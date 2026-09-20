// National Dex Shared Power custom formats

const NDSP_STANDARD_BANNED_ABILITIES = new Set([
	'shadowtag',
	'arenatrap',
	'simple',
	'moody',
]);

function ndspIsAG(battle: any) {
	return battle.format.id === 'gen9ndsharedpowerag';
}

function ndspAlliance(side: any): any[] {
	if (
		side.battle.gameType === 'multi' &&
		side.allySide
	) {
		return [side, side.allySide];
	}

	return [side];
}

function ndspPool(side: any): Set<string> {
	let root = side;

	if (
		side.battle.gameType === 'multi' &&
		side.allySide &&
		side.allySide.n < side.n
	) {
		root = side.allySide;
	}

	const memory = root as any;

	if (!memory.ndspAbilityPool) {
		memory.ndspAbilityPool = new Set<string>();
	}

	const pool = memory.ndspAbilityPool as Set<string>;

	for (const allySide of ndspAlliance(side)) {
		(allySide as any).ndspAbilityPool = pool;
	}

	return pool;
}

function ndspAbilityAllowed(
	battle: any,
	ability: string
): boolean {
	if (!ability || ability === 'noability') {
		return false;
	}

	if (ndspIsAG(battle)) {
		return true;
	}

	return !NDSP_STANDARD_BANNED_ABILITIES.has(ability);
}

function ndspApplyPool(
	battle: any,
	pokemon: any,
	pool: Set<string>
) {
	const memory = pokemon.m as any;

	const previousManaged =
		new Set<string>(
			memory.ndspManagedAbilities || []
		);

	const desired =
		new Set<string>();

	for (const ability of pool) {
		if (
			!ndspAbilityAllowed(
				battle,
				ability
			)
		) {
			continue;
		}

		/*
		 * Don't duplicate the Pokémon's own ability as a
		 * Shared Power volatile.
		 */
		if (
			ability === pokemon.ability ||
			ability === pokemon.baseAbility
		) {
			continue;
		}

		desired.add(
			`ability:${ability}`
		);
	}

	/*
	 * Remove only stale volatiles that NDSP itself managed.
	 * Never touch unrelated volatile effects.
	 */
	for (const effect of previousManaged) {
		if (desired.has(effect)) continue;

		if (pokemon.volatiles[effect]) {
			delete pokemon.volatiles[effect];
		}
	}

	/*
	 * Preserve any m.abils entries not owned by NDSP, then
	 * reconstruct every permanent NDSP shared ability.
	 *
	 * This is crucial for Neutralizing Gas restoration.
	 */
	const preserved =
		Array.isArray(memory.abils) ?
			memory.abils.filter(
				(effect: string) =>
					!previousManaged.has(effect)
			) :
			[];

	memory.abils = [
		...new Set([
			...preserved,
			...desired,
		]),
	];

	/*
	 * Recreate missing active ability volatiles.
	 *
	 * This intentionally mirrors Shared Power's direct
	 * volatile-state restoration style instead of relying
	 * on a fresh switch-in.
	 */
	for (const effect of desired) {
		if (!pokemon.volatiles[effect]) {
			pokemon.volatiles[effect] =
				battle.initEffectState({
					id: effect as ID,
					target: pokemon,
				});
		}
	}

	memory.ndspManagedAbilities =
		Array.from(desired);
}

function ndspSyncAlliance(
	battle: any,
	side: any
) {
	const pool = ndspPool(side);

	for (const allySide of ndspAlliance(side)) {
		for (const pokemon of allySide.active) {
			if (!pokemon) continue;

			ndspApplyPool(
				battle,
				pokemon,
				pool
			);
		}
	}
}

function ndspUnlock(
	battle: any,
	pokemon: any
) {
	const ability =
		pokemon.baseAbility ||
		pokemon.ability;

	const memory =
		pokemon.m as any;

	if (
		!Array.isArray(
			memory.ndspUnlockedAbilities
		)
	) {
		memory.ndspUnlockedAbilities = [];
	}

	if (
		ability &&
		ndspAbilityAllowed(
			battle,
			ability
		) &&
		!memory.ndspUnlockedAbilities
			.includes(ability)
	) {
		memory.ndspUnlockedAbilities
			.push(ability);
	}

	const pool =
		ndspPool(pokemon.side);

	/*
	 * Restore this Pokémon's entire historical contribution,
	 * not merely its current ability.
	 *
	 * This means:
	 *
	 * base ability
	 * + later Mega ability
	 *
	 * can both survive switches/faints.
	 */
	for (
		const unlocked of
			memory.ndspUnlockedAbilities
	) {
		if (
			ndspAbilityAllowed(
				battle,
				unlocked
			)
		) {
			pool.add(unlocked);
		}
	}

	ndspSyncAlliance(
		battle,
		pokemon.side
	);
}

/*
 * Gen 9 normally suppresses Dynamax in Side.canDynamaxNow().
 * NDSP deliberately enables it.
 *
 * Multi preserves the official Gen 8 alternating-partner
 * Dynamax opportunity, and each two-player alliance gets
 * only one Dynamax total.
 */
const dynamaxSide = {
	canDynamaxNow(this: any) {
		if (this.dynamaxUsed) {
			return false;
		}

		if (
			this.allySide &&
			this.allySide.dynamaxUsed
		) {
			return false;
		}

		if (
			this.battle.gameType === 'multi' &&
			this.battle.turn % 2 !==
				[1, 1, 0, 0][this.n]
		) {
			return false;
		}

		return true;
	},
};

function ndspBegin(this: any) {
	/*
	 * Gen 9 normally initializes dynamaxUsed=true.
	 */
	for (const side of this.sides) {
		side.dynamaxUsed = false;
		delete (side as any).ndspAbilityPool;
	}

	/*
	 * Initialize shared alliance pools.
	 */
	for (const side of this.sides) {
		ndspPool(side);
	}

	this.add(
		'rule',
		'Persistent Shared Power: Abilities remain shared after their original user leaves the field or faints'
	);

	this.add(
		'rule',
		'Dynamax / Tera Exclusivity: A Pokémon that uses one cannot use the other'
	);

	if (!ndspIsAG(this)) {
		this.add(
			'rule',
			'Huge Power + Pure Power do not stack'
		);
	}
}

function ndspBeforeSwitchIn(
	this: any,
	pokemon: any
) {
	ndspUnlock(this, pokemon);
}

function ndspSwitchIn(
	this: any,
	pokemon: any
) {
	/*
	 * Run again after switch-in transformations/ability
	 * changes, which is especially useful in AG.
	 */
	ndspUnlock(this, pokemon);
}

function ndspAfterMega(
	this: any,
	pokemon: any
) {
	/*
	 * The new Mega ability is added to the permanent pool.
	 * The old ability deliberately stays in the pool.
	 */
	ndspUnlock(this, pokemon);
}


/*
 * ===========================================================
 * NDSP PERMANENT POOL REPAIR
 * ===========================================================
 *
 * side.ndspAbilityPool is the main source of truth.
 *
 * pokemon.m.ndspUnlockedAbilities is the backup history.
 *
 * If a volatile or m.abils entry disappears due to
 * Neutralizing Gas, transformation, switching, fainting, or
 * another battle-state transition, rebuild it.
 */
function ndspRepairAll(this: any) {
	const seenPools =
		new Set<Set<string>>();

	for (const side of this.sides) {
		const pool =
			ndspPool(side);

		if (seenPools.has(pool)) {
			continue;
		}

		seenPools.add(pool);

		/*
		 * Rebuild the side pool from every Pokémon that has
		 * previously contributed an ability.
		 */
		for (
			const allySide of
				ndspAlliance(side)
		) {
			for (
				const pokemon of
					allySide.pokemon
			) {
				const memory =
					pokemon.m as any;

				for (
					const ability of
						memory
							.ndspUnlockedAbilities ||
						[]
				) {
					if (
						ndspAbilityAllowed(
							this,
							ability
						)
					) {
						pool.add(ability);
					}
				}

				/*
				 * Extra recovery path for a Pokémon that
				 * switched in before its history field was
				 * initialized.
				 */
				if (
					pokemon.previouslySwitchedIn >
						0
				) {
					const ability =
						pokemon.baseAbility ||
						pokemon.ability;

					if (
						ability &&
						ndspAbilityAllowed(
							this,
							ability
						)
					) {
						pool.add(
							ability
						);
					}
				}
			}
		}

		ndspSyncAlliance(
			this,
			side
		);
	}
}

function ndspAfterTerastallization(
	this: any,
	pokemon: any
) {
	ndspUnlock(
		this,
		pokemon
	);

	ndspRepairAll.call(this);
}

const ndspHooks = {
	side: dynamaxSide,
	onBegin: ndspBegin,
	onBeforeSwitchIn: ndspBeforeSwitchIn,
	onSwitchIn: ndspSwitchIn,
	onAfterMega: ndspAfterMega,

	onBeforeTurn: ndspRepairAll,
	onAfterMove: ndspRepairAll,
	onAfterFaint: ndspRepairAll,
	onAfterTerastallization: ndspAfterTerastallization,
};

export const Formats: import('../sim/dex-formats').FormatList = [
	{
		section: 'ND Shared Power',
		column: 1,
	},

	// ========================================================
	// NORMAL SINGLES
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power RandBats',

		desc:
			'National Dex Random Battle with persistent Shared Power. Bring 12, pick 6.',

		mod: 'ndsharedpower',
		team: 'random',

		rated: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndspHooks,
	},

	// ========================================================
	// FREE-FOR-ALL
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power FFA',

		desc:
			'Four-player National Dex Shared Power Random Battle. Bring 12, pick 6.',

		mod: 'ndsharedpower',
		team: 'random',
		gameType: 'freeforall',

		rated: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndspHooks,
	},

	// ========================================================
	// 2v2 MULTI
	//
	// Four human players:
	//
	//   p1 + p3
	//      vs
	//   p2 + p4
	//
	// Each player controls exactly one active Pokémon.
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power 2v2',

		desc:
			'Four-player 2v2 Multi Battle. Two human players share each team; every player controls one active Pokémon.',

		mod: 'ndsharedpower',
		team: 'random',
		gameType: 'multi',

		rated: false,
		searchShow: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Max Team Size = 3',
		],

		...ndspHooks,
	},

	// ========================================================
	// ANYTHING GOES
	//
	// No NDSP Standard Bans.
	// No Obtainable rule.
	// No Species Clause.
	//
	// Engine/mechanics fixes still apply.
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power AG',

		desc:
			'Unrestricted National Dex Shared Power. No NDSP bans; bug fixes and Shared Power mechanics remain active.',

		mod: 'ndsharedpower',

		debug: true,
		rated: false,

		ruleset: [
			'Team Preview',
			'HP Percentage Mod',
			'Cancel Mod',
			'Max Team Size = 24',
			'Max Move Count = 24',
			'Max Level = 9999',
			'Default Level = 100',
		],

		...ndspHooks,
	},

	// ========================================================
	// RANDOM MONOTYPE SINGLES
	// ========================================================

	{
		name:
			'[Gen 9] ND Shared Power Monotype RandBats',

		desc:
			'Random National Dex Shared Power where all Pokémon on a generated team share a type.',

		mod: 'ndsharedpower',
		team: 'random',

		rated: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Same Type Clause',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndspHooks,
	},

	// ========================================================
	// RANDOM MONOTYPE FFA
	// ========================================================

	{
		name:
			'[Gen 9] ND Shared Power Monotype FFA',

		desc:
			'Four-player random Monotype National Dex Shared Power. Each player receives a team sharing one type.',

		mod: 'ndsharedpower',
		team: 'random',
		gameType: 'freeforall',

		rated: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Same Type Clause',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndspHooks,
	},


	// ========================================================
	// 2v2 MULTI - BRING 12 PICK 6
	//
	// Each of the four human players:
	//   receives 12 random Pokemon
	//   chooses 6 at Team Preview
	//   controls one active Pokemon at a time
	//
	// p1 + p3 vs p2 + p4
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power 2v2 B12P6',

		desc:
			'Four-player 2v2 Shared Power Multi Battle. Each player receives 12 random Pokemon and picks 6.',

		mod: 'ndsharedpower',
		team: 'random',
		gameType: 'multi',

		rated: false,
		searchShow: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndspHooks,
	},

	// ========================================================
	// 2v2 MULTI - BRING 6 PICK 3
	//
	// Each of the four human players:
	//   receives 6 random Pokemon
	//   chooses 3 at Team Preview
	//   controls one active Pokemon at a time
	//
	// p1 + p3 vs p2 + p4
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power 2v2 B6P3',

		desc:
			'Four-player 2v2 Shared Power Multi Battle. Each player receives 6 random Pokemon and picks 3.',

		mod: 'ndsharedpower',
		team: 'random',
		gameType: 'multi',

		rated: false,
		searchShow: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'NDSP Standard Bans',
			'Max Team Size = 6',
			'Picked Team Size = 3',
		],

		...ndspHooks,
	},

];
