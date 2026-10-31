'use strict';
// Writes js/locations.js: every item check of the randomizer (one row per item,
// 216 in all) with the save-file flag the game sets when that item is taken,
// the column it is counted in, the text box that shows it and, for the checks
// that have a chest icon on the map by default, where that icon sits.
//
// Names and the set of checks come from the randomizer's own region files
// (app/Region/Standard of alttp_vt_randomizer, a "new Location\..." line per
// item). The save-file flags come from the Archipelago SNES client for this
// game (worlds/alttp/Client.py: location_table_uw / _npc / _ow / _misc), the
// same flags the tracker's auto-tracking has always read for the non-dungeon
// checks. Run with:
//   node tools/locations.js <alttp_vt_randomizer>/app/Region/Standard <path to Archipelago's worlds/alttp/Client.py>
const fs = require('fs');
const path = require('path');

const regionDir = process.argv[2];
const clientFile = process.argv[3];
if (!regionDir || !clientFile) {
	console.error('usage: node tools/locations.js <app/Region/Standard> <worlds/alttp/Client.py>');
	process.exit(1);
}
const target = path.join(__dirname, '..', 'js', 'locations.js');

// ---------------------------------------------------------------- the checks
// [name, region file] for every item location the randomizer defines
function readRegions(dir) {
	const out = [];
	const walk = d => {
		for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const full = path.join(d, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			const region = path.relative(dir, full).replace(/\\/g, '/');
			const text = fs.readFileSync(full, 'utf8');
			// prizes, fountains, medallions and the fairy trades are not item checks (World::getTotalItemCount)
			const re = /new Location\\((?:Prize|Fountain|Medallion|Trade)\\?[A-Za-z\\]*|[A-Za-z\\]+)\("([^"]+)"/g;
			let m;
			while ((m = re.exec(text))) {
				if (/^(Prize|Fountain|Medallion|Trade)/.test(m[1])) {
					continue;
				}
				out.push([m[2], region]);
			}
		}
	};
	walk(dir);
	return out;
}

// --------------------------------------------------------- save-file flags
// Room flags are two bytes per room from the start of the save file; the
// client's 16-bit masks cover both bytes (0x10-0x80 the first, 0x100 up the
// second). NPC flags are the two bytes at 0x410, overworld flags one byte per
// screen from 0x280 (bit 0x40), and a few sit in the progress bytes at 0x3C6.
function readClientTables(file) {
	const text = fs.readFileSync(file, 'utf8');
	const table = name => {
		const m = new RegExp(name + '\\s*=\\s*\\{([\\s\\S]*?)\\}', 'm').exec(text);
		if (!m) {
			throw new Error('table ' + name + ' not found in ' + file);
		}
		return m[1];
	};
	const flags = new Map();
	const split16 = (base, mask) => (mask > 0xFF ? [base + 1, mask >> 8] : [base, mask]);
	for (const m of table('location_table_uw').matchAll(/(["'])(.*?)\1:\s*\((0x[0-9a-f]+),\s*(0x[0-9a-f]+)\)/g)) {
		flags.set(m[2], split16(parseInt(m[3], 16) * 2, parseInt(m[4], 16)));
	}
	for (const m of table('location_table_npc').matchAll(/(["'])(.*?)\1:\s*(0x[0-9a-f]+)/g)) {
		flags.set(m[2], split16(0x410, parseInt(m[3], 16)));
	}
	for (const m of table('location_table_ow').matchAll(/(["'])(.*?)\1:\s*(0x[0-9a-f]+)/g)) {
		flags.set(m[2], [0x280 + parseInt(m[3], 16), 0x40]);
	}
	for (const m of table('location_table_misc').matchAll(/(["'])(.*?)\1:\s*\((0x[0-9a-f]+),\s*(0x[0-9a-f]+)\)/g)) {
		flags.set(m[2], [parseInt(m[3], 16), parseInt(m[4], 16)]);
	}
	return flags;
}

// the client names a few checks differently from the randomizer
const CLIENT_NAMES = {
	"Hyrule Castle - Zelda's Cell": "Hyrule Castle - Zelda's Chest",
	'Graveyard Ledge': 'Graveyard Cave',
	'Pegasus Rocks': 'Bonk Rock Cave',
	'Hammer Pegs': 'Peg Cave',
	'Bumper Cave': 'Bumper Cave Ledge',
	'Mini Moldorm Cave - NPC': 'Mini Moldorm Cave - Generous Guy',
	'Hype Cave - NPC': 'Hype Cave - Generous Guy',
	"Ganon's Tower - Moldorm Chest": 'Ganons Tower - Validation Chest',
};
const clientName = name => CLIENT_NAMES[name] || name.replace(/^Ganon's Tower/, 'Ganons Tower');

// ------------------------------------------------------------- the columns
// Overworld: taken standing on the overworld map or from someone on it, plus
// the sanctuary.
// Drop-downs: everything behind a hole (the tracker's Drop downs panel), the
// three sewer chests behind the sanctuary drop included.
// Single / multi: the other caves and houses, with one item or several.
// Dungeon: everything inside the thirteen dungeons (Hyrule Castle with its
// dark cross, Castle Tower and Ganon's Tower included).
const DROP_DOWNS = ['Kakariko Well - Top', 'Kakariko Well - Left', 'Kakariko Well - Middle', 'Kakariko Well - Right', 'Kakariko Well - Bottom', "Link's Uncle", 'Secret Passage', 'Lost Woods Hideout', 'Lumberjack Tree', 'Magic Bat', 'Sewers - Secret Room - Left', 'Sewers - Secret Room - Middle', 'Sewers - Secret Room - Right'];
const OVERWORLD = ['Master Sword Pedestal', 'Mushroom', 'Ether Tablet', 'Spectacle Rock', 'Floating Island', 'King Zora', "Zora's Ledge", 'Bottle Merchant', 'Old Man', 'Lake Hylia Island', 'Sunken Treasure', 'Flute Spot', 'Maze Race', 'Purple Chest', 'Desert Ledge', 'Bombos Tablet', 'Hobo', 'Bumper Cave', 'Catfish', 'Stumpy', 'Digging Game', 'Blacksmith', 'Pyramid', 'Sanctuary'];
const SINGLE = ["King's Tomb", 'Kakariko Tavern', 'Chicken House', 'Pegasus Rocks', 'Sick Kid', 'Graveyard Ledge', 'Floodgate Chest', "Link's House", "Aginah's Cave", 'Ice Rod Cave', 'Cave 45', 'Checkerboard Cave', 'Library', 'Spiral Cave', 'Mimic Cave', 'Spectacle Rock Cave', 'Potion Shop', 'Spike Cave', 'Brewery', 'C-Shaped House', 'Chest Game', 'Hammer Pegs'];
const MULTI = ["Blind's Hideout - Top", "Blind's Hideout - Left", "Blind's Hideout - Right", "Blind's Hideout - Far Left", "Blind's Hideout - Far Right", "Sahasrahla's Hut - Left", "Sahasrahla's Hut - Middle", "Sahasrahla's Hut - Right", 'Sahasrahla', 'Waterfall Fairy - Left', 'Waterfall Fairy - Right', 'Paradox Cave Lower - Far Left', 'Paradox Cave Lower - Left', 'Paradox Cave Lower - Right', 'Paradox Cave Lower - Far Right', 'Paradox Cave Lower - Middle', 'Paradox Cave Upper - Left', 'Paradox Cave Upper - Right', 'Hookshot Cave - Top Right', 'Hookshot Cave - Top Left', 'Hookshot Cave - Bottom Left', 'Hookshot Cave - Bottom Right', 'Superbunny Cave - Top', 'Superbunny Cave - Bottom', 'Mire Shed - Left', 'Mire Shed - Right', 'Pyramid Fairy - Left', 'Pyramid Fairy - Right', 'Hype Cave - Top', 'Hype Cave - Middle Right', 'Hype Cave - Middle Left', 'Hype Cave - Bottom', 'Hype Cave - NPC', 'Mini Moldorm Cave - Far Left', 'Mini Moldorm Cave - Left', 'Mini Moldorm Cave - Right', 'Mini Moldorm Cave - Far Right', 'Mini Moldorm Cave - NPC'];

// ------------------------------------------- text boxes (data-chest ids)
// a box marks every check listed for its id
const TEXT_BOXES = {
	1: ['Floodgate Chest'], 2: ["Link's House"], 3: ['Spiral Cave'], 4: ['Mimic Cave'], 5: ['Kakariko Tavern'], 6: ['Chicken House'], 7: ['Brewery'], 8: ['C-Shaped House'], 9: ["Aginah's Cave"],
	10: ['Mire Shed - Left', 'Mire Shed - Right'], 11: ['Superbunny Cave - Top', 'Superbunny Cave - Bottom'], 13: ['Spike Cave'],
	14: ['Kakariko Well - Top', 'Kakariko Well - Left', 'Kakariko Well - Middle', 'Kakariko Well - Right', 'Kakariko Well - Bottom'],
	15: ["Blind's Hideout - Top", "Blind's Hideout - Left", "Blind's Hideout - Right", "Blind's Hideout - Far Left", "Blind's Hideout - Far Right"],
	16: ['Hype Cave - Top', 'Hype Cave - Middle Right', 'Hype Cave - Middle Left', 'Hype Cave - Bottom', 'Hype Cave - NPC'],
	17: ['Paradox Cave Lower - Far Left', 'Paradox Cave Lower - Left', 'Paradox Cave Lower - Right', 'Paradox Cave Lower - Far Right', 'Paradox Cave Lower - Middle', 'Paradox Cave Upper - Left', 'Paradox Cave Upper - Right'],
	18: ['Pegasus Rocks'], 19: ['Mini Moldorm Cave - Far Left', 'Mini Moldorm Cave - Left', 'Mini Moldorm Cave - Right', 'Mini Moldorm Cave - Far Right', 'Mini Moldorm Cave - NPC'],
	20: ['Ice Rod Cave'], 23: ['Chest Game'], 24: ['Bottle Merchant'], 26: ['Stumpy'], 27: ['Sick Kid'], 28: ['Purple Chest'], 29: ['Hobo'], 30: ['Ether Tablet'], 31: ['Bombos Tablet'],
	32: ['Catfish'], 33: ['King Zora'], 34: ['Old Man'], 35: ['Potion Shop'], 36: ['Lost Woods Hideout'], 37: ['Lumberjack Tree'], 38: ['Spectacle Rock Cave'], 39: ['Cave 45'], 40: ['Graveyard Ledge'],
	41: ['Checkerboard Cave'], 42: ['Hammer Pegs'], 43: ['Library'], 44: ['Mushroom'], 45: ['Spectacle Rock'], 46: ['Floating Island'], 47: ['Maze Race'], 48: ['Desert Ledge'], 49: ['Lake Hylia Island'],
	50: ['Bumper Cave'], 51: ['Pyramid'], 52: ['Digging Game'], 53: ["Zora's Ledge"], 54: ['Flute Spot'],
	55: ['Sewers - Secret Room - Left', 'Sewers - Secret Room - Middle', 'Sewers - Secret Room - Right'], 56: ["Link's Uncle", 'Secret Passage'],
	59: ['Magic Bat'], 60: ['Blacksmith'], 61: ['Pyramid Fairy - Left', 'Pyramid Fairy - Right'], 62: ['Master Sword Pedestal'], 64: ['Waterfall Fairy - Left', 'Waterfall Fairy - Right'], 69: ['Sunken Treasure'],
	70: ["Sahasrahla's Hut - Left", "Sahasrahla's Hut - Middle", "Sahasrahla's Hut - Right", 'Sahasrahla'],
	71: ['Hookshot Cave - Top Right', 'Hookshot Cave - Top Left', 'Hookshot Cave - Bottom Left', 'Hookshot Cave - Bottom Right'],
	72: ["King's Tomb"], 73: ['Desert Palace - Torch'], 74: ["Ganon's Tower - Bob's Torch"],
};

// ------------------------------------------- default map chests (world, x, y)
// where the built-in configuration puts a chest icon for the check
const MAP_SPOTS = {
	'Master Sword Pedestal': ['light-world', 10, 12], 'Mushroom': ['light-world', 62, 44], 'Ether Tablet': ['light-world', 246, 6], 'Spectacle Rock': ['light-world', 290, 40],
	'Floating Island': ['light-world', 470, 4], 'King Zora': ['light-world', 566, 74], "Zora's Ledge": ['light-world', 548, 92], 'Kakariko Tavern': ['light-world', 84, 335],
	'Bottle Merchant': ['light-world', 42, 276], 'Old Man': ['light-world', 259, 117], 'Potion Shop': ['light-world', 487, 187], 'Lake Hylia Island': ['light-world', 421, 491],
	'Sunken Treasure': ['light-world', 247, 547], 'Flute Spot': ['light-world', 169, 387], 'Maze Race': ['light-world', 13, 409], 'Purple Chest': ['light-world', 193, 529],
	'Desert Ledge': ['light-world', 3, 545], 'Bombos Tablet': ['light-world', 123, 545], 'Hobo': ['light-world', 413, 411],
	'Bumper Cave': ['dark-world', 185, 85], 'Catfish': ['dark-world', 534, 99], 'Stumpy': ['dark-world', 174, 401], 'Digging Game': ['dark-world', 22, 403], 'Blacksmith': ['dark-world', 80, 389], 'Pyramid': ['dark-world', 338, 259],
};

// ------------------------------------------------------------------ build
const regions = readRegions(regionDir);
const flags = readClientTables(clientFile);
const boxOf = {};
for (const [id, names] of Object.entries(TEXT_BOXES)) {
	for (const name of names) {
		if (boxOf[name]) throw new Error(name + ' is listed for two text boxes');
		boxOf[name] = parseInt(id, 10);
	}
}
const seen = new Set();
const rows = [];
for (const [name, region] of regions) {
	if (seen.has(name)) throw new Error('duplicate location ' + name);
	seen.add(name);
	const dungeonFile = !/^(LightWorld|DarkWorld)\//.test(region);
	let cat;
	if (OVERWORLD.includes(name)) cat = 'ow';
	else if (DROP_DOWNS.includes(name)) cat = 'drop';
	else if (SINGLE.includes(name)) cat = 'single';
	else if (MULTI.includes(name)) cat = 'multi';
	else if (dungeonFile) cat = 'dungeon';
	else throw new Error('no column for ' + name + ' (' + region + ')');
	const flag = flags.get(clientName(name));
	if (!flag) throw new Error('no save-file flag for ' + name + ' (client name ' + clientName(name) + ')');
	const row = { name, cat, sram: flag };
	if (cat === 'dungeon') {
		row.dungeon = /^Sewers/.test(name) ? 'Hyrule Castle' : name.replace(/ - .*$/, '');
	}
	if (boxOf[name]) row.chest = boxOf[name];
	if (MAP_SPOTS[name]) row.map = MAP_SPOTS[name];
	rows.push(row);
}
for (const name of [...OVERWORLD, ...DROP_DOWNS, ...SINGLE, ...MULTI, ...Object.keys(boxOf), ...Object.keys(MAP_SPOTS)]) {
	if (!seen.has(name)) throw new Error('unknown location ' + name);
}
const totals = {};
for (const row of rows) totals[row.cat] = (totals[row.cat] || 0) + 1;
if (rows.length !== 216) throw new Error('expected 216 checks, found ' + rows.length);

const hex = n => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const lines = [
	"'use strict';",
	'',
	'// Generated by tools/locations.js: every item check of the randomizer, one row',
	'// per item (' + rows.length + ' in all: ' + Object.entries(totals).map(([k, v]) => v + ' ' + k).join(', ') + '). Names are the',
	"// randomizer's own. sram is [offset into the save file, bit] of the flag the",
	'// game sets when the item is taken (room flags 2 bytes per room, overworld',
	'// screens from 0x280, NPC flags at 0x410); cat is the column of the Checks box;',
	'// chest is the data-chest id of the text box that marks it; map is where the',
	'// built-in configuration puts a chest icon for it.',
	'const LOCATIONS = [',
];
for (const row of rows) {
	const parts = ['name: ' + q(row.name), "cat: '" + row.cat + "'", 'sram: [' + hex(row.sram[0]) + ', ' + hex(row.sram[1]) + ']'];
	if (row.dungeon) parts.push('dungeon: ' + q(row.dungeon));
	if (row.chest) parts.push('chest: ' + row.chest);
	if (row.map) parts.push("map: ['" + row.map[0] + "', " + row.map[1] + ', ' + row.map[2] + ']');
	lines.push('\t{ ' + parts.join(', ') + ' },');
}
lines.push('];', '');
fs.writeFileSync(target, lines.join('\r\n'));
console.log('wrote ' + path.relative(process.cwd(), target) + ': ' + rows.length + ' checks (' + Object.entries(totals).map(([k, v]) => k + ' ' + v).join(', ') + ')');
