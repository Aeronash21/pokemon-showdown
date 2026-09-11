const NDSP_BANNED_ABILITIES =
	new Set<ID>([
		'shadowtag' as ID,
		'moody' as ID,
	]);

function getNDSPPool(
	side: Side
): ID[] {
	const custom =
		side as Side & {
			ndspSharedAbilities?: ID[];
		};

	if (
		!Array.isArray(
			custom.ndspSharedAbilities
		)
	) {
		custom.ndspSharedAbilities = [];
	}

	return custom.ndspSharedAbilities;
}

function wantedSharedEffects(
	pokemon: Pokemon
): string[] {
	return getNDSPPool(
		pokemon.side
	)
		.filter(
			ability =>
				ability !==
				pokemon.ability
		)
		.map(
			ability =>
				'ability:' +
				ability
		);
}

/*
 * Called before a Pokémon enters.
 *
 * This mirrors upstream Shared Power's method of
 * pre-loading innate ability volatile states.
 */
function preloadSharedPower(
	this: Battle,
	pokemon: Pokemon
) {
	const wanted =
		wantedSharedEffects(
			pokemon
		);

	const m =
		pokemon.m as typeof pokemon.m & {
			ndspManaged?: string[];
		};

	m.abils = [];
	m.ndspManaged =
		[...wanted];

	for (const effect of wanted) {
		pokemon.volatiles[effect] =
			this.initEffectState({
				id: effect as ID,
				target: pokemon,
			});

		if (!m.abils.includes(effect)) {
			m.abils.push(effect);
		}
	}
}

/*
 * Synchronise an already-active Pokémon when a teammate
 * reveals a NEW shared ability.
 */
function syncActiveSharedPower(
	this: Battle,
	pokemon: Pokemon
) {
	if (
		!pokemon ||
		!pokemon.hp ||
		!pokemon.isActive
	) {
		return;
	}

	const wanted =
		wantedSharedEffects(
			pokemon
		);

	const m =
		pokemon.m as typeof pokemon.m & {
			ndspManaged?: string[];
		};

	const previous =
		m.ndspManaged || [];

	if (!m.abils) {
		m.abils = [];
	}

	for (const effect of previous) {
		if (
			!wanted.includes(effect)
		) {
			if (
				pokemon.volatiles[effect]
			) {
				pokemon.removeVolatile(
					effect
				);
			}

			m.abils =
				m.abils.filter(
					x => x !== effect
				);
		}
	}

	for (const effect of wanted) {
		if (!m.abils.includes(effect)) {
			m.abils.push(effect);
		}

		if (
			!pokemon.volatiles[effect]
		) {
			pokemon.addVolatile(
				effect,
				pokemon
			);
		}
	}

	m.ndspManaged =
		[...wanted];
}

function unlockSharedAbility(
	this: Battle,
	pokemon: Pokemon,
	rawAbility?: string
) {
	const ability =
		this.toID(
			rawAbility ||
			pokemon.ability
		);

	if (
		!ability ||
		ability === 'noability' ||
		NDSP_BANNED_ABILITIES.has(
			ability
		)
	) {
		return;
	}

	const pool =
		getNDSPPool(
			pokemon.side
		);

	if (!pool.includes(ability)) {
		pool.push(ability);
	}

	for (
		const ally
		of pokemon.side.active
	) {
		if (ally) {
			syncActiveSharedPower.call(
				this,
				ally
			);
		}
	}
}

/*
 * Gen 9 normally marks Dynamax as already used.
 * This restores the per-side Dynamax button.
 */
const dynamaxSide = {
	canDynamaxNow(this: Side) {
		return !this.dynamaxUsed;
	},
};

function ndspBegin(
	this: Battle
) {
	for (const side of this.sides) {
		side.dynamaxUsed = false;

		(
			side as Side & {
				ndspSharedAbilities?: ID[];
			}
		).ndspSharedAbilities = [];
	}
}

function ndspBeforeSwitchIn(
	this: Battle,
	pokemon: Pokemon
) {
	preloadSharedPower.call(
		this,
		pokemon
	);
}

function ndspSwitchIn(
	this: Battle,
	pokemon: Pokemon
) {
	unlockSharedAbility.call(
		this,
		pokemon,
		pokemon.ability
	);
}

function ndspAfterMega(
	this: Battle,
	pokemon: Pokemon
) {
	/*
	 * Mega/Ultra ability becomes permanently shared.
	 */
	unlockSharedAbility.call(
		this,
		pokemon,
		pokemon.ability
	);
}

export const Formats: FormatList = [
	{
		section:
			'ND Shared Power',
		column: 1,
	},

	{
		name:
			'[Gen 9] ND Shared Power RandBats',

		desc:
			'National Dex Random Battle Shared Power. ' +
			'Bring 12, pick 6. Mega Evolution, Z-Moves, ' +
			'Dynamax/Gigantamax and Terastallization are enabled.',

		mod:
			'ndsharedpower',

		team:
			'random',

		rated:
			false,

		ruleset: [
			'Standard NatDex',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		side:
			dynamaxSide,

		onBegin:
			ndspBegin,

		onBeforeSwitchIn:
			ndspBeforeSwitchIn,

		onSwitchInPriority:
			-100,

		onSwitchIn:
			ndspSwitchIn,

		onAfterMega:
			ndspAfterMega,
	},

	{
		name:
			'[Gen 9] ND Shared Power FFA',

		desc:
			'Four-player National Dex Random Battle Shared Power. ' +
			'Bring 12, pick 6. Mega Evolution, Z-Moves, ' +
			'Dynamax/Gigantamax and Terastallization are enabled.',

		mod:
			'ndsharedpower',

		team:
			'random',

		gameType:
			'freeforall',

		rated:
			false,

		tournamentShow:
			false,

		ruleset: [
			'Standard NatDex',
			'Max Team Size = 12',
			'Picked Team Size = 6',
		],

		side:
			dynamaxSide,

		onBegin:
			ndspBegin,

		onBeforeSwitchIn:
			ndspBeforeSwitchIn,

		onSwitchInPriority:
			-100,

		onSwitchIn:
			ndspSwitchIn,

		onAfterMega:
			ndspAfterMega,
	},
];
