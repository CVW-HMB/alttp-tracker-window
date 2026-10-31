'use strict';

class Config {
	#configurable = null;
	#backup = null;
	#resumed = false;
	#pending = null;
	#lastOpened = null;
	#definition = null;      // the last map definition opened (has entranceMap)
	#defaultsSavedAt = null;
	#openListeners = [];
	#ending = false;
	#watching = false;       // backup watchers set up by the first OK Dude
	#toastTimer = null;

	constructor(configurable) {
		this.#configurable = configurable;

		$('.save').on('click', () => {
			this.download();
		});
		$('#update-defaults').on('click', () => this.updateDefaults());
		$('body').on('change', '#config-file', e => {
			if (e.target.files[0]) {
				this.loadConfig(e.target.files[0]);
			}
		});
		$('body').on('click', '#load-button', e => {
			$('#options').css('display', 'none');
			$('#tracker').css('display', 'block');
			$('#end-race, #menu-wrap').removeClass('coop-hidden');
		});
		$('#end-race-button').on('click', () => $('#end-race-overlay').removeClass('coop-hidden'));
		$('#end-race-no, #end-race-overlay .coop-backdrop').on('click', () => $('#end-race-overlay').addClass('coop-hidden'));
		$('#end-race-yes').on('click', () => this.endRace());
		$('#previous-button').on('click', () => this.bringBackPrevious());
		$('#load-button').on('click', () => {
			// OK Dude can be pressed again (co-op presses it for a joiner); the
			// previous-race slot and the watchers below are set up once
			if (this.#watching) {
				return;
			}
			this.#watching = true;
			if (!this.#resumed) {
				Persist.keepPrevious();
			}
			sessionStorage.setItem(Persist.OPEN_FLAG, '1');
			setTimeout(() => this.backup(), 0);
			// every change on the tracker page is a DOM change: an icon added or
			// removed, a class toggled, a panel moved, resized or zoomed
			new MutationObserver(() => this.scheduleBackup()).observe($('#tracker')[0], { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'], characterData: true });
			setInterval(() => this.backup(), 60000);
			$(window).on('pagehide', () => this.backup());
		});
		$('#resume-button').on('click', () => this.resume());

		const previous = Persist.previous();
		if (previous) {
			$('#previous-ended-at').text(new Date(previous.savedAt).toLocaleString());
			$('#previous').removeClass('coop-hidden');
		}

		// the stored defaults (or the built-in ones on first start) are loaded
		// straight away, so no config file is needed; a saved session on top
		Persist.loadDefaults().then(defaults => {
			if (defaults) {
				this.#defaultsSavedAt = defaults.savedAt;
				this.open(defaults.data);
			} else if (typeof DEFAULT_CONFIG !== 'undefined') {
				this.open(DEFAULT_CONFIG);
				Persist.saveDefaults(DEFAULT_CONFIG);
			}
			this.#refreshConfigSummary();
			return Persist.load();
		}).then(backup => {
			if (!backup) {
				return;
			}
			this.#backup = backup;
			if (sessionStorage.getItem(Persist.OPEN_FLAG)) {
				// same tab as before (refresh, or the browser restored the tab)
				this.resume();
			} else {
				$('#resume-saved-at').text(new Date(backup.savedAt).toLocaleString());
				$('#resume').removeClass('coop-hidden');
			}
		});


	}

	loadConfig(file) {
		if (!file) {
			return;
		}

		const fileReader = new FileReader();
		fileReader.onload = e => {
			const text = e.target.result;
			try {
				const json = JSON.parse(text);
				this.open(json);
			} catch (e) {
				console.error('invalid config');
			}
		};

		fileReader.readAsText(file, "UTF-8");
	}

	// map definition + settings + layout: what Update defaults stores and
	// Export settings downloads (the same shape a config file has)
	exportDocument() {
		const definition = this.#definition || (typeof DEFAULT_CONFIG !== 'undefined' ? DEFAULT_CONFIG : {});
		const settings = this.#configurable.settings ? this.#configurable.settings.save() : {};
		delete settings.spoiler;
		delete settings.spoilerText;
		return {
			'light-world': definition['light-world'] || [],
			'dark-world': definition['dark-world'] || [],
			entranceMap: definition.entranceMap || {},
			settings,
			mover: this.#configurable.mover ? this.#configurable.mover.save() : {},
			resizer: this.#configurable.resizer ? this.#configurable.resizer.save() : {},
			zoomer: this.#configurable.zoomer ? this.#configurable.zoomer.save() : {},
		};
	}

	download() {
		this.#startDownload(JSON.stringify(this.exportDocument(), null, 1));
	}

	updateDefaults() {
		const document = this.exportDocument();
		Persist.saveDefaults(document).then(() => {
			this.#defaultsSavedAt = Date.now();
			this.#refreshConfigSummary();
			this.#toast('Defaults updated: this layout and these settings are used from now on.');
		});
	}

	definition() {
		return this.#definition || this.#lastOpened;
	}

	#refreshConfigSummary() {
		const when = this.#defaultsSavedAt ? 'Defaults from ' + new Date(this.#defaultsSavedAt).toLocaleString() : 'Built-in defaults';
		$('#config-summary').text(when + ' are loaded. Importing a file is optional; press Update defaults during play to keep a layout.');
	}

	#toast(text) {
		const toast = $('#toast');
		toast.text(text).removeClass('coop-hidden');
		clearTimeout(this.#toastTimer);
		this.#toastTimer = setTimeout(() => toast.addClass('coop-hidden'), 2500);
	}

	scheduleBackup() {
		clearTimeout(this.#pending);
		this.#pending = setTimeout(() => this.backup(), 200);
	}

	backup() {
		clearTimeout(this.#pending);
		if (this.#ending) {
			return;
		}
		const exportConfig = {};

		for (const toExport of Object.keys(this.#configurable)) {
			exportConfig[toExport] = this.#configurable[toExport].save();
		}

		Persist.save(exportConfig);
	}

	// clear the board and go back to the settings screen; the ended race is
	// kept one step back so it can be brought back from there
	endRace() {
		this.#ending = true;
		clearTimeout(this.#pending);
		$('#end-race-overlay').addClass('coop-hidden');
		Persist.endSession().then(() => location.reload());
	}

	bringBackPrevious() {
		const previous = Persist.previous();
		if (!previous) {
			return;
		}
		this.#resumed = true;
		this.open(previous.data);
		$('#load-button').click();
	}

	resume() {
		if (!this.#backup) {
			return;
		}
		try {
			this.#resumed = true;
			this.open(this.#backup.data);
			$('#load-button').click();
		} catch (e) {
			console.error('error loading the saved session', e);
		}
	}

	#startDownload(text) {
		const el = document.createElement('a');
		el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		el.setAttribute('download', 'z3rTracker-settings.json');
		el.style.display = 'none';

		document.body.appendChild(el);
		el.click();
		document.body.removeChild(el);
	}

	open(config) {
		this.#lastOpened = config;
		if (config && config.entranceMap) {
			this.#definition = config;
		}
		for (const key of Object.keys(config)) {
			if (this.#configurable[key]) {
				this.#configurable[key].load(config[key], config);
			}
		}
		for (const listener of this.#openListeners) {
			listener(config);
		}
	}

	lastOpened() {
		return this.#lastOpened;
	}

	onOpen(listener) {
		this.#openListeners.push(listener);
	}
}