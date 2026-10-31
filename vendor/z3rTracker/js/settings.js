'use strict';

const prizeNameMap = {
	'Eastern Palace - Prize': 'Eastern Palace Prize',
	'Desert Palace - Prize': 'Desert Palace Prize',
	'Tower of Hera - Prize': 'Tower of Hera Prize',
	'Palace of Darkness - Prize': 'Palace of Darkness Prize',
	'Thieves\' Town - Prize': 'Thieves Town Prize',
	'Skull Woods - Prize': 'Skull Woods Prize',
	'Swamp Palace - Prize': 'Swamp Palace Prize',
	'Ice Palace - Prize': 'Ice Palace Prize',
	'Misery Mire - Prize': 'Misery Mire Prize',
	'Turtle Rock - Prize': 'Turtle Rock Prize',
	'Eastern Palace': 'Eastern Palace Prize',
	'Desert Palace': 'Desert Palace Prize',
	'Tower of Hera': 'Tower of Hera Prize',
	'Palace of Darkness': 'Palace of Darkness Prize',
	'Thieves Town': 'Thieves Town Prize',
	'Skull Woods': 'Skull Woods Prize',
	'Swamp Palace': 'Swamp Palace Prize',
	'Ice Palace': 'Ice Palace Prize',
	'Misery Mire': 'Misery Mire Prize',
	'Turtle Rock': 'Turtle Rock Prize',
	'Crystal 1': 'bluecrystal',
	'Crystal 2': 'bluecrystal',
	'Crystal 3': 'bluecrystal',
	'Crystal 4': 'bluecrystal',
	'Crystal 5': 'redcrystal',
	'Crystal 6': 'redcrystal',
	'Crystal 7': 'bluecrystal',
	'Blue Pendant': 'crappendant',
	'Red Pendant': 'crappendant',
	'Green Pendant': 'greenpendant'
}

class Settings {

	#settings = {
		oneMap: 0,
		multi: 1,
		single: 1,
		dropDown: 1,
		visible: 1,
		overworld: 1,
		connectors: 1,
		checks: 1,
		useMaps: 1,
		ogSephs: 0,
		autoTracking: 0,
		autoTrackingPort: 23074,
		visitMarks: 0,
		spoiler: '',
	};

	constructor() {
		$('#spoiler-open').on('click', () => $('#spoiler-overlay').removeClass('coop-hidden'));
		$('#spoiler-done, #spoiler-close, #spoiler-overlay .coop-backdrop').on('click', () => $('#spoiler-overlay').addClass('coop-hidden'));
		$('#spoiler-clear').on('click', () => $('#spoiler').val('').trigger('change'));
		$('#spoiler').on('input change', () => this.refreshSpoilerSummary());
		$('#spoiler-file').on('change', e => {
			const file = e.target.files[0];
			if (!file) {
				return;
			}
			const reader = new FileReader();
			reader.onload = ev => $('#spoiler').val(ev.target.result).trigger('change');
			reader.readAsText(file, 'UTF-8');
		});
		this.refreshSpoilerSummary();
		$('#load-button').on('click', () => {
			const ogSephs = $('#enable-og-sephs').is(':checked') ? 1 : 0;
			const useMaps = $('#enable-maps').is(':checked') ? 1 : 0;

			$('body').addClass(ogSephs ? 'og-sephs' : 'new-icons');
			if (!useMaps) {
				for (const el of $('.map-container')) {
					$(el).css('display', 'none');
				}
			}
		});
	}

	getSettings() {
		return {
			oneMap: $('#enable-one-map').is(':checked') ? 1 : 0,
			multi: $('#enable-multi').is(':checked') ? 1 : 0,
			single: $('#enable-single').is(':checked') ? 1 : 0,
			dropDown: $('#enable-drop-down').is(':checked') ? 1 : 0,
			visible: $('#enable-visible').is(':checked') ? 1 : 0,
			overworld: $('#enable-overworld').is(':checked') ? 1 : 0,
			connectors: $('#enable-connectors').is(':checked') ? 1 : 0,
			checks: $('#enable-checks').is(':checked') ? 1 : 0,
			ogSephs: $('#enable-og-sephs').is(':checked') ? 1 : 0,
			useMaps: $('#enable-maps').is(':checked') ? 1 : 0,
			autoTracking: $('#enable-auto-tracking').is(':checked') ? 1 : 0,
			autoTrackingPort: $('#auto-tracking-port').val(),
			visitMarks: $('#enable-visit-marks').is(':checked') ? 1 : 0,
			spoiler: this.parseSpoiler($('#spoiler').val() || ''),
		};
	}

	// one line under the Spoiler button and in the dialog: what is loaded
	refreshSpoilerSummary() {
		const text = $('#spoiler').val() || '';
		let summary = 'No spoiler loaded';
		let cls = '';
		if (text.trim() !== '') {
			const spoiler = this.parseSpoiler(text);
			if (spoiler) {
				const entrances = Object.keys(spoiler.entranceMap).length;
				const prizes = Object.keys(spoiler.prizeMap).length;
				summary = `${spoiler.format} spoiler loaded: ${entrances ? entrances + ' entrances' : 'entrances not shuffled'}, ${prizes} prizes`;
				cls = 'good';
			} else {
				summary = 'Could not read this spoiler';
				cls = 'bad';
			}
		}
		$('#spoiler-summary, #spoiler-modal-summary').text(summary).attr('class', 'settings-note ' + cls);
	}

	// Accepts an alttpr.com spoiler (JSON, bare or wrapped in {"spoiler": ...},
	// with or without entrance shuffle) or a Door Randomizer spoiler (text).
	// Returns { entranceMap, prizeMap, format } or null when nothing usable is in it.
	parseSpoiler(text) {
		if (text === '') {
			return null;
		}
		try {
			const trimmed = text.trim();
			if (trimmed.startsWith('{')) {
				return this.#parseJsonSpoiler(JSON.parse(trimmed));
			}
			return this.#parseTextSpoiler(text);
		} catch (e) {
			console.error(e.message);
			return null;
		}
	}

	#parseJsonSpoiler(json) {
		const spoiler = json && json.spoiler && typeof json.spoiler === 'object' ? json.spoiler : json;
		const entranceMap = {};
		const prizeMap = {};
		if (Array.isArray(spoiler.Entrances)) {
			for (const row of spoiler.Entrances) {
				// an "exit" row is the reverse side of a one-way connection, not a door
				if (!row || !row.entrance || !row.exit || row.direction === 'exit' || row.exit === 'Chris Houlihan Room Exit') {
					continue;
				}
				entranceMap[row.entrance] = row.exit;
			}
		}
		// dungeon prizes sit in the dungeon sections as "<Dungeon> - Prize" (older files:
		// "<Dungeon> - Prize:1" with values like "Crystal4:1" or "PendantOfPower:1")
		const sections = Object.values(spoiler).filter(v => v && typeof v === 'object' && !Array.isArray(v));
		if (spoiler.Prizes && typeof spoiler.Prizes === 'object') {
			sections.push(Object.fromEntries(Object.entries(spoiler.Prizes).map(([dungeon, prize]) => [dungeon + ' - Prize', prize])));
		}
		for (const section of sections) {
			for (const [key, value] of Object.entries(section)) {
				const match = /^(.*? - Prize)(?::\d+)?$/.exec(key);
				if (!match || typeof value !== 'string') {
					continue;
				}
				const location = prizeNameMap[match[1]];
				const prize = prizeNameMap[Settings.normalizePrize(value)];
				if (location && prize) {
					prizeMap[location] = prize;
				}
			}
		}
		if (!Object.keys(entranceMap).length && !Object.keys(prizeMap).length) {
			return null;
		}
		return { entranceMap, prizeMap, format: 'alttpr.com' };
	}

	#parseTextSpoiler(text) {
		const entranceMap = {};
		const prizeMap = {};
		const entrancesIndex = text.indexOf('Entrances:');
		const locationsIndex = text.indexOf('Locations:');
		if (entrancesIndex >= 0) {
			const mapping = text.slice(entrancesIndex, locationsIndex >= 0 ? locationsIndex : text.length).split('\n');
			for (const line of mapping) {
				let split;
				if (line.indexOf('<=>') >= 0) {
					split = line.split('<=>');
				} else if (line.indexOf('=>') >= 0) {
					split = line.split('=>');
				} else {
					continue;
				}
				entranceMap[split[0].trim()] = split[1].trim();
			}
		}
		if (locationsIndex >= 0) {
			const endLocationsIndex = text.indexOf('Ganons Tower - Validation Chest');
			const locations = text.slice(locationsIndex, endLocationsIndex >= 0 ? endLocationsIndex : text.length).split('\n');
			for (const line of locations) {
				const [location, item] = line.split(':');
				if (!item || !prizeNameMap[location.trim()] || !prizeNameMap[Settings.normalizePrize(item)]) {
					continue;
				}
				prizeMap[prizeNameMap[location.trim()]] = prizeNameMap[Settings.normalizePrize(item)];
			}
		}
		if (!Object.keys(entranceMap).length && !Object.keys(prizeMap).length) {
			return null;
		}
		return { entranceMap, prizeMap, format: 'Door Randomizer' };
	}

	// "Crystal4:1", "Crystal 4", "PendantOfPower:1", "Blue Pendant" -> the names prizeNameMap knows
	static normalizePrize(value) {
		const plain = String(value).replace(/:\d+$/, '').trim();
		const pendants = { PendantOfCourage: 'Green Pendant', PendantOfWisdom: 'Red Pendant', PendantOfPower: 'Blue Pendant' };
		if (pendants[plain]) {
			return pendants[plain];
		}
		const crystal = /^Crystal\s*(\d)$/.exec(plain);
		return crystal ? 'Crystal ' + crystal[1] : plain;
	}

	// the settings a co-op host shares: the spoiler and the visit-marks mode;
	// nothing else on the screen is touched
	loadShared(values) {
		if (!values) {
			return;
		}
		$('#enable-visit-marks').prop('checked', !!values.visitMarks);
		if (typeof values.spoilerText === 'string' && $('#spoiler').val() !== values.spoilerText) {
			$('#spoiler').val(values.spoilerText).trigger('change');
		}
	}

	save() {
		const values = JSON.parse(JSON.stringify(this.getSettings()));
		delete values.spoiler;
		values.spoilerText = $('#spoiler').val() || '';
		return values;
	}

	load(config) {
		Object.assign(this.#settings, config);
		$('#enable-one-map').prop('checked', !!this.#settings.oneMap);
		$('#enable-drop-down').prop('checked', !!this.#settings.dropDown);
		$('#enable-multi').prop('checked', !!this.#settings.multi);
		$('#enable-single').prop('checked', !!this.#settings.single);
		$('#enable-visible').prop('checked', !!this.#settings.visible);
		$('#enable-overworld').prop('checked', !!this.#settings.overworld);
		$('#enable-connectors').prop('checked', !!this.#settings.connectors);
		$('#enable-checks').prop('checked', !!this.#settings.checks);
		$('#enable-maps').prop('checked', !!this.#settings.useMaps);
		$('#enable-og-sephs').prop('checked', !!this.#settings.ogSephs);
		$('#enable-auto-tracking').prop('checked', !!this.#settings.autoTracking);
		$('#auto-tracking-port').val(this.#settings.autoTrackingPort);
		$('#enable-visit-marks').prop('checked', !!this.#settings.visitMarks);
		if (typeof config.spoilerText === 'string') {
			$('#spoiler').val(config.spoilerText).trigger('change');
		}
	}
}