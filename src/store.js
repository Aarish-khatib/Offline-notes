import { maxNotes } from "./model.js";

export function openNotes() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("offline-notes-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("notes", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(makeStore(request.result));
  });
}

function makeStore(database) {
  function transact(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("notes", mode);
      let result;
      let reason;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(reason || transaction.error || new Error("Storage was interrupted."));
      const store = transaction.objectStore("notes");
      operation(store, value => { result = value; }, message => {
        reason = new Error(message);
        transaction.abort();
      });
    });
  }

  return {
    list() {
      return transact("readonly", (store, done) => {
        const request = store.getAll();
        request.onsuccess = () => done(request.result);
      });
    },
    create(note) {
      return transact("readwrite", (store, _done, fail) => {
        const request = store.count();
        request.onsuccess = () => {
          if (request.result >= maxNotes) {
            fail(`This notebook can hold up to ${maxNotes} notes.`);
            return;
          }
          store.add(note);
        };
      });
    },
    save(note) {
      return transact("readwrite", (store, done, fail) => {
        const request = store.get(note.id);
        request.onsuccess = () => {
          if (!request.result) {
            fail("This note was deleted in another tab.");
            return;
          }
          const next = { ...note, updated: Math.max(Date.now(), request.result.updated) };
          store.put(next);
          done(next);
        };
      });
    },
    remove(id) {
      return transact("readwrite", store => { store.delete(id); });
    },
    merge(notes) {
      return transact("readwrite", (store, done, fail) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const current = new Map(request.result.map(note => [note.id, note]));
          const additions = notes.filter(note => !current.has(note.id)).length;
          if (current.size + additions > maxNotes) {
            fail(`This backup would exceed the ${maxNotes}-note limit. No notes were imported.`);
            return;
          }
          const changed = notes.filter(note => !current.has(note.id) || current.get(note.id).updated < note.updated);
          for (const note of changed) store.put(note);
          done(changed.length);
        };
      });
    },
  };
}
