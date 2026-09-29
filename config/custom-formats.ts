// National Dex Shared Power custom formats

import {PokeRogueFormats} from './pokerogue-formats';

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

	ndspMegaMoveChange(this, pokemon);
}


/*
 * ===========================================================
 * MEGA SIGNATURE MOVE CHANGES
 * ===========================================================
 *
 * When Zygarde Mega Evolves, Core Enforcer becomes Nihil Light
 * for the rest of the battle (including after switching out).
 *
 * The move keeps the same fraction of PP it had left.
 */
const NDSP_MEGA_MOVE_CHANGES: {[megaID: string]: [string, string][]} = {
	zygardemega: [['coreenforcer', 'nihillight']],
};

function ndspMegaMoveChange(
	battle: any,
	pokemon: any
) {
	const changes =
		NDSP_MEGA_MOVE_CHANGES[pokemon.species.id];

	if (!changes) return;

	for (const [fromID, toID] of changes) {
		const newMove = battle.dex.moves.get(toID);

		if (!newMove.exists) continue;

		const index = pokemon.baseMoveSlots.findIndex(
			(slot: any) => slot.id === fromID
		);

		if (index < 0) continue;

		const oldSlot = pokemon.baseMoveSlots[index];

		const maxpp = newMove.noPPBoosts ?
			newMove.pp :
			Math.floor(newMove.pp * 8 / 5);

		const ratio = oldSlot.maxpp ?
			oldSlot.pp / oldSlot.maxpp :
			1;

		/*
		 * One shared slot object, exactly like Pokemon's own
		 * setup, so PP used now is still spent after the
		 * Pokemon switches out and moveSlots is rebuilt from
		 * baseMoveSlots.
		 */
		const newSlot = {
			move: newMove.name,
			id: newMove.id,
			pp: Math.round(maxpp * ratio),
			maxpp,
			target: newMove.target,
			disabled: false,
			used: oldSlot.used,
		};

		pokemon.baseMoveSlots[index] = newSlot;

		const activeIndex = pokemon.moveSlots.findIndex(
			(slot: any) => slot === oldSlot || slot.id === fromID
		);

		if (activeIndex >= 0) {
			pokemon.moveSlots[activeIndex] = newSlot;
		}

		/*
		 * Mega Evolution happens before moves, so a Core Enforcer
		 * chosen this turn is already queued. Point it at Nihil
		 * Light, or the move would silently fail.
		 */
		for (const action of battle.queue.list) {
			if (
				action.choice === 'move' &&
				action.pokemon === pokemon &&
				action.move?.id === fromID
			) {
				action.moveid = newMove.id;
				action.move = battle.dex.getActiveMove(newMove.id);
			}
		}

		battle.add(
			'message',
			`${pokemon.name}'s ${battle.dex.moves.get(fromID).name} became ${newMove.name}!`
		);
	}
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

/*
 * ===========================================================
 * ND MIX AND MEGA HOOKS
 * ===========================================================
 *
 * Same as the official Mix and Mega format: remember each
 * Pokemon's original species (the mixandmega scripts use it when
 * it Mega Evolves) and show the Mega / type change on switches.
 */
const ndmnmHooks = {
	onBegin(this: any) {
		for (const pokemon of this.getAllPokemon()) {
			pokemon.m.originalSpecies = pokemon.baseSpecies.name;
		}

		this.add(
			'rule',
			'Mix and Mega: Every Pokémon holds a Mega Stone or other transformation item and gains its forme\'s changes'
		);
	},

	onSwitchIn(this: any, pokemon: any) {
		const originalSpecies = this.dex.species.get(pokemon.species.originalSpecies);

		if (originalSpecies.exists && pokemon.m.originalSpecies !== originalSpecies.baseSpecies) {
			this.add(
				'-start',
				pokemon,
				originalSpecies.requiredItems?.[0] || originalSpecies.requiredItem || originalSpecies.requiredMove,
				'[silent]'
			);

			const oSpecies = this.dex.species.get(pokemon.m.originalSpecies);

			if (oSpecies.types.join('/') !== pokemon.species.types.join('/')) {
				this.add(
					'-start',
					pokemon,
					'typechange',
					pokemon.species.types.join('/'),
					'[silent]',
					'[from] format: Mix and Mega'
				);
			}
		}
	},

	onSwitchOut(this: any, pokemon: any) {
		const originalSpecies = this.dex.species.get(pokemon.species.originalSpecies);

		if (originalSpecies.exists && pokemon.m.originalSpecies !== originalSpecies.baseSpecies) {
			this.add(
				'-end',
				pokemon,
				originalSpecies.requiredItems?.[0] || originalSpecies.requiredItem || originalSpecies.requiredMove,
				'[silent]'
			);
		}
	},
};


/*
 * ===========================================================
 * ND MIX AND MEGA (TEAMBUILDER FORMATS)
 * ===========================================================
 *
 * Build-your-own-team Mix and Mega on the full National Dex (the
 * official mixandmega mod, with Pokémon Champions' move / ability
 * changes: data/mods/ndmixandmegabuilder): any Pokémon can hold any Mega Stone,
 * Primal Orb, Rusted item, Origin item, Mask, Plate, Memory or Drive
 * and gains that forme's stat changes, ability and type.
 *
 * - One of each transformation item per team.
 * - "Restricted" Pokémon can only use their own transformation item.
 * - A Pokémon's tier is its own (holding a foreign stone doesn't
 *   change it); stones that are too strong on anything are banned.
 */
function mnmBuilderValidateTeam(this: any, team: any[]) {
	const seen = new Set<string>();
	for (const set of team) {
		const item = this.dex.items.get(set.item);
		const isTransformation = item.megaStone || item.isPrimalOrb || item.name.startsWith('Rusted') ||
			(item.forcedForme && !item.zMove);
		if (!isTransformation) continue;
		const species = this.dex.species.get(set.species);
		const own = item.megaStone ?
			Object.keys(item.megaStone).some(name => [species.name, species.baseSpecies].includes(name) ||
				this.dex.species.get(name).baseSpecies === species.baseSpecies) :
			([...(item.itemUser || []), item.forcedForme || ''].some(name => name &&
				this.dex.species.get(name).baseSpecies === species.baseSpecies) ||
				(item.isPrimalOrb && ['Groudon', 'Kyogre'].includes(species.baseSpecies)));
		if (!own && (this.ruleTable.isRestrictedSpecies(species) || this.toID(set.ability) === 'powerconstruct')) {
			return [`${species.name} can only use its own transformation item, not ${item.name}.`];
		}
		if (seen.has(item.id)) {
			return [
				`You are limited to one of each Mega Stone / Primal Orb / Rusted item / Origin item / Mask / Plate / ` +
				`Memory / Drive. (You have more than one ${item.name}.)`,
			];
		}
		seen.add(item.id);
	}
}

const mnmBuilderHooks = {
	onValidateTeam: mnmBuilderValidateTeam,
	onBegin(this: any) {
		for (const pokemon of this.getAllPokemon()) {
			pokemon.m.originalSpecies = pokemon.baseSpecies.name;
		}
	},
	onSwitchIn: ndmnmHooks.onSwitchIn,
	onSwitchOut: ndmnmHooks.onSwitchOut,
};

/** Stones that are too strong on anything (official Mix and Mega OU list + Zygardite). */
const MNM_OU_STONE_BANS = [
	'Beedrillite', 'Blazikenite', 'Gengarite', 'Kangaskhanite', 'Lucarionite Z', 'Malamarite', 'Mawilite',
	'Medichamite', 'Pidgeotite', 'Raichunite Y', 'Red Orb', 'Scovillainite', 'Starminite', 'Zygardite',
];
/**
 * Can only use their own transformation item: only the really strong ones
 * (by request; the official Mix and Mega list is longer). Ubers adds every
 * Restricted Legendary plus Darkrai, Magearna and Marshadow.
 */
const MNM_RESTRICTED = [
	// box legends
	'Calyrex-Ice', 'Dialga', 'Eternatus', 'Giratina', 'Groudon', 'Ho-Oh', 'Kyurem-Black', 'Kyurem-White', 'Lugia',
	'Lunala', 'Mewtwo', 'Necrozma-Dawn-Wings', 'Necrozma-Dusk-Mane', 'Palkia', 'Rayquaza', 'Reshiram', 'Solgaleo',
	'Zacian', 'Zekrom',
	// Mythicals as strong as them
	'Arceus', 'Deoxys-Normal', 'Deoxys-Attack',
	// any Mega Stone would replace Truant / Slow Start
	'Regigigas', 'Slaking',
];

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
	// TAG BATTLE (2v2 MULTI - BRING 6 PICK 3)
	//
	// Formerly "[Gen 9] ND Shared Power 2v2 B6P3".
	//
	// Each of the four human players:
	//   receives 6 random Pokemon
	//   chooses 3 at Team Preview
	//   controls one active Pokemon at a time
	//
	// p1 + p3 vs p2 + p4
	// ========================================================

	{
		name: '[Gen 9] ND Shared Power Tag Battle',

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

	// ========================================================
	// ND MIX AND MEGA
	//
	// Random battles where every Pokemon holds a Mega Stone or
	// another transformation item (Primal Orb, Rusted Sword /
	// Shield, Origin item, Mask, Plate, Memory, Drive) and gains
	// that forme's stat changes, ability and type change (Mix and
	// Mega rules). Terastallization is off, as in Mix and Mega. Pokemon pool = the legal NDSP Pokemon; sets and
	// stone pairings are curated by tools/build-ndmnm-sets.cjs.
	// ========================================================

	{
		section: 'ND Mix and Mega',
		column: 1,
	},

	{
		name: '[Gen 9] ND Mix and Mega RandBats',

		desc:
			'National Dex Random Battle where every Pokemon holds a curated Mega Stone or other transformation item (Primal Orbs, Rusted items, Plates, Masks...). Bring 12, pick 6.',

		mod: 'ndmixandmega',
		team: 'random',

		rated: false,

		ruleset: [
			'Standard NatDex',
			'Terastal Clause',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndmnmHooks,
	},

	{
		name: '[Gen 9] ND Mix and Mega FFA',

		desc:
			'Four-player National Dex Mix and Mega Random Battle. Bring 12, pick 6.',

		mod: 'ndmixandmega',
		team: 'random',
		gameType: 'freeforall',

		rated: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'Terastal Clause',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		...ndmnmHooks,
	},

	{
		name: '[Gen 9] ND Mix and Mega 2v2',

		desc:
			'Four-player 2v2 Multi Battle with National Dex Mix and Mega random teams. Every player controls one active Pokemon.',

		mod: 'ndmixandmega',
		team: 'random',
		gameType: 'multi',

		rated: false,
		searchShow: false,
		tournamentShow: false,

		ruleset: [
			'Standard NatDex',
			'Terastal Clause',
			'Max Team Size = 3',
		],

		...ndmnmHooks,
	},

	// ========================================================
	// ND MIX AND MEGA: BUILD YOUR OWN TEAM
	// (full National Dex, official Mix and Mega mechanics)
	// ========================================================

	{
		name: '[Gen 9] ND Mix and Mega OU',
		desc: 'National Dex Mix and Mega: any Pokémon can Mega Evolve with any Mega Stone (or use any Primal Orb, ' +
			'Rusted item, Origin item, Mask, Plate, Memory or Drive) and gains its stat changes, ability and type. ' +
			'One of each item per team; Pokémon are tiered by their own National Dex tier.',
		mod: 'ndmixandmegabuilder',
		ruleset: ['Standard NatDex', 'Terastal Clause'],
		banlist: [
			'ND Uber', 'ND AG', 'Arena Trap', 'Moody', 'Power Construct', 'Shadow Tag', "King's Rock", 'Quick Claw',
			'Razor Fang', 'Assist', 'Baton Pass', 'Last Respects', 'Shed Tail',
			...MNM_OU_STONE_BANS,
		],
		restricted: MNM_RESTRICTED,
		...mnmBuilderHooks,
	},
	{
		name: '[Gen 9] ND Mix and Mega Ubers',
		desc: 'National Dex Mix and Mega with the Ubers. Restricted Legendaries (and a few others) can only use ' +
			'their own Mega Stone / Orb / item; everyone else can use any.',
		mod: 'ndmixandmegabuilder',
		ruleset: [
			'Standard NatDex', 'Terastal Clause', '!Evasion Clause', 'Evasion Moves Clause', 'Evasion Items Clause',
			'Mega Rayquaza Clause',
		],
		banlist: [
			'ND AG', 'Shedinja', 'Moody', 'Shadow Tag', 'Arena Trap', 'Assist', 'Baton Pass',
			'Gengarite', // Shadow Tag on anything
			'Zygardite', // +125 Sp. Atk on anything
		],
		restricted: ['Restricted Legendary', ...MNM_RESTRICTED, 'Magearna', 'Marshadow', 'Darkrai'],
		...mnmBuilderHooks,
	},
	{
		name: '[Gen 9] ND Mix and Mega AG',
		desc: 'National Dex Mix and Mega Anything Goes: every Pokémon can use any transformation item (one of each ' +
			'per team).',
		mod: 'ndmixandmegabuilder',
		ruleset: ['Standard AG', 'NatDex Mod', 'Terastal Clause'],
		...mnmBuilderHooks,
	},
	{
		// Four players, p1 + p3 vs p2 + p4; each brings 6 and picks 3, and controls one active Pokémon.
		name: '[Gen 9] ND Mix and Mega 2v2 (Teambuilder)',
		desc: 'Four-player 2v2 Multi Battle with your own National Dex Mix and Mega teams. Bring 6, pick 3.',
		mod: 'ndmixandmegabuilder',
		gameType: 'multi',
		rated: false,
		searchShow: false,
		tournamentShow: false,
		ruleset: [
			'Standard NatDex', 'Terastal Clause', 'Gravity Sleep Clause', 'Max Team Size = 6', 'Picked Team Size = 3',
		],
		banlist: [
			'ND Uber', 'ND AG', 'Arena Trap', 'Moody', 'Power Construct', 'Shadow Tag', "King's Rock", 'Quick Claw',
			'Razor Fang', 'Assist', 'Baton Pass', 'Last Respects', 'Shed Tail',
			...MNM_OU_STONE_BANS,
			// doubles (official Mix and Mega Doubles list)
			'Banettite', 'Blue Orb', 'Magearnite', 'Staraptite',
		],
		restricted: MNM_RESTRICTED,
		...mnmBuilderHooks,
	},

	// PokéRogue formats live in config/pokerogue-formats.ts
	...PokeRogueFormats,
];
