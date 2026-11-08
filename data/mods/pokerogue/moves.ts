import type {PokeRogueBiome} from './rulesets';

/** The battle's PokéRogue biome (chosen by the 'PokeRogue Mod' rule, see rulesets.ts), if any. */
function battleBiome(battle: Battle): PokeRogueBiome | undefined {
	return battle.formatData.pokeRogueBiome as PokeRogueBiome | undefined;
}

export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	// Pre-nerf (Gen 4-6) Dark Void: 80% accurate (Gen 7+: 50%), and any Pokémon
	// that has it can use it (Gengar, Hypno, Meowstic...), not just Darkrai.
	darkvoid: {
		inherit: true,
		accuracy: 80,
		onTry: undefined,
		desc: "Causes the target to fall asleep.",
		shortDesc: "Causes the foe(s) to fall asleep.",
	},
	// Multi-Attack (Arceus' egg move) is Arceus' type: the type of its form, like
	// Judgment (Arceus-Fire: Fire). Anyone else still gets their Memory's type.
	multiattack: {
		inherit: true,
		onModifyType(move, pokemon) {
			if (pokemon.species.baseSpecies === 'Arceus') {
				move.type = pokemon.species.types[0];
				return;
			}
			if (pokemon.ignoringItem()) return;
			move.type = this.runEvent('Memory', pokemon, null, move, 'Normal');
		},
		desc: "This move's type matches the user's type if the user is Arceus (the type of its form, set by its " +
			"Plate). Otherwise, it depends on the user's held Memory.",
		shortDesc: "Arceus: its type. Others: type varies by held Memory.",
	},
	// The original (Let's Go) Zippy Zap, as in PokéRogue: 50 BP, always a
	// critical hit, no Evasion boost (instead of 80 BP with +1 Evasion).
	zippyzap: {
		inherit: true,
		basePower: 50,
		pp: 15,
		willCrit: true,
		secondary: undefined, // no Evasion boost
		desc: "Nearly always goes first. This move is always a critical hit unless the target is under the effect of " +
			"Lucky Chant or has the Battle Armor or Shell Armor Abilities.",
		shortDesc: "Nearly always goes first. Always results in a critical hit.",
	},
	gastroacid: {
		inherit: true,
		condition: {
			// Ability suppression implemented in Pokemon.ignoringAbility() within sim/pokemon.js
			onStart(pokemon) {
				if (pokemon.hasItem('Ability Shield')) return false;
				this.add('-endability', pokemon);
				this.singleEvent('End', pokemon.getAbility(), pokemon.abilityState, pokemon, pokemon, 'gastroacid');
				// Gastro Acid suppresses the passive too (unless it can't be
				// suppressed, like Battle Bond; same as Neutralizing Gas).
				for (const innate of pokemon.m.innates || []) {
					if (this.dex.abilities.get(innate).flags['cantsuppress']) continue;
					pokemon.removeVolatile('ability:' + innate);
				}
			},
			onCopy(pokemon) {
				if (pokemon.getAbility().flags['cantsuppress']) pokemon.removeVolatile('gastroacid');
			},
		},
	},

	// Psycho Shift from a Pokémon with Comatose (ability or passive) puts the
	// target to sleep; the user keeps its Comatose.
	psychoshift: {
		inherit: true,
		onTryHit(target, source, move) {
			if (!source.status && !source.hasAbility('comatose')) return false;
			move.status = source.status || 'slp' as ID;
		},
		desc: "The user's major status condition is transferred to the target, and the user is then cured. If the " +
			"user has Comatose, the target falls asleep instead. Fails if the user has no major status condition " +
			"(and no Comatose) or if the target already has one.",
		shortDesc: "Transfers the user's status to the target (Comatose: sleep).",
	},
	// PokéRogue's PP: Take Heart 10 (as in Legends: Arceus), Hail and Heal
	// Order 5 (like the other weather and recovery moves under Champions' PP).
	takeheart: {
		inherit: true,
		pp: 10,
	},
	hail: {
		inherit: true,
		pp: 5,
	},
	healorder: {
		inherit: true,
		pp: 5,
	},
	// (Metronome, Assist, Sleep Talk, Copycat, Mirror Move, Encore, Instruct and
	// Sketch follow PokéRogue's banlists: move-lists.ts.)
	sketch: {
		inherit: true,
		desc: "This move is permanently replaced by the last move used by the target. The copied move has the " +
			"maximum PP for that move. As in PokéRogue, Sketch can copy any move but Sketch and Struggle. Fails if " +
			"the target has not made a move, if the user has Transformed, or if the user already knows the move.",
		shortDesc: "Permanently copies the last move the target used (any but Struggle).",
	},
	mirrormove: {
		inherit: true,
		desc: "The user uses the last move used by the target, whatever it targeted (as in PokéRogue). The copied " +
			"move is used against that target, if possible. Fails if the target has not made a move, or if the last " +
			"move used was one Mirror Move can't copy.",
		shortDesc: "User uses the target's last move.",
	},

	// Thief and Covet steal the target's item only 30% of the time.
	thief: {
		inherit: true,
		onAfterHit(target, source, move) {
			if (source.item || source.volatiles['gem'] || !target.item) return;
			if (!this.randomChance(3, 10)) return;
			const yourItem = target.takeItem(source);
			if (!yourItem) return;
			if (!this.singleEvent('TakeItem', yourItem, target.itemState, source, target, move, yourItem) ||
				!source.setItem(yourItem)) {
				target.item = yourItem.id; // bypass setItem so we don't break choicelock or anything
				return;
			}
			this.add('-enditem', target, yourItem, '[silent]', '[from] move: Thief', `[of] ${source}`);
			this.add('-item', source, yourItem, '[from] move: Thief', `[of] ${target}`);
		},
		desc: "Has a 30% chance to take the target's held item, if the user has none. Items lost to this move " +
			"cannot be regained with Recycle or Harvest.",
		shortDesc: "30% chance to steal the target's item if the user has none.",
	},
	covet: {
		inherit: true,
		onAfterHit(target, source, move) {
			if (source.item || source.volatiles['gem'] || !target.item) return;
			if (!this.randomChance(3, 10)) return;
			const yourItem = target.takeItem(source);
			if (!yourItem) return;
			if (!this.singleEvent('TakeItem', yourItem, target.itemState, source, target, move, yourItem) ||
				!source.setItem(yourItem)) {
				target.item = yourItem.id; // bypass setItem so we don't break choicelock or anything
				return;
			}
			this.add('-item', source, yourItem, '[from] move: Covet', `[of] ${target}`);
		},
		desc: "Has a 30% chance to take the target's held item, if the user has none. Items lost to this move " +
			"cannot be regained with Recycle or Harvest.",
		shortDesc: "30% chance to steal the target's item if the user has none.",
	},
	// Acrobatics: 110 power with no item it could lose (no item at all, or one
	// that can't be taken from it, like its Mega Stone), 99 with one. (PokéRogue:
	// 20% less per transferable item, down to 55; Showdown has one item at most.)
	acrobatics: {
		inherit: true,
		basePowerCallback(pokemon, target, move) {
			const item = pokemon.getItem();
			if (!pokemon.item ||
				this.singleEvent('TakeItem', item, pokemon.itemState, pokemon, pokemon, move, item) === false) {
				this.debug("BP doubled for no transferable item");
				return move.basePower * 2;
			}
			return Math.round(move.basePower * 1.8);
		},
		desc: "Power is 110 if the user has no held item, or only one that can't be removed from it (like its own " +
			"Mega Stone). Otherwise, power is 99.",
		shortDesc: "110 power with no (removable) item, 99 otherwise.",
	},
	// Thousand Waves' trapping is a secondary effect (like Spirit Shackle), so
	// Sheer Force boosts it (and removes the trapping).
	thousandwaves: {
		inherit: true,
		onHit: undefined,
		secondary: {
			chance: 100,
			onHit(target, source, move) {
				if (source.isActive) target.addVolatile('trapped', source, move, 'trapper');
			},
		},
		desc: "Prevents the target from switching out. The target can still switch out if it is holding Shed Shell " +
			"or uses Baton Pass, Flip Turn, Parting Shot, Shed Tail, Teleport, U-turn, or Volt Switch. If the target " +
			"leaves the field using Baton Pass, the replacement will remain trapped. The effect ends when the user " +
			"leaves the field. This trapping is a secondary effect, so Sheer Force boosts this move.",
	},
	// Telekinesis also fails on Wiglett and Wugtrio, and on Gigantamax Gengar
	// (like Mega Gengar).
	telekinesis: {
		inherit: true,
		condition: {
			duration: 3,
			onStart(target) {
				if (['Diglett', 'Dugtrio', 'Palossand', 'Sandygast', 'Wiglett', 'Wugtrio']
					.includes(target.baseSpecies.baseSpecies) ||
					['Gengar-Mega', 'Gengar-Gmax'].includes(target.baseSpecies.name)) {
					this.add('-immune', target);
					return null;
				}
				if (target.volatiles['smackdown'] || target.volatiles['ingrain']) return false;
				this.add('-start', target, 'Telekinesis');
			},
			onAccuracyPriority: -1,
			onAccuracy(accuracy, target, source, move) {
				if (move && !move.ohko) return true;
			},
			onImmunity(type) {
				if (type === 'Ground') return false;
			},
			onUpdate(pokemon) {
				if (['Gengar-Mega', 'Gengar-Gmax'].includes(pokemon.baseSpecies.name)) {
					delete pokemon.volatiles['telekinesis'];
					this.add('-end', pokemon, 'Telekinesis', '[silent]');
				}
			},
			onResidualOrder: 19,
			onEnd(target) {
				this.add('-end', target, 'Telekinesis');
			},
		},
		desc: "For 3 turns, the target cannot avoid any attacks made against it, other than OHKO moves, as long as " +
			"it remains active. During the effect, the target is immune to Ground-type attacks and the effects of " +
			"Spikes, Toxic Spikes, Sticky Web, and the Arena Trap Ability as long as it remains active. If the target " +
			"uses Baton Pass, the replacement will gain the effect. Ingrain, Smack Down, Thousand Arrows, and Iron " +
			"Ball override this move if the target is under any of their effects. Fails if the target is already " +
			"under this effect or the effects of Ingrain, Smack Down, or Thousand Arrows. The target is immune to " +
			"this move on use if its species is Diglett, Dugtrio, Wiglett, Wugtrio, Sandygast, Palossand, or " +
			"Gengar (Mega or Gigantamax). Fails if Gravity is active.",
	},

	// The battle's biome (PokeRogueBiomes, rulesets.ts) decides Nature Power, Camouflage and Secret
	// Power, unless there is a terrain.
	naturepower: {
		inherit: true,
		onTryHit(target, pokemon) {
			let move = battleBiome(this)?.naturePower || 'triattack';
			if (this.field.isTerrain('electricterrain')) {
				move = 'thunderbolt';
			} else if (this.field.isTerrain('grassyterrain')) {
				move = 'energyball';
			} else if (this.field.isTerrain('mistyterrain')) {
				move = 'moonblast';
			} else if (this.field.isTerrain('psychicterrain')) {
				move = 'psychic';
			}
			this.actions.useMove(move, pokemon, {target});
			return null;
		},
		desc: "This move calls another move for use based on the battle's biome or terrain. Electric Terrain: " +
			"Thunderbolt; Grassy Terrain: Energy Ball; Misty Terrain: Moonblast; Psychic Terrain: Psychic. With no " +
			"terrain, it depends on the biome (Forest: Bug Buzz, Sea: Hydro Pump, Volcano: Lava Plume...; Tri " +
			"Attack if there is none).",
		shortDesc: "Attack depends on the biome or terrain.",
	},
	camouflage: {
		inherit: true,
		onHit(target) {
			let newType = battleBiome(this)?.camouflage || 'Normal';
			if (this.field.isTerrain('electricterrain')) {
				newType = 'Electric';
			} else if (this.field.isTerrain('grassyterrain')) {
				newType = 'Grass';
			} else if (this.field.isTerrain('mistyterrain')) {
				newType = 'Fairy';
			} else if (this.field.isTerrain('psychicterrain')) {
				newType = 'Psychic';
			}

			if (target.getTypes().join() === newType || !target.setType(newType)) return false;
			this.add('-start', target, 'typechange', newType);
		},
		desc: "The user's type changes based on the battle's biome or terrain. Electric Terrain: Electric; Grassy " +
			"Terrain: Grass; Misty Terrain: Fairy; Psychic Terrain: Psychic. With no terrain, it depends on the " +
			"biome (Forest: Bug, Sea: Water, Volcano: Fire...; Normal if there is none). Fails if the user's type " +
			"cannot be changed or if the user is already purely that type.",
		shortDesc: "Changes user's type based on the biome or terrain.",
	},
	secretpower: {
		inherit: true,
		onModifyMove(move, pokemon) {
			const biome = battleBiome(this);
			if (this.field.isTerrain('') && !biome) return;
			move.secondaries = [];
			if (this.field.isTerrain('electricterrain')) {
				move.secondaries.push({chance: 30, status: 'par'});
			} else if (this.field.isTerrain('grassyterrain')) {
				move.secondaries.push({chance: 30, status: 'slp'});
			} else if (this.field.isTerrain('mistyterrain')) {
				move.secondaries.push({chance: 30, boosts: {spa: -1}});
			} else if (this.field.isTerrain('psychicterrain')) {
				move.secondaries.push({chance: 30, boosts: {spe: -1}});
			} else if (biome) {
				move.secondaries.push({chance: 30, ...this.dex.deepClone(biome.secretPower)});
			} else {
				move.secondaries.push({chance: 30, status: 'par'});
			}
		},
		desc: "Has a 30% chance to cause a secondary effect on the target based on the battle's biome or terrain. " +
			"Electric Terrain: paralysis; Grassy Terrain: sleep; Misty Terrain: lowers Sp. Atk by 1 stage; Psychic " +
			"Terrain: lowers Speed by 1 stage. With no terrain, it depends on the biome (Forest: sleep, Volcano: " +
			"burn, Sea: lowers Attack, Cave: flinch...; paralysis if there is none).",
		shortDesc: "Effect varies with the biome or terrain. (30% chance)",
	},
};
