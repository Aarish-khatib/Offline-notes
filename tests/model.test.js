import assert from "node:assert/strict";
import test from "node:test";
import { decodeBackup, encodeBackup, maxBody, noteLabel, selectNotes } from "../src/model.js";

const first = { id: "b56713ca-7111-4111-8111-222222222222", title: "Errands", body: "Buy apples", updated: 100 };
const second = { id: "a56713ca-7111-4111-8111-222222222222", title: "", body: "Send APPLES", updated: 200 };

test("search checks title and body, ignores case and sorts by most recent edit", () => {
  assert.deepEqual(selectNotes([first, second], " apples "), [second, first]);
  assert.deepEqual(selectNotes([first, second], "ERRANDS"), [first]);
  assert.equal(noteLabel(second), "Untitled note");
  assert.deepEqual([first, second].map(note => note.updated), [100, 200]);
});

test("a supported backup preserves an entire note", () => {
  assert.deepEqual(decodeBackup(encodeBackup([first, second])), [first, second]);
});

test("invalid drafts, versions and duplicate IDs are rejected before import", () => {
  assert.throws(() => decodeBackup("bad JSON"), /not valid JSON/);
  assert.throws(() => decodeBackup('{"format":"offline-notes","version":2,"notes":[]}'), /version 1/);
  assert.throws(() => decodeBackup(encodeBackup([first, first])), /duplicate/);
  assert.throws(() => decodeBackup(encodeBackup([{ ...first, body: "a".repeat(maxBody + 1) }])), /invalid note/);
  assert.throws(() => decodeBackup(encodeBackup([{ ...first, updated: 9e15 }])), /invalid note/);
});
