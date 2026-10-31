'use strict';

// Durable backup of the tracker state for a page opened from a local file.
// localStorage survives a normal browser close, but Chrome only writes it to
// disk a few seconds after a change (and less often when changes are frequent),
// so a crash can lose the last minute. IndexedDB with strict durability is
// written and synced to disk right away. Both are written; the newer one wins
// when reading.
class Persist {
	static KEY = 'z3rTracker.backup';
	static DEFAULTS_KEY = 'z3rTracker.defaults';
	static PREVIOUS_KEY = 'z3rTracker.backup.previous';
	static OPEN_FLAG = 'z3rTracker.open';
	static DB = 'z3rTracker';
	static STORE = 'backups';
	static #dbPromise = null;
	static #lastSaved = null;

	static save(data) {
		const json = JSON.stringify(data);
		if (json === Persist.#lastSaved) {
			return Promise.resolve();
		}
		Persist.#lastSaved = json;
		const record = { savedAt: Date.now(), data };
		try {
			localStorage.setItem(Persist.KEY, JSON.stringify(record));
		} catch (e) {
			console.error('localStorage backup failed', e);
		}
		return Persist.#db().then(db => new Promise((resolve, reject) => {
			const tx = db.transaction(Persist.STORE, 'readwrite', { durability: 'strict' });
			tx.objectStore(Persist.STORE).put(record, 'current');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		})).catch(e => console.error('IndexedDB backup failed', e));
	}

	// newest of the two copies, as { savedAt, data }, or null
	static async load() {
		let fromLocal = null;
		try {
			fromLocal = JSON.parse(localStorage.getItem(Persist.KEY));
		} catch (e) {
			fromLocal = null;
		}
		let fromDb = null;
		try {
			const db = await Persist.#db();
			fromDb = await new Promise((resolve, reject) => {
				const request = db.transaction(Persist.STORE).objectStore(Persist.STORE).get('current');
				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			});
		} catch (e) {
			fromDb = null;
		}
		const found = [fromLocal, fromDb].filter(r => r && r.data && r.savedAt);
		if (!found.length) {
			return null;
		}
		return found.sort((a, b) => b.savedAt - a.savedAt)[0];
	}

	// the stored default configuration (map definition, settings, layout)
	static saveDefaults(data) {
		const record = { savedAt: Date.now(), data };
		try {
			localStorage.setItem(Persist.DEFAULTS_KEY, JSON.stringify(record));
		} catch (e) {
			console.error('localStorage defaults failed', e);
		}
		return Persist.#db().then(db => new Promise((resolve, reject) => {
			const tx = db.transaction(Persist.STORE, 'readwrite', { durability: 'strict' });
			tx.objectStore(Persist.STORE).put(record, 'defaults');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		})).catch(e => console.error('IndexedDB defaults failed', e));
	}

	static async loadDefaults() {
		let fromLocal = null;
		try {
			fromLocal = JSON.parse(localStorage.getItem(Persist.DEFAULTS_KEY));
		} catch (e) {
			fromLocal = null;
		}
		let fromDb = null;
		try {
			const db = await Persist.#db();
			fromDb = await new Promise((resolve, reject) => {
				const request = db.transaction(Persist.STORE).objectStore(Persist.STORE).get('defaults');
				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			});
		} catch (e) {
			fromDb = null;
		}
		const found = [fromLocal, fromDb].filter(r => r && r.data && r.savedAt);
		if (!found.length) {
			return null;
		}
		return found.sort((a, b) => b.savedAt - a.savedAt)[0];
	}

	// the previous session, as { savedAt, data }, or null
	static previous() {
		try {
			const record = JSON.parse(localStorage.getItem(Persist.PREVIOUS_KEY));
			return record && record.data && record.savedAt ? record : null;
		} catch (e) {
			return null;
		}
	}

	// end the current session: keep it one step back, forget it as current
	static endSession() {
		Persist.keepPrevious();
		try {
			localStorage.removeItem(Persist.KEY);
			sessionStorage.removeItem(Persist.OPEN_FLAG);
		} catch (e) {
			console.error('could not clear the current backup', e);
		}
		Persist.#lastSaved = null;
		return Persist.#db().then(db => new Promise((resolve, reject) => {
			const tx = db.transaction(Persist.STORE, 'readwrite', { durability: 'strict' });
			tx.objectStore(Persist.STORE).delete('current');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		})).catch(e => console.error('could not clear the IndexedDB backup', e));
	}

	// keeps the backup a fresh start is about to replace
	static keepPrevious() {
		try {
			const current = localStorage.getItem(Persist.KEY);
			if (current) {
				localStorage.setItem(Persist.PREVIOUS_KEY, current);
			}
		} catch (e) {
			console.error('could not keep the previous backup', e);
		}
	}

	static #db() {
		if (!Persist.#dbPromise) {
			Persist.#dbPromise = new Promise((resolve, reject) => {
				const request = indexedDB.open(Persist.DB, 1);
				request.onupgradeneeded = () => request.result.createObjectStore(Persist.STORE);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				request.onblocked = () => reject(new Error('IndexedDB open blocked'));
			});
		}
		return Persist.#dbPromise;
	}
}
