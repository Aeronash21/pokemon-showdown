/**
 * PokéRogue banlist message
 *
 * What /tier (also /formathelp, /banlists, /viewbanlist, /banlist) shows for
 * the PokéRogue singles formats. It's built from the format's rule table each
 * time, so it always matches config/pokerogue-formats.ts: ban or unban
 * something there and this message follows. Rules a format checks in its own
 * onValidateSet (which the rule table can't see) go in its `banlistNotes`.
 */

import { Utils } from '../../lib';

/** Rules that are bans in all but name: their bans are listed under abilities / items / moves */
const HIDDEN_CLAUSES = ['nicknameclause', 'evasionabilitiesclause', 'evasionitemsclause', 'evasionmovesclause'];

export function pokeRogueBanlistHTML(format: Format): string | null {
	// (singles, and built Multi Battles like PokeRogue 2v2 (Bring 6 Pick 3); VGC keeps the standard /tier view)
	if (format.mod !== 'pokerogue' || format.team || !['singles', 'multi'].includes(format.gameType)) return null;
	const dex = Dex.forFormat(format);
	const ruleTable = Dex.formats.getRuleTable(format);

	// Pokémon: each forme the format bans. A battle-only forme (Mega, Primal, Gmax...)
	// of a Pokémon that's banned anyway is left out, and a Pokémon with every forme
	// banned is listed once as "(all forms)".
	const inFormat = (species: Species) => species.exists &&
		(!species.isNonstandard || ruleTable.has(`+tag:${toID(species.isNonstandard)}`));
	const isBanned = (species: Species) => inFormat(species) && ruleTable.isBannedSpecies(species);
	const unreachable = (species: Species) => {
		if (!species.battleOnly) return false;
		const from = Array.isArray(species.battleOnly) ? species.battleOnly : [species.battleOnly];
		return from.every(name => isBanned(dex.species.get(name)));
	};
	const families = new Map<string, Species[]>();
	for (const species of dex.species.all()) {
		if (!inFormat(species) || unreachable(species)) continue;
		const family = families.get(species.baseSpecies);
		if (family) family.push(species);
		else families.set(species.baseSpecies, [species]);
	}
	const pokemon: string[] = [];
	for (const [baseSpecies, family] of families) {
		const banned = family.filter(isBanned);
		if (!banned.length) continue;
		if (family.length > 1 && banned.length === family.length) {
			pokemon.push(`${baseSpecies} (all forms)`);
		} else {
			pokemon.push(...banned.map(species => species.name));
		}
	}

	const abilities: string[] = [];
	const items: string[] = [];
	const moves: string[] = [];
	for (const rule of ruleTable.keys()) {
		const [type, id] = rule.split(':');
		if (type === '-ability') abilities.push(dex.abilities.get(id).name);
		if (type === '-item') items.push(dex.items.get(id).name);
		if (type === '-move') moves.push(dex.moves.get(id).name);
	}

	// "<Pokémon> + <Ability>" bans are passive bans: the Pokémon is legal with its
	// passive switched off. "<Pokémon> + <move / item>" bans are grouped by move / item.
	const passiveBans: string[] = [];
	const bannedOn = new Map<string, string[]>();
	const otherBans: string[] = [];
	for (const [name, source, , bans] of ruleTable.complexBans) {
		// part of a clause (e.g. Sleep Clause Mod's Hypnosis + Gengarite); bans inherited from a format
		// in the ruleset (PokeRogue 2v2 (Bring 6 Pick 3) is built on PokeRogue OU) still count
		if (source && dex.formats.get(source).effectType !== 'Format') continue;
		const mon = bans.find(ban => ban.startsWith('pokemon:') || ban.startsWith('basepokemon:'));
		const rest = bans.filter(ban => ban !== mon);
		if (mon && rest.length === 1) {
			const species = dex.species.get(mon.split(':')[1]).name;
			const [type, id] = rest[0].split(':');
			if (type === 'ability') {
				passiveBans.push(`${species} (${dex.abilities.get(id).name})`);
				continue;
			}
			if (type === 'move' || type === 'item') {
				const thing = type === 'move' ? dex.moves.get(id).name : dex.items.get(id).name;
				const mons = bannedOn.get(thing);
				if (mons) mons.push(species);
				else bannedOn.set(thing, [species]);
				continue;
			}
		}
		otherBans.push(name);
	}
	for (const [name, source] of ruleTable.complexTeamBans) {
		if (!source || dex.formats.get(source).effectType === 'Format') otherBans.push(name);
	}

	const clauses: string[] = [];
	for (const rule of ruleTable.keys()) {
		if (/^[-+*!]/.test(rule) || rule.includes(':') || HIDDEN_CLAUSES.includes(rule)) continue;
		const clause = dex.formats.get(rule);
		if (!clause.exists || !clause.name.includes('Clause')) continue;
		clauses.push(rule === 'terastalclause' ? `${clause.name} (no Terastallization)` : clause.name);
	}

	const sorted = (names: string[]) => Utils.escapeHTML([...new Set(names)].sort().join(', '));
	const lines: string[] = [];
	const line = (title: string, names: string[], note?: string) => {
		if (!names.length) return;
		lines.push(`<b>${title}</b>${note ? ` <small>(${note})</small>` : ''}: ${sorted(names)}`);
	};
	// (a block element: no line break after it)
	const pokemonList = !pokemon.length ? '' :
		`<details class="details"><summary><b>Banned Pok&eacute;mon</b> (${pokemon.length}): click to show</summary>` +
		`${sorted(pokemon)}</details>`;
	line('Banned abilities', abilities, 'also banned as passives');
	line('Banned items', items);
	line('Banned moves', moves);
	line('Passive bans', passiveBans, 'the Pok&eacute;mon is allowed with its passive switched off');
	if (bannedOn.size) {
		const entries = [...bannedOn].sort(([a], [b]) => a.localeCompare(b))
			.map(([thing, mons]) => `${Utils.escapeHTML(thing)} on ${sorted(mons)}`);
		lines.push(`<b>Banned on specific Pok&eacute;mon</b>: ${entries.join('; ')}`);
	}
	line('Banned combinations', otherBans);
	if (format.banlistNotes?.length) {
		const notes = format.banlistNotes.map(note => `<br />&bull; ${Utils.escapeHTML(note)}`);
		lines.push(`<b>Other rules</b>:${notes.join('')}`);
	}
	line('Clauses', clauses);
	if (!pokemonList && !lines.length) return `Nothing is banned in ${Utils.escapeHTML(format.name)}.`;
	lines.push(`<small>Every legal Pok&eacute;mon: <code>/legal ${Utils.escapeHTML(format.id.replace(/^gen9pokerogue/, ''))}</code></small>`);
	return pokemonList + lines.join('<br />');
}

// ---------------------------------------------------------------
// /legal: every Pokémon a PokéRogue format allows
// ---------------------------------------------------------------

/** "ubers", "ou", "PokeRogue AG", "gen9pokerogueag"... -> the PokéRogue (or Chaos) format */
function findPokeRogueFormat(target: string): Format | null {
	const id = toID(target) || 'ubers';
	for (const candidate of [`gen9pokerogue${id}`, `gen9${id}`, id, `gen9pokerogue${id.replace(/^pokerogue/, '')}`]) {
		const format = Dex.formats.get(candidate);
		if (format.exists && format.effectType === 'Format' && ['pokerogue', 'chaos'].includes(format.mod) && !format.team) {
			return format;
		}
	}
	return null;
}

/** The tier sections, strongest first (same order as the teambuilder) */
const TIER_ORDER = ['AG', 'Uber', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NFE', 'LC'];

export function pokeRogueLegalHTML(format: Format): string {
	const dex = Dex.forFormat(format);
	const ruleTable = Dex.formats.getRuleTable(format);
	const banned = (species: Species): boolean => {
		if (ruleTable.isBannedSpecies(species)) return true;
		// a forme its item can't reach (Zygardite, Ultranecrozium Z... banned)
		const items = species.requiredItems || (species.requiredItem ? [species.requiredItem] : []);
		if (items.length && items.every(item => ruleTable.isBanned(`item:${toID(item)}`))) return true;
		// a battle forme of a banned Pokémon (Primal Kyogre when Kyogre is banned...)
		if (species.battleOnly) {
			const from = Array.isArray(species.battleOnly) ? species.battleOnly : [species.battleOnly];
			if (from.every(name => banned(dex.species.get(name)))) return true;
		}
		return false;
	};

	const byTier = new Map<string, string[]>();
	const transformed: string[] = [];
	let total = 0;
	for (const species of dex.species.all()) {
		if (!(species as AnyObject).pokeRogue || species.isCosmeticForme || species.forme.includes('Totem')) continue;
		// formes only reached mid-battle without an item (Zen Mode, Complete Zygarde, Tera Ogerpon...)
		if (species.battleOnly && !species.requiredItem && !species.requiredItems && !species.requiredMove) continue;
		if ((species.baseSpecies === 'Ogerpon' && species.forme.includes('Tera')) || species.forme.includes('Zen')) continue;
		if (banned(species)) continue;
		total++;
		// Megas, Primals, G-Max forms, Eternamax, Ultra Necrozma: their own section
		if (species.battleOnly) {
			transformed.push(species.name);
			continue;
		}
		const tier = TIER_ORDER.includes(species.natDexTier) ? species.natDexTier : 'RU';
		const list = byTier.get(tier);
		if (list) list.push(species.name);
		else byTier.set(tier, [species.name]);
	}

	const section = (title: string, names: string[]) =>
		`<details class="details"><summary><b>${title}</b> (${names.length})</summary>` +
		`${Utils.escapeHTML(names.sort().join(', '))}</details>`;
	let buf = `<b>${Utils.escapeHTML(format.name)}</b>: ${total} legal Pok&eacute;mon (click a tier to show it).`;
	for (const tier of TIER_ORDER) {
		const names = byTier.get(tier);
		if (!names) continue;
		const title = tier === '(OU)' ? 'OU by technicality' : tier === 'NFE' ? 'NFE' : tier;
		buf += section(title, names);
	}
	if (transformed.length) buf += section('Megas, Primals &amp; G-Max forms (with their item)', transformed);
	buf += `<small>Banned: <code>/tier ${Utils.escapeHTML(format.id.replace(/^gen9pokerogue/, 'pokerogue '))}</code>. ` +
		`Passive bans and other rules there still apply.</small>`;
	return buf;
}

export const commands: Chat.ChatCommands = {
	legalmons: 'legal',
	legalpokemon: 'legal',
	legal(target) {
		const format = findPokeRogueFormat(target);
		if (!format) {
			return this.errorReply(`"${target}" isn't a PokéRogue format. Try /legal ubers, /legal ou or /legal ag.`);
		}
		if (!this.runBroadcast(`!legal ${format.id}`)) return;
		this.sendReplyBox(pokeRogueLegalHTML(format));
	},
	legalhelp: [
		`/legal [format] - Shows every Pokémon legal in a PokéRogue format, by tier ` +
		`(default: PokéRogue Ubers). E.g. /legal ubers, /legal ou, /legal ag. ` +
		`Aliases: /legalmons, /legalpokemon. !legal shows it to the room.`,
	],
};
