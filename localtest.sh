#/bin/sh

python3 scripts/gen-shell-fs.py . assets/fs.json
python3 -m http.server