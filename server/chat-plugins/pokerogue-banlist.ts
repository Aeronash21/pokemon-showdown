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
	if (format.mod !== 'pokerogue' || format.team || format.gameType !== 'singles') return null;
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

	// "<Pokémon> + <Ability>" bans are passive bans: the Pokémon is legal and its
	// passive is switched off. "<Pokémon> + <move / item>" bans are grouped by move / item.
	const passiveBans: string[] = [];
	const bannedOn = new Map<string, string[]>();
	const otherBans: string[] = [];
	for (const [name, source, , bans] of ruleTable.complexBans) {
		if (source) continue; // part of a clause (e.g. Sleep Clause Mod's Hypnosis + Gengarite)
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
		if (!source) otherBans.push(name);
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
	line('Banned abilities', abilities, 'also switched off as passives');
	line('Banned items', items);
	line('Banned moves', moves);
	line('Passive bans', passiveBans, 'the Pok&eacute;mon is allowed; its passive is switched off');
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
	return pokemonList + lines.join('<br />');
}
