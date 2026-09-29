/*
 * ===========================================================
 * POKÉROGUE SINGLES TIERS
 * ===========================================================
 *
 * Every PokéRogue Pokémon starts at its Smogon National Dex tier.
 * This table only lists the changes:
 *
 *  - Pokémon moved up because their PokéRogue egg moves or stats make
 *    them much stronger than in normal National Dex;
 *  - forms that have no Smogon tier at all (Gigantamax forms, which work
 *    like Mega Evolutions here, the Legends: Z-A Megas and a few others).
 *
 * A Pokémon that is only too strong because of its passive is NOT moved
 * here. Instead the format bans that passive on it (see the format
 * banlists in config/pokerogue-formats.ts, e.g. "Dragonite + Aerilate"),
 * so it stays legal with its passive switched off.
 *
 * Tier names follow Smogon: 'AG' is banned from Ubers, 'Uber' is banned
 * from OU, anything else is OU-legal.
 */

export const PokeRogueTiers: {[speciesName: string]: string} = {
	// -------------------------------------------------------
	// Moved up
	// -------------------------------------------------------

	// Choice Specs Dragon Energy (150 BP at full HP) from 130 Sp. Atk.
	'Kyurem': 'Uber',
	// (Zapdos-Galar is back at its National Dex tier; OU bans it from using
	// its Bolt Beak egg move instead, see config/pokerogue-formats.ts.)

	// -------------------------------------------------------
	// Gigantamax forms (hold Max Mushrooms)
	// -------------------------------------------------------

	'Venusaur-Gmax': 'RU',
	'Charizard-Gmax': 'RU',
	'Blastoise-Gmax': 'RU',
	'Butterfree-Gmax': 'RU',
	'Pikachu-Gmax': 'RU',
	'Meowth-Gmax': 'RU',
	// 170 Atk No Guard + Iron Fist (was Uber with Guts + Quick Feet); OU by request.
	'Machamp-Gmax': 'OU',
	// Shadow Tag with 150 HP / 150 Sp. Atk and Regenerator (like Mega Gengar).
	'Gengar-Gmax': 'Uber',
	'Kingler-Gmax': 'RU',
	'Lapras-Gmax': 'RU',
	'Eevee-Gmax': 'RU',
	'Snorlax-Gmax': 'RU',
	'Garbodor-Gmax': 'RU',
	'Melmetal-Gmax': 'OU',
	'Rillaboom-Gmax': 'OU',
	// 141 Atk / 134 Spe Libero with Extreme Speed as an egg move.
	'Cinderace-Gmax': 'Uber',
	// 147 Sp. Atk / 137 Spe; Focus Energy + Super Luck + Sniper = guaranteed 2.25x crits.
	'Inteleon-Gmax': 'Uber',
	'Corviknight-Gmax': 'OU',
	'Orbeetle-Gmax': 'RU',
	'Drednaw-Gmax': 'RU',
	'Coalossal-Gmax': 'RU',
	'Flapple-Gmax': 'RU',
	'Appletun-Gmax': 'RU',
	'Sandaconda-Gmax': 'RU',
	'Toxtricity-Gmax': 'RU',
	'Toxtricity-Low-Key-Gmax': 'RU',
	'Centiskorch-Gmax': 'RU',
	'Hatterene-Gmax': 'OU',
	'Grimmsnarl-Gmax': 'RU',
	'Alcremie-Gmax': 'RU',
	'Copperajah-Gmax': 'RU',
	'Duraludon-Gmax': 'RU',
	// Urshifu is already Uber; the G-Max forms have 650 BST.
	'Urshifu-Gmax': 'Uber',
	'Urshifu-Rapid-Strike-Gmax': 'Uber',

	// -------------------------------------------------------
	// Legends: Z-A Megas
	// -------------------------------------------------------

	'Raichu-Mega-X': 'RU',
	'Raichu-Mega-Y': 'RU',
	'Clefable-Mega': 'RU',
	'Victreebel-Mega': 'RU',
	// Huge Power on 100 Atk / 120 Spe, with Regenerator as its passive.
	'Starmie-Mega': 'Uber',
	// 700 BST Multiscale Dragon Dance with Extreme Speed (Aerilate passive).
	'Dragonite-Mega': 'Uber',
	'Meganium-Mega': 'RU',
	// 160 Atk Dragonize (Normal -> Dragon, 1.2x) + Strong Jaw + Dragon Dance.
	'Feraligatr-Mega': 'Uber',
	'Skarmory-Mega': 'RU',
	'Chimecho-Mega': 'RU',
	// 154 Atk / 151 Spe with Sharpness as its passive.
	'Absol-Mega-Z': 'Uber',
	'Staraptor-Mega': 'RU',
	// 151 Spe mixed attacker (130 / 141) with a Levitate passive: outspeeds all of OU.
	'Garchomp-Mega-Z': 'Uber',
	// 164 Sp. Atk / 151 Spe, Mega Launcher Aura Sphere / Dark Pulse.
	'Lucario-Mega-Z': 'Uber',
	'Froslass-Mega': 'RU',
	// 175 Sp. Atk on a 91 / 106 / 141 Fire/Steel body.
	'Heatran-Mega': 'Uber',
	// Darkrai is already Uber; the Mega has 165 Sp. Atk and 130 / 130 defenses.
	'Darkrai-Mega': 'Uber',
	'Emboar-Mega': 'RU',
	// 165 Atk / 103 Spe; Piercing Drill plus a Mold Breaker passive. OU by request.
	'Excadrill-Mega': 'OU',
	'Gardevoir-Mega': 'Uber', // Pixilate Hyper Voice with a Psychic Surge passive (Expanding Force)
	'Scolipede-Mega': 'RU',
	'Scrafty-Mega': 'RU',
	'Eelektross-Mega': 'RU',
	'Chandelure-Mega': 'RU',
	'Golurk-Mega': 'RU',
	'Chesnaught-Mega': 'RU',
	'Delphox-Mega': 'RU',
	// 133 Sp. Atk / 142 Spe Protean.
	'Greninja-Mega': 'Uber',
	'Pyroar-Mega': 'RU',
	'Meowstic-M-Mega': 'RU',
	'Malamar-Mega': 'RU',
	'Barbaracle-Mega': 'RU',
	'Dragalge-Mega': 'RU',
	'Hawlucha-Mega': 'RU',
	// 778 BST, 216 HP / 216 Sp. Atk.
	'Zygarde-Mega': 'AG',
	'Crabominable-Mega': 'RU',
	'Golisopod-Mega': 'RU',
	'Drampa-Mega': 'RU',
	// Magearna is already Uber; the Mega has 700 BST and 170 Sp. Atk Soul-Heart.
	'Magearna-Mega': 'Uber',
	'Magearna-Original-Mega': 'Uber',
	// 157 Atk / 147 Sp. Atk / 153 Spe.
	'Zeraora-Mega': 'Uber',
	'Falinks-Mega': 'RU',
	'Scovillain-Mega': 'RU',
	// 150 Sp. Atk Adaptability Sludge Wave / Power Gem.
	'Glimmora-Mega': 'Uber',
	'Tatsugiri-Curly-Mega': 'RU',
	'Tatsugiri-Droopy-Mega': 'RU',
	'Tatsugiri-Stretchy-Mega': 'RU',
	// 175 Atk / 700 BST, with Dragon Dance as an egg move.
	'Baxcalibur-Mega': 'Uber',
	// Fairy Aura Light of Ruin (140 BP) from 155 Sp. Atk, no recoil with Magic Guard.
	'Floette-Mega': 'Uber',

	// -------------------------------------------------------
	// Other forms with no Smogon National Dex tier
	// -------------------------------------------------------

	'Floette-Eternal': 'RU',
	'Pikachu-Starter': 'RU',
	'Pikachu-Cosplay': 'RU',
	'Pikachu-Rock-Star': 'RU',
	'Pikachu-Belle': 'RU',
	'Pikachu-Pop-Star': 'RU',
	'Pikachu-PhD': 'RU',
	'Pikachu-Libre': 'RU',
	'Eevee-Starter': 'RU',
	'Pichu-Spiky-eared': 'LC',
	'Greninja-Ash': 'UUBL',
	// Battle Bond turns it into Ash-Greninja, so it's tiered as Ash-Greninja.
	'Greninja-Bond': 'UUBL',
};
