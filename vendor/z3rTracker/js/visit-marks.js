'use strict';

// Visit marks: a translucent orange box drawn over the visible part of a placed
// icon: the glyphs of a text icon (including their black outline) or the drawn
// image of an image icon. The box is measured at runtime, so it follows the
// font and images the browser actually renders and stays aligned under zoom.
class VisitMarks {
	static #images = new Map();
	static #canvas = null;

	static attach(icon) {
		if (icon.querySelector(':scope > .visit-mark')) {
			return;
		}
		const mark = document.createElement('div');
		mark.className = 'visit-mark';
		icon.appendChild(mark);

		const apply = box => {
			mark.style.left = box.left.toFixed(2) + 'px';
			mark.style.top = box.top.toFixed(2) + 'px';
			mark.style.width = box.width.toFixed(2) + 'px';
			mark.style.height = box.height.toFixed(2) + 'px';
		};
		const place = () => {
			if (!icon.isConnected || icon.offsetWidth === 0) {
				return false;
			}
			const box = VisitMarks.#measure(icon);
			apply(box);
			if (box.pending) {
				box.pending.then(() => {
					if (icon.isConnected && icon.offsetWidth > 0) {
						apply(VisitMarks.#measure(icon));
					}
				});
			}
			return true;
		};
		if (!place()) {
			// the map is hidden right now (one map mode); measure once it is shown
			const observer = new ResizeObserver(() => {
				if (place()) {
					observer.disconnect();
				}
			});
			observer.observe(icon);
		}
	}

	// box of the visible content in icon coordinates (unzoomed css px)
	static #measure(icon) {
		const iconRect = icon.getBoundingClientRect();
		const zoom = iconRect.width / icon.offsetWidth || 1;
		const text = icon.querySelector(':scope > .icon-text');
		const image = icon.querySelector(':scope > .icon-image');
		let box = null;
		let pending = null;
		if (text) {
			box = VisitMarks.#textInk(text, zoom);
		} else if (image) {
			({ box, pending } = VisitMarks.#imageBox(image, zoom));
		}
		if (!box) {
			box = iconRect;
		}
		return {
			left: (box.left - iconRect.left) / zoom,
			top: (box.top - iconRect.top) / zoom,
			width: box.width / zoom,
			height: box.height / zoom,
			pending,
		};
	}

	// ink box of the text glyphs plus their text-shadow outline, in page px
	static #textInk(text, zoom) {
		const nodes = [...text.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
		if (!nodes.length) {
			return null;
		}
		const range = document.createRange();
		range.setStart(nodes[0], 0);
		range.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length);
		const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
		if (!rects.length) {
			return null;
		}
		const left = Math.min(...rects.map(r => r.left));
		const top = Math.min(...rects.map(r => r.top));
		const style = getComputedStyle(text);
		const ctx = VisitMarks.#context();
		ctx.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
		const metrics = ctx.measureText(nodes.map(n => n.textContent).join('').replace(/\s+/g, ' ').trim());
		const baseline = top + metrics.fontBoundingBoxAscent * zoom;
		const spread = VisitMarks.#shadowSpread(style.textShadow) * zoom;
		return {
			left: left - metrics.actualBoundingBoxLeft * zoom - spread,
			top: baseline - metrics.actualBoundingBoxAscent * zoom - spread,
			width: (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * zoom + 2 * spread,
			height: (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * zoom + 2 * spread,
		};
	}

	// box of the drawn background image (background-size contain, centred), or
	// the whole element when it draws its own frame (border or background colour)
	static #imageBox(image, zoom) {
		const rect = image.getBoundingClientRect();
		const style = getComputedStyle(image);
		const framed = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0 || !/rgba\(.*, 0\)$/.test(style.backgroundColor) && style.backgroundColor !== 'transparent';
		const url = /url\("?(.*?)"?\)/.exec(style.backgroundImage);
		if (framed || !url || style.backgroundSize !== 'contain') {
			return { box: rect, pending: null };
		}
		const entry = VisitMarks.#image(url[1]);
		if (!entry.img.complete || !entry.img.naturalWidth) {
			return { box: rect, pending: entry.promise };
		}
		const boxWidth = image.clientWidth;
		const boxHeight = image.clientHeight;
		const scale = Math.min(boxWidth / entry.img.naturalWidth, boxHeight / entry.img.naturalHeight);
		const width = entry.img.naturalWidth * scale;
		const height = entry.img.naturalHeight * scale;
		// drawn pixels of the image, when it has transparent margins (see js/icon-bounds.js)
		const file = decodeURIComponent(url[1].split('/').pop());
		const drawn = typeof IconBounds !== 'undefined' && IconBounds[file] ? IconBounds[file] : [0, 0, entry.img.naturalWidth, entry.img.naturalHeight];
		return {
			box: {
				left: rect.left + (image.clientLeft + (boxWidth - width) / 2 + drawn[0] * scale) * zoom,
				top: rect.top + (image.clientTop + (boxHeight - height) / 2 + drawn[1] * scale) * zoom,
				width: drawn[2] * scale * zoom,
				height: drawn[3] * scale * zoom,
			},
			pending: null,
		};
	}

	static #image(url) {
		let entry = VisitMarks.#images.get(url);
		if (!entry) {
			const img = new Image();
			entry = { img, promise: new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }) };
			img.src = url;
			VisitMarks.#images.set(url, entry);
		}
		return entry;
	}

	// how far the text-shadow outline reaches beyond the glyphs
	static #shadowSpread(textShadow) {
		let spread = 0;
		for (const shadow of textShadow.split(/,(?![^(]*\))/)) {
			const px = shadow.match(/-?[\d.]+px/g);
			if (!px) {
				continue;
			}
			const [x, y, blur] = px.map(parseFloat);
			spread = Math.max(spread, Math.abs(x || 0) + (blur || 0), Math.abs(y || 0) + (blur || 0));
		}
		return spread;
	}

	static #context() {
		if (!VisitMarks.#canvas) {
			VisitMarks.#canvas = document.createElement('canvas');
		}
		return VisitMarks.#canvas.getContext('2d');
	}
}
