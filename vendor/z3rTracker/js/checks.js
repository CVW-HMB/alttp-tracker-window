'use strict';

// The one record of what is done. Every item check of the game (LOCATIONS)
// is either collected or not, and the five columns of the Checks box are
// counted from that record: overworld, single-item caves, multi-item caves,
// drop-downs and dungeons, plus a by-hand adjustment per column for what the
// tracker cannot see. The auto-tracker collects checks from the save file, a
// text box shows its checks and collects them when clicked, a chest icon on
// the map shows its check and collects it when right-clicked. They all read
// and write this one record, so the counts, the boxes and the map cannot
// disagree.

const CHECK_COLUMNS = [
	{ id: 'ow', label: 'OW', title: 'Overworld', tip: 'Items taken out on the overworld map, or given by someone standing on it: the tablets, the ledges and islands, the pedestal, the dig spots, the hobo, the merchants, the dwarf and the purple chest, plus the sanctuary heart.' },
	{ id: 'single', label: 'Single', title: 'Single-item caves', tip: 'Caves, houses and drop-downs with exactly one item in them, such as Aginah, the chicken house, the tavern back room, the spiral cave or the library.' },
	{ id: 'multi', label: 'Multi', title: 'Multi-item caves', tip: 'Every item in a cave with more than one: Blind\'s hut, Sahasrahla\'s hut (his gift included), the two fairies, Paradox, Hookshot cave, Hype, Mini Moldorm, Mire shed and Superbunny.' },
	{ id: 'drop', label: 'Drop', title: 'Drop-downs', tip: 'Everything behind a hole: the five well chests, the uncle and the secret passage chest, the Lost Woods hideout, the lumberjack tree, the magic bat and the three sewer chests behind the sanctuary drop.' },
	{ id: 'dungeon', label: 'Dungeon', title: 'Dungeons', tip: 'Every chest, torch and boss drop inside the thirteen dungeons: Hyrule Castle with its dark cross, Castle Tower and Ganon\'s Tower included. Keys, maps and compasses count too, they are checks.' },
];

class Checks {
	#byName = new Map();
	#byChest = new Map();
	#spots = [];
	#totals = {};
	#collected = new Set();
	#adjust = {};
	#listeners = [];

	constructor() {
		for (const column of CHECK_COLUMNS) {
			this.#totals[column.id] = 0;
			this.#adjust[column.id] = 0;
		}
		for (const location of LOCATIONS) {
			if (this.#byName.has(location.name) || !(location.cat in this.#totals)) {
				console.error('bad location table entry', location);
				continue;
			}
			this.#byName.set(location.name, location);
			this.#totals[location.cat]++;
			if (location.chest) {
				(this.#byChest.get(location.chest) || this.#byChest.set(location.chest, []).get(location.chest)).push(location.name);
			}
			if (location.map) {
				this.#spots.push({ name: location.name, world: location.map[0], x: location.map[1], y: location.map[2] });
			}
		}
	}

	columns() {
		return CHECK_COLUMNS;
	}

	has(name) {
		return this.#byName.has(name);
	}

	names() {
		return [...this.#byName.keys()];
	}

	total(column) {
		return this.#totals[column] || 0;
	}

	adjustment(column) {
		return this.#adjust[column] || 0;
	}

	// checks not yet collected in the column, with the by-hand adjustment on top
	remaining(column) {
		let left = 0;
		for (const location of this.#byName.values()) {
			if (location.cat === column && !this.#collected.has(location.name)) {
				left++;
			}
		}
		return left + this.adjustment(column);
	}

	isCollected(name) {
		return this.#collected.has(name);
	}

	// how many of these checks are collected
	collectedCount(names) {
		let count = 0;
		for (const name of names) {
			if (this.#collected.has(name)) {
				count++;
			}
		}
		return count;
	}

	collect(name, on = true) {
		return this.collectAll([name], on);
	}

	// returns true when something changed
	collectAll(names, on = true) {
		let changed = false;
		for (const name of names) {
			if (!this.#byName.has(name)) {
				console.error('unknown check', name);
				continue;
			}
			if (on && !this.#collected.has(name)) {
				this.#collected.add(name);
				changed = true;
			} else if (!on && this.#collected.has(name)) {
				this.#collected.delete(name);
				changed = true;
			}
		}
		if (changed) {
			this.#reclamp();
			this.#emit();
		}
		return changed;
	}

	// a by-hand adjustment never takes a column below 0 or above its total,
	// also once checks collected later have used it up (the hand count stood
	// in for them)
	#reclamp() {
		for (const column of Object.keys(this.#adjust)) {
			const base = this.remaining(column) - this.#adjust[column];
			this.#adjust[column] = Math.max(-base, Math.min(this.total(column) - base, this.#adjust[column]));
		}
	}

	// the up / down arrows: the shown count moves by delta, kept between 0 and the column total
	bump(column, delta) {
		this.setAdjustment(column, this.adjustment(column) + delta);
	}

	setAdjustment(column, value) {
		if (!(column in this.#adjust)) {
			return;
		}
		const base = this.remaining(column) - this.adjustment(column);
		const clamped = Math.max(-base, Math.min(this.total(column) - base, Math.round(value) || 0));
		if (clamped === this.#adjust[column]) {
			return;
		}
		this.#adjust[column] = clamped;
		this.#emit();
	}

	// the checks a text box with this data-chest id stands for
	forChest(id) {
		return this.#byChest.get(parseInt(id, 10)) || [];
	}

	// the check whose default chest icon sits at (x, y) on this map, if any
	spotAt(world, x, y) {
		for (const spot of this.#spots) {
			if (spot.world === world && Math.abs(spot.x - x) <= Checks.SPOT_RADIUS && Math.abs(spot.y - y) <= Checks.SPOT_RADIUS) {
				return spot.name;
			}
		}
		return null;
	}

	spots() {
		return this.#spots.slice();
	}

	onChange(listener) {
		this.#listeners.push(listener);
	}

	#emit() {
		for (const listener of this.#listeners) {
			listener();
		}
	}

	save() {
		return { collected: [...this.#collected].sort(), adjust: Object.assign({}, this.#adjust) };
	}

	load(data) {
		this.#collected = new Set();
		for (const column of Object.keys(this.#adjust)) {
			this.#adjust[column] = 0;
		}
		if (data && Array.isArray(data.collected)) {
			for (const name of data.collected) {
				if (this.#byName.has(name)) {
					this.#collected.add(name);
				}
			}
		}
		if (data && data.adjust && typeof data.adjust === 'object') {
			for (const column of Object.keys(this.#adjust)) {
				if (typeof data.adjust[column] === 'number') {
					this.#adjust[column] = data.adjust[column];
				}
			}
		}
		this.#reclamp();
		this.#emit();
	}

	// hooks for the test harness
	debugState() {
		const out = { collected: this.#collected.size, adjust: Object.assign({}, this.#adjust) };
		for (const column of CHECK_COLUMNS) {
			out[column.id] = this.remaining(column.id);
		}
		return out;
	}
}
Checks.SPOT_RADIUS = 8;

// The Checks box on the tracker screen: the five counts with their arrows.
class CheckPanel {
	#checks = null;
	#settings = null;

	constructor(checks, settings) {
		this.#checks = checks;
		this.#settings = settings;
		const grid = $('#checks-grid');
		for (const column of CHECK_COLUMNS) {
			const cell = $('<div class="check-cell"></div>').attr('data-column', column.id).attr('data-tip-title', column.title).attr('data-tip', column.tip + ' The arrows move the number by hand for anything the tracker missed; marking a text box, right-clicking a map chest or the auto-tracker already lower it.');
			cell.append($('<div class="check-label"></div>').text(column.label));
			cell.append($('<button class="check-arrow check-up" title="one more">&#9650;</button>'));
			cell.append($('<div class="check-count"></div>').text(checks.remaining(column.id)));
			cell.append($('<button class="check-arrow check-down" title="one less">&#9660;</button>'));
			grid.append(cell);
		}
		grid.on('click', '.check-up, .check-down', e => {
			const cell = e.currentTarget.closest('.check-cell');
			checks.bump(cell.dataset.column, e.currentTarget.classList.contains('check-up') ? 1 : -1);
		});
		checks.onChange(() => this.render());
		$('#load-button').on('click', () => this.loadSettings());
		this.render();
	}

	render() {
		let left = 0;
		for (const column of CHECK_COLUMNS) {
			const remaining = this.#checks.remaining(column.id);
			left += remaining;
			const cell = $(`#checks-grid .check-cell[data-column="${column.id}"]`);
			cell.find('.check-count').text(remaining);
			cell.toggleClass('check-done', remaining === 0);
			cell.find('.check-down').prop('disabled', remaining <= 0);
			cell.find('.check-up').prop('disabled', remaining >= this.#checks.total(column.id));
		}
		$('#checks-total').text(left);
	}

	loadSettings() {
		const settings = this.#settings.getSettings();
		$('#checks').css('display', settings.checks ? '' : 'none');
	}
}
