type MegaSetProfile = {
	nature?: string;
	moves: string[];
	ffaMoves?: string[];
};

/**
 * Sets in this table are chosen according to the ACTUAL Mega form,
 * not the base Pokemon.
 *
 * Moves are legality-checked before being applied, so if Showdown
 * changes a learnset later the generator safely falls back to the
 * Pokemon's original random-battle moves instead of crashing.
 */
const MEGA_SET_PROFILES: Record<string, MegaSetProfile> = {
	// ---- Classic Megas where the Mega form changes role heavily ----

	charizardmegax: {
		nature: 'Jolly',
		moves: [
			'Dragon Dance',
			'Flare Blitz',
			'Dragon Claw',
			'Earthquake',
		],
	},

	charizardmegay: {
		nature: 'Timid',
		moves: [
			'Fire Blast',
			'Solar Beam',
			'Weather Ball',
			'Roost',
			'Focus Blast',
		],
		ffaMoves: [
			'Heat Wave',
			'Solar Beam',
			'Weather Ball',
			'Protect',
			'Fire Blast',
		],
	},

	mewtwomegax: {
		nature: 'Jolly',
		moves: [
			'Bulk Up',
			'Drain Punch',
			'Zen Headbutt',
			'Ice Punch',
		],
	},

	mewtwomegay: {
		nature: 'Timid',
		moves: [
			'Psystrike',
			'Aura Sphere',
			'Ice Beam',
			'Nasty Plot',
		],
	},

	blastoisemega: {
		nature: 'Modest',
		moves: [
			'Shell Smash',
			'Water Pulse',
			'Dark Pulse',
			'Aura Sphere',
		],
	},

	pidgeotmega: {
		nature: 'Timid',
		moves: [
			'Hurricane',
			'Heat Wave',
			'U-turn',
			'Roost',
		],
	},

	pinsirmega: {
		nature: 'Jolly',
		moves: [
			'Swords Dance',
			'Return',
			'Quick Attack',
			'Close Combat',
			'Earthquake',
		],
	},

	heracrossmega: {
		nature: 'Adamant',
		moves: [
			'Close Combat',
			'Pin Missile',
			'Rock Blast',
			'Bullet Seed',
		],
	},

	gardevoirmega: {
		nature: 'Timid',
		moves: [
			'Hyper Voice',
			'Psyshock',
			'Focus Blast',
			'Calm Mind',
		],
	},

	altariamega: {
		nature: 'Jolly',
		moves: [
			'Dragon Dance',
			'Return',
			'Body Slam',
			'Earthquake',
			'Roost',
		],
	},

	salamencemega: {
		nature: 'Jolly',
		moves: [
			'Dragon Dance',
			'Double-Edge',
			'Earthquake',
			'Roost',
		],
	},

	// ---- New / Z-A Megas ----

	meganiummega: {
		nature: 'Modest',
		moves: [
			'Solar Beam',
			'Weather Ball',
			'Dazzling Gleam',
			'Synthesis',
			'Earth Power',
		],
		ffaMoves: [
			'Solar Beam',
			'Weather Ball',
			'Dazzling Gleam',
			'Protect',
		],
	},

	feraligatrmega: {
		nature: 'Jolly',
		moves: [
			'Dragon Dance',
			'Body Slam',
			'Liquidation',
			'Earthquake',
			'Double-Edge',
		],
		ffaMoves: [
			'Dragon Dance',
			'Body Slam',
			'Liquidation',
			'Protect',
			'Earthquake',
		],
	},

	emboarmega: {
		nature: 'Adamant',
		moves: [
			'Flare Blitz',
			'Close Combat',
			'Head Smash',
			'Earthquake',
		],
	},

	starmiemega: {
		nature: 'Jolly',
		moves: [
			'Liquidation',
			'Aqua Jet',
			'Flip Turn',
			'Psycho Cut',
			'Zen Headbutt',
			'Ice Spinner',
		],
		ffaMoves: [
			'Liquidation',
			'Aqua Jet',
			'Psycho Cut',
			'Protect',
			'Flip Turn',
		],
	},

	raichumegax: {
		nature: 'Jolly',
		moves: [
			'Volt Tackle',
			'Knock Off',
			'Brick Break',
			'Fake Out',
			'Volt Switch',
		],
	},

	raichumegay: {
		nature: 'Timid',
		moves: [
			'Thunder',
			'Focus Blast',
			'Surf',
			'Nasty Plot',
			'Volt Switch',
		],
	},

	absolmegaz: {
		nature: 'Jolly',
		moves: [
			'Swords Dance',
			'Night Slash',
			'Psycho Cut',
			'Shadow Claw',
			'X-Scissor',
		],
	},

	staraptormega: {
		nature: 'Jolly',
		moves: [
			'Close Combat',
			'Brave Bird',
			'Roost',
			'U-turn',
			'Quick Attack',
		],
	},

	garchompmegaz: {
		nature: 'Timid',
		moves: [
			'Draco Meteor',
			'Earth Power',
			'Fire Blast',
			'Stealth Rock',
			'Dragon Pulse',
		],
	},

	lucariomegaz: {
		nature: 'Timid',
		moves: [
			'Nasty Plot',
			'Aura Sphere',
			'Flash Cannon',
			'Vacuum Wave',
			'Dark Pulse',
		],
	},

	excadrillmega: {
		nature: 'Jolly',
		moves: [
			'Swords Dance',
			'Drill Run',
			'Iron Head',
			'Rapid Spin',
			'Rock Slide',
		],
	},

	victreebelmega: {
		nature: 'Modest',
		moves: [
			'Giga Drain',
			'Sludge Bomb',
			'Strength Sap',
			'Sleep Powder',
		],
	},

	scovillainmega: {
		nature: 'Bold',
		moves: [
			'Overheat',
			'Giga Drain',
			'Leech Seed',
			'Protect',
		],
		ffaMoves: [
			'Rage Powder',
			'Protect',
			'Overheat',
			'Giga Drain',
			'Leech Seed',
		],
	},

	glimmoramega: {
		nature: 'Timid',
		moves: [
			'Power Gem',
			'Sludge Wave',
			'Earth Power',
			'Stealth Rock',
		],
	},

	floettemega: {
		nature: 'Modest',
		moves: [
			'Calm Mind',
			'Moonblast',
			'Draining Kiss',
			'Light of Ruin',
			'Protect',
		],
		ffaMoves: [
			'Moonblast',
			'Dazzling Gleam',
			'Light of Ruin',
			'Protect',
		],
	},

	pyroarmega: {
		nature: 'Timid',
		moves: [
			'Fire Blast',
			'Hyper Voice',
			'Will-O-Wisp',
			'Taunt',
			'Dark Pulse',
		],
	},

	golurkmega: {
		nature: 'Adamant',
		moves: [
			'Shadow Punch',
			'Drain Punch',
			'Ice Punch',
			'Earthquake',
		],
	},

	greninjamega: {
		nature: 'Timid',
		moves: [
			'Hydro Pump',
			'Dark Pulse',
			'Ice Beam',
			'U-turn',
		],
	},

	barbaraclemega: {
		nature: 'Jolly',
		moves: [
			'Shell Smash',
			'Close Combat',
			'Stone Edge',
			'Liquidation',
		],
	},

	dragalgemega: {
		nature: 'Modest',
		moves: [
			'Draco Meteor',
			'Sludge Bomb',
			'Flip Turn',
			'Toxic Spikes',
			'Hydro Pump',
		],
	},

	darkraimega: {
		nature: 'Timid',
		moves: [
			'Dark Pulse',
			'Dark Void',
			'Nasty Plot',
			'Sludge Bomb',
			'Ice Beam',
		],
	},

	magearnamega: {
		nature: 'Modest',
		moves: [
			'Calm Mind',
			'Fleur Cannon',
			'Flash Cannon',
			'Aura Sphere',
		],
	},

	zygardemega: {
		nature: 'Modest',
		moves: [
			'Dragon Pulse',
			'Earth Power',
			'Glare',
			'Substitute',
		],
	},

	skarmorymega: {
		nature: 'Jolly',
		moves: [
			'Swords Dance',
			'Brave Bird',
			'Iron Head',
			'Roost',
		],
	},

	crabominablemega: {
		nature: 'Adamant',
		moves: [
			'Drain Punch',
			'Ice Punch',
			'Thunder Punch',
			'Ice Hammer',
			'Earthquake',
		],
	},

	malamarmega: {
		nature: 'Adamant',
		moves: [
			'Superpower',
			'Knock Off',
			'Psycho Cut',
			'Rest',
			'Protect',
		],
		ffaMoves: [
			'Superpower',
			'Knock Off',
			'Psycho Cut',
			'Protect',
		],
	},

	chandeluremega: {
		nature: 'Timid',
		moves: [
			'Shadow Ball',
			'Fire Blast',
			'Energy Ball',
			'Calm Mind',
		],
	},

	golisopodmega: {
		nature: 'Adamant',
		moves: [
			'First Impression',
			'Iron Head',
			'Leech Life',
			'Liquidation',
			'Sucker Punch',
		],
	},

	baxcaliburmega: {
		nature: 'Jolly',
		moves: [
			'Dragon Dance',
			'Glaive Rush',
			'Icicle Crash',
			'Earthquake',
		],
	},

	chesnaughtmega: {
		nature: 'Adamant',
		moves: [
			'Bulk Up',
			'Drain Punch',
			'Wood Hammer',
			'Spiky Shield',
		],
	},

	delphoxmega: {
		nature: 'Timid',
		moves: [
			'Fire Blast',
			'Psychic',
			'Shadow Ball',
			'Calm Mind',
		],
	},

	scraftymega: {
		nature: 'Adamant',
		moves: [
			'Bulk Up',
			'Drain Punch',
			'Knock Off',
			'Rest',
		],
	},

	chimechomega: {
		nature: 'Modest',
		moves: [
			'Psychic',
			'Flash Cannon',
			'Recover',
			'Calm Mind',
		],
	},

	scolipedemega: {
		nature: 'Jolly',
		moves: [
			'Swords Dance',
			'Megahorn',
			'Poison Jab',
			'Earthquake',
		],
	},

	clefablemega: {
		nature: 'Modest',
		moves: [
			'Calm Mind',
			'Moonblast',
			'Soft-Boiled',
			'Flamethrower',
		],
	},

	falinksmega: {
		nature: 'Jolly',
		moves: [
			'No Retreat',
			'Close Combat',
			'Iron Head',
			'Throat Chop',
			'Knock Off',
		],
	},

	zeraoramega: {
		nature: 'Jolly',
		moves: [
			'Plasma Fists',
			'Close Combat',
			'Knock Off',
			'Volt Switch',
		],
	},

	heatranmega: {
		nature: 'Modest',
		moves: [
			'Magma Storm',
			'Earth Power',
			'Flash Cannon',
			'Stealth Rock',
		],
	},

	drampamega: {
		nature: 'Modest',
		moves: [
			'Draco Meteor',
			'Hyper Voice',
			'Flamethrower',
			'Roost',
		],
	},

	meowsticmmega: {
		nature: 'Timid',
		moves: [
			'Psychic',
			'Shadow Ball',
			'Calm Mind',
			'Thunderbolt',
		],
	},

	meowsticfmega: {
		nature: 'Timid',
		moves: [
			'Psychic',
			'Shadow Ball',
			'Calm Mind',
			'Thunderbolt',
		],
	},

	tatsugiricurlymega: {
		nature: 'Timid',
		moves: [
			'Draco Meteor',
			'Hydro Pump',
			'Icy Wind',
			'Protect',
		],
	},

	tatsugiridroopymega: {
		nature: 'Timid',
		moves: [
			'Draco Meteor',
			'Hydro Pump',
			'Icy Wind',
			'Protect',
		],
	},

	tatsugiristretchymega: {
		nature: 'Timid',
		moves: [
			'Draco Meteor',
			'Hydro Pump',
			'Icy Wind',
			'Protect',
		],
	},
};

export function applyMegaSetOverride(
	generator: any,
	species: Species,
	set: RandomTeamsTypes.RandomSet
): RandomTeamsTypes.RandomSet {
	const item = generator.dex.items.get(set.item);

	if (!item.megaStone) return set;

	const megaMap = item.megaStone as Record<string, string>;

	const megaName =
		megaMap[species.name] ||
		megaMap[species.baseSpecies] ||
		(Object.values(megaMap)[0] as string | undefined);

	if (!megaName) return set;

	const mega = generator.dex.species.get(megaName);
	const profile = MEGA_SET_PROFILES[mega.id];

	if (!profile) return set;

	/*
	 * Use FFA-specific moves where appropriate.
	 */
	const desiredMoves =
		generator.format?.gameType === 'freeforall' &&
		profile.ffaMoves?.length
			? profile.ffaMoves
			: profile.moves;

	/*
	 * Never blindly install a move.
	 *
	 * This avoids illegal-set bugs if a move does not exist in the
	 * current learnset revision.
	 */
	const learnset = new Set(
		generator.dex.species.getMovePool(species.id)
	);

	const chosen: string[] = [];

	for (const moveName of desiredMoves) {
		const move = generator.dex.moves.get(moveName);

		if (!move.exists) continue;
		if (!learnset.has(move.id)) continue;
		if (chosen.includes(move.id)) continue;

		chosen.push(move.id);

		if (chosen.length === 4) break;
	}

	/*
	 * If a future Showdown learnset change makes one of our preferred
	 * moves unavailable, fill the remaining slots from the original
	 * generated set instead of failing team generation.
	 */
	for (const moveName of set.moves) {
		if (chosen.length >= 4) break;

		const move = generator.dex.moves.get(moveName);

		if (!move.exists) continue;
		if (chosen.includes(move.id)) continue;

		chosen.push(move.id);
	}

	if (chosen.length === 4) {
		set.moves = chosen;
	}

	if (profile.nature) {
		set.nature = profile.nature;
	}

	return set;
}
