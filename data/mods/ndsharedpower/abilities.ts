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
