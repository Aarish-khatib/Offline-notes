# Offline Notes

Write and search notes in a browser without an account. Notes are saved in IndexedDB on your device. The app can reopen offline once its service worker has cached the app on a successful visit.

## Run

Use Node.js 22 or later.

```sh
npm start
```

Open [localhost:4173](http://127.0.0.1:4173). The app has no runtime dependencies. To host it as a static site, publish `index.html`, `styles.css`, `sw.js`, and `src/` together on HTTPS.

- Create a note, enter a title or text, and wait for the saved status.
- Search titles and note bodies.
- Export a versioned JSON backup. Import adds missing notes and replaces matching IDs only when the backup copy is newer. A malformed backup leaves the notebook intact.
- Close and reopen on the same browser profile to continue editing. Use the same URL and port each time.

## Verify

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite covers desktop and mobile layouts, autosave, refresh, offline reload, search, import, export, and deletion.

Notes and backup files are not encrypted. Keep a backup if the notes matter, since clearing browser site data clears the notebook. There is no server, sync, analytics, or account. The notebook holds up to 500 notes, with up to 120 title and 16,000 body characters per note.
