'use strict';

// The text boxes: one per location, coloured by hand or by the check record.
// A box that stands for checks (data-chest) is gray once they are all
// collected and pink while some are, whatever it was clicked to; the colours
// clicked by hand (yellow: seen, pink: started, green: item in hand) are a
// note kept underneath. Clicking a box to gray collects its checks and
// clicking it back to blue uncollects them, so the box, the Checks box and
// the chests on the map always agree.
class TextTracker {

	#notes = new Map();      // box -> colour chosen by hand (gray only for a box without checks)
	#names = new Map();      // box -> the checks it stands for

	#items = {};

	#settings = null;
	#checks = null;

	constructor(settings, checks) {
		this.#settings = settings;
		this.#checks = checks;
		for (const box of $('.text-location')) {
			const id = $(box).data('chest');
			const names = id ? checks.forChest(id) : [];
			if (id && !names.length) {
				console.error('text box has no checks: data-chest=' + id, box);
			}
			this.#names.set(box, names);
			this.#notes.set(box, 'blue');
		}

		$('.text-location').on('click', e => this.#click(e.currentTarget));
		checks.onChange(() => this.#renderAll());

		$('#load-button').on('click', () => {
		  this.loadSettings();
		});
	}

	// the colour a box shows: its checks decide gray and pink, the note the rest
	#shown(box) {
		const names = this.#names.get(box) || [];
		if (names.length) {
			const done = this.#checks.collectedCount(names);
			if (done === names.length) {
				return 'gray';
			}
			if (done > 0) {
				return 'pink';
			}
		}
		return this.#notes.get(box) || 'blue';
	}

	#render(box) {
		$(box).removeClass('blue green yellow pink gray').addClass(this.#shown(box));
	}

	#renderAll() {
		for (const box of this.#names.keys()) {
			this.#render(box);
		}
	}

	// the click cycle: blue -> (yellow for a visible item, pink for a multi cave) -> gray -> blue
	#click(box) {
		const names = this.#names.get(box) || [];
		const type = $(box).data('chesttype');
		const shown = this.#shown(box);
		let next;
		if (shown === 'gray') {
			next = 'blue';
		} else if (shown === 'yellow' || shown === 'pink') {
			next = 'gray';
		} else if (type === 'visible') {
			next = 'yellow';
		} else if (type === 'multi') {
			next = 'pink';
		} else {
			next = 'gray';
		}
		if (names.length && (next === 'gray' || next === 'blue')) {
			this.#notes.set(box, 'blue');
			this.#checks.collectAll(names, next === 'gray');
		} else {
			this.#notes.set(box, next);
		}
		this.#render(box);
	}

	#boxFor(id) {
		for (const box of this.#names.keys()) {
			if (parseInt($(box).data('chest'), 10) === id) {
				return box;
			}
		}
		return null;
	}

	// an item in hand turns the box of the check it unlocks green
	setItem(item, value) {
		let id;
		switch(item) {
			case 'mushroom': {
				id = 35;
				break;
			}
			case 'shovel': {
				id = 54;
				break;
			}
			case 'bottle': {
				id = 27;
				break;
			}
			case 'powder': {
				id = 59;
				break;
			}
			default: {
				return;
			}
		}

		this.#items[id] = value;
		const box = this.#boxFor(id);
		if (box && (value === true || value > 0) && this.#shown(box) !== 'gray') {
			this.#notes.set(box, 'green');
			this.#render(box);
		}
	};

	#keyOf(el) {
		const container = el.closest('.location-container');
		return (container ? container.id : '') + '/' + $(el).text().trim();
	}

	// the colours chosen by hand; what the checks decide lives in the check record
	save() {
		const notes = {};
		for (const box of this.#names.keys()) {
			const note = this.#notes.get(box);
			if (note && note !== 'blue') {
				notes[this.#keyOf(box)] = note;
			}
		}
		return notes;
	}

	// a backup from before the check record kept gray boxes here: those checks are collected
	load(data, config) {
		const legacy = !(config && config.checks);
		for (const box of this.#names.keys()) {
			const colour = data[this.#keyOf(box)];
			const names = this.#names.get(box);
			if (colour === 'gray' && names.length) {
				this.#notes.set(box, 'blue');
				if (legacy) {
					this.#checks.collectAll(names, true);
				}
			} else {
				this.#notes.set(box, colour || 'blue');
			}
		}
		this.#renderAll();
	}

	// [key, note] for every box, blue included (co-op sync; the checks themselves are synced from the check record)
	allColors() {
		const out = [];
		for (const box of this.#names.keys()) {
			out.push([this.#keyOf(box), this.#notes.get(box) || 'blue']);
		}
		return out;
	}

	setColor(key, colour) {
		for (const box of this.#names.keys()) {
			if (this.#keyOf(box) !== key) {
				continue;
			}
			const names = this.#names.get(box);
			if (colour === 'gray' && names.length) {
				this.#notes.set(box, 'blue');
				this.#checks.collectAll(names, true);
			} else {
				this.#notes.set(box, colour || 'blue');
			}
			this.#render(box);
			return;
		}
	}

	loadSettings() {
	  const settings = this.#settings.getSettings();

	  $('#drop-down').css('display', !!settings.dropDown ? '' : 'none');
	  $('#multi-chest').css('display', !!settings.multi ? '' : 'none');
	  $('#single-chest').css('display', !!settings.single ? '' : 'none');
	  $('#visible-items').css('display', !!settings.visible ? '' : 'none');
	  $('#overworld').css('display', !!settings.overworld ? '' : 'none');
	  $('#connectors').css('display', !!settings.connectors ? '' : 'none');
	}

}
