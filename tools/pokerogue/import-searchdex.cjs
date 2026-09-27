'use strict';

/*
 * ===========================================================
 * POKÉROGUE DATA IMPORTER
 * ===========================================================
 *
 * Builds the `pokerogue` mod's data from Sandstorm's PokeRogue
 * SearchDex (https://sandstormer.github.io/PokeRogue-Dex/,
 * https://github.com/sandstormer/pokerogue-dex), which is itself
 * generated from the PokeRogue game source.
 *
 * Usage (after `node build`):
 *
 *   git clone --depth 1 https://github.com/sandstormer/pokerogue-dex /tmp/pokerogue-dex
 *   node tools/pokerogue/import-searchdex.cjs /tmp/pokerogue-dex
 *
 * Writes:
 *   data/mods/pokerogue/pokerogue-data.ts  passives, egg moves, version
 *   data/mods/pokerogue/learnsets.ts       every PokeRogue move list
 *   data/mods/pokerogue/pokedex.ts         PokeRogue stats / abilities where
 *                                          they differ, G-Max formes as
 *                                          Max Mushrooms "Megas"
 *   data/mods/pokerogue/items.ts           Max Mushrooms
 *
 * Learnset sources use Showdown's letters so the teambuilder can
 * group them: 9L<level> level-up (9L1 for evolution moves), 9T
 * relearn-only ("Memory"), 9M TM, 9E egg move. Rare egg moves
 * are also listed in pokerogue-data.ts.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {Dex} = require('../../dist/sim/dex');

const SOURCE = path.resolve(process.argv[2] || '/tmp/pokerogue-dex');
const OUT = path.resolve(__dirname, '../../data/mods/pokerogue');

const toID = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/*
 * -----------------------------------------------------------
 * Load the SearchDex data files
 * -----------------------------------------------------------
 */
function loadSearchDex(dir) {
	const context = {col: new Proxy({}, {get: () => ''})};
	vm.createContext(context);

	for (const file of ['filter_data.js', 'pokedex_data.js', 'lang/en.js']) {
		const source = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^(const|let) /gm, 'var ');
		vm.runInContext(source, context, {filename: file});
	}

	return context;
}

/*
 * -----------------------------------------------------------
 * PokeRogue name -> Showdown species
 * -----------------------------------------------------------
 * PokeRogue puts the forme first ("Attack Deoxys", "Mega X
 * Charizard", "Gigantamax Charizard"). Cosmetic variants (Unown
 * letters, Vivillon patterns...) map to the base species.
 */
const NAME_OVERRIDES = {
	'Partner Pikachu': 'Pikachu-Starter',
	'Own Tempo Rockruff': 'Rockruff-Dusk',
	'Partner Eevee': 'Eevee-Starter',
	'Cosplay Pikachu': 'Pikachu-Cosplay',
	'Cool Cosplay Pikachu': 'Pikachu-Rock-Star',
	'Beauty Cosplay Pikachu': 'Pikachu-Belle',
	'Cute Cosplay Pikachu': 'Pikachu-Pop-Star',
	'Smart Cosplay Pikachu': 'Pikachu-PhD',
	'Tough Cosplay Pikachu': 'Pikachu-Libre',
	'Female Nidoran': 'Nidoran-F',
	'Male Nidoran': 'Nidoran-M',
	'Spiky-Eared Pichu': 'Pichu-Spiky-eared',
	'Hisui Basculin': 'Basculin-White-Striped',
	'Combat Paldea Tauros': 'Tauros-Paldea-Combat',
	'Blaze Paldea Tauros': 'Tauros-Paldea-Blaze',
	'Aqua Paldea Tauros': 'Tauros-Paldea-Aqua',
	'Zen Galar Darmanitan': 'Darmanitan-Galar-Zen',
	'Battle Bond Greninja': 'Greninja-Bond',
	'Ash Battle Bond Greninja': 'Greninja-Ash',
	'Mega Eternal Floette': 'Floette-Mega',
	'Teal Mask Ogerpon': 'Ogerpon',
	'Teal Mask Tera Ogerpon': 'Ogerpon-Teal-Tera',
	'Wellspring Mask Tera Ogerpon': 'Ogerpon-Wellspring-Tera',
	'Hearthflame Mask Tera Ogerpon': 'Ogerpon-Hearthflame-Tera',
	'Cornerstone Mask Tera Ogerpon': 'Ogerpon-Cornerstone-Tera',
	'Wellspring Mask Ogerpon': 'Ogerpon-Wellspring',
	'Hearthflame Mask Ogerpon': 'Ogerpon-Hearthflame',
	'Cornerstone Mask Ogerpon': 'Ogerpon-Cornerstone',
	'Gigantamax Single Strike Urshifu': 'Urshifu-Gmax',
	'Gigantamax Rapid Strike Urshifu': 'Urshifu-Rapid-Strike-Gmax',
	'Single Strike Urshifu': 'Urshifu',
	'Rapid Strike Urshifu': 'Urshifu-Rapid-Strike',
	'50% Zygarde': 'Zygarde',
	'10% Zygarde': 'Zygarde-10%',
	'Power Construct 50% Zygarde': 'Zygarde',
	'Power Construct 10% Zygarde': 'Zygarde-10%',
	'Complete Zygarde': 'Zygarde-Complete',
	'Male Meowstic': 'Meowstic',
	'Female Meowstic': 'Meowstic-F',
	'Mega Meowstic': 'Meowstic-M-Mega',
	'Mega Curly Tatsugiri': 'Tatsugiri-Curly-Mega',
	'Mega Droopy Tatsugiri': 'Tatsugiri-Droopy-Mega',
	'Mega Stretchy Tatsugiri': 'Tatsugiri-Stretchy-Mega',
	'Curly Tatsugiri': 'Tatsugiri',
	'Original Magearna': 'Magearna-Original',
	'Mega Original Magearna': 'Magearna-Original-Mega',
	'Dada Zarude': 'Zarude-Dada',
	'Four Maushold': 'Maushold-Four',
	'Three Maushold': 'Maushold',
	'Two-Segment Dudunsparce': 'Dudunsparce',
	'Three-Segment Dudunsparce': 'Dudunsparce-Three-Segment',
	'Chest Gimmighoul': 'Gimmighoul',
	'Roaming Gimmighoul': 'Gimmighoul-Roaming',
	'Amped Toxtricity': 'Toxtricity',
	'Low-Key Toxtricity': 'Toxtricity-Low-Key',
	'Midday Lycanroc': 'Lycanroc',
	'Male Indeedee': 'Indeedee',
	'Female Indeedee': 'Indeedee-F',
	'Male Basculegion': 'Basculegion',
	'Female Basculegion': 'Basculegion-F',
	'Male Oinkologne': 'Oinkologne',
	'Female Oinkologne': 'Oinkologne-F',
	'Zero Palafin': 'Palafin',
	'Disguised Mimikyu': 'Mimikyu',
	'Full Belly Morpeko': 'Morpeko',
	'No Ice Eiscue': 'Eiscue-Noice',
	'Shield Aegislash': 'Aegislash',
	'Aria Meloetta': 'Meloetta',
	'Active Xerneas': 'Xerneas',
	'Neutral Xerneas': 'Xerneas',
	'Normal Silvally': 'Silvally',
	'Normal Arceus': 'Arceus',
	'Normal Deoxys': 'Deoxys',
	'Altered Giratina': 'Giratina',
	'Land Shaymin': 'Shaymin',
	'Red-Striped Basculin': 'Basculin',
	'Blue-Striped Basculin': 'Basculin-Blue-Striped',
	'Ordinary Keldeo': 'Keldeo',
	'Baile Oricorio': 'Oricorio',
	'Overcast Cherrim': 'Cherrim',
	'Plant Wormadam': 'Wormadam',
	'Red Meteor Minior': 'Minior-Meteor',
	'Red Minior': 'Minior',
};

function mapName(name) {
	if (NAME_OVERRIDES[name]) return {name: NAME_OVERRIDES[name], cosmetic: false};

	const direct = Dex.species.get(name);
	if (direct.exists && direct.name === name) return {name: direct.name, cosmetic: false};

	let match;

	if ((match = /^Gigantamax (.+)$/.exec(name))) {
		const species = Dex.species.get(`${match[1]}-Gmax`);
		if (species.exists) return {name: species.name, cosmetic: false};
	}
	if ((match = /^Mega ([XYZ]) (.+)$/.exec(name))) {
		const species = Dex.species.get(`${match[2]}-Mega-${match[1]}`);
		if (species.exists) return {name: species.name, cosmetic: false};
	}
	if ((match = /^Mega (.+)$/.exec(name))) {
		const species = Dex.species.get(`${match[1]}-Mega`);
		if (species.exists) return {name: species.name, cosmetic: false};
	}

	// "<Forme words> <Species>" -> "<Species>-<Forme>", or a cosmetic
	// variant of <Species>.
	const words = name.split(' ');
	for (let k = words.length - 1; k >= 1; k--) {
		const base = Dex.species.get(words.slice(k).join(' '));
		if (!base.exists) continue;

		const forme = words.slice(0, k).join('-');
		const candidate = Dex.species.get(`${base.name}-${forme}`);
		if (candidate.exists && toID(candidate.name) === toID(`${base.name}${forme}`)) {
			return {name: candidate.name, cosmetic: false};
		}

		// Colour / pattern variants of Minior's core share Minior's data.
		if (base.name === 'Minior') {
			return {name: /Meteor/.test(name) ? 'Minior-Meteor' : 'Minior', cosmetic: true};
		}

		return {name: base.name, cosmetic: true};
	}

	if (direct.exists) return {name: direct.name, cosmetic: false};

	return null;
}

/*
 * -----------------------------------------------------------
 * Move source codes (see the SearchDex script.js)
 * -----------------------------------------------------------
 *   -1       relearn only ("Memory")
 *    0       evolution
 *    1-200   level
 *   201-203  egg move + TM        205-207 rare egg move + TM
 *   204      egg move             208     rare egg move
 *   209-211  TM (common / great / ultra)
 */
function sourcesFor(code) {
	if (code === -1) return ['9T'];
	if (code === 0) return ['9L1'];
	if (code >= 1 && code <= 200) return [`9L${code}`];
	if ([201, 202, 203, 205, 206, 207].includes(code)) return ['9E', '9M'];
	if (code === 204 || code === 208) return ['9E'];
	if (code >= 209 && code <= 211) return ['9M'];

	throw new Error(`Unknown move source code ${code}`);
}

/*
 * -----------------------------------------------------------
 * Build
 * -----------------------------------------------------------
 */
function build() {
	const dex = loadSearchDex(SOURCE);
	const {items, speciesNames, fidToName, fidThreshold, gameVersion, latestDate} = dex;

	const TYPES = fidToName.slice(0, fidThreshold[0]);
	// PokeRogue names Ogerpon's Embody Aspect by the stat it boosts.
	const ABILITY_NAMES = {
		'Embody Aspect Speed': 'Embody Aspect (Teal)',
		'Embody Aspect Sp.&nbspDef': 'Embody Aspect (Wellspring)',
		'Embody Aspect Attack': 'Embody Aspect (Hearthflame)',
		'Embody Aspect Defense': 'Embody Aspect (Cornerstone)',
	};
	const abilityName = fid => {
		let name = fidToName[fid].replace(/’/g, "'");
		name = ABILITY_NAMES[name] || name;
		const ability = Dex.abilities.get(name);
		if (!ability.exists) throw new Error(`Unknown ability ${name}`);
		return ability.name;
	};
	const moveName = fid => {
		const name = fidToName[fid].replace(/’/g, "'");
		const move = Dex.moves.get(name);
		if (!move.exists) throw new Error(`Unknown move ${name}`);
		return move;
	};

	const species = {};
	const unmapped = [];

	items.forEach((item, index) => {
		const prName = speciesNames[index];
		const mapped = mapName(prName);

		if (!mapped) {
			unmapped.push(prName);
			return;
		}

		const id = toID(mapped.name);

		// Keep the first entry for each Showdown species (cosmetic
		// variants share the base form's data).
		if (species[id]) return;

		const learnset = {};
		for (const [key, code] of Object.entries(item)) {
			const fid = Number(key);
			if (isNaN(fid) || fid < fidThreshold[1] || fid >= fidThreshold[2]) continue;
			learnset[moveName(fid).id] = sourcesFor(code);
		}

		const eggMoves = [item.e1, item.e2, item.e3, item.e4]
			.filter(fid => fid !== undefined)
			.map(fid => moveName(fid).name);

		species[id] = {
			prName,
			showdown: mapped.name,
			form: item.fx || 0,
			types: [item.t1, item.t2].filter(t => t !== undefined).map(t => TYPES[t]),
			abilities: {
				0: abilityName(item.a1),
				...(item.a2 !== undefined ? {1: abilityName(item.a2)} : {}),
				...(item.ha !== undefined ? {H: abilityName(item.ha)} : {}),
			},
			passive: item.pa !== undefined ? abilityName(item.pa) : null,
			baseStats: {hp: item.hp, atk: item.atk, def: item.def, spa: item.spa, spd: item.spd, spe: item.spe},
			eggMoves,
			learnset,
		};
	});

	if (unmapped.length) throw new Error(`Could not map: ${unmapped.join(', ')}`);

	return {species, version: gameVersion, date: latestDate};
}

/*
 * -----------------------------------------------------------
 * Output
 * -----------------------------------------------------------
 */
const HEADER = `/*
 * GENERATED by tools/pokerogue/import-searchdex.cjs from the PokeRogue
 * SearchDex (https://github.com/sandstormer/pokerogue-dex). Do not edit
 * by hand; re-run the importer to update.
 */
`;

function sameStats(a, b) {
	return ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(k => a[k] === b[k]);
}

function sameAbilities(a, b) {
	const clean = x => Object.fromEntries(Object.entries(x).filter(([k, v]) => k !== 'S' && v));
	return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
}

function writeData({species, version, date}) {
	fs.mkdirSync(OUT, {recursive: true});

	const passives = {};
	const eggMoves = {};
	const learnsets = {};
	const pokedex = {};
	const gmax = {};

	for (const [id, data] of Object.entries(species)) {
		const ps = Dex.species.get(data.showdown);

		if (data.passive) passives[id] = data.passive;
		if (data.eggMoves.length) eggMoves[id] = data.eggMoves;
		if (Object.keys(data.learnset).length) learnsets[id] = {learnset: data.learnset};

		const entry = {};

		if (!sameStats(ps.baseStats, data.baseStats)) entry.baseStats = data.baseStats;
		if (!sameAbilities(ps.abilities, data.abilities)) entry.abilities = data.abilities;
		if (ps.types.join('/') !== data.types.join('/')) entry.types = data.types;

		// G-Max formes behave like Mega Evolutions: hold Max Mushrooms.
		if (ps.forme.endsWith('Gmax')) {
			const base = ps.changesFrom || ps.baseSpecies;
			entry.baseStats = data.baseStats;
			entry.abilities = data.abilities;
			entry.types = data.types;
			entry.requiredItem = 'Max Mushrooms';
			entry.battleOnly = base;
			gmax[base] = ps.name;
		}

		if (Object.keys(entry).length) pokedex[id] = {inherit: true, ...entry};
	}

	// PokeRogue has one Gigantamax Toxtricity that both Amped and Low Key
	// forms can reach. Showdown splits it in two; give Low Key the same data.
	if (pokedex.toxtricitygmax) {
		pokedex.toxtricitylowkeygmax = {...pokedex.toxtricitygmax, battleOnly: 'Toxtricity-Low-Key'};
		gmax['Toxtricity-Low-Key'] = 'Toxtricity-Low-Key-Gmax';
		if (passives.toxtricitygmax) passives.toxtricitylowkeygmax = passives.toxtricitygmax;
	}

	const json = value => JSON.stringify(value, null, '\t');

	fs.writeFileSync(path.join(OUT, 'pokerogue-data.ts'), HEADER + `
export const PokeRogueData: {
	version: string,
	date: string,
	/** species id -> passive ability name */
	passives: {[speciesid: string]: string},
	/** species id -> egg moves; the 4th is the rare egg move */
	eggMoves: {[speciesid: string]: string[]},
	/** species ids that are in PokeRogue */
	species: string[],
} = {
	version: ${json(version)},
	date: ${json(date)},
	passives: ${json(passives)},
	eggMoves: ${json(eggMoves)},
	species: ${json(Object.keys(species))},
};
`);

	fs.writeFileSync(path.join(OUT, 'learnsets.ts'), HEADER + `
export const Learnsets: import('../../../sim/dex-species').ModdedLearnsetDataTable = ${json(learnsets)};
`);

	fs.writeFileSync(path.join(OUT, 'pokedex.ts'), HEADER + `
export const Pokedex: import('../../../sim/dex-species').ModdedSpeciesDataTable = ${json(pokedex)};
`);

	fs.writeFileSync(path.join(OUT, 'items.ts'), HEADER + `
export const Items: import('../../../sim/dex-items').ModdedItemDataTable = {
	maxmushrooms: {
		name: "Max Mushrooms",
		spritenum: 0,
		num: 2000,
		gen: 8,
		desc: "If held by a Pokemon with a Gigantamax form, it can Gigantamax like a Mega Evolution.",
		shortDesc: "Lets a Pokemon with a Gigantamax form Gigantamax (like a Mega Evolution).",
		megaStone: ${json(gmax).replace(/\n/g, '\n\t\t')},
		itemUser: ${json(Object.keys(gmax)).replace(/\n/g, '\n\t\t')},
		// Like a Mega Stone, it can't be removed from a Pokemon that can use it
		// (before or after Gigantamaxing).
		onTakeItem(item, source) {
			if (!source || !item.megaStone) return true;
			const line = source.baseSpecies.baseSpecies;
			return !Object.keys(item.megaStone).some(name => this.dex.species.get(name).baseSpecies === line);
		},
	},
};
`);

	console.log(`PokeRogue ${version} (${date}): ${Object.keys(species).length} species, ` +
		`${Object.keys(passives).length} passives, ${Object.keys(eggMoves).length} egg move lists, ` +
		`${Object.keys(learnsets).length} learnsets, ${Object.keys(pokedex).length} pokedex overrides, ` +
		`${Object.keys(gmax).length} G-Max formes`);
}

module.exports = {build, mapName, loadSearchDex};

if (require.main === module) writeData(build());
