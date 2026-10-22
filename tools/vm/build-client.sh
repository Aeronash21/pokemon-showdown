#!/usr/bin/env bash
#
# Downloads (or updates) the client and builds it for the self-hosted VM.
# Called by tools/vm/install.sh:  build-client.sh REPO_URL CLIENT_DIR RUN_USER

set -euo pipefail

REPO="$1"
DIR="$2"
RUN_USER="$3"
TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
as_user() { sudo -u "$RUN_USER" -H bash -c "$1"; }

if [[ -d "$DIR/.git" ]]; then
	as_user "cd '$DIR' && git pull --quiet --ff-only origin master"
else
	as_user "git clone --quiet --branch master '$REPO' '$DIR'"
fi

as_user "cd '$DIR' && mkdir -p caches play.pokemonshowdown.com/data play.pokemonshowdown.com/js \
	play.pokemonshowdown.com/js/server play.pokemonshowdown.com/caches replay.pokemonshowdown.com/js \
	replay.pokemonshowdown.com/caches teams.pokemonshowdown.com/js teams.pokemonshowdown.com/caches"
as_user "cd '$DIR' && { [[ -f config/config.js ]] || cp config/config-example.js config/config.js; }"
as_user "cd '$DIR' && npm ci --no-audit --no-fund --loglevel=error"
# build-indexes reads the game server's data from caches/pokemon-showdown. Point
# it at this VM's game server, already updated and built, instead of a second
# copy that would need building again.
SERVER_DIR="$(cd "$TOOLS_DIR/../.." && pwd)"
as_user "cd '$DIR/caches' && { [[ -L pokemon-showdown ]] || { rm -rf pokemon-showdown && ln -s '$SERVER_DIR' pokemon-showdown; }; }"
as_user "cd '$DIR' && PS_SERVER_PREBUILT=1 node build indexes && node build"
as_user "node '$TOOLS_DIR/make-client-index.cjs' '$DIR/play.pokemonshowdown.com'"
