import { decodeBackup, encodeBackup, maxBackupBytes, maxBody, maxTitle, newNote, noteLabel, selectNotes } from "./model.js";
import { openNotes } from "./store.js";

const byId = id => document.getElementById(id);
const elements = {
  add: byId("new-note"), search: byId("search"), list: byId("notes"), listEmpty: byId("list-empty"),
  import: byId("import"), export: byId("export"), backup: byId("backup"),
  empty: byId("empty"), emptyTitle: byId("empty-title"), emptyHint: byId("empty-hint"),
  editor: byId("document"), title: byId("title"), body: byId("body"), modified: byId("modified"),
  remove: byId("delete-note"), status: byId("status"),
};
const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
let storage;
let notes = [];
let activeId;
let saveVersion = 0;
let dirty = false;
let queue = Promise.resolve();

elements.title.maxLength = maxTitle;
elements.body.maxLength = maxBody;

function status(message, error = false) {
  elements.status.textContent = message;
  elements.status.dataset.error = String(error);
}

function act(action) {
  queue = queue.then(action).catch(error => status(error.message || "Something went wrong.", true));
}

function renderList() {
  const visible = selectNotes(notes, elements.search.value);
  const list = document.createDocumentFragment();
  for (const note of visible) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note";
    button.setAttribute("aria-current", String(note.id === activeId));
    const label = document.createElement("strong");
    label.textContent = noteLabel(note);
    button.append(label);
    const summary = note.body.trim();
    if (summary) {
      const preview = document.createElement("span");
      preview.textContent = summary.slice(0, 100);
      button.append(preview);
    }
    button.addEventListener("click", () => act(async () => {
      if (canSwitch()) showNote(note.id, true);
    }));
    item.append(button);
    list.append(item);
  }
  elements.list.replaceChildren(list);
  elements.listEmpty.hidden = visible.length > 0;
  elements.listEmpty.textContent = notes.length ? "No matching notes." : "Your notes will appear here.";
  elements.export.disabled = !notes.length;
}

function showNote(id, focus = false) {
  const note = notes.find(item => item.id === id);
  activeId = note?.id;
  dirty = false;
  elements.empty.hidden = Boolean(note);
  elements.editor.hidden = !note;
  elements.title.value = note?.title ?? "";
  elements.body.value = note?.body ?? "";
  elements.modified.textContent = note ? `Edited ${formatDate.format(note.updated)}` : "";
  renderList();
  if (focus) (note ? elements.title : elements.add).focus();
}

function canSwitch() {
  return !dirty || window.confirm("Some edits could not be saved. Leave this note anyway?");
}

function saveEditor() {
  const id = activeId;
  if (!id) return;
  const version = ++saveVersion;
  const draft = { id, title: elements.title.value, body: elements.body.value };
  dirty = true;
  status("Saving…");
  act(async () => {
    try {
      const saved = await storage.save(draft);
      notes = notes.map(note => note.id === id ? saved : note);
      if (activeId === id && version === saveVersion) {
        dirty = false;
        elements.modified.textContent = `Edited ${formatDate.format(saved.updated)}`;
        status("Saved on this device.");
      }
      renderList();
    } catch (error) {
      if (activeId === id && version === saveVersion) {
        throw new Error(`Could not save. ${error.message} Your text is still in the editor.`);
      }
    }
  });
}

elements.add.addEventListener("click", () => act(async () => {
  if (!canSwitch()) return;
  const note = newNote();
  await storage.create(note);
  notes = await storage.list();
  elements.search.value = "";
  showNote(note.id, true);
  status("New note created.");
}));
elements.search.addEventListener("input", renderList);
elements.title.addEventListener("input", saveEditor);
elements.body.addEventListener("input", saveEditor);

elements.remove.addEventListener("click", () => {
  const id = activeId;
  const note = notes.find(item => item.id === id);
  if (!note || !window.confirm(`Delete “${noteLabel(note)}”?`)) return;
  act(async () => {
    await storage.remove(id);
    notes = await storage.list();
    showNote(selectNotes(notes, "")[0]?.id, true);
    status("Note deleted.");
  });
});

elements.export.addEventListener("click", () => act(async () => {
  if (dirty) throw new Error("Save or copy the pending edits before exporting.");
  const blob = new Blob([encodeBackup(selectNotes(await storage.list(), ""))], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `offline-notes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  status("Backup exported.");
}));

elements.import.addEventListener("click", () => elements.backup.click());
elements.backup.addEventListener("change", () => {
  const file = elements.backup.files[0];
  elements.backup.value = "";
  if (!file) return;
  act(async () => {
    if (dirty) throw new Error("Save or copy the pending edits before importing.");
    if (file.size > maxBackupBytes) throw new Error("Choose a backup smaller than 50 MiB.");
    const incoming = decodeBackup(await file.text());
    const count = await storage.merge(incoming);
    notes = await storage.list();
    if (!dirty) showNote(activeId ?? selectNotes(notes, "")[0]?.id);
    else renderList();
    status(count ? `Imported ${count} ${count === 1 ? "note" : "notes"}.` : "This backup has no newer notes.");
  });
});

window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

async function start() {
  try {
    storage = await openNotes();
    notes = await storage.list();
    elements.emptyTitle.textContent = "No note selected";
    elements.emptyHint.textContent = "Create a note or choose one from the list.";
    elements.add.disabled = false;
    elements.search.disabled = false;
    elements.import.disabled = false;
    showNote(selectNotes(notes, "")[0]?.id);
  } catch {
    elements.emptyTitle.textContent = "Couldn’t open local storage";
    elements.emptyHint.textContent = "Allow site storage in your browser and reload.";
  } finally {
    elements.editor.parentElement.setAttribute("aria-busy", "false");
  }
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register(new URL("../sw.js", import.meta.url));
    } catch {
      if (storage) status("Notes are available. Offline reload couldn’t be enabled.", true);
    }
  }
}

void start();
