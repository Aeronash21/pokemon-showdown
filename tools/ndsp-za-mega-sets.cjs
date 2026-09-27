'use strict';

/*
 * ===========================================================
 * NDSP LEGENDS Z-A MEGA SETS
 * ===========================================================
 *
 * Dedicated random-battle sets for every Legends Z-A Mega in
 * the NDSP Pokédex (data/mods/ndsharedpower/pokedex.ts).
 *
 * Previously most of these Megas cloned their base form's sets,
 * which ignored the Mega's new stats, typing and ability. These
 * sets are built around the Mega itself, with a few rules:
 *
 * - A Mega always holds its Mega Stone and cannot Terastallize,
 *   Dynamax or use a Z-Move, so there are no Tera Blast,
 *   Dynamax, Z-Move, Choice or Assault Vest roles.
 * - Tera types default to the Mega's own types. They only steer
 *   which STAB the generator enforces.
 * - `abilities` are for the forme the Pokémon switches in as
 *   (before it Mega Evolves). In NDSP that ability also joins
 *   the shared pool, so useful ones are preferred.
 * - Singles sets feed RandBats / Monotype; Doubles sets feed
 *   FFA and the 2v2 formats.
 *
 * Used by tools/build-nd-shared-sets.cjs. Running this file
 * directly applies the sets to the current JSON pools:
 *
 *   node tools/ndsp-za-mega-sets.cjs
 */

const ZA_MEGA_SETS = {
	raichumegax: {
		// Electric Surge; 135 Atk / 110 Spe
		abilities: ['Lightning Rod'],
		singles: [
			{role: 'Fast Attacker', moves: ['Drain Punch', 'Knock Off', 'Play Rough', 'Volt Tackle']},
			{role: 'Fast Support', moves: ['Encore', 'Knock Off', 'Nuzzle', 'Volt Switch', 'Volt Tackle']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Drain Punch', 'Fake Out', 'Knock Off', 'Play Rough', 'Protect', 'Volt Tackle']},
			{role: 'Doubles Support', moves: ['Encore', 'Fake Out', 'Nuzzle', 'Volt Tackle']},
		],
	},

	raichumegay: {
		// No Guard; 160 SpA / 130 Spe - Zap Cannon and Focus Blast never miss
		abilities: ['Lightning Rod'],
		singles: [
			{role: 'Fast Attacker', moves: ['Focus Blast', 'Grass Knot', 'Surf', 'Volt Switch', 'Zap Cannon']},
			{role: 'Setup Sweeper', moves: ['Focus Blast', 'Grass Knot', 'Nasty Plot', 'Surf', 'Zap Cannon']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Fake Out', 'Focus Blast', 'Grass Knot', 'Protect', 'Zap Cannon']},
			{role: 'Doubles Setup Sweeper', moves: ['Focus Blast', 'Grass Knot', 'Nasty Plot', 'Protect', 'Zap Cannon']},
		],
	},

	clefablemega: {
		// Magic Bounce; Fairy/Flying, 135 SpA
		abilities: ['Magic Guard', 'Unaware'],
		singles: [
			{role: 'Bulky Support', moves: ['Air Slash', 'Knock Off', 'Moonblast', 'Moonlight', 'Stealth Rock', 'Thunder Wave']},
			{role: 'Bulky Setup', moves: ['Calm Mind', 'Fire Blast', 'Moonblast', 'Moonlight']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Follow Me', 'Heal Pulse', 'Helping Hand', 'Icy Wind', 'Moonblast', 'Protect']},
			{role: 'Bulky Protect', moves: ['Air Slash', 'Calm Mind', 'Moonblast', 'Moonlight', 'Protect']},
		],
	},

	victreebelmega: {
		// Innards Out; 125 Atk / 135 SpA - either side works
		abilities: ['Chlorophyll'],
		singles: [
			{role: 'Wallbreaker', moves: ['Knock Off', 'Leaf Storm', 'Sleep Powder', 'Sludge Wave', 'Sucker Punch']},
			{role: 'Bulky Attacker', moves: ['Giga Drain', 'Knock Off', 'Sleep Powder', 'Sludge Bomb', 'Strength Sap']},
			{role: 'Setup Sweeper', moves: ['Knock Off', 'Poison Jab', 'Power Whip', 'Sucker Punch', 'Swords Dance']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Leaf Storm', 'Protect', 'Sleep Powder', 'Sludge Bomb', 'Sucker Punch']},
			{role: 'Doubles Bulky Attacker', moves: ['Energy Ball', 'Protect', 'Sleep Powder', 'Sludge Bomb', 'Strength Sap']},
		],
	},

	starmiemega: {
		// Huge Power; physical despite 130 SpA
		abilities: ['Analytic', 'Natural Cure'],
		singles: [
			{role: 'Fast Attacker', moves: ['Aqua Jet', 'Flip Turn', 'Ice Spinner', 'Liquidation', 'Rapid Spin', 'Zen Headbutt']},
			{role: 'Fast Bulky Setup', moves: ['Bulk Up', 'Ice Spinner', 'Liquidation', 'Recover', 'Zen Headbutt']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Aqua Jet', 'Ice Spinner', 'Liquidation', 'Protect', 'Zen Headbutt']},
			{role: 'Doubles Setup Sweeper', moves: ['Bulk Up', 'Liquidation', 'Protect', 'Recover', 'Zen Headbutt']},
		],
	},

	dragonitemega: {
		// Multiscale; 145 SpA special attacker, or Dragon Dance
		abilities: ['Multiscale'],
		singles: [
			{role: 'Bulky Attacker', moves: ['Draco Meteor', 'Fire Blast', 'Hurricane', 'Roost', 'Thunderbolt']},
			{role: 'Setup Sweeper', moves: ['Dragon Dance', 'Earthquake', 'Extreme Speed', 'Fire Punch', 'Outrage']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Draco Meteor', 'Heat Wave', 'Hurricane', 'Protect', 'Tailwind']},
			{role: 'Doubles Setup Sweeper', moves: ['Dragon Dance', 'Extreme Speed', 'Fire Punch', 'Iron Head', 'Protect', 'Scale Shot']},
		],
	},

	meganiummega: {
		// Mega Sol: its moves act as if in sun - instant Solar Beam,
		// Fire-type Weather Ball, stronger Synthesis
		abilities: ['Overgrow'],
		singles: [
			{role: 'Bulky Attacker', moves: ['Dazzling Gleam', 'Earth Power', 'Solar Beam', 'Synthesis', 'Weather Ball']},
			{role: 'Bulky Support', moves: ['Dragon Tail', 'Leech Seed', 'Solar Beam', 'Synthesis', 'Weather Ball']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Dazzling Gleam', 'Earth Power', 'Protect', 'Solar Beam', 'Weather Ball']},
			{role: 'Bulky Protect', moves: ['Leech Seed', 'Protect', 'Solar Beam', 'Synthesis', 'Weather Ball']},
		],
	},

	feraligatrmega: {
		// Dragonize: Normal moves become 1.2x Dragon (Double-Edge).
		// Pools are kept at four moves because the generator does not
		// know Double-Edge is its Dragon STAB and could drop it.
		abilities: ['Sheer Force'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Double-Edge', 'Dragon Dance', 'Earthquake', 'Liquidation']},
			{role: 'Wallbreaker', moves: ['Aqua Jet', 'Double-Edge', 'Earthquake', 'Liquidation']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Double-Edge', 'Ice Punch', 'Liquidation', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Double-Edge', 'Dragon Dance', 'Liquidation', 'Protect']},
		],
	},

	skarmorymega: {
		// Stalwart; 140 Atk / 110 Spe
		abilities: ['Sturdy'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Brave Bird', 'Drill Run', 'Iron Head', 'Roost', 'Swords Dance']},
			{role: 'Fast Support', moves: ['Brave Bird', 'Iron Head', 'Roost', 'Spikes', 'Stealth Rock']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Brave Bird', 'Drill Run', 'Iron Head', 'Protect', 'Tailwind']},
			{role: 'Doubles Setup Sweeper', moves: ['Brave Bird', 'Iron Head', 'Protect', 'Roost', 'Swords Dance']},
		],
	},

	chimechomega: {
		// Levitate; Psychic/Steel, 135 SpA / 120 SpD
		abilities: ['Levitate'],
		singles: [
			{role: 'Bulky Setup', moves: ['Calm Mind', 'Flash Cannon', 'Psyshock', 'Recover', 'Shadow Ball']},
			{role: 'Bulky Support', moves: ['Flash Cannon', 'Knock Off', 'Psychic Noise', 'Recover', 'Thunder Wave']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Flash Cannon', 'Helping Hand', 'Protect', 'Psychic', 'Trick Room']},
			{role: 'Bulky Protect', moves: ['Calm Mind', 'Flash Cannon', 'Protect', 'Psyshock', 'Recover']},
		],
	},

	absolmegaz: {
		// Sharpness; Dark/Ghost, 154 Atk / 151 Spe
		abilities: ['Super Luck'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Night Slash', 'Psycho Cut', 'Shadow Claw', 'Sucker Punch', 'Swords Dance']},
			{role: 'Fast Attacker', moves: ['Close Combat', 'Night Slash', 'Psycho Cut', 'Shadow Claw', 'Sucker Punch']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Night Slash', 'Protect', 'Psycho Cut', 'Shadow Claw', 'Sucker Punch']},
			{role: 'Doubles Setup Sweeper', moves: ['Night Slash', 'Protect', 'Psycho Cut', 'Sucker Punch', 'Swords Dance']},
		],
	},

	staraptormega: {
		// Contrary: Close Combat raises Atk/Def/SpD
		abilities: ['Intimidate', 'Reckless'],
		singles: [
			{role: 'Fast Attacker', moves: ['Brave Bird', 'Close Combat', 'Double-Edge', 'Quick Attack', 'U-turn']},
			{role: 'Bulky Attacker', moves: ['Brave Bird', 'Close Combat', 'Defog', 'Roost', 'U-turn']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Brave Bird', 'Close Combat', 'Protect', 'Quick Attack', 'Tailwind']},
			{role: 'Doubles Fast Attacker', moves: ['Brave Bird', 'Close Combat', 'Quick Attack', 'Tailwind', 'U-turn']},
		],
	},

	garchompmegaz: {
		// Levitate; 141 SpA / 130 Atk / 151 Spe
		abilities: ['Rough Skin'],
		singles: [
			{role: 'Fast Attacker', moves: ['Draco Meteor', 'Dragon Pulse', 'Earth Power', 'Fire Blast', 'Stealth Rock']},
			{role: 'Setup Sweeper', moves: ['Earthquake', 'Fire Fang', 'Outrage', 'Stone Edge', 'Swords Dance']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Draco Meteor', 'Dragon Pulse', 'Earth Power', 'Fire Blast', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Dragon Claw', 'Protect', 'Rock Slide', 'Stomping Tantrum', 'Swords Dance']},
		],
	},

	lucariomegaz: {
		// Aura Guard (halves contact damage); 164 SpA / 151 Spe
		abilities: ['Justified', 'Inner Focus'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Aura Sphere', 'Dark Pulse', 'Flash Cannon', 'Nasty Plot', 'Vacuum Wave']},
			{role: 'Fast Attacker', moves: ['Aura Sphere', 'Dragon Pulse', 'Flash Cannon', 'Shadow Ball', 'Vacuum Wave']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Aura Sphere', 'Dark Pulse', 'Flash Cannon', 'Protect', 'Vacuum Wave']},
			{role: 'Doubles Setup Sweeper', moves: ['Aura Sphere', 'Flash Cannon', 'Nasty Plot', 'Protect', 'Vacuum Wave']},
		],
	},

	froslassmega: {
		// Snow Warning: Blizzard never misses, Aurora Veil works
		abilities: ['Cursed Body'],
		singles: [
			{role: 'Fast Support', moves: ['Aurora Veil', 'Blizzard', 'Destiny Bond', 'Shadow Ball', 'Spikes', 'Taunt']},
			{role: 'Setup Sweeper', moves: ['Blizzard', 'Nasty Plot', 'Shadow Ball', 'Thunderbolt']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Aurora Veil', 'Blizzard', 'Icy Wind', 'Shadow Ball']},
			{role: 'Offensive Protect', moves: ['Blizzard', 'Nasty Plot', 'Protect', 'Shadow Ball', 'Thunderbolt']},
		],
	},

	heatranmega: {
		// Flash Fire; 175 SpA / 141 SpD
		abilities: ['Flash Fire'],
		singles: [
			{role: 'Bulky Support', moves: ['Earth Power', 'Flash Cannon', 'Magma Storm', 'Stealth Rock', 'Taunt']},
			{role: 'Wallbreaker', moves: ['Dragon Pulse', 'Earth Power', 'Fire Blast', 'Flash Cannon', 'Magma Storm']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Earth Power', 'Flash Cannon', 'Heat Wave', 'Protect']},
			{role: 'Bulky Protect', moves: ['Earth Power', 'Flash Cannon', 'Magma Storm', 'Protect', 'Taunt']},
		],
	},

	darkraimega: {
		// Bad Dreams; 165 SpA
		abilities: ['Bad Dreams'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Dark Pulse', 'Focus Blast', 'Hypnosis', 'Nasty Plot', 'Sludge Bomb']},
			{role: 'Wallbreaker', moves: ['Dark Pulse', 'Focus Blast', 'Ice Beam', 'Sludge Bomb', 'Thunderbolt']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Dark Pulse', 'Focus Blast', 'Hypnosis', 'Protect', 'Sludge Bomb']},
			{role: 'Doubles Setup Sweeper', moves: ['Dark Pulse', 'Focus Blast', 'Nasty Plot', 'Protect', 'Sludge Bomb']},
		],
	},

	emboarmega: {
		// Mold Breaker; 148 Atk. Reckless joins the shared pool.
		abilities: ['Reckless'],
		singles: [
			{role: 'Wallbreaker', moves: ['Close Combat', 'Flare Blitz', 'Head Smash', 'Knock Off', 'Wild Charge']},
			{role: 'Setup Sweeper', moves: ['Bulk Up', 'Drain Punch', 'Earthquake', 'Flare Blitz', 'Knock Off']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Close Combat', 'Flare Blitz', 'Head Smash', 'Knock Off', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Bulk Up', 'Drain Punch', 'Flare Blitz', 'Protect']},
		],
	},

	excadrillmega: {
		// Piercing Drill: contact moves hit through Protect
		abilities: ['Mold Breaker'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Earthquake', 'Iron Head', 'Rapid Spin', 'Rock Slide', 'Swords Dance']},
			{role: 'Fast Support', moves: ['Earthquake', 'Iron Head', 'Rapid Spin', 'Rock Slide', 'Stealth Rock']},
		],
		doubles: [
			{role: 'Doubles Setup Sweeper', moves: ['High Horsepower', 'Iron Head', 'Protect', 'Rock Slide', 'Swords Dance']},
			{role: 'Offensive Protect', moves: ['High Horsepower', 'Iron Head', 'Protect', 'Rock Slide']},
		],
	},

	scolipedemega: {
		// Shell Armor; 140 Atk / 149 Def. Speed Boost joins the shared pool.
		abilities: ['Speed Boost'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Earthquake', 'Gunk Shot', 'Megahorn', 'Rock Slide', 'Swords Dance']},
			{role: 'Bulky Support', moves: ['Earthquake', 'Megahorn', 'Poison Jab', 'Spikes', 'Toxic Spikes']},
		],
		doubles: [
			{role: 'Doubles Setup Sweeper', moves: ['Megahorn', 'Poison Jab', 'Protect', 'Rock Slide', 'Swords Dance']},
			{role: 'Offensive Protect', moves: ['Gunk Shot', 'Megahorn', 'Protect', 'Rock Slide', 'Superpower']},
		],
	},

	scraftymega: {
		// Intimidate; 130 Atk / 135 Def / 135 SpD
		abilities: ['Intimidate'],
		singles: [
			{role: 'Bulky Setup', moves: ['Bulk Up', 'Drain Punch', 'Ice Punch', 'Knock Off', 'Poison Jab']},
			{role: 'Setup Sweeper', moves: ['Close Combat', 'Dragon Dance', 'Ice Punch', 'Knock Off']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Coaching', 'Drain Punch', 'Fake Out', 'Knock Off', 'Protect']},
			{role: 'Doubles Bulky Setup', moves: ['Bulk Up', 'Drain Punch', 'Knock Off', 'Protect']},
		],
	},

	eelektrossmega: {
		// Eelevate: Levitate + boosts its best stat after a KO
		abilities: ['Levitate'],
		singles: [
			{role: 'Fast Attacker', moves: ['Close Combat', 'Fire Punch', 'Knock Off', 'Supercell Slam', 'U-turn']},
			{role: 'Bulky Setup', moves: ['Coil', 'Drain Punch', 'Fire Punch', 'Knock Off', 'Supercell Slam']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Close Combat', 'Fire Punch', 'Knock Off', 'Protect', 'Supercell Slam']},
			{role: 'Doubles Bulky Attacker', moves: ['Electroweb', 'Flamethrower', 'Giga Drain', 'Protect', 'Thunderbolt']},
		],
	},

	chandeluremega: {
		// Infiltrator; 175 SpA
		abilities: ['Flash Fire', 'Infiltrator'],
		singles: [
			{role: 'Bulky Setup', moves: ['Calm Mind', 'Flamethrower', 'Pain Split', 'Shadow Ball', 'Substitute']},
			{role: 'Wallbreaker', moves: ['Energy Ball', 'Fire Blast', 'Psychic', 'Shadow Ball']},
		],
		doubles: [
			{role: 'Doubles Wallbreaker', moves: ['Energy Ball', 'Heat Wave', 'Protect', 'Shadow Ball', 'Trick Room']},
			{role: 'Offensive Protect', moves: ['Energy Ball', 'Heat Wave', 'Protect', 'Shadow Ball', 'Will-O-Wisp']},
		],
	},

	golurkmega: {
		// Unseen Fist: contact moves ignore Protect. Iron Fist joins the pool.
		abilities: ['Iron Fist', 'No Guard'],
		singles: [
			{role: 'Wallbreaker', moves: ['Drain Punch', 'Headlong Rush', 'Ice Punch', 'Poltergeist']},
			{role: 'Setup Sweeper', moves: ['Headlong Rush', 'Ice Punch', 'Poltergeist', 'Rock Polish']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Drain Punch', 'Headlong Rush', 'Ice Punch', 'Poltergeist', 'Protect']},
			{role: 'Doubles Bulky Attacker', moves: ['High Horsepower', 'Ice Punch', 'Poltergeist', 'Protect', 'Rock Slide']},
		],
	},

	chesnaughtmega: {
		// Bulletproof; 172 Def
		abilities: ['Bulletproof'],
		singles: [
			{role: 'Bulky Support', moves: ['Body Press', 'Knock Off', 'Leech Seed', 'Spikes', 'Synthesis', 'Wood Hammer']},
			{role: 'Bulky Setup', moves: ['Body Press', 'Iron Defense', 'Seed Bomb', 'Synthesis']},
		],
		doubles: [
			{role: 'Bulky Protect', moves: ['Body Press', 'Drain Punch', 'Iron Defense', 'Spiky Shield', 'Wood Hammer']},
			{role: 'Doubles Support', moves: ['Coaching', 'Knock Off', 'Rock Tomb', 'Spiky Shield', 'Wide Guard', 'Wood Hammer']},
		],
	},

	delphoxmega: {
		// Levitate; 159 SpA / 134 Spe
		abilities: ['Blaze'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Fire Blast', 'Focus Blast', 'Grass Knot', 'Nasty Plot', 'Psyshock']},
			{role: 'Fast Attacker', moves: ['Dazzling Gleam', 'Fire Blast', 'Grass Knot', 'Psychic', 'Shadow Ball']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Dazzling Gleam', 'Grass Knot', 'Heat Wave', 'Protect', 'Psychic']},
			{role: 'Doubles Setup Sweeper', moves: ['Heat Wave', 'Nasty Plot', 'Protect', 'Psyshock']},
		],
	},

	greninjamega: {
		// Protean (Mega keeps it); 133 SpA / 125 Atk / 142 Spe
		abilities: ['Protean'],
		singles: [
			{role: 'Fast Attacker', moves: ['Dark Pulse', 'Grass Knot', 'Hydro Pump', 'Ice Beam', 'U-turn']},
			{role: 'Fast Support', moves: ['Dark Pulse', 'Ice Beam', 'Spikes', 'Surf', 'Toxic Spikes', 'U-turn']},
			{role: 'Setup Sweeper', moves: ['Gunk Shot', 'Ice Punch', 'Liquidation', 'Night Slash', 'Swords Dance']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Dark Pulse', 'Grass Knot', 'Hydro Pump', 'Icy Wind', 'Protect']},
			{role: 'Doubles Fast Attacker', moves: ['Dark Pulse', 'Hydro Pump', 'Ice Beam', 'Taunt', 'U-turn']},
		],
	},

	pyroarmega: {
		// Fire Mane: 1.5x Fire moves; 129 SpA / 126 Spe
		abilities: ['Moxie', 'Unnerve'],
		singles: [
			{role: 'Fast Attacker', moves: ['Dark Pulse', 'Fire Blast', 'Hyper Voice', 'Scorching Sands']},
			{role: 'Setup Sweeper', moves: ['Dark Pulse', 'Fire Blast', 'Hyper Voice', 'Scorching Sands', 'Work Up']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Dark Pulse', 'Heat Wave', 'Hyper Voice', 'Protect', 'Scorching Sands']},
			{role: 'Doubles Fast Attacker', moves: ['Fire Blast', 'Heat Wave', 'Hyper Voice', 'Snarl']},
		],
	},

	floettemega: {
		// Fairy Aura; 155 SpA / 148 SpD, Light of Ruin
		abilities: ['Flower Veil'],
		singles: [
			{role: 'Fast Attacker', moves: ['Energy Ball', 'Light of Ruin', 'Moonblast', 'Psychic']},
			{role: 'Bulky Setup', moves: ['Calm Mind', 'Energy Ball', 'Moonblast', 'Synthesis']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Dazzling Gleam', 'Energy Ball', 'Light of Ruin', 'Moonblast', 'Protect']},
			{role: 'Doubles Bulky Setup', moves: ['Calm Mind', 'Dazzling Gleam', 'Moonblast', 'Protect', 'Synthesis']},
		],
	},

	meowsticfmega: {
		// Trace; 143 SpA / 124 Spe. Competitive before Mega Evolving.
		abilities: ['Competitive'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Alluring Voice', 'Nasty Plot', 'Psyshock', 'Shadow Ball', 'Thunderbolt']},
			{role: 'Fast Attacker', moves: ['Dark Pulse', 'Energy Ball', 'Psychic', 'Shadow Ball', 'Thunderbolt']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Alluring Voice', 'Fake Out', 'Protect', 'Psychic', 'Shadow Ball']},
			{role: 'Doubles Setup Sweeper', moves: ['Nasty Plot', 'Protect', 'Psyshock', 'Shadow Ball']},
		],
	},

	meowsticmmega: {
		// Trace; Prankster support before Mega Evolving
		abilities: ['Prankster'],
		singles: [
			{role: 'Fast Support', moves: ['Light Screen', 'Psychic Noise', 'Reflect', 'Thunder Wave', 'Yawn']},
			{role: 'Setup Sweeper', moves: ['Energy Ball', 'Nasty Plot', 'Psyshock', 'Shadow Ball', 'Thunderbolt']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Fake Out', 'Light Screen', 'Psychic', 'Reflect']},
			{role: 'Offensive Protect', moves: ['Fake Out', 'Protect', 'Psychic', 'Shadow Ball', 'Thunderbolt']},
		],
	},

	malamarmega: {
		// Contrary: Superpower raises Atk/Def, so it is in every set.
		abilities: ['Contrary'],
		singles: [
			{role: 'Bulky Setup', moves: ['Knock Off', 'Rest', 'Sleep Talk', 'Superpower']},
			{role: 'Fast Attacker', moves: ['Knock Off', 'Psycho Cut', 'Rock Slide', 'Superpower']},
		],
		doubles: [
			{role: 'Bulky Protect', moves: ['Knock Off', 'Protect', 'Superpower', 'Trick Room']},
			{role: 'Doubles Wallbreaker', moves: ['Knock Off', 'Psycho Cut', 'Superpower', 'Trick Room']},
		],
	},

	barbaraclemega: {
		// Tough Claws; 140 Atk / 130 Def, Shell Smash
		abilities: ['Tough Claws'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Close Combat', 'Earthquake', 'Liquidation', 'Shell Smash', 'Stone Edge']},
			{role: 'Bulky Support', moves: ['Close Combat', 'Liquidation', 'Stealth Rock', 'Stone Edge']},
		],
		doubles: [
			{role: 'Doubles Setup Sweeper', moves: ['Close Combat', 'Liquidation', 'Protect', 'Rock Slide', 'Shell Smash']},
			{role: 'Offensive Protect', moves: ['Close Combat', 'Liquidation', 'Protect', 'Rock Slide']},
		],
	},

	dragalgemega: {
		// Regenerator; 132 SpA / 163 SpD. Adaptability joins the pool.
		abilities: ['Adaptability'],
		singles: [
			{role: 'Bulky Attacker', moves: ['Draco Meteor', 'Flip Turn', 'Focus Blast', 'Sludge Bomb', 'Toxic Spikes']},
			{role: 'Wallbreaker', moves: ['Draco Meteor', 'Focus Blast', 'Hydro Pump', 'Sludge Wave']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Draco Meteor', 'Focus Blast', 'Icy Wind', 'Protect', 'Sludge Bomb']},
			{role: 'Offensive Protect', moves: ['Dragon Pulse', 'Hydro Pump', 'Protect', 'Sludge Bomb']},
		],
	},

	hawluchamega: {
		// No Guard: High Jump Kick and Stone Edge never miss
		abilities: ['Mold Breaker'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Brave Bird', 'Close Combat', 'Stone Edge', 'Swords Dance', 'Throat Chop']},
			{role: 'Fast Attacker', moves: ['Brave Bird', 'Encore', 'High Jump Kick', 'Roost', 'Stone Edge', 'U-turn']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Brave Bird', 'Close Combat', 'Protect', 'Rock Slide']},
			{role: 'Doubles Setup Sweeper', moves: ['Brave Bird', 'Close Combat', 'Protect', 'Swords Dance']},
		],
	},

	zygardemega: {
		// Official path: Zygardite only works on Zygarde-Complete, so
		// Power Construct must first turn it Complete (below half HP)
		// before it can Mega Evolve into 216 HP / 216 SpA.
		// Every set has Core Enforcer, which becomes Nihil Light when
		// it Mega Evolves (config/custom-formats.ts). Pools are kept
		// at four moves so Core Enforcer is always picked.
		abilities: ['Power Construct'],
		singles: [
			{role: 'Wallbreaker', moves: ['Core Enforcer', 'Earth Power', 'Focus Blast', 'Sludge Wave']},
			{role: 'Bulky Attacker', moves: ['Core Enforcer', 'Earth Power', 'Glare', 'Pain Split']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Core Enforcer', 'Earth Power', 'Glare', 'Protect']},
			{role: 'Offensive Protect', moves: ['Core Enforcer', 'Earth Power', 'Focus Blast', 'Protect']},
		],
	},

	crabominablemega: {
		// Iron Fist; 157 Atk, very slow
		abilities: ['Iron Fist'],
		singles: [
			{role: 'Wallbreaker', moves: ['Drain Punch', 'Earthquake', 'Ice Hammer', 'Knock Off', 'Mach Punch']},
			{role: 'Bulky Setup', moves: ['Bulk Up', 'Drain Punch', 'Ice Hammer', 'Knock Off']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Drain Punch', 'Ice Hammer', 'Knock Off', 'Mach Punch', 'Protect']},
			{role: 'Doubles Bulky Setup', moves: ['Bulk Up', 'Drain Punch', 'Ice Hammer', 'Protect']},
		],
	},

	golisopodmega: {
		// Tough Claws; 150 Atk / 175 Def
		abilities: ['Emergency Exit'],
		singles: [
			{role: 'Wallbreaker', moves: ['Aqua Jet', 'First Impression', 'Iron Head', 'Leech Life', 'Liquidation']},
			{role: 'Bulky Setup', moves: ['Close Combat', 'Iron Head', 'Leech Life', 'Liquidation', 'Swords Dance']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['First Impression', 'Iron Head', 'Leech Life', 'Liquidation', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Iron Head', 'Leech Life', 'Protect', 'Swords Dance']},
		],
	},

	drampamega: {
		// Berserk; 160 SpA, very slow
		abilities: ['Berserk'],
		singles: [
			{role: 'Bulky Attacker', moves: ['Draco Meteor', 'Fire Blast', 'Glare', 'Hyper Voice', 'Roost']},
			{role: 'Bulky Setup', moves: ['Calm Mind', 'Dragon Pulse', 'Hyper Voice', 'Roost']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Draco Meteor', 'Heat Wave', 'Hyper Voice', 'Protect']},
			{role: 'Bulky Protect', moves: ['Calm Mind', 'Dragon Pulse', 'Hyper Voice', 'Protect', 'Roost']},
		],
	},

	magearnamega: {
		// Soul-Heart; 170 SpA
		abilities: ['Soul-Heart'],
		singles: [
			{role: 'Bulky Setup', moves: ['Aura Sphere', 'Calm Mind', 'Flash Cannon', 'Fleur Cannon', 'Pain Split']},
			{role: 'Setup Sweeper', moves: ['Aura Sphere', 'Flash Cannon', 'Fleur Cannon', 'Shift Gear']},
			{role: 'Bulky Attacker', moves: ['Aura Sphere', 'Flash Cannon', 'Fleur Cannon', 'Pain Split', 'Spikes', 'Volt Switch']},
		],
		doubles: [
			{role: 'Doubles Bulky Attacker', moves: ['Aura Sphere', 'Dazzling Gleam', 'Flash Cannon', 'Protect', 'Trick Room']},
			{role: 'Doubles Wallbreaker', moves: ['Aura Sphere', 'Flash Cannon', 'Fleur Cannon', 'Trick Room']},
		],
	},

	// Same Mega, different base forme.
	magearnaoriginalmega: 'magearnamega',

	zeraoramega: {
		// Volt Absorb; 157 Atk / 147 SpA / 153 Spe
		abilities: ['Volt Absorb'],
		singles: [
			{role: 'Fast Attacker', moves: ['Close Combat', 'Knock Off', 'Plasma Fists', 'Play Rough', 'Volt Switch']},
			{role: 'Setup Sweeper', moves: ['Bulk Up', 'Drain Punch', 'Knock Off', 'Plasma Fists', 'Play Rough']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Close Combat', 'Fake Out', 'Knock Off', 'Plasma Fists', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Bulk Up', 'Drain Punch', 'Plasma Fists', 'Protect']},
		],
	},

	falinksmega: {
		// Defiant; No Retreat
		abilities: ['Defiant'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Close Combat', 'Iron Head', 'Knock Off', 'No Retreat', 'Rock Slide']},
			{role: 'Wallbreaker', moves: ['Close Combat', 'First Impression', 'Iron Head', 'Knock Off', 'Rock Slide']},
		],
		doubles: [
			{role: 'Doubles Setup Sweeper', moves: ['Close Combat', 'Knock Off', 'No Retreat', 'Protect', 'Rock Slide']},
			{role: 'Offensive Protect', moves: ['Close Combat', 'First Impression', 'Knock Off', 'Protect', 'Rock Slide']},
		],
	},

	scovillainmega: {
		// Spicy Spray (burns attackers); 138 Atk / 138 SpA
		abilities: ['Insomnia', 'Chlorophyll'],
		singles: [
			{role: 'Wallbreaker', moves: ['Crunch', 'Energy Ball', 'Fire Blast', 'Leaf Storm', 'Overheat']},
			{role: 'Bulky Support', moves: ['Flamethrower', 'Giga Drain', 'Leech Seed', 'Will-O-Wisp']},
			{role: 'Fast Attacker', moves: ['Crunch', 'Flare Blitz', 'Seed Bomb', 'Zen Headbutt']},
		],
		doubles: [
			{role: 'Doubles Support', moves: ['Burning Jealousy', 'Energy Ball', 'Helping Hand', 'Rage Powder', 'Will-O-Wisp']},
			{role: 'Offensive Protect', moves: ['Energy Ball', 'Fire Blast', 'Leaf Storm', 'Protect']},
		],
	},

	glimmoramega: {
		// Adaptability; 150 SpA
		abilities: ['Toxic Debris'],
		singles: [
			{role: 'Fast Support', moves: ['Earth Power', 'Mortal Spin', 'Power Gem', 'Sludge Wave', 'Spikes', 'Stealth Rock']},
			{role: 'Wallbreaker', moves: ['Dazzling Gleam', 'Earth Power', 'Energy Ball', 'Power Gem', 'Sludge Wave']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Earth Power', 'Power Gem', 'Protect', 'Sludge Bomb']},
			{role: 'Bulky Protect', moves: ['Mortal Spin', 'Power Gem', 'Sludge Bomb', 'Spiky Shield']},
		],
	},

	tatsugiricurlymega: {
		// Storm Drain; 135 SpA
		abilities: ['Storm Drain'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Dragon Pulse', 'Hydro Pump', 'Icy Wind', 'Nasty Plot', 'Rapid Spin']},
			{role: 'Fast Support', moves: ['Draco Meteor', 'Hydro Pump', 'Rapid Spin', 'Taunt']},
		],
		doubles: [
			{role: 'Offensive Protect', moves: ['Draco Meteor', 'Icy Wind', 'Muddy Water', 'Protect']},
			{role: 'Doubles Setup Sweeper', moves: ['Dragon Pulse', 'Muddy Water', 'Nasty Plot', 'Protect']},
		],
	},

	tatsugiridroopymega: 'tatsugiricurlymega',
	tatsugiristretchymega: 'tatsugiricurlymega',

	baxcaliburmega: {
		// Thermal Exchange; 175 Atk
		abilities: ['Thermal Exchange'],
		singles: [
			{role: 'Setup Sweeper', moves: ['Dragon Dance', 'Earthquake', 'Glaive Rush', 'Icicle Crash']},
			{role: 'Setup Sweeper', moves: ['Earthquake', 'Ice Shard', 'Icicle Crash', 'Scale Shot', 'Swords Dance']},
		],
		doubles: [
			{role: 'Doubles Setup Sweeper', moves: ['Dragon Dance', 'Glaive Rush', 'High Horsepower', 'Icicle Crash', 'Protect']},
			{role: 'Offensive Protect', moves: ['Glaive Rush', 'High Horsepower', 'Ice Shard', 'Icicle Crash', 'Protect']},
		],
	},
};

/*
 * -----------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------
 */
const toID = text =>
	String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

function resolve(id) {
	let entry = ZA_MEGA_SETS[id];

	while (typeof entry === 'string') entry = ZA_MEGA_SETS[entry];

	return entry;
}

function learnableMoves(dex, species) {
	const moves = new Set();
	const seen = new Set();

	const addFrom = start => {
		let current = start;

		while (current?.exists && !seen.has(current.id)) {
			seen.add(current.id);

			const own = Object.keys(dex.species.getLearnsetData(current.id)?.learnset || {});

			for (const move of own) moves.add(move);

			const base = dex.species.get(current.changesFrom || current.baseSpecies);

			if (
				base.id !== current.id &&
				(own.length < 20 || current.changesFrom || current.battleOnly || current.isMega)
			) {
				addFrom(base);
			}

			current = current.prevo ? dex.species.get(current.prevo) : null;
		}
	};

	addFrom(species);

	return moves;
}

// The forme(s) the Mega switches in as.
function preMegaFormes(dex, species) {
	const names = Array.isArray(species.battleOnly) ?
		species.battleOnly :
		[species.battleOnly || species.changesFrom || species.baseSpecies];

	return names.map(name => dex.species.get(name));
}

/*
 * Check every set (moves learnable, abilities legal) and throw
 * with a readable list of problems.
 */
function validate(dex) {
	const problems = [];

	for (const id of Object.keys(ZA_MEGA_SETS)) {
		const species = dex.species.get(id);

		if (!species.exists || !species.isMega) {
			problems.push(`${id}: not a Mega in this dex`);
			continue;
		}

		const entry = resolve(id);
		const learnable = learnableMoves(dex, species);

		for (const forme of preMegaFormes(dex, species)) {
			const legal = Object.values(forme.abilities);

			for (const ability of entry.abilities) {
				if (!legal.includes(ability)) {
					problems.push(`${species.name}: ${forme.name} cannot have ${ability}`);
				}
			}
		}

		for (const [pool, templates] of [['singles', entry.singles], ['doubles', entry.doubles]]) {
			for (const template of templates) {
				for (const name of template.moves) {
					const move = dex.moves.get(name);

					if (!move.exists || move.name !== name) {
						problems.push(`${species.name} (${pool} ${template.role}): unknown move "${name}"`);
					} else if (!learnable.has(move.id)) {
						problems.push(`${species.name} (${pool} ${template.role}): cannot learn ${name}`);
					}
				}
			}
		}
	}

	if (problems.length) {
		throw new Error('Invalid Z-A Mega sets:\n  ' + problems.join('\n  '));
	}
}

/*
 * Replace the sets of every Z-A Mega in both pools.
 * Existing levels are kept.
 */
function applyZAMegaSets(singles, doubles, dex) {
	validate(dex);

	let count = 0;

	for (const id of Object.keys(ZA_MEGA_SETS)) {
		const species = dex.species.get(id);
		const entry = resolve(id);

		for (const [table, templates] of [[singles, entry.singles], [doubles, entry.doubles]]) {
			const level = table[id]?.level ?? table[toID(species.baseSpecies)]?.level;

			table[id] = {
				...(typeof level === 'number' ? {level} : {}),

				sets: templates.map(template => ({
					role: template.role,
					movepool: [...template.moves].sort(),
					abilities: [...(template.abilities || entry.abilities)],
					teraTypes: [...(template.teraTypes || entry.teraTypes || species.types)],
				})),
			};

			count += templates.length;
		}
	}

	console.log(
		`Z-A Megas: wrote ${count} sets for ${Object.keys(ZA_MEGA_SETS).length} Megas`
	);
}

module.exports = {
	ZA_MEGA_SETS,
	applyZAMegaSets,
	validate,
};

/*
 * Run directly: apply to the current JSON pools.
 */
if (require.main === module) {
	const fs = require('fs');
	const path = require('path');
	const {Dex} = require('../dist/sim/dex');

	const dex = Dex.mod('ndsharedpower');
	const dir = path.resolve(__dirname, '../data/random-battles/ndsharedpower');
	const singlesPath = path.join(dir, 'sets.json');
	const doublesPath = path.join(dir, 'doubles-sets.json');

	const singles = JSON.parse(fs.readFileSync(singlesPath, 'utf8'));
	const doubles = JSON.parse(fs.readFileSync(doublesPath, 'utf8'));

	applyZAMegaSets(singles, doubles, dex);

	fs.writeFileSync(singlesPath, JSON.stringify(singles, null, 2) + '\n');
	fs.writeFileSync(doublesPath, JSON.stringify(doubles, null, 2) + '\n');
}
