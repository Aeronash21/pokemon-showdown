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
 * legal, and its passive is switched off automatically. A plain ability
 * ban (e.g. 'Arena Trap') also switches it off as a passive.
 */

const POKEROGUE_DESC = `Pok&eacute;Rogue: every Pok&eacute;mon has its Pok&eacute;Rogue passive ability ` +
	`(a passive the format bans is switched off), egg moves and move list. Gigantamax works like Mega ` +
	`Evolution with Galarica Wreath (or Max Mushrooms). The only Z-Move is Ultra Necrozma's (Ultranecrozium Z). Pok&eacute;mon holding a ` +
	`Mega Stone, Galarica Wreath / Max Mushrooms or Ultranecrozium Z can't Terastallize.`;

/**
 * VGC: Mythicals are legal by strength. These (Uber in singles, at the
 * level of Restricted Legendaries) are Restricted: banned in VGC, and
 * count as the one Restricted Pokémon in VGC Restricted.
 */
const RESTRICTED_MYTHICALS = [
	'Arceus', 'Darkrai', 'Deoxys-Base', 'Deoxys-Attack', 'Deoxys-Speed', 'Genesect', 'Magearna', 'Marshadow',
	'Shaymin-Sky',
];

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
			'Regigigas', // Normalize + Scrappy passive (160 Atk boosted Normal STAB that hits everything) and Recover
			// Fishious Rend / Bolt Beak (170 BP when moving first) on the Pokémon that get them as STAB or
			// boosted by their passive: these Pokémon are legal, just without the move
			'Arctovish + Fishious Rend', 'Seaking + Fishious Rend', 'Arctozolt + Bolt Beak', 'Dracozolt + Bolt Beak',
			'Zapdos-Galar + Bolt Beak',
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
			// Passive bans
			'Articuno-Galar + Serene Grace', // 40% freeze Freezing Glare
			'Blacephalon + Magic Guard', // free Mind Blown (150 BP Fire, no recoil) and Life Orb
			'Dragonite + Aerilate', // Flying Extreme Speed / Crush Grip
			'Drampa-Mega + Adaptability', // 160 Sp. Atk Adaptability Boomburst / Draco Meteor
			'Floette-Eternal + Magic Guard', // recoil-free Light of Ruin
			'Gallade-Mega + Sharpness', // 165 Atk, 1.5x Sacred Sword / Psycho Cut / Leaf Blade
			'Heracross-Mega + Technician', // Technician + Skill Link Pin Missile / Rock Blast
			'Kingambit + Sword of Ruin', // Supreme Overlord + Sword of Ruin
			'Shedinja + Magic Guard', // Wonder Guard with no indirect damage
			'Swampert-Mega + Drizzle', // sets its own rain for Swift Swim
			// Legendaries with a Drizzle passive: their own rain (100% accurate Thunder /
			// Hurricane, boosted Water attacks) on a legendary stat spread
			'Thundurus + Drizzle', 'Thundurus-Therian + Drizzle', 'Tornadus + Drizzle', 'Tornadus-Therian + Drizzle',
			'Zapdos + Drizzle',
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
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
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
		desc: `Four-player free-for-all with random Pok&eacute;Rogue teams (egg moves and passives included). ` +
			`Bring 12, pick 6.`,
		mod: 'pokerogue',
		team: 'random',
		gameType: 'freeforall',
		tournamentShow: false,
		ruleset: [
			'Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod',
			'Team Preview', 'Max Team Size = 12', 'Picked Team Size = 6', 'PokeRogue Mod',
		],
	},
	{
		// Four players, p1 + p3 vs p2 + p4; each player controls one active Pokémon.
		name: '[Gen 9] PokeRogue 2v2',
		desc: `Four-player 2v2 Multi Battle with random Pok&eacute;Rogue teams (egg moves and passives included). ` +
			`Two players share each side; every player gets 3 Pok&eacute;mon and controls one active Pok&eacute;mon.`,
		mod: 'pokerogue',
		team: 'random',
		gameType: 'multi',
		searchShow: false,
		tournamentShow: false,
		ruleset: [
			'Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod',
			'Max Team Size = 3', 'PokeRogue Mod',
		],
	},

	// ========================================================
	// VGC DOUBLES (level 50, bring 6 pick 4)
	// ========================================================

	{
		name: '[Gen 9] PokeRogue VGC',
		desc: `${POKEROGUE_DESC} VGC rules; no Restricted Legendaries. Mythicals are allowed except the ones ` +
			`as strong as a Restricted Legendary.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'PokeRogue Mod'],
		unbanlist: ['Mythical'],
		banlist: [
			// Mythicals at Restricted Legendary strength (allowed in VGC Restricted)
			...RESTRICTED_MYTHICALS,
			'Zeraorite', // Zeraora-Mega: 700 BST, Uber in singles
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
			// Passive bans
			'Manaphy + Primordial Sea', // unremovable heavy rain with no Restricted weather to answer it
			'Smeargle + Prankster', // priority Spore
		],
	},
	{
		name: '[Gen 9] PokeRogue VGC Restricted',
		desc: `${POKEROGUE_DESC} VGC rules with one Restricted Pok&eacute;mon allowed: a Restricted Legendary or ` +
			`one of the strongest Mythicals. Other Mythicals are allowed freely.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: [
			'Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'Limit One Restricted', 'PokeRogue Mod',
		],
		unbanlist: ['Mythical'],
		restricted: ['Restricted Legendary', ...RESTRICTED_MYTHICALS],
		banlist: [
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
			// Passive bans
			'Arceus + Adaptability', // as in Ubers: Adaptability Multi-Attack / Judgment of any type
			'Smeargle + Prankster', // priority Spore
		],
	},
];
