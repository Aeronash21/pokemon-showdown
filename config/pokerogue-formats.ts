/*
 * ===========================================================
 * POKÉROGUE FORMATS
 * ===========================================================
 *
 * National Dex with PokéRogue's Pokémon, stats, move lists (level-up,
 * TM, all four egg moves) and passives. Gigantamax forms work like
 * Mega Evolutions with Max Mushrooms. Tera is allowed (except for
 * Pokémon holding a Mega Stone or Max Mushrooms), but not in OU.
 *
 * Singles tiers: Smogon National Dex tiers + the PokéRogue changes in
 * data/mods/pokerogue/tiers.ts.
 *
 * "<Pokémon> + <Ability>" bans below are PASSIVE bans: that Pokémon is
 * legal with its passive switched off in the teambuilder; with it on, the
 * team is rejected ("Alomomola's Passive Multiscale is banned"). A plain
 * ability ban (e.g. 'Arena Trap') also bans it as a passive.
 *
 * /tier <format> builds its banlist from these rules automatically
 * (server/chat-plugins/pokerogue-banlist.ts). Anything a format checks in
 * its own onValidateSet needs a line in its `banlistNotes`.
 */

const POKEROGUE_DESC = `Pok&eacute;Rogue: every Pok&eacute;mon has its Pok&eacute;Rogue passive ability ` +
	`(a passive the format bans has to be switched off), egg moves and move list. Gigantamax works like Mega ` +
	`Evolution with Max Mushrooms. The only Z-Move is Ultra Necrozma's (Ultranecrozium Z). Pok&eacute;mon holding a ` +
	`Mega Stone, Max Mushrooms or Ultranecrozium Z can't Terastallize.`;
/** Teambuilder formats: PokéRogue move lists plus every move learnt in any game ('PokeRogue All Moves'). */
const POKEROGUE_BUILDER_DESC = `${POKEROGUE_DESC} Pok&eacute;mon can also use every move they've learnt in any ` +
	`Pok&eacute;mon game.`;

/**
 * VGC: Mythicals are legal by strength. These (Uber in singles, at the
 * level of Restricted Legendaries) are Restricted: banned in VGC, and
 * count as the one Restricted Pokémon in VGC Restricted.
 */
const RESTRICTED_MYTHICALS = [
	'Arceus', 'Darkrai', 'Deoxys-Base', 'Deoxys-Attack', 'Deoxys-Speed', 'Genesect', 'Magearna', 'Marshadow',
	'Shaymin-Sky',
];

/** PokeRogue OU's rules that its banlist can't show (/tier lists them); formats built on OU repeat them. */
const POKEROGUE_OU_NOTES = [
	`Bitter Blade: only Ceruledge can use it.`,
	`Mega Dragonite is allowed, with its Aerilate passive switched off (like Dragonite's).`,
	`Galarian Darmanitan is Zen Mode only (Gorilla Tactics is banned).`,
	`Gallade holding Galladite has no passive, so Mega Gallade doesn't get Sharpness. ` +
	`Gallade can still have Sharpness as its regular ability before it Mega Evolves.`,
];

/** PokeRogue OU's banlist (PokeRogue Fusion starts from it). */
const POKEROGUE_OU_BANLIST = [
	// Smogon National Dex OU
	'ND Uber', 'ND AG', 'Arena Trap', 'Moody', 'Power Construct', 'Shadow Tag', "King's Rock",
	'Quick Claw', 'Razor Fang', 'Assist', 'Baton Pass', 'Last Respects', 'Shed Tail',
	// Galarian Darmanitan is Zen Mode only (also banned as Unovan Darmanitan's passive)
	'Gorilla Tactics',
	// PokéRogue: egg move / passive additions
	'Revival Blessing', 'Simple',
	'Regieleki', // 200 Speed Transistor + Electric Surge passive, with Nasty Plot and Electro Drift egg moves
	'Garchomp-Mega', 'Garchomp-Mega-Z', // (Garchomp itself is legal; Bitter Blade is Ceruledge-only, see onValidateSet)
	'Jirachi',
	'Melmetal-Gmax', // (Melmetal itself is legal)
	'Overqwil', 'Zapdos-Galar',
	'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
	// Passive bans
	'Alomomola + Multiscale', // half damage at full HP on 165 HP, with Regenerator to get back there
	'Blacephalon + Magic Guard', // free Mind Blown (150 BP Fire, no recoil) and Life Orb
	'Blissey + Fur Coat', // doubled Defense on top of its HP and Special Defense
	'Dragonite + Aerilate', // Flying Extreme Speed / Crush Grip (Mega Dragonite too)
	'Electrode-Hisui + Magic Guard', // recoil-free Mind Blown (egg move) and Life Orb at 150 Speed
	'Floette-Eternal + Magic Guard', // recoil-free Light of Ruin
	'Heracross-Mega + Technician', // Technician + Skill Link Pin Missile / Rock Blast
	'Kingambit + Sword of Ruin', // Supreme Overlord + Sword of Ruin
	'Bisharp + Sword of Ruin', // Eviolite Bisharp with Sword of Ruin
	'Manaphy + Primordial Sea', // Tail Glow / Take Heart in its own unremovable heavy rain
	'Shedinja + Magic Guard', // Wonder Guard with no indirect damage
	// Legendaries with a Drizzle passive: their own rain (100% accurate Thunder /
	// Hurricane, boosted Water attacks) on a legendary stat spread
	'Thundurus + Drizzle', 'Thundurus-Therian + Drizzle', 'Tornadus + Drizzle', 'Tornadus-Therian + Drizzle',
	'Zapdos + Drizzle',
];

/** PokeRogue OU's checks its banlist can't express (see POKEROGUE_OU_NOTES). */
function pokeRogueOUSetChecks(this: import('../sim/team-validator').TeamValidator, set: PokemonSet) {
	const species = this.dex.species.get(set.species);
	// Mega Gallade's Sharpness passive is switched off (165 Atk, 1.5x Sacred Sword /
	// Psycho Cut / Leaf Blade). Gallade can still have Sharpness as its ability before
	// Mega Evolving; it's gone once it Mega Evolves (Inner Focus, no passive).
	if (species.baseSpecies === 'Gallade' && this.dex.toID(set.item) === 'galladite') set.passive = false;
	// Bitter Blade: Ceruledge only (Garchomp, Kingambit, Kartana... get it as an egg move).
	// In PokeRogue Fusion, a Pokémon fused with Ceruledge can use it too.
	const ceruledge = species.baseSpecies === 'Ceruledge' ||
		(!!set.fusion && this.dex.species.get(set.fusion).baseSpecies === 'Ceruledge');
	if (!ceruledge && set.moves.some(move => this.dex.toID(move) === 'bitterblade')) {
		return [`${set.name || set.species} can't use Bitter Blade: only Ceruledge can in PokéRogue OU.`];
	}
}

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
		desc: `${POKEROGUE_BUILDER_DESC} No Terastallization in OU.`,
		mod: 'pokerogue',
		ruleset: ['Standard NatDex', 'PokeRogue Mod', 'PokeRogue All Moves', 'Terastal Clause'],
		onValidateSet(set) {
			return pokeRogueOUSetChecks.call(this, set);
		},
		// Shown in /tier's banlist (keep in step with pokeRogueOUSetChecks)
		banlistNotes: POKEROGUE_OU_NOTES,
		banlist: POKEROGUE_OU_BANLIST,
	},
	{
		name: '[Gen 9] PokeRogue Fusion',
		desc: `${POKEROGUE_BUILDER_DESC} Pok&eacute;Rogue's DNA Splicers: each Pok&eacute;mon can be fused with a ` +
			`second Pok&eacute;mon (the teambuilder's Fusion box). The fusion keeps the first Pok&eacute;mon's ` +
			`primary type, nature, IVs and passive; it takes the second Pok&eacute;mon's secondary type (or its ` +
			`primary type, if it has only one) and ability; its base stats are the average of the two; and it can ` +
			`use moves from either. PokeRogue OU's rules and bans apply to both halves. No Terastallization.`,
		mod: 'pokerogue',
		// (the ability comes from the second Pokémon: PokeRogue Fusion checks it)
		ruleset: [
			'Standard NatDex', 'PokeRogue Mod', 'PokeRogue All Moves', 'PokeRogue Fusion Mod', '!Obtainable Abilities',
			'Terastal Clause',
		],
		onValidateSet(set) {
			return pokeRogueOUSetChecks.call(this, set);
		},
		banlistNotes: [
			...POKEROGUE_OU_NOTES,
			`A banned Pokémon can't be either half of a fusion.`,
			`Fused Pokémon can't have form-changing abilities (Disguise, Stance Change, Zen Mode...), as in ` +
			`PokéRogue.`,
		],
		banlist: [
			...POKEROGUE_OU_BANLIST,
			'Wonder Guard', // (Shedinja's) on a fusion with real HP
		],
	},
	{
		name: '[Gen 9] PokeRogue Ubers',
		desc: POKEROGUE_BUILDER_DESC,
		mod: 'pokerogue',
		ruleset: [
			'Standard NatDex', 'PokeRogue Mod', 'PokeRogue All Moves', '!Evasion Clause', 'Evasion Moves Clause',
			'Evasion Items Clause',
			'Mega Rayquaza Clause',
		],
		// Smogon's [Gen 9] National Dex Ubers banlist, and no passive bans (for now).
		// Eternamax and Mega Gengar are tiered AG here, so 'ND AG' covers them. Mega Zygarde
		// (AG) Mega Evolves from Complete Zygarde, which the tier check doesn't see, so its
		// stone is banned instead.
		banlist: ['ND AG', 'Shedinja', 'Assist', 'Baton Pass', 'Zygardite'],
	},
	{
		name: '[Gen 9] PokeRogue AG',
		desc: POKEROGUE_BUILDER_DESC,
		mod: 'pokerogue',
		ruleset: ['Standard AG', 'PokeRogue Mod', 'PokeRogue All Moves'],
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
	// BUILT 2v2 (Multi Battle)
	// ========================================================

	{
		// Four players, p1 + p3 vs p2 + p4. Each player brings 6, picks 3 at Team Preview and
		// controls one active Pokémon. Started by challenging one player and adding the other
		// two with /addplayer (Multi Battles can't use the ladder search).
		//
		// Banlist (for now): every Restricted Legendary except Cosmog, Cosmoem, Necrozma, Calyrex and
		// Terapagos, plus everything Smogon's Gen 7, 8 and 9 2v2 Doubles ban. Bans are
		// kept simple: Pokémon, abilities / items / moves for everyone, and passive bans.
		name: '[Gen 9] PokeRogue 2v2 (Bring 6 Pick 3)',
		desc: `${POKEROGUE_BUILDER_DESC} Four-player 2v2 Multi Battle: every player builds a team of 6, picks 3 at ` +
			`Team Preview and controls one active Pok&eacute;mon. Challenge one player, then add the other two ` +
			`with <code>/addplayer [user], p3</code> and <code>/addplayer [user], p4</code>.`,
		mod: 'pokerogue',
		gameType: 'multi',
		searchShow: false,
		tournamentShow: false,
		ruleset: [
			// (Smogon 2v2 Doubles: Standard Doubles, Accuracy Moves, Terastal, Sleep and Evasion Items Clauses)
			'Standard Doubles', 'PokeRogue Mod', 'PokeRogue All Moves', 'Accuracy Moves Clause', 'Evasion Abilities Clause',
			'Evasion Items Clause', 'Sleep Clause Mod', 'Terastal Clause', 'Max Team Size = 6', 'Picked Team Size = 3',
		],
		banlist: [
			'Restricted Legendary', // (exceptions in unbanlist)
			// Smogon 2v2 Doubles, Gen 7 + 8 + 9 (their other Pokémon are Restricted Legendaries)
			'Arceus', 'Chi-Yu', 'Deoxys-Attack', 'Magearna', 'Urshifu', 'Urshifu-Rapid-Strike', // Gen 9
			'Jirachi', 'Marshadow', 'Melmetal', 'Tornadus-Base', // Gen 8 (Whimsicott allowed by request)
			'Gengar-Mega', 'Kangaskhan-Mega', 'Salamence-Mega', 'Tapu Lele', // Gen 7 (Snorlax allowed by request)
			'Deoxys-Base', // by request (Deoxys-Defense / Speed are allowed)
			'Moody', 'Power Construct', // (Commander allowed by request)
			"King's Rock", // (Focus Sash and Razor Fang allowed by request)
			'Dark Void', // (Ally Switch, Final Gambit, Perish Song and Swagger allowed by request)
			// Also banned for everyone
			'Arena Trap', 'Shadow Tag', 'Simple',
			'Assist', 'Last Respects', 'Shed Tail', // (Baton Pass, Coaching and Revival Blessing allowed by request)
			// Passive bans (the Pokémon is allowed with its passive switched off)
			'Blacephalon + Magic Guard', 'Electrode-Hisui + Magic Guard', // recoil-free Mind Blown (hits both foes)
			'Floette-Eternal + Magic Guard', // recoil-free Light of Ruin
			'Dragapult + Parental Bond',
			'Dragonite + Aerilate', // Flying Extreme Speed and Hyper Voice (Mega Dragonite too)
			'Gallade-Mega + Sharpness',
			'Heracross-Mega + Technician',
			'Kingambit + Sword of Ruin', 'Bisharp + Sword of Ruin',
			'Manaphy + Primordial Sea',
			'Smeargle + Prankster', // priority Spore
			'Grafaiai + Prankster', // (its regular ability, not its passive) priority Sketched moves like Spore
			'Thundurus + Drizzle', 'Thundurus-Therian + Drizzle', 'Tornadus + Drizzle', 'Tornadus-Therian + Drizzle',
			'Zapdos + Drizzle', // their own rain: 100% accurate Thunder / Hurricane / Bleakwind and Sandsear Storm
		],
		unbanlist: [
			// Restricted Legendaries allowed here (only these forms: Ice / Shadow Calyrex and Dusk Mane /
			// Dawn Wings / Ultra Necrozma stay banned). Terapagos can't Terastallize here.
			'Cosmog', 'Cosmoem', 'Necrozma-Base', 'Calyrex-Base', 'Terapagos',
		],
	},

	// ========================================================
	// VGC DOUBLES (level 50, bring 6 pick 4)
	// ========================================================

	{
		name: '[Gen 9] PokeRogue VGC',
		desc: `${POKEROGUE_BUILDER_DESC} VGC rules; no Restricted Legendaries. Mythicals are allowed except the ones ` +
			`as strong as a Restricted Legendary.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: [
			'Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'PokeRogue Mod',
			'PokeRogue All Moves',
		],
		unbanlist: ['Mythical'],
		banlist: [
			// Mythicals at Restricted Legendary strength (allowed in VGC Restricted)
			...RESTRICTED_MYTHICALS,
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
			// Passive bans
			'Manaphy + Primordial Sea', // unremovable heavy rain with no Restricted weather to answer it
			'Smeargle + Prankster', // priority Spore
		],
	},
	{
		name: '[Gen 9] PokeRogue VGC Restricted',
		desc: `${POKEROGUE_BUILDER_DESC} VGC rules with one Restricted Pok&eacute;mon allowed: a Restricted ` +
			`Legendary or one of the strongest Mythicals. Other Mythicals are allowed freely.`,
		mod: 'pokerogue',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: [
			'Flat Rules', '!! Adjust Level = 50', 'VGC Timer', 'Open Team Sheets', 'Limit One Restricted', 'PokeRogue Mod',
			'PokeRogue All Moves',
		],
		unbanlist: ['Mythical'],
		restricted: ['Restricted Legendary', ...RESTRICTED_MYTHICALS],
		banlist: [
			'Eternatus-Eternamax', // (Eternatus holding Max Mushrooms) Anything Goes only
			'Pikachu-Starter + Light Ball', // Partner Pikachu's stats with doubled Atk / Sp. Atk
			// Passive bans
			'Arceus + Adaptability', // as in Ubers: Adaptability Multi-Attack / Judgment of any type
			'Smeargle + Prankster', // priority Spore
		],
	},
];
