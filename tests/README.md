# Tests

The site is three static pages whose logic lives in a single inline `<script>` each.
`extract-scripts.mjs` (run automatically by the vitest global setup) copies each page's
inline script into `tests/generated/<page>.js` as an ES module that re-exports its
top-level functions and state. `helpers/load-page.js` parses the real `.html` file with
jsdom, exposes the resulting window as globals and then imports the generated module, so
the tests exercise the shipped page markup and script without changing either.

```
npm install
npm test          # run once
npm run test:watch
npm run coverage  # text + html report in coverage/
```

Notes:

- `tests/generated/` and `coverage/` are build artefacts and are gitignored.
- Trainer timing is driven by fake timers (`useTrainerClock`), which also fake
  `performance.now()` and `requestAnimationFrame`.
- `index.html` links out to `roster.html` and no longer contains `#rosterGrid` /
  `#characterDetail`, so its inline `renderRoster()` / `selectCharacter()` throw on load
  in a real browser. The index tests inject those containers via `beforeScript` to cover
  the functions, and one test pins the current broken-on-load behaviour.
