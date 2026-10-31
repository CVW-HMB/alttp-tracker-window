class MapTracker {
	#el = null;
	#menu = null;

	#icons = new Map();
	#spoiler = null;
	#data = null;
	#config = null;
	#settings = null;
	#checks = null;
	#visitMarks = false;

	constructor(el, zoomer, settings, checks) {
		this.#el = el;
		this.#settings = settings;
		this.#checks = checks;
		this.#menu = new Menu(
			$(el).find('.menu-container')[0],
			(icon, x, y) => this.addIcon(icon, x, y),
			icon => this.removeIcon(icon),
			zoomer,
			icon => this.toggleVisited(icon),
		);

		$(el).on('contextmenu', e => {
			e.preventDefault();
		});

		// right click: a chest standing on a known check collects that check (the
		// chest goes away with it); any other icon is removed, and Shift+right
		// click removes such a chest outright
		$(el).on('contextmenu', '.icon.placed', e => {
			const icon = e.target.closest('.icon');
			if (icon.dataset.check && !e.shiftKey) {
				this.#checks.collect(icon.dataset.check, true);
			} else {
				this.removeIcon(icon);
				this.#countRemovedChest(icon);
			}
		});

		checks.onChange(() => this.#applyChecks());
		$('#load-button').on('click', () => this.onOkDude());
	}

	addIcon(icon, x, y, adjust = true, state = null) {
		// an icon placed from the menu starts with a fresh mark when marks are on
		if (state === null && this.#visitMarks) {
			state = { visit: 1, visited: 0 };
		}
		if (adjust) {
			x -= 3;
			y += 1;
		}
		const clone = icon.cloneNode(true);
		const cloneJq = $(clone);
		cloneJq.removeClass('used');
		if (adjust && cloneJq.find('.icon-image')[0]) {
			y += 2;
		}
		cloneJq.addClass('placed').css({ left: x, top: y });
		if (state && state.visit) {
			cloneJq.addClass('visit');
			if (state.visited) {
				cloneJq.addClass('visited');
			}
		}
		const key = cloneJq.data('key');
		if (!key) {
			console.error('Icon is missing data-key property');
			return;
		}
		for (const menuIcon of $('body').find(`.location-menu .icon[data-key='${key}'], #connectors .icon[data-key='${key}']`)) {
			if ($(menuIcon).data('amount') !== 'unlimited') {
				$(menuIcon).addClass('used');
			}
		}

		this.#el.appendChild(clone);
		if (state && state.visit) {
			VisitMarks.attach(clone);
		}
		const icons = this.#icons.get(key) || [];
		icons.push({ x, y, clone });
		this.#icons.set(key, icons);
		this.#bind(clone, x, y, adjust);
	}

	// a chest icon on the spot of a known check shows that check: it is hidden
	// once the check is collected and, with marks on, its mark follows the
	// check. A chest put down there by hand means the check is not done.
	#bind(icon, x, y, byHand) {
		if (!/^(small-chest|chest[125]|bombchest|bunnychest)$/.test(String($(icon).data('key')))) {
			return;
		}
		const name = this.#checks.spotAt(this.#el.id, x, y);
		if (!name) {
			return;
		}
		icon.dataset.check = name;
		if (byHand) {
			// one chest per check: the new one stands in for any older (hidden) one
			for (const other of $(this.#el).children(`.icon.placed[data-check="${name}"]`)) {
				if (other !== icon) {
					this.removeIcon(other);
				}
			}
			if (this.#checks.isCollected(name)) {
				this.#checks.collect(name, false);
				return;
			}
		}
		this.#applyCheck(icon);
	}

	// a numbered chest (1, 2 or 5 items) taken off the map by hand stands for
	// that many checks done in a cave the tracker has no record for: without
	// auto-tracking the count is lowered by that many (a 1 is a single-item
	// cave, a 2 or 5 a multi-item cave); with auto-tracking on the game reports
	// those chests itself, so the count is left alone
	#countRemovedChest(icon) {
		const match = /^chest([125])$/.exec(String($(icon).data('key')));
		if (!match || this.#settings.getSettings().autoTracking) {
			return;
		}
		const items = parseInt(match[1], 10);
		this.#checks.bump(items === 1 ? 'single' : 'multi', -items);
	}

	#applyCheck(icon) {
		const collected = this.#checks.isCollected(icon.dataset.check);
		$(icon).toggleClass('collected', collected);
		if ($(icon).hasClass('visit')) {
			$(icon).toggleClass('visited', collected);
		}
	}

	#applyChecks() {
		for (const icon of $(this.#el).children('.icon.placed[data-check]')) {
			this.#applyCheck(icon);
		}
	}

	// left click on a marked icon: a chest on a known check collects or
	// uncollects it, any other icon just flips its mark
	toggleVisited(icon) {
		if (icon.dataset.check) {
			this.#checks.collect(icon.dataset.check, !this.#checks.isCollected(icon.dataset.check));
		} else {
			$(icon).toggleClass('visited');
		}
	}

	removeIcon(icon) {
		if (!icon) {
			return;
		}
		const key = $(icon).data('key');

		if (this.#icons.has(key)) {
			const icons = this.#icons.get(key).filter(item => item.clone !== icon);
			if (icons.length) {
				this.#icons.set(key, icons);
			} else {
				this.#icons.delete(key);
			}
		}
		icon.remove();

		if ($(icon).data('amount') !== 'unlimited') {
			const placed = $(`.icon[data-key='${key}'].placed`);
			if (placed.length === 0) {
				for (const menuIcon of $(`.icon[data-key='${key}'].used`)) {
					$(menuIcon).removeClass('used');
				}
			}
		}
	}

	// every placed icon as { x, y, key, visited } (co-op sync)
	placedCells() {
		const cells = [];
		for (const el of $(this.#el).children('.icon.placed')) {
			cells.push({
				x: parseFloat(el.style.left),
				y: parseFloat(el.style.top),
				key: String($(el).data('key')),
				visited: $(el).hasClass('visited') ? 1 : 0,
			});
		}
		return cells;
	}

	// make the slot at (x, y) show `key` (or nothing when key is null) with the
	// given visited flag, touching only what differs (co-op sync)
	applyCell(x, y, key, visited) {
		let existing = null;
		for (const el of $(this.#el).children('.icon.placed')) {
			if (parseFloat(el.style.left) === x && parseFloat(el.style.top) === y) {
				existing = el;
				break;
			}
		}
		if (existing) {
			if (String($(existing).data('key')) === String(key)) {
				// a chest on a known check takes its mark from the check record instead
				if ($(existing).hasClass('visit') && !existing.dataset.check) {
					$(existing).toggleClass('visited', !!visited);
				}
				return;
			}
			this.removeIcon(existing);
		}
		if (key) {
			const icon = $(this.#el).find(`.menu-container .icon[data-key='${key}']`)[0];
			if (icon) {
				const state = this.#visitMarks ? { visit: 1, visited: visited ? 1 : 0 } : null;
				this.addIcon(icon, x, y, false, state);
			}
		}
	}

	unload() {
		for (const icon of $(this.#el).find('> .icon')) {
			icon.remove();
		}
		this.#icons = new Map();
	}

	save() {
		const output = [];
		for (const [key, icons] of this.#icons.entries()) {
			for (const icon of icons) {
				const row = [ key, icon.x, icon.y ];
				if ($(icon.clone).hasClass('visit')) {
					row.push(null, { visit: 1, visited: $(icon.clone).hasClass('visited') ? 1 : 0 });
				}
				output.push(row);
			}
		}
		return JSON.parse(JSON.stringify(output));
	}

	onOkDude() {
		const settings = this.#settings.getSettings();
		this.#spoiler = settings.spoiler;
		this.#visitMarks = !!settings.visitMarks;
		this.load(this.#data, this.#config);
	}

	load(data, config) {
		this.#data = data;
		this.#config = config;
		this.unload();
		const shuffled = !!(this.#spoiler && Object.keys(this.#spoiler.entranceMap).length);
		for (const [key, x, y, entrance, saved] of data) {
			// a saved row keeps its own marks (resume); a config entry gets fresh ones in marks mode
			const state = saved ? saved : (this.#visitMarks ? { visit: 1, visited: 0 } : null);
			const prize = !!entrance && entrance.some(e => e.indexOf('Prize') >= 0);
			if (!entrance || (!prize && !shuffled) || (prize && !this.#spoiler)) {
				const icon = $(this.#el).find(`.menu-container .icon[data-key='${key}']`)[0];
				if (icon) {
					this.addIcon(icon, x, y, false, state);
				}
			} else if (this.#spoiler) {
				let iconKey;
				if (entrance.some(e => e.indexOf('Prize') >= 0)) {
					iconKey = this.#spoiler.prizeMap[entrance[0]];
				} else {
					for (const name of entrance) {
						if (this.#spoiler.entranceMap[name]) {
							iconKey = config.entranceMap[this.#spoiler.entranceMap[name]];
						}
					}
				}

				if (iconKey) {
					// an entrance the definition maps to no icon ("x") shows nothing
					const icon = $(this.#el).find(`.menu-container .icon[data-key='${iconKey}']`)[0];
					if (icon) {
						this.addIcon(icon, x, y, false, state);
					}
				}
			}
		}
	}
}