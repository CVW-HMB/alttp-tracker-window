'use strict';

// Styled hover tooltips for elements with a data-tip attribute (and an optional
// data-tip-title). Shown below the element, kept inside the window, with a
// short delay so passing the mouse over a button does not flash it.
class Tooltip {
	#el = null;
	#timer = null;

	constructor() {
		this.#el = document.createElement('div');
		this.#el.className = 'tip coop-hidden';
		this.#el.innerHTML = '<div class="tip-title"></div><div class="tip-body"></div>';
		document.body.appendChild(this.#el);
		$('body').on('mouseenter', '[data-tip]', e => this.#show(e.currentTarget));
		$('body').on('mouseleave', '[data-tip]', () => this.#hide());
		$('body').on('mousedown', '[data-tip]', () => this.#hide());
	}

	#show(target) {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			$(this.#el).find('.tip-title').text(target.getAttribute('data-tip-title') || '');
			$(this.#el).find('.tip-body').text(target.getAttribute('data-tip') || '');
			this.#el.classList.remove('coop-hidden');
			const rect = target.getBoundingClientRect();
			const width = this.#el.offsetWidth;
			const height = this.#el.offsetHeight;
			let left;
			let top;
			if (rect.left - width - 12 >= 8) {
				// beside the element, to its left, so nothing under it is covered
				this.#el.classList.add('tip-left');
				left = rect.left - width - 12;
				top = Math.max(8, Math.min(rect.top + rect.height / 2 - 18, window.innerHeight - height - 8));
				this.#el.style.setProperty('--tip-arrow-top', (rect.top + rect.height / 2 - top - 6) + 'px');
			} else {
				// under the element, right-aligned, flipped above it when there is no room
				this.#el.classList.remove('tip-left');
				left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
				top = rect.bottom + 8;
				if (top + height > window.innerHeight - 8) {
					top = rect.top - height - 8;
				}
				this.#el.style.setProperty('--tip-arrow-left', Math.max(12, Math.min(width - 24, rect.left + rect.width / 2 - left - 6)) + 'px');
			}
			this.#el.style.left = left + 'px';
			this.#el.style.top = top + 'px';
		}, 150);
	}

	#hide() {
		clearTimeout(this.#timer);
		this.#el.classList.add('coop-hidden');
	}
}
