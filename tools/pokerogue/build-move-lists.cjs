#!/usr/bin/env node
/**
 * Builds data/mods/pokerogue/move-lists.ts from PokéRogue's move banlists
 * (src/data/moves/invalid-moves.ts): which moves Metronome, Assist, Sleep
 * Talk, Copycat, Mirror Move, Encore, Instruct and Sketch can't use there.
 * PokéRogue diverges from the main games on purpose here: most signature
 * moves can be called by move-calling moves, and Sketch copies everything
 * but itself and Struggle. The PokeRogue mod sets the moves' flags from
 * these lists (applyPokeRogueMoveLists in move-lists.ts).
 *
 * Usage: node tools/pokerogue/build-move-lists.cjs <path to a pokerogue checkout>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const checkout = process.argv[2];
if (!checkout) {
	console.error('Usage: node tools/pokerogue/build-move-lists.cjs <path to a pokerogue checkout>');
	process.exit(1);
}
const src = fs.readFileSync(path.join(checkout, 'src/data/moves/invalid-moves.ts'), 'utf8');
let commit = '';
try {
	commit = execFileSync('git', ['-C', checkout, 'log', '-1', '--format=%h %cd', '--date=short']).toString().trim();
} catch {}

const toID = name => name.toLowerCase().replace(/_/g, '');
const callers = (/const moveCallingMoves = \[([^\]]*)\]/.exec(src)?.[1] || '')
	.match(/MoveId\.(\w+)/g).map(m => toID(m.slice(7)));

function list(name) {
	const start = src.indexOf(`export const ${name}`);
	if (start < 0) throw new Error(`${name} not found in invalid-moves.ts`);
	const body = src.slice(start, src.indexOf(']);', start));
	const ids = new Set([...body.matchAll(/MoveId\.(\w+)/g)].map(m => toID(m[1])));
	if (body.includes('...moveCallingMoves')) for (const id of callers) ids.add(id);
	ids.delete('none');
	return [...ids].sort();
}

const LISTS = {
	metronome: 'invalidMetronomeMoves',
	assist: 'invalidAssistMoves',
	sleepTalk: 'invalidSleepTalkMoves',
	copycat: 'invalidCopycatMoves',
	mirrorMove: 'invalidMirrorMoveMoves',
	encore: 'invalidEncoreMoves',
	instruct: 'invalidInstructMoves',
	sketch: 'invalidSketchMoves',
};

const wrap = ids => {
	const lines = [];
	let line = '\t\t';
	for (const id of ids) {
		const item = `'${id}', `;
		if (line.length + item.length > 116) {
			lines.push(line.trimEnd());
			line = '\t\t';
		}
		line += item;
	}
	if (line.trim()) lines.push(line.trimEnd());
	return lines.join('\n');
};

let out = `/**
 * PokéRogue's move banlists (src/data/moves/invalid-moves.ts${commit ? `, ${commit}` : ''}), built
 * by tools/pokerogue/build-move-lists.cjs: the moves each move-calling move
 * (and Encore, Instruct, Sketch) can't use in PokéRogue. PokéRogue diverges
 * from the main games on purpose: most signature moves can be called by
 * Metronome and the like, and Sketch copies everything but itself and
 * Struggle. Its Mirror Move copies the target's last move whatever it
 * targeted (in the main games, only moves aimed at the user).
 *
 * applyPokeRogueMoveLists() sets the moves' flags to match, so Showdown's
 * own Metronome / Assist / ... code (which reads those flags) follows
 * PokéRogue's lists.
 */

export const PokeRogueMoveBans: {[list: string]: string[]} = {
`;
for (const [key, name] of Object.entries(LISTS)) {
	out += `\t// ${name}\n\t${key}: [\n${wrap(list(name))}\n\t],\n`;
}
out += `};

/** The flag each list sets ("can't use" flags) or clears (Metronome / Mirror Move: "can use" flags). */
const FLAGS: {[list: string]: [flag: string, banned: boolean]} = {
	metronome: ['metronome', false],
	assist: ['noassist', true],
	sleepTalk: ['nosleeptalk', true],
	copycat: ['failcopycat', true],
	mirrorMove: ['mirror', false],
	encore: ['failencore', true],
	instruct: ['failinstruct', true],
	sketch: ['nosketch', true],
};

export function applyPokeRogueMoveLists(dex: ModdedDex) {
	for (const [list, [flag, setWhenBanned]] of Object.entries(FLAGS)) {
		const banned = new Set(PokeRogueMoveBans[list]);
		for (const id in dex.data.Moves) {
			const data = dex.data.Moves[id];
			if (data.isZ || data.isMax || (data as AnyObject).realMove) continue;
			const value = banned.has(id) === setWhenBanned;
			if (!!(data.flags as AnyObject | undefined)?.[flag] === value) continue;
			const flags: AnyObject = {...dex.modData('Moves', id).flags};
			if (value) flags[flag] = 1;
			else delete flags[flag];
			dex.modData('Moves', id).flags = flags;
		}
	}
}
`;
const file = path.join(ROOT, 'data/mods/pokerogue/move-lists.ts');
fs.writeFileSync(file, out);
console.log(`wrote ${path.relative(ROOT, file)}`);
