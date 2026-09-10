const fs = require('fs');
const path = require('path');

const singlesPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/sets.json'
);

const ffaPath = path.resolve(
	__dirname,
	'../data/random-battles/ndsharedpower/doubles-sets.json'
);

const singles = JSON.parse(fs.readFileSync(singlesPath, 'utf8'));
const ffa = JSON.parse(fs.readFileSync(ffaPath, 'utf8'));

function clone(obj) {
	return structuredClone(obj);
}

function toID(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

/*
 * ============================================================
 * ADD PRIMAL GROUDON / KYOGRE
 * ============================================================
 *
 * We clone the ordinary Groudon/Kyogre random sets.
 *
 * The important part is the DATABASE KEY:
 *
 *   groudonprimal
 *   kyogreprimal
 *
 * Because Showdown sees the requested species as the Primal
 * forme, getPriorityItem() automatically sees requiredItem:
 *
 * Groudon-Primal -> Red Orb
 * Kyogre-Primal  -> Blue Orb
 *
 * They still enter battle as Groudon/Kyogre and then Primal
 * Revert when the Orb activates.
 */
function addPrimals(table) {
	if (table.groudon) {
		table.groudonprimal = clone(table.groudon);

		for (const set of table.groudonprimal.sets) {
			/*
			 * It starts the battle as ordinary Groudon.
			 * Desolate Land appears after Primal Reversion.
			 */
			set.abilities = ['Drought'];
		}

		console.log('✓ Added Groudon-Primal -> Red Orb');
	} else {
		console.warn('⚠ Could not find base Groudon set');
	}

	if (table.kyogre) {
		table.kyogreprimal = clone(table.kyogre);

		for (const set of table.kyogreprimal.sets) {
			/*
			 * It starts as ordinary Kyogre.
			 * Primordial Sea appears after Primal Reversion.
			 */
			set.abilities = ['Drizzle'];
		}

		console.log('✓ Added Kyogre-Primal -> Blue Orb');
	} else {
		console.warn('⚠ Could not find base Kyogre set');
	}
}


/*
 * ============================================================
 * ADD ULTRA NECROZMA
 * ============================================================
 *
 * Ultra Necrozma is battle-only.
 * It must start as Necrozma-Dawn-Wings or Necrozma-Dusk-Mane
 * holding Ultranecrozium Z.
 *
 * Therefore the PRE-Ultra ability needs to be Prism Armor.
 * Neuroforce is obtained after Ultra Burst.
 */
function addUltraNecrozma(table, doubles = false) {
	const reference =
		table.necrozmaduskmane ||
		table.necrozmadawnwings ||
		table.necrozma;

	const level = reference?.level ?? 72;

	if (!doubles) {
		table.necrozmaultra = {
			level,
			sets: [
				{
					role: 'Setup Sweeper',
					movepool: [
						'Dragon Dance',
						'Photon Geyser',
						'Earthquake',
						'Knock Off',
					],
					abilities: ['Prism Armor'],
					teraTypes: [
						'Psychic',
						'Dragon',
						'Ground',
					],
				},
				{
					role: 'Setup Sweeper',
					movepool: [
						'Calm Mind',
						'Photon Geyser',
						'Dragon Pulse',
						'Heat Wave',
					],
					abilities: ['Prism Armor'],
					teraTypes: [
						'Psychic',
						'Dragon',
					],
				},
			],
		};
	} else {
		table.necrozmaultra = {
			level,
			sets: [
				{
					role: 'Doubles Setup Sweeper',
					movepool: [
						'Dragon Dance',
						'Photon Geyser',
						'Earthquake',
						'Protect',
					],
					abilities: ['Prism Armor'],
					teraTypes: [
						'Psychic',
						'Dragon',
						'Ground',
					],
				},
				{
					role: 'Doubles Setup Sweeper',
					movepool: [
						'Calm Mind',
						'Photon Geyser',
						'Dragon Pulse',
						'Protect',
					],
					abilities: ['Prism Armor'],
					teraTypes: [
						'Psychic',
						'Dragon',
					],
				},
			],
		};
	}

	console.log('✓ Added Necrozma-Ultra -> Ultranecrozium Z');
}


/*
 * ============================================================
 * REMOVE BANNED POKEMON
 * ============================================================
 */
function removeBannedPokemon(table) {
	for (const id of [
		'shedinja',
		'eternatuseternamax',
	]) {
		if (table[id]) {
			delete table[id];
			console.log(`✓ Removed ${id}`);
		}
	}
}


/*
 * ============================================================
 * REMOVE SHADOW TAG FROM THE ENTIRE RANDOM POOL
 * ============================================================
 *
 * If the Pokemon has another normal ability, use that.
 *
 * If we somehow encounter an unknown set whose ONLY ability is
 * Shadow Tag, remove that particular set rather than allowing
 * Shadow Tag back into the pool.
 */
const SHADOW_TAG_FALLBACKS = {
	wobbuffet: ['Telepathy'],
	wynaut: ['Telepathy'],

	gothitelle: ['Competitive', 'Frisk'],
	gothorita: ['Competitive', 'Frisk'],
	gothita: ['Competitive', 'Frisk'],
};

function removeShadowTag(table) {
	let removedAbilities = 0;
	let removedSets = 0;
	let removedSpecies = 0;

	for (const [speciesId, data] of Object.entries(table)) {
		if (!data || !Array.isArray(data.sets)) continue;

		const keptSets = [];

		for (const set of data.sets) {
			if (!Array.isArray(set.abilities)) {
				keptSets.push(set);
				continue;
			}

			const before = set.abilities.length;

			set.abilities = set.abilities.filter(
				ability => toID(ability) !== 'shadowtag'
			);

			removedAbilities += before - set.abilities.length;

			if (!set.abilities.length) {
				const fallback =
					SHADOW_TAG_FALLBACKS[speciesId];

				if (fallback) {
					set.abilities = [...fallback];

					console.log(
						`  ${speciesId}: Shadow Tag -> ` +
						fallback.join(' / ')
					);
				} else {
					console.warn(
						`  ${speciesId}: removed set because ` +
						`Shadow Tag was its only ability`
					);

					removedSets++;
					continue;
				}
			}

			keptSets.push(set);
		}

		data.sets = keptSets;

		if (!data.sets.length) {
			delete table[speciesId];
			removedSpecies++;
		}
	}

	console.log(
		`✓ Shadow Tag cleaned: ${removedAbilities} ability entries removed`
	);

	if (removedSets) {
		console.log(`  ${removedSets} unusable set(s) removed`);
	}

	if (removedSpecies) {
		console.log(`  ${removedSpecies} empty species removed`);
	}
}


function patch(table, doubles) {
	addPrimals(table);
	addUltraNecrozma(table, doubles);

	removeBannedPokemon(table);

	/*
	 * IMPORTANT: do this LAST so no earlier script can add
	 * Shadow Tag back into the generated data.
	 */
	removeShadowTag(table);
}


console.log('');
console.log('========================================');
console.log(' SPECIAL ND SHARED POWER POOL PATCH');
console.log('========================================');

console.log('');
console.log('--- Singles ---');
patch(singles, false);

console.log('');
console.log('--- FFA ---');
patch(ffa, true);

fs.writeFileSync(
	singlesPath,
	JSON.stringify(singles, null, 2) + '\n'
);

fs.writeFileSync(
	ffaPath,
	JSON.stringify(ffa, null, 2) + '\n'
);

console.log('');
console.log('========================================');
console.log(' Special-form patch complete');
console.log('========================================');
