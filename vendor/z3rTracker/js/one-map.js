'use strict';

class OneMap {

	#settings = null;
	#enabled = false;
	#isLightWorld = true;

	constructor(settings) {
		this.#settings = settings;
		$('#load-button').on('click', () => this.onLoad());
		// bound once: OK Dude can be pressed again (co-op presses it for a joiner)
		$(document).on('keydown', (e) => this.onKeyDown(e));
		$('.swap-map').on('click', (e) => this.swap(e));
	}

	onLoad() {
		const settings = this.#settings.getSettings();
		this.#enabled = !!settings.oneMap;
		if (!this.#enabled) {
			$('#one-map').css('display', 'none');
			return;
		}

		this.#isLightWorld = true;
		$('#dark-world').css('display', 'none').appendTo('#one-map');
		$('#light-world').css('display', 'block').appendTo('#one-map');
		$('#light-world-container').css('display', 'none');
		$('#dark-world-container').css('display', 'none');
	}

	onKeyDown(e) {
		if (!this.#enabled || (e.keyCode !== 9 && e.keyCode !== 8)) {
			return;
		}
		// Tab and Backspace keep their meaning while typing in a text box
		const target = e.target;
		if (target && target.matches && (target.matches('input, textarea, select') || target.isContentEditable)) {
			return;
		}
		this.swap(e);
	}

	swap(e) {
		if (!this.#enabled) {
			return;
		}
		const lw = this.#isLightWorld = !this.#isLightWorld;
		$('#dark-world').css('display', lw ? 'none' : 'block');
		$('#light-world').css('display', lw ? 'block' : 'none');
		e.preventDefault();
		e.stopPropagation();
	}
}
