import type { PRNG, PRNGSeed } from "../../../sim/prng";
import MegaSinglesTeams from "./mega-singles-teams";

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

export class ZMegaSinglesTeams extends MegaSinglesTeams {
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
		/*
		 * 80%: proper Light Ball physical attacker.
		 * 20%: dedicated Pikanium Z / Catastropika set.
		 *
		 * This is based on Pikachu's current Smogon NFE physical set:
		 * Fake Out / Volt Tackle / Knock Off / Quick Attack.
		 */
		const useZ = this.randomChance(1, 5);

		set.item = useZ ? "Pikanium Z" : "Light Ball";
		set.ability = "Lightning Rod";
		set.nature = "Adamant";

		set.moves = [
			"fakeout",
			"volttackle",
			"knockoff",
			"quickattack",
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
		set.teraType = "Normal";
		set.role = "Fast Attacker";

		return set;
	}

	private fixMegaHawlucha(
		set: RandomTeamsTypes.RandomSet
	): RandomTeamsTypes.RandomSet {
		/*
		 * Mega Hawlucha:
		 * 137 Atk / 118 Spe + No Guard.
		 *
		 * No Guard makes High Jump Kick and Stone Edge
		 * particularly valuable.
		 */
		set.item = "Hawluchanite";
		set.ability = "Unburden";
		set.nature = "Jolly";

		set.moves = [
			"swordsdance",
			"highjumpkick",
			"bravebird",
			"stoneedge",
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
		set.role = "Setup Sweeper";

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

			/*
			 * Exact form matching is intentional:
			 * base Pikachu should not receive Pikashunium Z,
			 * for example.
			 */
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

		/*
		 * Prefer a powerful STAB Z-Move.
		 * Otherwise use the strongest coverage move.
		 */
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

		// Never overwrite Mega/Primal/forme-required items.
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

		/*
		 * About 25% of eligible sets become Z-Move sets.
		 *
		 * Bring 12 means this normally gives each roster several
		 * potential Z users without flooding every Pokémon with one.
		 */
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

		// Curated Pikachu overrides.
		if (species.id === "pikachu") {
			return this.fixPikachu(set);
		}

		// Curated Mega Hawlucha override.
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

export default ZMegaSinglesTeams;
