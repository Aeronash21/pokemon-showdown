import {Abilities as ChampionsAbilities} from '../champions/abilities';
import {Abilities as SharedPowerAbilities} from '../sharedpower/abilities';

export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	...ChampionsAbilities,
	...SharedPowerAbilities,

	hugepower: {
		inherit: true,
		onModifyAtkPriority: 5,
		onModifyAtk() {
			return this.chainModify(2);
		},
	},

	purepower: {
		inherit: true,
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			/*
			 * NDSP:
			 * Huge Power + Pure Power must never stack to 4x.
			 *
			 * Shared Power's hasAbility() sees both the natural
			 * ability and ability: volatiles.
			 */
			if (pokemon.hasAbility('hugepower')) return;
			return this.chainModify(2);
		},
	},


	/*
	 * =========================================================
	 * NDSP TERAPAGOS STELLAR FIX
	 * =========================================================
	 *
	 * Persistent Shared Power means Tera Shift can remain in the
	 * side's shared ability pool even after Terapagos becomes
	 * Terapagos-Stellar.
	 *
	 * Upstream Tera Shift normally changes any Terapagos that is
	 * not currently Terastal into Terapagos-Terastal on switch-in.
	 *
	 * Without this guard, a switched-out Terapagos-Stellar can
	 * come back in, receive the shared Tera Shift volatile, and
	 * incorrectly regress to Terapagos-Terastal/base progression.
	 *
	 * Once Terapagos has Terastallized, Tera Shift must never
	 * change its forme again.
	 */
	terashift: {
		inherit: true,

		onSwitchInPriority: 2,

		onSwitchIn(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !==
				'Terapagos'
			) {
				return;
			}

			/*
			 * Stellar Terapagos is permanently Terastallized.
			 * Do not let a shared/persistent Tera Shift effect
			 * regress it.
			 */
			if (
				pokemon.terastallized ||
				pokemon.species.name ===
					'Terapagos-Stellar'
			) {
				return;
			}

			if (
				pokemon.species.forme !==
				'Terastal'
			) {
				this.add(
					'-activate',
					pokemon,
					'ability: Tera Shift'
				);

				pokemon.formeChange(
					'Terapagos-Terastal',
					this.effect,
					true
				);
			}
		},
	},

	auraguard: {
		name: "Aura Guard",
		shortDesc: "This Pokemon takes 1/2 damage from contact moves.",
		rating: 4,
		flags: {breakable: 1},

		onSourceModifyDamage(damage, source, target, move) {
			if (move.flags['contact']) {
				return this.chainModify(0.5);
			}
		},
	},
};
