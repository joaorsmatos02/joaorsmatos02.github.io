# joaorsmatos02.github.io

Personal portfolio — a "view source" themed site: each page renders like an
indented HTML document, with the content styled by semantic tag.

## Structure

```
.
├── index.html            # home + CV nav
├── education.html        # \
├── experience.html       #  |
├── projects.html         #  |  CV sections (kept at root for clean URLs
├── awards.html           #  |  and GitHub Pages)
├── misc.html             # /
└── assets/
    ├── cv.pdf            # downloadable CV
    ├── css/
    │   └── style.css     # all styling (view-source theme + terminal)
    └── js/
        ├── bonsai.js     # cbonsai growth algorithm (pure; window.Cbonsai)
        ├── filesystem.js # in-memory data (window.FakeFS)
        └── terminal.js   # the side-panel terminal controller
```

The HTML pages stay at the repository root because GitHub Pages serves the
site from there; moving them into a folder would change every URL.

## The terminal

A `cbonsai` screensaver grows in a side panel by default (`Esc`/`✕` to close,
type `cmd` to reopen). There may be more to it, have a poke around. :)

The three JS modules load in order (`bonsai.js` -> `filesystem.js` ->
`terminal.js`); `terminal.js` depends on the globals the first two expose.

## Cache busting

CSS/JS are linked with a `?v=YYYYMMDD` query. Bump it whenever those files
change so browsers fetch the new version instead of a cached one.
