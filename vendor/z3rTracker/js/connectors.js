'use strict';

// Connector lines: with both maps shown and a spoiler loaded, every connector
// cave in the Connectors box has its overworld sides placed on the maps as a
// set of matched icons. This joins the sides of each connector with coloured
// lines (all sides of a cave connected, so a two-way cave is one line and a
// multi-entrance cave a small mesh in one colour), so you can see at a glance
// which entrances are the same cave. The set of connectors is exactly the
// icons the Connectors box uses: placed icons carrying data-connector="true".
// The colour is the marker's text colour, or a distinct default for an image
// marker.
//
// Two ways to show them: the Menu button toggles all connectors at once, and
// hovering a single connector in the Connectors box previews just that one
// cave's lines (whether or not the toggle is on).

// distinct defaults for connectors whose marker has no text colour of its own
const CONNECTOR_COLORS = {
	hs: '#00e5ff',
	rescue: '#ff4d4d',
	'old-man': '#c8823c',
	woman: '#c14fe0',
	brothers: '#3d6bff',
	bumper: '#00c853',
	spiral: '#ff5ea8',
	sb: '#a6e000',
	paradox: '#ffab00',
};

class ConnectorLines {
	#svg = null;
	#enabled = false;
	#available = false;
	#observer = null;
	#raf = null;
	#hoverBase = null;
	#hoverKey = null;
	#hoverTimer = null;

	constructor() {
		this.#svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.#svg.setAttribute('id', 'connector-overlay');
		this.#svg.classList.add('coop-hidden');
		document.body.appendChild(this.#svg);
		$('#connector-lines').on('click', () => this.toggle());
		window.addEventListener('resize', () => this.#schedule());
		// always watch the maps so lines follow zoom, drags and icon changes;
		// #render decides whether anything is actually drawn
		this.#observer = new MutationObserver(() => this.#schedule());
		this.#observer.observe($('#tracker')[0], { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
		// hovering a connector in the Connectors box previews just that cave
		$('#connectors').on('mouseenter', '.icon[data-key]', e => this.#hoverConnector(e.currentTarget));
		$('#connectors').on('mouseleave', '.icon[data-key]', () => this.#scheduleUnhover());
	}

	// both maps must be on screen (not one-map mode) for cross-map lines to work
	refreshAvailability() {
		const both = ['light-world-container', 'dark-world-container'].every(id => {
			const el = document.getElementById(id);
			return el && getComputedStyle(el).display !== 'none';
		});
		this.#available = both;
		if (!both) {
			this.#clearHover();
			this.disable();
		}
		this.#renderButton();
	}

	toggle() {
		if (!this.#available) {
			return;
		}
		if (this.#enabled) {
			this.disable();
		} else {
			this.enable();
		}
	}

	enable() {
		if (!this.#available) {
			return;
		}
		this.#enabled = true;
		this.#renderButton();
		this.#schedule();
	}

	disable() {
		this.#enabled = false;
		this.#renderButton();
		this.#schedule();
	}

	#hoverConnector(el) {
		if (!this.#available) {
			return;
		}
		clearTimeout(this.#hoverTimer);
		this.#hoverKey = String($(el).data('key'));
		this.#hoverBase = this.#hoverKey.replace(/-(up|down|left|right|mid)$/, '');
		this.#schedule();
	}

	// a short delay absorbs the leave/enter pair when moving between box icons
	#scheduleUnhover() {
		clearTimeout(this.#hoverTimer);
		this.#hoverTimer = setTimeout(() => { this.#clearHover(); }, 60);
	}

	#clearHover() {
		this.#hoverKey = null;
		this.#hoverBase = null;
		this.#schedule();
	}

	#renderButton() {
		const button = $('#connector-lines');
		button.prop('disabled', !this.#available);
		button.toggleClass('toolbar-on', this.#enabled && this.#available);
		button.text(!this.#available ? 'Connector lines: needs both maps' : this.#enabled ? 'Connector lines: on' : 'Connector lines: off');
	}

	#schedule() {
		cancelAnimationFrame(this.#raf);
		this.#raf = requestAnimationFrame(() => this.#render());
	}

	#clear() {
		while (this.#svg.firstChild) {
			this.#svg.removeChild(this.#svg.firstChild);
		}
	}

	// placed connector icons (those the Connectors box uses: data-connector="true")
	// grouped by the cave they belong to (the icon key without its direction suffix)
	#groups() {
		const groups = {};
		for (const el of $('.map-tracker > .icon.placed[data-connector="true"]')) {
			const key = String($(el).data('key'));
			const base = key.replace(/-(up|down|left|right|mid)$/, '');
			(groups[base] = groups[base] || []).push(el);
		}
		return groups;
	}

	#color(base, members) {
		for (const el of members) {
			const text = el.querySelector(':scope > .icon-text');
			if (text && /-color(\s|$)/.test(text.className)) {
				return getComputedStyle(text).color;
			}
		}
		return CONNECTOR_COLORS[base] || '#ffffff';
	}

	#center(el) {
		const rect = el.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}

	#render() {
		// nothing to show: the toggle is off and nothing is hovered
		if (!this.#enabled && !this.#hoverBase) {
			if (!this.#svg.classList.contains('coop-hidden')) {
				this.#svg.classList.add('coop-hidden');
				this.#clear();
			}
			return;
		}
		this.#svg.classList.remove('coop-hidden');
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.#svg.setAttribute('width', width);
		this.#svg.setAttribute('height', height);
		this.#svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		this.#clear();
		const groups = this.#groups();
		// hovering a connector isolates that one cave; otherwise every cave is drawn
		const bases = this.#hoverBase ? [this.#hoverBase] : Object.keys(groups);
		const highlight = !!this.#hoverBase;
		const casing = highlight ? 7 : 5;
		const stroke = highlight ? 3.5 : 2.5;
		const radius = highlight ? 5 : 3.5;
		for (const base of bases) {
			const members = groups[base];
			if (!members || members.length < 2) {
				continue;
			}
			const centers = members.map(el => this.#center(el));
			const color = this.#color(base, members);
			// join every side of the cave to every other; all one colour
			for (let i = 0; i < centers.length; i++) {
				for (let j = i + 1; j < centers.length; j++) {
					this.#svg.appendChild(this.#line(centers[i], centers[j], 'rgba(0,0,0,.65)', casing));
					const line = this.#line(centers[i], centers[j], color, stroke);
					line.dataset.base = base;
					this.#svg.appendChild(line);
				}
			}
			for (const p of centers) {
				this.#svg.appendChild(this.#dot(p, color, radius));
			}
		}
		// the exact side being hovered in the Connectors box: a green ring around
		// its placed icon on the map, so you can see where that entrance is
		if (this.#hoverKey) {
			for (const el of $('.map-tracker > .icon.placed[data-connector="true"]')) {
				if (String($(el).data('key')) !== this.#hoverKey) {
					continue;
				}
				this.#svg.appendChild(this.#ring(this.#center(el)));
			}
		}
	}

	#ring(p) {
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.dataset.hoverRing = '1';
		const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		glow.setAttribute('cx', p.x.toFixed(1)); glow.setAttribute('cy', p.y.toFixed(1)); glow.setAttribute('r', 18);
		glow.setAttribute('fill', 'none'); glow.setAttribute('stroke', 'rgba(46,195,106,.45)'); glow.setAttribute('stroke-width', 7);
		const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		ring.setAttribute('cx', p.x.toFixed(1)); ring.setAttribute('cy', p.y.toFixed(1)); ring.setAttribute('r', 13);
		ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#2ec36a'); ring.setAttribute('stroke-width', 3);
		g.appendChild(glow); g.appendChild(ring);
		return g;
	}

	#line(a, b, stroke, strokeWidth) {
		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', a.x.toFixed(1));
		line.setAttribute('y1', a.y.toFixed(1));
		line.setAttribute('x2', b.x.toFixed(1));
		line.setAttribute('y2', b.y.toFixed(1));
		line.setAttribute('stroke', stroke);
		line.setAttribute('stroke-width', strokeWidth);
		line.setAttribute('stroke-linecap', 'round');
		return line;
	}

	#dot(p, color, radius = 3.5) {
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.setAttribute('cx', p.x.toFixed(1));
		dot.setAttribute('cy', p.y.toFixed(1));
		dot.setAttribute('r', radius);
		dot.setAttribute('fill', color);
		dot.setAttribute('stroke', 'rgba(0,0,0,.65)');
		dot.setAttribute('stroke-width', 1);
		return dot;
	}

	// hooks for the test harness
	debugHoverBase() { return this.#hoverBase; }
	debugLines() {
		return JSON.stringify([...this.#svg.querySelectorAll('line[data-base]')].map(l => ({
			base: l.dataset.base,
			color: l.getAttribute('stroke'),
			x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2'),
		})));
	}
}
