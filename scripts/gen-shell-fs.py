#!/usr/bin/env python3
"""Generate the fake shell's ~/site filesystem from the site's own source.

Walks the site files (root *.html + assets/css + assets/js) and emits a JSON
tree in the FakeFS node shape:  {"t":"dir","c":{...}} / {"t":"file","c":"..."}.
filesystem.js fetches this and mounts it at ~/site.

Usage:  gen-shell-fs.py <src-dir> <out-json>
  e.g.  gen-shell-fs.py public public/assets/fs.json     (in CI)
        gen-shell-fs.py . assets/fs.json                 (locally, to test)

Scope is intentionally "the site" only — no CI/config, no binaries.
"""
import json
import os
import sys

TEXT_EXT = (".html", ".css", ".js", ".md", ".txt", ".json", ".svg")


def add_file(root, relpath, content):
    parts = relpath.split("/")
    node = root
    for p in parts[:-1]:
        node = node["c"].setdefault(p, {"t": "dir", "c": {}})
    node["c"][parts[-1]] = {"t": "file", "c": content}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "."
    out = sys.argv[2] if len(sys.argv) > 2 else "assets/fs.json"

    # site files only: root pages + their css/js
    targets = sorted(f for f in os.listdir(src) if f.endswith(".html"))
    targets += ["assets/css", "assets/js"]

    root = {"t": "dir", "c": {}}
    for t in targets:
        full = os.path.join(src, t)
        if os.path.isfile(full) and t.endswith(TEXT_EXT):
            with open(full, encoding="utf-8", errors="replace") as fh:
                add_file(root, t, fh.read())
        elif os.path.isdir(full):
            for dirpath, _dirs, files in os.walk(full):
                for name in sorted(files):
                    rel = os.path.relpath(os.path.join(dirpath, name), src).replace(os.sep, "/")
                    if rel.endswith(TEXT_EXT):
                        with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as fh:
                            add_file(root, rel, fh.read())

    out_dir = os.path.dirname(out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(root, fh, ensure_ascii=False, separators=(",", ":"))
    print("wrote " + out + " (" + str(len(root["c"])) + " top-level entries)")


if __name__ == "__main__":
    main()
