/*
 * ===========================================================
 * POKÉROGUE FORMATS
 * ===========================================================
 *
 * National Dex with PokéRogue's Pokémon, stats, move lists (level-up,
 * TM, all four egg moves) and passives. Gigantamax forms work like
 * Mega Evolutions with Max Mushrooms. Tera is allowed, except for
 * Pokémon holding a Mega Stone or Max Mushrooms.
 *
 * Singles tiers: Smogon National Dex tiers + the PokéRogue changes in
 * data/mods/pokerogue/tiers.ts.
 *
 * "<Pokémon> + <Ability>" bans below are PASSIVE bans: that Pokémon is
 * legal, but only with its passive switched off in the teambuilder.
 * A plain ability ban (e.g. 'Arena Trap') also bans it as a passive.
 */

const POKEROGUE_DESC = `Pok&eacute;Rogue: every Pok&eacute;mon has its Pok&eacute;Rogue passive ability ` +
	`(toggle it on or off in the teambuilder), egg moves and move list. Gigantamax works like Mega Evolution ` +
	`with Max Mushrooms. Mega and Gigantamax Pok&eacute;mon can't Terastallize.`;

export const PokeRogueFormats: import('../sim/dex-formats').FormatList = [
	{
		section: 'PokeRogue',
		column: 2,
	},

	// ========================================================
	// SINGLES
	// ========================================================

	{
		name: '[Gen 9] PokeRogue OU',
		desc: POKEROGUE_DESC,
		mod: 'pokerogue',
		ruleset: ['Standard NatDex', 'PokeRogue Mod'],
		banlist: [
			// Smogon National Dex OU
			'ND Uber', 'ND AG', 'Arena Trap', 'Moody', 'Power Construct', 'Shadow Tag', "King's Rock",
			'Quick Claw', 'Razor Fang', 'Assist', 'Baton Pass', 'Last Respects', 'Shed Tail',
			// PokéRogue: egg move / passive additions
			'Revival Blessing', 'Simple', 'Primordial Sea', 'Desolate Land',
			// Passive bans
			'Articuno-Galar + Serene Grace', // 40% freeze Freezing Glare
			'Blacephalon + Magic Guard', // recoil-free Mind Blown
			'Dragonite + Aerilate', // Flying Extreme Speed / Crush Grip
			'Drampa-Mega + Adaptability', // 160 Sp. Atk Adaptability Boomburst / Draco Meteor
			'Flapple-Gmax + No Guard', // Hustle with no accuracy drop
			'Floette-Eternal + Magic Guard', // recoil-free Light of Ruin
			'Gallade-Mega + Sharpness', // 165 Atk, 1.5x Sacred Sword / Psycho Cut / Leaf Blade
			'Heracross-Mega + Technician', // Technician + Skill Link Pin Missile / Rock Blast
			'Kingambit + Sword of Ruin', // Supreme Overlord + Sword of Ruin
			'Scolipede-Mega + Speed Boost', // 140 Atk / 149 Def Speed Boost
			'Shedinja + Magic Guard', // Wonder Guard with no indirect damage
			'Swampert-Mega + Drizzle', // sets its own rain for Swift Swim
			'Thundurus-Therian + Drizzle', // 100% accurate Thunder / Hurricane + Nasty Plot
			'Typhlosion + Drought', // sun Eruption (Typhlosion and Hisuian Typhlosion)
		],
	},
	{
		name: '[Gen 9] PokeRogue Ubers',
		desc: POKEROGUE_DESC,
		mod: 'pokerogue',
		ruleset: [
			'Standard NatDex', 'PokeRogue Mod', '!Evasion Clause', 'Evasion Moves Clause', 'Evasion Items Clause',
			'Mega Rayquaza Clause',
		],
		banlist: [
			// Smogon National Dex Ubers
			'ND AG', 'Shedinja', 'Assist', 'Baton Pass',
			// PokéRogue
			'Moody',
			'Zygardite', // Zygarde-Mega (778 BST)
			// Passive bans
			'Arceus + Adaptability', // Adaptability Multi-Attack / Judgment of any type, plus No Retreat
			'Deoxys-Attack + Adaptability', // 180 / 180 attacking stats with 2x STAB
		],
	},
	{
		name: '[Gen 9] PokeRogue AG',
		desc: POKEROGUE_DESC,
		mod: 'pokerogue',
		ruleset: ['Standard AG', 'PokeRogue Mod'],
	},

	// ========================================================
	// RANDOM BATTLES
	// Sets: tools/pokerogue/build-random-sets.cjs (egg moves and
	// passives worked into the sets; levels drop for stronger sets)
	// ========================================================

	{
		name: '[Gen 9] PokeRogue Random Battle',
		desc: `Randomized teams of Pok&eacute;Rogue Pok&eacute;mon whose sets use their egg moves and passives. ` +
			`Levels are lower for Pok&eacute;mon their passive and egg moves make stronger.`,
		mod: 'pokerogue',
		team: 'random',
		ruleset: [
			'Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod',
			'PokeRogue Mod',
		],
	},
	{
		name: '[Gen 9] PokeRogue FFA Random Battle',
		desc: `Four-player free-for-all with random Pok&eacute;Rogue teams (egg moves and passives included).`,
		mod: 'pokerogue',
		team: 'random',
		gameType: 'freeforall',
		tournamentShow: false,
		ruleset: [
			'Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod',
			'PokeRogue Mod',
		],
	},

	// ========================================================
	// VGC DOUBLES (level 50, bring 6 pick 4)
	// ========================================================

	{
		name: '[Gen 9] PokeRogue VGC',
		desc: `${POKEROGUE_DESC} VGC rules; no Restricted Legendaries or Mythicals.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'PokeRogue Mod'],
		banlist: [
			'Smeargle + Prankster', // priority Spore
		],
	},
	{
		name: '[Gen 9] PokeRogue VGC Restricted',
		desc: `${POKEROGUE_DESC} VGC rules with one Restricted Legendary allowed; no Mythicals.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: [
			'Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'Limit One Restricted', 'PokeRogue Mod',
		],
		restricted: ['Restricted Legendary'],
		banlist: [
			'Smeargle + Prankster', // priority Spore
		],
	},
];
