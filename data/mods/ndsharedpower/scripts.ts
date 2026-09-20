import {Scripts as SharedPowerScripts} from '../sharedpower/scripts';

const NDSP_MEGA_ACTIONS = new Set([
	'megaEvo',
	'megaEvoX',
	'megaEvoY',
]);

function ndspFixActionOrder(action: AnyObject) {
	if (
		NDSP_MEGA_ACTIONS.has(action.choice)
	) {
		/*
		 * Pokémon Showdown's normal Mega action order.
		 *
		 * Switch = 103
		 * Mega   = 104
		 * Dmax   = 105
		 * Tera   = 106
		 * Move   = 200
		 */
		action.order = 104;
		return;
	}

	/*
	 * Ordinary attacks must never accidentally receive an
	 * action order earlier than Mega Evolution.
	 */
	if (
		action.choice === 'move' &&
		(
			action.order === undefined ||
			action.order < 200
		)
	) {
		action.order = 200;
	}
}

export const Scripts: ModdedBattleScriptsData = {
	...SharedPowerScripts,

	gen: 9,

	field: {
		inherit: true,
		...(SharedPowerScripts.field || {}),
	},

	pokemon: {
		inherit: true,
		...(SharedPowerScripts.pokemon || {}),
	},

	queue: {
		inherit: true,
		...(SharedPowerScripts.queue || {}),

		/*
		 * =====================================================
		 * NDSP MEGA ORDER GUARANTEE
		 * =====================================================
		 *
		 * resolveAction() can produce both:
		 *
		 *   Mega Evolution action
		 *   Move action
		 *
		 * Force the expected ordering immediately.
		 */
		resolveAction(
			action: AnyObject,
			midTurn = false
		) {
			const baseResolve =
				(this.constructor.prototype as AnyObject)
					.resolveAction;

			const actions =
				baseResolve.call(
					this,
					action,
					midTurn
				) as AnyObject[];

			for (const resolved of actions) {
				ndspFixActionOrder(resolved);

				if (resolved.pokemon) {
					this.battle.getActionSpeed(
						resolved
					);
				}
			}

			return actions;
		},

		/*
		 * Repair again immediately before every queue sort.
		 *
		 * This covers actions inserted/re-resolved later in
		 * the turn by custom mechanics.
		 */
		sort() {
			for (
				const action of
				this.list as AnyObject[]
			) {
				ndspFixActionOrder(action);

				if (action.pokemon) {
					this.battle.getActionSpeed(
						action
					);
				}
			}

			return (
				this.constructor.prototype as AnyObject
			).sort.call(this);
		},
	},
};
