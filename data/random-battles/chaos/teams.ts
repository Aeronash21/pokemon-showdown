/*
 * ===========================================================
 * CHAOS RANDOM TEAMS
 * ===========================================================
 *
 * PokéRogue random sets (egg moves, passives, levels), then Chaos items:
 *
 * - About 40% of the team gets a Mega Stone that suits its set (Mix and
 *   Mega: it gains that Mega's stat changes, ability, type and passive).
 *   The stone is picked by how much the Mega's stat changes help the set
 *   and whether its ability works with the set (-ate abilities need a
 *   Normal move, Mega Launcher a pulse move...). Mega Stone holders drop
 *   a few levels, by how much the stone adds.
 * - About one in six gets a Z-Crystal for its strongest attack.
 * - Everyone else can Terastallize or Dynamax (with the G-Max factor if it
 *   has a G-Max form).
 *
 * Items a set relies on (Eviolite, Toxic / Flame Orb, Light Ball...) and
 * the PokéRogue transformation items (own Mega Stone, Galarica Wreath,
 * Ultranecrozium Z) are never replaced. One of each item per team.
 */
import {PokeRogueTeams} from '../pokerogue/teams';

/**
 * Mega Stones never handed out: Shadow Tag or +125 Sp. Atk on anything (Galarica
 * Wreath / Max Mushrooms aren't Mega Stones here).
 */
const EXCLUDED_STONES = new Set(['gengarite', 'zygardite', 'galaricawreath', 'maxmushrooms']);

/** Items a set relies on: never replaced. */
const KEPT_ITEMS = new Set([
	'eviolite', 'toxicorb', 'flameorb', 'lightball', 'thickclub', 'leek', 'stick', 'boosterenergy', 'souldew',
	'luckypunch', 'metalpowder', 'quickpowder', 'deepseatooth', 'deepseascale', 'berryjuice', 'powerherb',
	'whiteherb', 'loadeddice', 'ultranecroziumz', 'galaricawreath', 'maxmushrooms',
	'cornerstonemask', 'hearthflamemask', 'wellspringmask', 'rustedsword', 'rustedshield',
	'adamantcrystal', 'lustrousglobe', 'griseouscore', 'redorb', 'blueorb',
]);

/** Mega abilities that only help a set with the right moves. */
const ABILITY_NEEDS: {[abilityid: string]: (moves: Move[]) => boolean} = {
	aerilate: moves => moves.some(m => m.type === 'Normal' && m.category !== 'Status'),
	pixilate: moves => moves.some(m => m.type === 'Normal' && m.category !== 'Status'),
	refrigerate: moves => moves.some(m => m.type === 'Normal' && m.category !== 'Status'),
	galvanize: moves => moves.some(m => m.type === 'Normal' && m.category !== 'Status'),
	dragonize: moves => moves.some(m => m.type === 'Normal' && m.category !== 'Status'),
	megalauncher: moves => moves.some(m => m.flags['pulse']),
	strongjaw: moves => moves.some(m => m.flags['bite']),
	ironfist: moves => moves.some(m => m.flags['punch']),
	sharpness: moves => moves.some(m => m.flags['slicing']),
	toughclaws: moves => moves.some(m => m.flags['contact'] && m.category !== 'Status'),
	technician: moves => moves.some(m => m.category !== 'Status' && m.basePower && m.basePower <= 60),
	skilllink: moves => moves.some(m => Array.isArray(m.multihit)),
	sheerforce: moves => moves.some(m => m.secondary || m.secondaries),
	reckless: moves => moves.some(m => m.recoil || m.hasCrashDamage),
	hugepower: moves => moves.some(m => m.category === 'Physical'),
	purepower: moves => moves.some(m => m.category === 'Physical'),
	solarpower: moves => moves.some(m => m.category === 'Special'),
	sandforce: moves => moves.some(m => ['Rock', 'Ground', 'Steel'].includes(m.type)),
};

/** Mega abilities that hurt their holder. */
const BAD_ABILITIES = new Set(['truant', 'slowstart', 'defeatist', 'klutz', 'stall']);

/**
 * Abilities that change the Pokémon's own form (a Mega Stone would replace
 * them): these Pokémon don't get a Mega Stone (Mix and Mega keeps Power
 * Construct Zygarde to its own items too).
 */
const FORM_ABILITIES = new Set([
	'powerconstruct', 'zenmode', 'schooling', 'shieldsdown', 'disguise', 'stancechange', 'battlebond', 'multitype',
	'rkssystem', 'iceface', 'hungerswitch', 'zerotohero', 'commander', 'gulpmissile', 'teraformzero', 'terashift',
]);

export class ChaosTeams extends PokeRogueTeams {
	override getTeam(options: PlayerOptions | null = null): PokemonSet[] {
		const team = super.getTeam(options);
		this.addChaosItems(team as RandomTeamsTypes.RandomSet[]);
		return team;
	}

	protected isTransformationItem(item: Item) {
		return !!(item.megaStone || item.zMove || item.isPrimalOrb || item.forcedForme);
	}

	protected addChaosItems(team: RandomTeamsTypes.RandomSet[]) {
		const used = new Set<string>(team.map(set => this.dex.toID(set.item)));
		const free = team.filter(set => {
			const item = this.dex.items.get(set.item);
			return !this.isTransformationItem(item) && !KEPT_ITEMS.has(item.id);
		});
		this.prng.shuffle(free);

		let stones = Math.round(team.length * 0.4);
		let zCrystals = Math.max(1, Math.round(team.length / 6));
		for (const set of free) {
			if (stones > 0) {
				const stone = this.pickStone(set, used);
				if (stone) {
					set.item = stone.name;
					// (not below level 50, and not with an Adjust Level rule)
					if (!this.adjustLevel) set.level -= Math.min(stone.levelDrop, Math.max(0, set.level - 50));
					used.add(stone.id);
					stones--;
					continue;
				}
			}
			if (zCrystals > 0) {
				const crystal = this.pickZCrystal(set, used);
				if (crystal) {
					set.item = crystal.name;
					used.add(crystal.id);
					zCrystals--;
				}
			}
		}

		// Dynamax with the G-Max factor where there's a G-Max form (nothing that
		// stops Dynamax: Mega Stones, Z-Crystals, Galarica Wreath...).
		for (const set of team) {
			const species = this.dex.species.get(set.species);
			const item = this.dex.items.get(set.item);
			if (species.canGigantamax && !this.isTransformationItem(item)) set.gigantamax = true;
		}
	}

	/** The best-fitting unused Mega Stone for a set (picked among the top few for variety). */
	protected pickStone(set: RandomTeamsTypes.RandomSet, used: Set<string>) {
		const species = this.dex.species.get(set.species);
		if (FORM_ABILITIES.has(this.dex.toID(set.ability))) return null;
		const moves = set.moves.map(m => this.dex.moves.get(m));
		const physical = moves.filter(m => m.category === 'Physical').length;
		const special = moves.filter(m => m.category === 'Special').length;
		const attacker = physical + special >= 2;
		const main = physical >= special ? 'atk' : 'spa';

		const scored: {id: string, name: string, score: number, levelDrop: number}[] = [];
		for (const item of this.dex.items.all()) {
			if (!item.megaStone || EXCLUDED_STONES.has(item.id) || used.has(item.id)) continue;
			const forme = this.dex.species.get(Object.values(item.megaStone)[0]);
			if (!forme.exists || !forme.battleOnly) continue;
			const base = this.dex.species.get(Array.isArray(forme.battleOnly) ? forme.battleOnly[0] : forme.battleOnly);
			const delta = (stat: StatID) => forme.baseStats[stat] - base.baseStats[stat];

			const ability = this.dex.abilities.get(forme.abilities['0']);
			if (BAD_ABILITIES.has(ability.id)) continue;
			if (ABILITY_NEEDS[ability.id] && !ABILITY_NEEDS[ability.id](moves)) continue;

			let score = attacker ?
				delta(main) + 0.7 * delta('spe') + 0.25 * (delta('hp') + delta('def') + delta('spd')) :
				0.6 * (delta('hp') + delta('def') + delta('spd')) + 0.3 * delta('spe');
			score += 8 * (ability.rating || 0);
			// (its own Mega: always a good fit)
			if (forme.baseSpecies === species.baseSpecies) score += 40;
			const gain = Math.max(0, attacker ? delta(main) : delta('def') + delta('spd')) + Math.max(0, delta('spe'));
			scored.push({id: item.id, name: item.name, score, levelDrop: Math.min(4, Math.round(gain / 35))});
		}
		// Any stone that fits well enough (within 60% of the best fit), better fits
		// more likely: plenty of variety without bad picks.
		scored.sort((a, b) => b.score - a.score);
		if (!scored.length || scored[0].score <= 0) return null;
		const good = scored.filter(s => s.score >= scored[0].score * 0.6);
		let roll = this.random(Math.round(good.reduce((total, s) => total + s.score, 0)));
		for (const option of good) {
			roll -= option.score;
			if (roll < 0) return option;
		}
		return good[0];
	}

	/** A type Z-Crystal for the set's strongest attack (none for all-status sets). */
	protected pickZCrystal(set: RandomTeamsTypes.RandomSet, used: Set<string>) {
		const species = this.dex.species.get(set.species);
		const attacks = set.moves.map(m => this.dex.moves.get(m))
			.filter(m => m.category !== 'Status' && m.basePower && !m.isMax && !m.isZ && !m.flags['charge']);
		if (!attacks.length) return null;
		const power = (m: Move) => (m.basePower || 0) * (species.types.includes(m.type) ? 1.5 : 1);
		attacks.sort((a, b) => power(b) - power(a));
		for (const move of attacks) {
			const crystal = this.dex.items.all().find(item => item.zMove === true && item.zMoveType === move.type);
			if (crystal && !used.has(crystal.id)) return crystal;
		}
		return null;
	}
}

export default ChaosTeams;
