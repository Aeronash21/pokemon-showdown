/**
 * PokéRogue's move banlists (src/data/moves/invalid-moves.ts, 215a58a 2026-10-27), built
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
	// invalidMetronomeMoves
	metronome: [
		'afteryou', 'assist', 'banefulbunker', 'beakblast', 'belch', 'bestow', 'comeuppance', 'copycat', 'counter',
		'craftyshield', 'destinybond', 'detect', 'endure', 'feint', 'focuspunch', 'followme', 'helpinghand', 'instruct',
		'kingsshield', 'matblock', 'mefirst', 'metronome', 'mimic', 'mirrorcoat', 'mirrormove', 'naturepower',
		'obstruct', 'protect', 'quash', 'quickguard', 'ragepowder', 'revivalblessing', 'shelltrap', 'silktrap', 'sketch',
		'sleeptalk', 'snatch', 'snore', 'spikyshield', 'spotlight', 'struggle', 'transform', 'wideguard',
	],
	// invalidAssistMoves
	assist: [
		'assist', 'banefulbunker', 'beakblast', 'belch', 'bestow', 'bounce', 'celebrate', 'chatter', 'circlethrow',
		'copycat', 'counter', 'destinybond', 'detect', 'dig', 'dive', 'dragontail', 'endure', 'feint', 'fly',
		'focuspunch', 'followme', 'helpinghand', 'holdhands', 'kingsshield', 'matblock', 'mefirst', 'metronome', 'mimic',
		'mirrorcoat', 'mirrormove', 'naturepower', 'phantomforce', 'protect', 'ragepowder', 'roar', 'shadowforce',
		'shelltrap', 'sketch', 'skydrop', 'sleeptalk', 'snatch', 'spikyshield', 'spotlight', 'struggle', 'switcheroo',
		'transform', 'trick', 'whirlwind',
	],
	// invalidSleepTalkMoves
	sleepTalk: [
		'assist', 'beakblast', 'belch', 'bide', 'bounce', 'copycat', 'dig', 'dive', 'fly', 'focuspunch', 'freezeshock',
		'geomancy', 'iceburn', 'mefirst', 'metronome', 'mimic', 'mirrormove', 'naturepower', 'phantomforce', 'razorwind',
		'shadowforce', 'shelltrap', 'sketch', 'skullbash', 'skyattack', 'skydrop', 'sleeptalk', 'snatch', 'solarbeam',
		'solarblade', 'struggle', 'uproar',
	],
	// invalidCopycatMoves
	copycat: [
		'assist', 'banefulbunker', 'beakblast', 'bestow', 'celebrate', 'chatter', 'circlethrow', 'copycat', 'counter',
		'destinybond', 'detect', 'dragontail', 'endure', 'feint', 'focuspunch', 'followme', 'helpinghand', 'holdhands',
		'kingsshield', 'matblock', 'mefirst', 'metronome', 'mimic', 'mirrorcoat', 'mirrormove', 'naturepower', 'protect',
		'ragepowder', 'roar', 'shelltrap', 'sketch', 'sleeptalk', 'snatch', 'spikyshield', 'spotlight', 'struggle',
		'switcheroo', 'transform', 'trick', 'whirlwind',
	],
	// invalidMirrorMoveMoves
	mirrorMove: [
		'acupressure', 'afteryou', 'aromaticmist', 'assist', 'beakblast', 'belch', 'chillyreception', 'coaching',
		'conversion2', 'copycat', 'counter', 'craftyshield', 'curse', 'decorate', 'doodle', 'doomdesire', 'dragoncheer',
		'electricterrain', 'finalgambit', 'floralhealing', 'flowershield', 'focuspunch', 'futuresight', 'gearup',
		'grassyterrain', 'gravity', 'guardsplit', 'hail', 'haze', 'healpulse', 'helpinghand', 'holdhands', 'instruct',
		'iondeluge', 'magneticflux', 'matblock', 'mefirst', 'metronome', 'mimic', 'mirrorcoat', 'mirrormove', 'mist',
		'mistyterrain', 'mudsport', 'naturepower', 'perishsong', 'powersplit', 'psychicterrain', 'psychup', 'purify',
		'quickguard', 'raindance', 'reflecttype', 'roleplay', 'rototiller', 'sandstorm', 'shelltrap', 'sketch',
		'sleeptalk', 'snatch', 'snowscape', 'spitup', 'spotlight', 'struggle', 'sunnyday', 'teatime', 'transform',
		'watersport', 'wideguard',
	],
	// invalidEncoreMoves
	encore: [
		'assist', 'copycat', 'dynamaxcannon', 'encore', 'mefirst', 'metronome', 'mimic', 'mirrormove', 'naturepower',
		'sketch', 'sleeptalk', 'snatch', 'struggle', 'transform',
	],
	// invalidInstructMoves
	instruct: [
		'assist', 'beakblast', 'bide', 'blastburn', 'bounce', 'copycat', 'dig', 'dive', 'electroshot', 'eternabeam',
		'fakeout', 'firstimpression', 'fly', 'focuspunch', 'freezeshock', 'frenzyplant', 'geomancy', 'gigaimpact',
		'hydrocannon', 'hyperbeam', 'iceball', 'iceburn', 'instruct', 'matblock', 'mefirst', 'meteorassault',
		'meteorbeam', 'metronome', 'mimic', 'mirrormove', 'naturepower', 'outrage', 'petaldance', 'phantomforce',
		'prismaticlaser', 'ragingfury', 'roaroftime', 'rockwrecker', 'rollout', 'shadowforce', 'shelltrap', 'sketch',
		'skullbash', 'skyattack', 'skydrop', 'sleeptalk', 'snatch', 'solarbeam', 'solarblade', 'struggle', 'thrash',
		'transform', 'uproar',
	],
	// invalidSketchMoves
	sketch: [
		'sketch', 'struggle',
	],
};

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
