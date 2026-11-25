#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
PBJS="$ROOT_DIR/node_modules/.bin/pbjs"
PBTS="$ROOT_DIR/node_modules/.bin/pbts"

if [ ! -x "$PBJS" ] || [ ! -x "$PBTS" ]; then
  echo "protobufjs-cli is missing. Run npm install before generating WAProto." >&2
  exit 1
fi

cd "$SCRIPT_DIR"
"$PBJS" -t static-module --no-beautify -w es6 --no-bundle --no-delimited --no-verify --no-comments -o ./index.js ./WAProto.proto
TYPE_SOURCE="$SCRIPT_DIR/.wa-proto-types.js"
trap 'rm -f "$TYPE_SOURCE"' EXIT HUP INT TERM
"$PBJS" -t static-module --no-beautify -w es6 --no-bundle --no-delimited --no-verify ./WAProto.proto > "$TYPE_SOURCE"
"$PBTS" --no-comments -o ./index.d.ts "$TYPE_SOURCE"
node ./fix-imports.js

node --check ./index.js
