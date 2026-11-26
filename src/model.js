export const maxNotes = 500;
export const maxTitle = 120;
export const maxBody = 16_000;
export const maxBackupBytes = 50 * 1024 * 1024;

export function newNote() {
  return { id: crypto.randomUUID(), title: "", body: "", updated: Date.now() };
}

export function noteLabel(note) {
  return note.title.trim() || "Untitled note";
}

export function selectNotes(notes, query) {
  const search = query.trim().toLowerCase();
  return notes
    .filter(note => note.title.toLowerCase().includes(search) || note.body.toLowerCase().includes(search))
    .sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id));
}

export function encodeBackup(notes) {
  return JSON.stringify({ format: "offline-notes", version: 1, notes }, null, 2);
}

export function decodeBackup(source) {
  let backup;
  try {
    backup = JSON.parse(source);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (backup?.format !== "offline-notes" || backup.version !== 1 ||
      !Array.isArray(backup.notes) || backup.notes.length > maxNotes) {
    throw new Error("Choose an Offline Notes version 1 backup with at most 500 notes.");
  }
  const ids = new Set();
  return backup.notes.map(note => {
    if (!note || typeof note.id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(note.id) ||
        typeof note.title !== "string" || note.title.length > maxTitle ||
        typeof note.body !== "string" || note.body.length > maxBody ||
        !Number.isSafeInteger(note.updated) || note.updated < 0 || note.updated > 8.64e15) {
      throw new Error("The backup contains an invalid note.");
    }
    if (ids.has(note.id)) throw new Error("The backup contains a duplicate note ID.");
    ids.add(note.id);
    return { id: note.id, title: note.title, body: note.body, updated: note.updated };
  });
}
