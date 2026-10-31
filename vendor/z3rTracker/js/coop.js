'use strict';

// Co-op for two players over a WebRTC data channel, with no server.
//
// The player who creates the invite is the HOST. The host's config, settings
// and spoiler are pushed to the JOINER, whose settings screen is locked to
// them, and the host pressing OK Dude starts the joiner's board as well. The
// host's board is the master copy: every 500 ms the whole board is sent to the
// joiner. The joiner's own clicks are sent to the host as requests, applied
// there exactly like the host's own clicks, and come back in the next
// snapshot. One source of truth, no merge rules.
//
// Signalling is manual: the invite and reply codes are pasted in chat. Public
// STUN servers (Google, Cloudflare) supply each side's public address so the
// direct link works across the internet on most home networks.

const COOP_ICE = [
	{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
	{ urls: 'stun:stun.cloudflare.com:3478' },
];
const COOP_TICK_MS = 500;     // host -> joiner snapshot period
const COOP_STALL_MS = 3000;   // joiner: no snapshot for this long means something is wrong
const COOP_CHUNK = 24000;     // larger messages are split (a single message is capped by the browser)
const COOP_MAX_CHUNKS = 4096; // more parts than this is not a message of ours

class Coop {
	#configurable;
	#config;
	#settings;
	#role = null;             // 'host' | 'client'
	#pc = null;
	#channel = null;
	#linkStarted = false;     // an invite or reply exists
	#linkUp = false;          // data channel open
	#everLinked = false;
	#stalled = false;         // both codes exchanged but no link after a while
	#stallTimer = null;
	#loaded = false;          // this side's board is loaded (OK Dude)
	// host side
	#tick = null;
	#tickEnabled = true;
	#snapshotSeq = 0;
	#lastIntentSeq = 0;
	// joiner side
	#hostSetup = null;        // last setup / start message from the host
	#clientStarted = false;   // board loaded from the host's start
	#known = new Map();       // cells as of the last applied snapshot or sent request
	#pendingSeq = 0;          // last request seq sent
	#lastSnapshotAt = 0;
	#noUpdates = false;
	#applying = false;
	#localTimer = null;
	#chunks = new Map();
	#savedRole = null;        // role restored from the durable backup (last session)
	#onStatus = () => {};

	constructor(configurable, config, settings) {
		this.#configurable = configurable;
		this.#config = config;
		this.#settings = settings;
		new MutationObserver(() => this.#scheduleLocal()).observe($('#tracker')[0], { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'], characterData: true });
		// host: the joiner's locked screen mirrors every choice the host makes
		$('#options').on('change input', 'input, textarea', () => this.#sendSetup());
		config.onOpen(() => this.#sendSetup());
		setInterval(() => this.#heartbeat(), COOP_TICK_MS);
	}

	get role() { return this.#role; }
	onStatus(fn) { this.#onStatus = fn; this.#emit(); }

	#emit() {
		this.#onStatus({
			role: this.#role,
			loaded: this.#loaded,
			linkStarted: this.#linkStarted,
			linkUp: this.#linkUp,
			everLinked: this.#everLinked,
			stalled: this.#stalled,
			connection: this.#pc ? this.#pc.connectionState : 'new',
			ice: this.#pc ? this.#pc.iceConnectionState : 'none',
			savedRole: this.#savedRole,
			clientStarted: this.#clientStarted,
			hostHasStarted: !!(this.#hostSetup && this.#hostSetup.started),
			noUpdates: this.#noUpdates,
		});
	}

	// ------------------------------------------------------------- signalling
	#newPeer() {
		const pc = new RTCPeerConnection({ iceServers: COOP_ICE });
		pc.onconnectionstatechange = () => this.#emit();
		pc.oniceconnectionstatechange = () => this.#emit();
		pc.ondatachannel = e => this.#wire(e.channel);
		this.#pc = pc;
		return pc;
	}

	// wait for ICE gathering without hanging: done once a public (srflx)
	// candidate is in, or after a short cap
	#gathered() {
		return new Promise(resolve => {
			const pc = this.#pc;
			let done = false;
			const finish = () => { if (!done) { done = true; resolve(); } };
			if (pc.iceGatheringState === 'complete') {
				return finish();
			}
			pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') finish(); });
			pc.addEventListener('icecandidate', e => { if (e.candidate && / typ srflx /.test(e.candidate.candidate)) setTimeout(finish, 400); });
			setTimeout(finish, 3000);
		});
	}

	#wire(channel) {
		this.#channel = channel;
		channel.onopen = () => {
			this.#linkUp = true;
			this.#everLinked = true;
			this.#stalled = false;
			clearTimeout(this.#stallTimer);
			this.#onLinkOpen();
			this.#emit();
		};
		channel.onclose = () => { this.#linkUp = false; this.#emit(); };
		channel.onmessage = e => this.#onRaw(e.data);
	}

	#onLinkOpen() {
		if (this.#role === 'host') {
			if (this.#loaded) {
				this.#sendStart();
			} else {
				this.#sendSetup();
			}
			this.#startTick();
		} else {
			this.#lastSnapshotAt = Date.now();
		}
	}

	// the co-op role is saved with the board so the next session can offer to
	// pick the game back up; a link itself cannot survive a reload
	save() {
		return { role: this.#role };
	}

	load(data) {
		this.#savedRole = data && (data.role === 'host' || data.role === 'client') ? data.role : null;
		this.#emit();
	}

	async createInvite() {
		this.#closeLink();
		this.#role = 'host';
		this.#savedRole = null;
		this.#linkStarted = true;
		this.#config.scheduleBackup();
		this.#newPeer();
		this.#wire(this.#pc.createDataChannel('coop'));
		await this.#pc.setLocalDescription(await this.#pc.createOffer());
		await this.#gathered();
		this.#emit();
		return Coop.pack(this.#pc.localDescription);
	}

	async joinWithInvite(code) {
		const desc = Coop.unpack(code);
		this.#closeLink();
		this.#role = 'client';
		this.#savedRole = null;
		this.#linkStarted = true;
		this.#config.scheduleBackup();
		this.#newPeer();
		await this.#pc.setRemoteDescription(desc);
		await this.#pc.setLocalDescription(await this.#pc.createAnswer());
		await this.#gathered();
		this.#watchForStall();
		this.#emit();
		return Coop.pack(this.#pc.localDescription);
	}

	async acceptReply(code) {
		if (!this.#pc || this.#role !== 'host') {
			throw new Error('Create an invite first.');
		}
		await this.#pc.setRemoteDescription(Coop.unpack(code));
		this.#watchForStall();
	}

	#watchForStall() {
		clearTimeout(this.#stallTimer);
		this.#stalled = false;
		this.#stallTimer = setTimeout(() => {
			if (!this.#linkUp) {
				this.#stalled = true;
				this.#emit();
			}
		}, 25000);
	}

	// drop the link but keep the role, for a fresh code exchange
	reconnect() {
		this.#closeLink();
		this.#emit();
	}

	// leave co-op: a joiner keeps the board it has and plays on alone; a host
	// simply stops sending
	leave() {
		this.#closeLink();
		this.#role = null;
		this.#savedRole = null;
		this.#clientStarted = false;
		this.#hostSetup = null;
		this.#known = new Map();
		this.#config.scheduleBackup();
		this.#emit();
	}

	#closeLink() {
		try { if (this.#channel) this.#channel.close(); } catch (e) { /* already closed */ }
		try { if (this.#pc) this.#pc.close(); } catch (e) { /* already closed */ }
		this.#channel = null;
		this.#pc = null;
		this.#linkStarted = false;
		this.#linkUp = false;
		this.#everLinked = false;
		this.#stalled = false;
		this.#noUpdates = false;
		clearTimeout(this.#stallTimer);
		this.#pendingSeq = 0;
		this.#lastIntentSeq = 0;
		this.#chunks = new Map();
	}

	static pack(desc) {
		return 'z3rcoop:' + btoa(JSON.stringify({ t: desc.type, s: desc.sdp }));
	}

	static unpack(code) {
		const trimmed = (code || '').trim();
		if (!trimmed.startsWith('z3rcoop:')) {
			throw new Error('That does not look like a co-op code. Copy the whole thing, starting with "z3rcoop:".');
		}
		let parsed;
		try {
			parsed = JSON.parse(atob(trimmed.slice('z3rcoop:'.length)));
		} catch (e) {
			throw new Error('That code is incomplete or garbled. Copy it again and paste the whole thing.');
		}
		return { type: parsed.t, sdp: parsed.s };
	}

	// ------------------------------------------------------------------ host
	setLoaded() {
		this.#loaded = true;
		if (this.#role === 'host') {
			if (this.#linkUp) {
				this.#sendStart();
			}
			this.#startTick();
		}
		this.#emit();
	}

	// only what shapes the shared board: the spoiler and the visit-marks mode.
	// Layout, panels, icon set and auto-tracking are each player's own.
	#hostSettings() {
		const values = this.#settings.getSettings();
		return { visitMarks: values.visitMarks, spoilerText: $('#spoiler').val() || '' };
	}

	#sendSetup() {
		if (this.#role !== 'host' || !this.#linkUp) {
			return;
		}
		this.#send({ type: 'setup', started: this.#loaded, settings: this.#hostSettings() });
	}

	#sendStart() {
		this.#send({ type: 'start', settings: this.#hostSettings(), snapshot: this.#snapshotMessage() });
	}

	#snapshotMessage() {
		return { type: 'snapshot', seq: ++this.#snapshotSeq, ack: this.#lastIntentSeq, cells: Coop.toObject(this.#readCells()) };
	}

	#startTick() {
		if (this.#tick) {
			return;
		}
		this.#tick = setInterval(() => {
			if (this.#tickEnabled && this.#role === 'host' && this.#linkUp && this.#loaded) {
				this.#send(this.#snapshotMessage());
			}
		}, COOP_TICK_MS);
	}

	#onIntent(msg) {
		this.#applyCells(msg.cells);
		this.#lastIntentSeq = msg.seq;
	}

	// ---------------------------------------------------------------- joiner
	#mirrorSettings(values) {
		if (!values) {
			return;
		}
		this.#settings.loadShared(values);
	}

	#onSetup(msg) {
		this.#hostSetup = msg;
		this.#mirrorSettings(msg.settings);
		this.#emit();
	}

	// the joiner's own map definition, layout and panels stay as they are; the
	// host's board arrives in the snapshot cell by cell
	#onStart(msg) {
		const previous = this.#hostSetup ? this.#hostSetup.settings : null;
		this.#hostSetup = Object.assign({}, msg, { started: true });
		this.#mirrorSettings(msg.settings);
		// press OK Dude on the joiner's behalf; the button is locked for the user.
		// A host that comes back sends start again: a board that is already up
		// under the same shared settings is brought level by the snapshot below
		// instead of being rebuilt
		if (!this.#loaded || !Coop.sameShared(previous, msg.settings)) {
			const button = $('#load-button');
			button.prop('disabled', false);
			button[0].click();
		}
		this.#clientStarted = true;
		this.#pendingSeq = 0;
		this.#applySnapshot(msg.snapshot.cells);
		this.#lastSnapshotAt = Date.now();
		this.#noUpdates = false;
		this.#emit();
	}

	#onSnapshot(msg) {
		this.#lastSnapshotAt = Date.now();
		if (this.#noUpdates) {
			this.#noUpdates = false;
			this.#emit();
		}
		if (!this.#clientStarted) {
			return;
		}
		// send any click of ours first, and skip snapshots that do not include
		// it yet, so our own change never flickers away and back
		this.#flushLocal();
		if (this.#pendingSeq > msg.ack) {
			return;
		}
		this.#applySnapshot(msg.cells);
	}

	#scheduleLocal() {
		clearTimeout(this.#localTimer);
		this.#localTimer = setTimeout(() => this.#flushLocal(), 120);
	}

	#flushLocal() {
		clearTimeout(this.#localTimer);
		if (this.#role !== 'client' || !this.#clientStarted || this.#applying || !this.#linkUp) {
			return;
		}
		const current = this.#readCells();
		const changes = {};
		for (const [key, value] of current) {
			if (!Coop.equal(this.#known.get(key), value)) {
				changes[key] = value;
			}
		}
		for (const [key, value] of this.#known) {
			if ((key[0] === 'm' || key[0] === 'c') && value !== null && !current.has(key)) {
				changes[key] = null;
			}
		}
		if (!Object.keys(changes).length) {
			return;
		}
		for (const [key, value] of Object.entries(changes)) {
			this.#known.set(key, value);
		}
		this.#send({ type: 'intent', seq: ++this.#pendingSeq, cells: changes });
	}

	#heartbeat() {
		if (this.#role !== 'client' || !this.#clientStarted || !this.#linkUp) {
			return;
		}
		const stale = Date.now() - this.#lastSnapshotAt > COOP_STALL_MS;
		if (stale !== this.#noUpdates) {
			this.#noUpdates = stale;
			this.#emit();
		}
	}

	// ------------------------------------------------------------- cell model
	// map cell:   key "m:<mapId>:<x>,<y>"   value null | { k: iconKey, v: 0|1 }
	// text cell:  key "t:<panelId>/<label>"  value colour chosen by hand
	// check cell: key "c:<check name>"       value 1 while collected, absent otherwise
	// count cell: key "a:<column>"           value the by-hand adjustment of a Checks column
	#readCells() {
		const cells = new Map();
		for (const mapId of ['light-world', 'dark-world']) {
			const tracker = this.#configurable[mapId];
			if (!tracker || !tracker.placedCells) {
				continue;
			}
			for (const cell of tracker.placedCells()) {
				cells.set(`m:${mapId}:${cell.x},${cell.y}`, { k: cell.key, v: cell.visited });
			}
		}
		const text = this.#configurable.textTracker;
		if (text && text.allColors) {
			for (const [key, colour] of text.allColors()) {
				cells.set(`t:${key}`, colour);
			}
		}
		const checks = this.#configurable.checks;
		if (checks && checks.save) {
			const state = checks.save();
			for (const name of state.collected) {
				cells.set(`c:${name}`, 1);
			}
			for (const [column, value] of Object.entries(state.adjust)) {
				cells.set(`a:${column}`, value);
			}
		}
		return cells;
	}

	#applySnapshot(cells) {
		const board = this.#readCells();
		const changes = {};
		for (const [key, value] of Object.entries(cells)) {
			if (!Coop.equal(board.get(key), value)) {
				changes[key] = value;
			}
		}
		for (const key of board.keys()) {
			if ((key[0] === 'm' || key[0] === 'c') && !(key in cells)) {
				changes[key] = null;
			}
		}
		this.#applyCells(changes);
		this.#known = new Map(Object.entries(cells));
	}

	#applyCells(changes) {
		this.#applying = true;
		try {
			for (const [key, value] of Object.entries(changes)) {
				this.#applyCell(key, value);
			}
		} finally {
			this.#applying = false;
		}
	}

	#applyCell(key, value) {
		if (key[0] === 'm') {
			const rest = key.slice(2);
			const cut = rest.lastIndexOf(':');
			const mapId = rest.slice(0, cut);
			const [x, y] = rest.slice(cut + 1).split(',').map(Number);
			const tracker = this.#configurable[mapId];
			if (!tracker || !tracker.applyCell) {
				return;
			}
			if (value) {
				tracker.applyCell(x, y, value.k, value.v);
			} else {
				tracker.applyCell(x, y, null, 0);
			}
		} else if (key[0] === 't') {
			const text = this.#configurable.textTracker;
			if (text && text.setColor) {
				text.setColor(key.slice(2), value || 'blue');
			}
		} else if (key[0] === 'c') {
			const checks = this.#configurable.checks;
			if (checks && checks.collect) {
				checks.collect(key.slice(2), !!value);
			}
		} else if (key[0] === 'a') {
			const checks = this.#configurable.checks;
			if (checks && checks.setAdjustment) {
				checks.setAdjustment(key.slice(2), value || 0);
			}
		}
	}

	// ----------------------------------------------------------------- wire
	#send(msg) {
		if (!this.#channel || this.#channel.readyState !== 'open') {
			return;
		}
		const json = JSON.stringify(msg);
		if (json.length <= COOP_CHUNK) {
			this.#channel.send(json);
			return;
		}
		const id = Math.random().toString(36).slice(2);
		const n = Math.ceil(json.length / COOP_CHUNK);
		for (let i = 0; i < n; i++) {
			this.#channel.send(JSON.stringify({ type: 'chunk', id, i, n, part: json.slice(i * COOP_CHUNK, (i + 1) * COOP_CHUNK) }));
		}
	}

	#onRaw(data) {
		let msg;
		try {
			msg = JSON.parse(data);
		} catch (e) {
			return;
		}
		if (msg.type === 'chunk') {
			// a garbled chunk is dropped: its count and index size the parts array
			const n = msg.n;
			const i = msg.i;
			if (typeof msg.id !== 'string' || typeof msg.part !== 'string' || !Number.isInteger(n) || n < 1 || n > COOP_MAX_CHUNKS || !Number.isInteger(i) || i < 0 || i >= n) {
				return;
			}
			const entry = this.#chunks.get(msg.id) || { parts: new Array(n), got: 0 };
			if (entry.parts.length !== n) {
				return;
			}
			if (entry.parts[i] === undefined) {
				entry.parts[i] = msg.part;
				entry.got++;
			}
			this.#chunks.set(msg.id, entry);
			if (entry.got < n) {
				return;
			}
			this.#chunks.delete(msg.id);
			try {
				msg = JSON.parse(entry.parts.join(''));
			} catch (e) {
				return;
			}
		}
		this.#onMessage(msg);
	}

	#onMessage(msg) {
		if (this.#role === 'host') {
			if (msg.type === 'intent') {
				this.#onIntent(msg);
			}
		} else if (this.#role === 'client') {
			if (msg.type === 'setup') {
				this.#onSetup(msg);
			} else if (msg.type === 'start') {
				this.#onStart(msg);
			} else if (msg.type === 'snapshot') {
				this.#onSnapshot(msg);
			}
		}
	}

	static toObject(map) {
		const out = {};
		for (const [key, value] of map) {
			out[key] = value;
		}
		return out;
	}

	// the shared settings of two setup / start messages
	static sameShared(a, b) {
		return !!a && !!b && !!a.visitMarks === !!b.visitMarks && (a.spoilerText || '') === (b.spoilerText || '');
	}

	static equal(a, b) {
		if (a === b) {
			return true;
		}
		if (a == null || b == null) {
			return a == null && b == null;
		}
		if (typeof a === 'object' && typeof b === 'object') {
			return a.k === b.k && a.v === b.v;
		}
		return false;
	}

	// hooks for the test harness
	debugState() {
		return { role: this.#role, loaded: this.#loaded, linkStarted: this.#linkStarted, linkUp: this.#linkUp, ice: this.#pc ? this.#pc.iceConnectionState : 'none', channel: this.#channel ? this.#channel.readyState : 'none', clientStarted: this.#clientStarted, hostHasStarted: !!(this.#hostSetup && this.#hostSetup.started), pendingSeq: this.#pendingSeq, lastIntentSeq: this.#lastIntentSeq, snapshotSeq: this.#snapshotSeq, snapshotAgeMs: this.#lastSnapshotAt ? Date.now() - this.#lastSnapshotAt : null, noUpdates: this.#noUpdates };
	}
	debugCells() {
		return JSON.stringify(Object.entries(Coop.toObject(this.#readCells())).sort((a, b) => a[0].localeCompare(b[0])));
	}
	debugTick(enabled) {
		this.#tickEnabled = enabled;
	}
}

// The co-op dialog (opened from the settings screen or the live pill), the
// locked settings screen for a joiner, the "frozen" cover when a joiner loses
// the host, and the live status pill.
class CoopUI {
	#coop;
	#wasLinkStarted = false;
	#resumePrompted = false;
	#reinvited = false;

	constructor(coop) {
		this.#coop = coop;
		$('#coop-open, #coop-live').on('click', () => this.#open());
		$('#coop-close, #coop-done, #coop-overlay .coop-backdrop').on('click', () => this.#close());
		$('#coop-create').on('click', () => this.#startCreate());
		$('#coop-join').on('click', () => this.#startJoin());
		$('#coop-restart').on('click', () => this.#restart());
		$('#coop-copy-offer').on('click', () => this.#copy('#coop-offer', '#coop-copy-offer'));
		$('#coop-copy-answer').on('click', () => this.#copy('#coop-answer', '#coop-copy-answer'));
		$('#coop-make-reply').on('click', () => this.#makeReply());
		$('#coop-connect').on('click', () => this.#connect());
		$('#coop-reconnect').on('click', () => this.#reconnect());
		$('#coop-leave').on('click', () => this.#restart());
		coop.onStatus(status => this.#render(status));
		this.#toRoles();
	}

	#open() { $('#coop-overlay').removeClass('coop-hidden'); $('#menu-panel').addClass('coop-hidden'); }
	#close() { $('#coop-overlay').addClass('coop-hidden'); }

	#toRoles() {
		$('.coop-flow').addClass('coop-hidden');
		$('#coop-roles').removeClass('coop-hidden');
		$('#coop-error').text('');
		$('#coop-resume-note').addClass('coop-hidden');
		$('#coop-offer, #coop-answer, #coop-offer-in, #coop-answer-in').val('');
		$('#coop-reply-step, #coop-answer, #coop-copy-answer, #coop-wait').addClass('coop-hidden');
		$('#coop-make-reply, #coop-connect').prop('disabled', false);
	}

	// leave co-op entirely: back to a normal solo screen
	#restart() {
		this.#coop.leave();
		this.#unlock();
		this.#toRoles();
		$('#coop-blocker').addClass('coop-hidden');
	}

	// joiner lost the host: new code exchange, same role
	#reconnect() {
		this.#coop.reconnect();
		this.#toRoles();
		this.#open();
		this.#startJoin();
	}

	async #startCreate() {
		$('#coop-roles').addClass('coop-hidden');
		$('#coop-create-flow').removeClass('coop-hidden');
		$('#coop-error').text('');
		$('#coop-answer-in').val('');
		$('#coop-connect').prop('disabled', false);
		$('#coop-offer').val('generating…');
		try {
			$('#coop-offer').val(await this.#coop.createInvite());
		} catch (e) {
			this.#error(e);
		}
	}

	#startJoin() {
		$('#coop-roles').addClass('coop-hidden');
		$('#coop-join-flow').removeClass('coop-hidden');
	}

	async #makeReply() {
		const code = $('#coop-offer-in').val().trim();
		if (!code) {
			return this.#error(new Error('Paste the host’s invite code first.'));
		}
		$('#coop-error').text('');
		$('#coop-make-reply').prop('disabled', true);
		try {
			const answer = await this.#coop.joinWithInvite(code);
			$('#coop-answer').val(answer);
			$('#coop-reply-step, #coop-answer, #coop-copy-answer, #coop-wait').removeClass('coop-hidden');
			this.#lock();
		} catch (e) {
			this.#error(e);
			$('#coop-make-reply').prop('disabled', false);
		}
	}

	async #connect() {
		const code = $('#coop-answer-in').val().trim();
		if (!code) {
			return this.#error(new Error('Paste your partner’s reply code first.'));
		}
		$('#coop-error').text('');
		$('#coop-connect').prop('disabled', true);
		try {
			await this.#coop.acceptReply(code);
		} catch (e) {
			this.#error(e);
			$('#coop-connect').prop('disabled', false);
		}
	}

	// joiner: the spoiler and the visit-marks mode come from the host, and the
	// host starts the game; everything else on the screen stays the joiner's own
	#lock() {
		$('#enable-visit-marks, #spoiler-open, #load-button').prop('disabled', true);
		$('#load-button').text('The host starts the game');
		$('#coop-lock-banner').removeClass('coop-hidden');
	}

	#unlock() {
		$('#enable-visit-marks, #spoiler-open, #load-button').prop('disabled', false);
		$('#load-button').text('OK Dude');
		$('#coop-lock-banner').addClass('coop-hidden');
	}

	async #copy(source, button) {
		const text = $(source).val();
		const original = $(button).text();
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch (e) {
			const el = $(source)[0];
			el.focus();
			el.select();
			try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
		}
		$(button).text(ok ? 'Copied!' : 'Select it and press Ctrl+C');
		setTimeout(() => $(button).text(original), 1600);
	}

	#error(e) {
		$('#coop-error').text(e && e.message ? e.message : String(e));
	}

	#render(s) {
		let text = 'not connected';
		let cls = '';
		const hiccup = s.linkUp && s.ice === 'disconnected';
		if (s.role === 'host') {
			if (hiccup) { text = 'connection hiccup, retrying…'; cls = 'warn'; }
			else if (s.linkUp) { text = 'partner connected'; cls = 'good'; }
			else if (s.everLinked) { text = 'partner disconnected'; cls = 'bad'; }
			else if (s.linkStarted) { text = 'connecting…'; cls = 'warn'; }
		} else if (s.role === 'client') {
			if (hiccup || (s.linkUp && s.clientStarted && s.noUpdates)) { text = 'reconnecting… (no updates from host)'; cls = 'warn'; }
			else if (s.linkUp && s.clientStarted) { text = 'synced with host'; cls = 'good'; }
			else if (s.linkUp) { text = 'connected, waiting for the host to start'; cls = 'good'; }
			else if (s.everLinked) { text = 'disconnected from host'; cls = 'bad'; }
			else if (s.linkStarted) { text = 'connecting…'; cls = 'warn'; }
		} else if (s.savedRole) {
			text = 'reconnect needed';
			cls = 'warn';
		}
		// a host whose partner dropped already holds a fresh invite: say so instead of a bare "connecting"
		if (s.role === 'host' && !s.linkUp && s.linkStarted && this.#reinvited) {
			text = 'partner disconnected, new invite ready';
			cls = 'bad';
		}
		$('#coop-status-inline, #coop-status-modal').text(text).attr('class', 'coop-status ' + cls);
		// a status dot on the Menu button so a co-op drop is noticed with the menu closed
		if (s.role) {
			$('#menu-dot').removeClass('coop-hidden').attr('class', 'menu-dot ' + (cls || 'warn'));
		} else {
			$('#menu-dot').addClass('coop-hidden');
		}

		// the pill lives on the tracker screen: always there during play so co-op
		// can be started or repaired later; grey when off
		const pill = $('#coop-live');
		if (s.role || s.loaded) {
			const prefix = s.role === 'host' ? 'Co-op host: ' : 'Co-op: ';
			pill.removeClass('coop-hidden').text(prefix + (s.role || s.savedRole ? text : 'off')).attr('class', 'coop-live ' + (s.role || s.savedRole ? cls : ''));
		} else {
			pill.addClass('coop-hidden');
		}

		// last session was a co-op game: offer to pick it up with one code exchange
		if (s.loaded && !s.role && s.savedRole && !this.#resumePrompted) {
			this.#resumePrompted = true;
			$('#coop-resume-note').text(s.savedRole === 'host'
				? 'Your last session was a co-op game you hosted. Your board is kept. Send your partner this new invite to carry on:'
				: 'Your last session was a co-op game as the second player. Ask the host for a new invite (they see a prompt for it too) and paste it here; your board is then reloaded from theirs.').removeClass('coop-hidden');
			this.#open();
			if (s.savedRole === 'host') {
				this.#startCreate();
			} else {
				this.#startJoin();
			}
		}
		// the partner dropped off a host: a fresh invite is ready without any clicks
		if (s.role === 'host' && s.everLinked && !s.linkUp && !this.#reinvited) {
			this.#reinvited = true;
			$('#coop-resume-note').text('Your partner disconnected. Your board is kept. Send them this new invite to carry on:').removeClass('coop-hidden');
			this.#open();
			this.#startCreate();
		}
		if (s.linkUp) {
			this.#reinvited = false;
			$('#coop-resume-note').addClass('coop-hidden');
		}

		// connected banners per role
		$('#coop-connected-host').toggleClass('coop-hidden', !(s.role === 'host' && s.linkUp));
		const clientBanner = $('#coop-connected-client');
		clientBanner.toggleClass('coop-hidden', !(s.role === 'client' && s.linkUp));
		if (s.role === 'client' && s.linkUp) {
			clientBanner.text(s.clientStarted
				? 'Connected. You are following the host: your board is refreshed from theirs every half second and your clicks are sent to them.'
				: 'Connected to the host. Their spoiler and visit-marks setting are locked in on your screen; your layout, panels and auto-tracking stay your own. Your board starts when the host presses OK Dude.');
		}
		if (s.linkUp) {
			$('.coop-flow, #coop-roles').addClass('coop-hidden');
			$('#coop-error').text('');
		} else if (s.linkStarted && s.stalled) {
			$('#coop-error').text('Still not connected after 25 seconds. Check that both of you pasted the whole code. If it never connects, one of you is probably on a network that blocks direct connections (mobile data, work network, VPN).');
		}

		// joiner: locked settings banner and the frozen-board cover
		if (s.role === 'client') {
			const when = s.clientStarted ? 'Your board is the host\'s board.' : s.hostHasStarted ? 'The host has started; your board is loading.' : 'Waiting for the host to press OK Dude…';
			$('#coop-lock-banner').text(`Joined as the second player. The spoiler and visit marks come from the host and are locked here; your layout, panels, icons and auto-tracking are your own. ${when}`);
		}
		$('#coop-blocker').toggleClass('coop-hidden', !(s.role === 'client' && s.clientStarted && !s.linkUp));

		if (this.#wasLinkStarted && !s.linkStarted && !s.role) {
			this.#toRoles();
		}
		this.#wasLinkStarted = s.linkStarted;
	}
}
