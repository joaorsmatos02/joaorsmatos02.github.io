# assets/doom

Self-hosted, fully static DOOM for the site's easter egg (launched from
`doom.html`). Nothing is built — these files are vendored as-is.

## Contents & origin

- **`jsdos/`** — [js-dos](https://js-dos.com) `6.22.60`, from npm (`npm pack js-dos@6.22.60`),
  license **ISC**. DOSBox compiled to WebAssembly. The three files are the
  runtime: `js-dos.js` (loader), `wdosbox.js` (glue), `wdosbox.wasm.js` (the
  WASM binary — it really is wasm despite the `.js` extension).

- **`doom.zip`** — the **shareware DOOM** (`DOOM.EXE` + `DOOM1.WAD`), from the
  Internet Archive item [`DoomsharewareEpisode`](https://archive.org/details/DoomsharewareEpisode)
  (`doom.ZIP`). id Software's shareware episode is freely distributable.

`doom.html` mounts `doom.zip` in the emulator and runs `DOOM.EXE`.

## Why vendored (no build)

An earlier version compiled a native WASM Doom (Emscripten + submodules) in CI.
This is far simpler: js-dos ships prebuilt, so the site stays 100% static — no
build step, no submodules, no toolchain. It also works on GitHub Pages without
COOP/COEP headers (no `SharedArrayBuffer` required).

## Updating

- **js-dos**: `npm pack js-dos@<version>` and replace the files in `jsdos/`.
- **WAD**: swap `doom.zip` for another zip containing a DOS `.EXE` + `.WAD`
  (e.g. Freedoom's BSD-licensed WAD) and update the `-c` command in `doom.html`.
