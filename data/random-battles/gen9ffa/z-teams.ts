import type { PRNG, PRNGSeed } from "../../../sim/prng";
import MegaFFATeams from "./mega-teams";

const GENERIC_Z: Record<string, string> = {
	Normal: "Normalium Z",
	Fire: "Firium Z",
	Water: "Waterium Z",
	Electric: "Electrium Z",
	Grass: "Grassium Z",
	Ice: "Icium Z",
	Fighting: "Fightinium Z",
	Poison: "Poisonium Z",
	Ground: "Groundium Z",
	Flying: "Flyinium Z",
	Psychic: "Psychium Z",
	Bug: "Buginium Z",
	Rock: "Rockium Z",
	Ghost: "Ghostium Z",
	Dragon: "Dragonium Z",
	Dark: "Darkinium Z",
	Steel: "Steelium Z",
	Fairy: "Fairium Z",
};

export class ZMegaFFATeams extends MegaFFATeams {
	constructor(format: Format | string, prng: PRNG | PRNGSeed | null) {
		super(format, prng);
	}

	private fullIVs(): StatsTable {
		return {
			hp: 31,
			atk: 31,
			def: 31,
			spa: 31,
			spd: 31,
			spe: 31,
		};
	}

	private fixPikachu(
		set: RandomTeamsTypes.RandomSet
	): RandomTeamsTypes.RandomSet {
		const useZ = this.randomChance(1, 5);

		set.ability = "Lightning Rod";
		set.ivs = this.fullIVs();

		if (useZ) {
			/*
			 * Physical Catastropika FFA variant.
			 */
			set.item = "Pikanium Z";
			set.nature = "Jolly";

			set.moves = [
				"fakeout",
				"volttackle",
				"knockoff",
				"protect",
			];

			set.evs = {
				hp: 0,
				atk: 252,
				def: 0,
				spa: 0,
				spd: 4,
				spe: 252,
			};

			set.teraType = "Normal";
		} else {
			/*
			 * Smogon VGC-style Light Ball set.
			 */
			set.item = "Light Ball";
			set.nature = "Naive";

			set.moves = [
				"fakeout",
				"thunderbolt",
				"grassknot",
				"protect",
			];

			set.evs = {
				hp: 0,
				atk: 4,
				def: 0,
				spa: 252,
				spd: 0,
				spe: 252,
			};

			set.teraType = "Electric";
		}

		set.role = "Fast Attacker";

		return set;
	}

	private fixMegaHawlucha(
		set: RandomTeamsTypes.RandomSet
	): RandomTeamsTypes.RandomSet {
		set.item = "Hawluchanite";
		set.ability = "Unburden";
		set.nature = "Jolly";

		/*
		 * FFA version trades Swords Dance for Protect.
		 */
		set.moves = [
			"highjumpkick",
			"bravebird",
			"stoneedge",
			"protect",
		];

		set.evs = {
			hp: 0,
			atk: 252,
			def: 0,
			spa: 0,
			spd: 4,
			spe: 252,
		};

		set.ivs = this.fullIVs();
		set.teraType = "Flying";
		set.role = "Fast Attacker";

		return set;
	}

	private getSignatureZ(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): string | null {
		const moves = new Set(
			set.moves.map(move => this.dex.moves.get(move).id)
		);

		const possible: string[] = [];

		for (const item of this.dex.items.all()) {
			if (typeof item.zMove !== "string") continue;
			if (!item.zMoveFrom) continue;
			if (!item.itemUser?.length) continue;

			const validUser = item.itemUser.some(userName => {
				const user = this.dex.species.get(userName);
				return user.exists && user.id === species.id;
			});

			if (!validUser) continue;

			const requiredMove =
				this.dex.moves.get(item.zMoveFrom).id;

			if (!moves.has(requiredMove)) continue;

			possible.push(item.name);
		}

		if (!possible.length) return null;
		return this.sample(possible);
	}

	private getGenericZMove(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): string | null {
		const candidates = set.moves
			.map(move => this.dex.moves.get(move))
			.filter(move =>
				move.exists &&
				move.category !== "Status" &&
				!!GENERIC_Z[move.type]
			);

		if (!candidates.length) return null;

		candidates.sort((a, b) => {
			const scoreA =
				(a.basePower || 1) +
				(species.types.includes(a.type) ? 40 : 0);

			const scoreB =
				(b.basePower || 1) +
				(species.types.includes(b.type) ? 40 : 0);

			return scoreB - scoreA;
		});

		return GENERIC_Z[candidates[0].type] || null;
	}

	private canReplaceItem(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): boolean {
		const item = this.dex.items.get(set.item);

		if (item.megaStone) return false;
		if (item.isPrimalOrb) return false;
		if (item.forcedForme) return false;

		if (
			species.requiredItem &&
			set.item === species.requiredItem
		) {
			return false;
		}

		if (
			species.requiredItems?.length &&
			species.requiredItems.includes(set.item)
		) {
			return false;
		}

		return true;
	}

	private maybeGiveZCrystal(
		species: Species,
		set: RandomTeamsTypes.RandomSet
	): RandomTeamsTypes.RandomSet {
		if (!this.canReplaceItem(species, set)) return set;

		if (!this.randomChance(1, 4)) return set;

		const signature = this.getSignatureZ(species, set);

		if (signature) {
			set.item = signature;
			return set;
		}

		const generic = this.getGenericZMove(species, set);

		if (generic) {
			set.item = generic;
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

		let set = super.randomSet(
			species,
			teamDetails,
			isLead,
			isDoubles
		);

		if (species.id === "pikachu") {
			return this.fixPikachu(set);
		}

		if (
			species.id === "hawlucha" &&
			this.dex.items.get(set.item).id === "hawluchanite"
		) {
			return this.fixMegaHawlucha(set);
		}

		set = this.maybeGiveZCrystal(species, set);

		return set;
	}
}

export default ZMegaFFATeams;
