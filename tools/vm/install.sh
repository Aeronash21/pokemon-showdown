#!/usr/bin/env bash
#
# Sets up this Pokémon Showdown server on one Debian/Ubuntu VM (Google Cloud,
# Oracle Cloud...), with everything players need behind one web address:
#
#   - the game server (this repo)
#   - the client (Aeronash21/pokemon-showdown-client)
#   - accounts: Showdown's own login server (smogon/pokemon-showdown-loginserver)
#     with a SQLite database, so players register and log in on your site
#   - HTTPS (Caddy gets a free certificate automatically)
#
# Usage, on the VM:
#   sudo bash install.sh your-name.duckdns.org
#
# Safe to run again: it updates everything and keeps your accounts, ranks,
# ladders and logs. For later updates: sudo bash /opt/showdown/server/tools/vm/update.sh

set -euo pipefail

DOMAIN="${1:-}"
SERVER_REPO="https://github.com/Aeronash21/pokemon-showdown.git"
SERVER_RAW="https://raw.githubusercontent.com/Aeronash21/pokemon-showdown/master"
CLIENT_REPO="https://github.com/Aeronash21/pokemon-showdown-client.git"
LOGIN_REPO="https://github.com/smogon/pokemon-showdown-loginserver.git"
# the login server version this setup was tested with
LOGIN_COMMIT="fed2f4a41b7f29c93448dd78a2f658a01631485c"

BASE=/opt/showdown
RUN_USER=showdown
SERVER_DIR="$BASE/server"
CLIENT_DIR="$BASE/client"
LOGIN_DIR="$BASE/loginserver"
DATA_DIR="$BASE/data"
KEY_DIR="$BASE/keys"
LOGIN_DB="$DATA_DIR/login.sqlite"
LOGIN_DB_TOOL="$SERVER_DIR/tools/vm/login-db.cjs"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }
as_user() { sudo -u "$RUN_USER" -H bash -c "$1"; }
node_ok() {
	command -v node >/dev/null || return 1
	node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 24 || (a === 24 && b >= 12) ? 0 : 1)'
}
is_registered() { # name (only once the login server is set up)
	[[ -f "$LOGIN_DB" && -f "$LOGIN_DB_TOOL" ]] && node_ok &&
		sudo -u "$RUN_USER" -H node --no-warnings "$LOGIN_DB_TOOL" has-user "$LOGIN_DB" "$1"
}

[[ $EUID -eq 0 ]] || fail "Run it with sudo:  sudo bash install.sh ${DOMAIN:-your-name.duckdns.org}"
[[ -n "$DOMAIN" ]] || fail "Give your web address:  sudo bash install.sh your-name.duckdns.org"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || fail "\"$DOMAIN\" doesn't look like a web address (lowercase, no https://)."
STARTED=$(date +%s)

# ---------------------------------------------------------------------------
step "Your owner account"
# Ranks go by name, so whoever registers a ranked name first gets its rank:
# the owner's name is registered before the site goes up.
if [[ -f "$SERVER_DIR/config/usergroups.csv" ]]; then
	USERGROUPS=$(cat "$SERVER_DIR/config/usergroups.csv")
else
	USERGROUPS=$(curl -fsS --max-time 10 "$SERVER_RAW/config/usergroups.csv" 2>/dev/null || true)
fi
OWNER_DEFAULT=$(printf '%s\n' "$USERGROUPS" | awk -F, '$2 == "~" && !found {gsub(/ /, "", $1); print $1; found = 1}')
OWNER=""
OWNER_PASSWORD=""
if [[ -n "$OWNER_DEFAULT" ]] && is_registered "$OWNER_DEFAULT"; then
	echo "\"$OWNER_DEFAULT\" is already registered."
elif [[ ! -t 0 ]]; then
	warn "Not running in a terminal, so I can't ask for a password. Register your owner name on the site straight away."
else
	echo "Ranks go by name: whoever registers a ranked name first gets its rank. So your owner name"
	echo "gets registered now, before the site goes up."
	read -rp "Your owner username [${OWNER_DEFAULT}]: " OWNER
	OWNER="${OWNER:-$OWNER_DEFAULT}"
	if [[ -z "$(printf '%s' "$OWNER" | tr -cd 'A-Za-z0-9')" ]]; then
		warn "No name given; skipping. Register your owner name on the site straight away."
		OWNER=""
	elif is_registered "$OWNER"; then
		echo "\"$OWNER\" is already registered."
		OWNER=""
	else
		while true; do
			read -rsp "Choose a password for $OWNER (at least 5 characters): " OWNER_PASSWORD; echo
			read -rsp "Type it again: " PASSWORD_AGAIN; echo
			if [[ "$OWNER_PASSWORD" != "$PASSWORD_AGAIN" ]]; then warn "They don't match; try again."; continue; fi
			if [[ $(printf '%s' "$OWNER_PASSWORD" | tr -d '[:space:]' | wc -c) -lt 5 ]]; then warn "Too short; try again."; continue; fi
			break
		done
		unset PASSWORD_AGAIN
		echo "Got it. The rest runs by itself and takes 20-30 minutes."
	fi
fi

# ---------------------------------------------------------------------------
step "Checking that $DOMAIN points at this VM"
MY_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)
if [[ -z "$DNS_IP" ]]; then
	warn "$DOMAIN doesn't resolve yet. Set its IP on duckdns.org; HTTPS starts working once it does."
elif [[ -n "$MY_IP" && "$MY_IP" != "$DNS_IP" ]]; then
	warn "$DOMAIN points at $DNS_IP, but this VM's address is $MY_IP. Update it on duckdns.org."
else
	echo "OK: $DOMAIN -> $DNS_IP"
fi

# ---------------------------------------------------------------------------
step "Installing system packages (git, build tools, Caddy)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl ca-certificates gnupg openssl build-essential python3
if ! apt-get install -y -q caddy; then
	echo "Caddy isn't in this system's package list; adding Caddy's own package repository"
	apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -q
	apt-get install -y -q caddy
fi

# ---------------------------------------------------------------------------
step "Installing Node.js 24"
if ! node_ok; then
	curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
	bash /tmp/nodesource_setup.sh
	apt-get install -y -q nodejs
fi
node_ok || fail "Node.js 24.12 or newer is needed, but $(node -v 2>/dev/null || echo 'none') is installed."
NODE_BIN=$(command -v node)
echo "Node.js $(node -v)"

# ---------------------------------------------------------------------------
step "Creating the '$RUN_USER' user and folders"
if ! id "$RUN_USER" >/dev/null 2>&1; then
	useradd --system --create-home --home-dir "$BASE" --shell /usr/sbin/nologin "$RUN_USER"
fi
mkdir -p "$DATA_DIR" "$KEY_DIR"
echo "$DOMAIN" > "$BASE/domain" # (for update.sh)
chown "$RUN_USER:$RUN_USER" "$BASE" "$DATA_DIR" "$KEY_DIR" "$BASE/domain"
chmod 755 "$BASE" # Caddy needs to read the client's files
chmod 700 "$DATA_DIR" "$KEY_DIR"

# ---------------------------------------------------------------------------
step "Login keys (they let the game server trust logins from your login server)"
if [[ ! -f "$KEY_DIR/login-private.pem" ]]; then
	as_user "openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out '$KEY_DIR/login-private.pem' 2>/dev/null"
	as_user "openssl pkey -in '$KEY_DIR/login-private.pem' -pubout -out '$KEY_DIR/login-public.pem'"
	chmod 600 "$KEY_DIR/login-private.pem"
	echo "Made a new key pair in $KEY_DIR"
else
	echo "Keeping the existing keys in $KEY_DIR"
fi

# ---------------------------------------------------------------------------
step "Game server: downloading and building (a few minutes)"
if [[ -d "$SERVER_DIR/.git" ]]; then
	# Keep this VM's ranks (config/usergroups.csv changes when you /promote people).
	# Other files the server changed in config/ (like avatars.json) take GitHub's
	# version; the VM's own changes are kept in `git stash list` in the server folder.
	cp "$SERVER_DIR/config/usergroups.csv" "$DATA_DIR/usergroups.csv.keep" 2>/dev/null || true
	as_user "cd '$SERVER_DIR' && { git stash push --quiet -m 'VM changes before update' -- config >/dev/null 2>&1 || true; }"
	as_user "cd '$SERVER_DIR' && git pull --quiet --ff-only origin master"
	if [[ -f "$DATA_DIR/usergroups.csv.keep" ]]; then
		install -o "$RUN_USER" -g "$RUN_USER" -m 644 "$DATA_DIR/usergroups.csv.keep" "$SERVER_DIR/config/usergroups.csv"
	fi
else
	as_user "git clone --quiet --branch master '$SERVER_REPO' '$SERVER_DIR'"
fi
if [[ ! -f "$SERVER_DIR/config/config.js" ]]; then
	# Only the settings that differ from config/config-example.js (it fills in the rest).
	cat > "$SERVER_DIR/config/config.js" <<EOF
// Written by tools/vm/install.sh. Every setting not listed here comes from
// config/config-example.js. Restart after editing: sudo systemctl restart showdown
'use strict';
const fs = require('fs');

exports.port = 8000;
// only reachable through Caddy (HTTPS) on this VM
exports.bindaddress = '127.0.0.1';
// Caddy passes on each player's real IP address
exports.proxyip = ['127.0.0.0/8'];
// nobody gets console access just by connecting through Caddy
exports.consoleips = [];

// accounts come from the login server on this VM
exports.loginserver = 'http://127.0.0.1:8080/';
exports.loginserverkeyalgo = 'RSA-SHA1';
exports.loginserverpublickeyid = 4;
exports.loginserverpublickey = fs.readFileSync('$KEY_DIR/login-public.pem', 'utf8');
EOF
	chown "$RUN_USER:$RUN_USER" "$SERVER_DIR/config/config.js"
fi
as_user "cd '$SERVER_DIR' && npm install --no-audit --no-fund --loglevel=error && npm run build --silent && node tools/build-nd-shared-sets.cjs && npm run build --silent"

# ---------------------------------------------------------------------------
step "Login server: downloading and setting up"
if [[ -d "$LOGIN_DIR/.git" ]]; then
	as_user "cd '$LOGIN_DIR' && git fetch --quiet origin && git checkout --quiet '$LOGIN_COMMIT'"
else
	as_user "git clone --quiet '$LOGIN_REPO' '$LOGIN_DIR' && cd '$LOGIN_DIR' && git checkout --quiet '$LOGIN_COMMIT'"
fi
as_user "cd '$LOGIN_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error"
cat > "$LOGIN_DIR/config/config.cjs" <<EOF
// Written by tools/vm/install.sh in the Pokémon Showdown server repo (re-running it rewrites this).
// Every setting not listed here comes from config/config-example.cjs.
'use strict';
const fs = require('fs');

// accounts, in a SQLite file
exports.logindb = { driver: 'sqlite', path: '$LOGIN_DB', prefix: '' };
exports.replaysdb = null;
exports.ladderdb = null;
exports.friendsdb = null;

// the login cookie is for this site
exports.routes = { root: '$DOMAIN' };
// no registered-server list (that's for Showdown's own network)
exports.serverlist = '';
exports.cors = [];
exports.sysops = [];
exports.pspath = '';
exports.colorpath = null;
exports.coilpath = null;
exports.cssdir = '$DATA_DIR/customcss/';

// signs logins for the game server, which checks them with the public key
exports.privatekey = fs.readFileSync('$KEY_DIR/login-private.pem', 'utf8');
exports.challengekeyid = 4;

// only reachable through Caddy on this VM
exports.bindaddress = '127.0.0.1';
exports.port = 8080;
exports.watchconfig = false;
exports.loadprivaterelayips = false;
EOF
chown "$RUN_USER:$RUN_USER" "$LOGIN_DIR/config/config.cjs"
if [[ ! -f "$LOGIN_DB" ]]; then
	as_user "'$NODE_BIN' --no-warnings '$LOGIN_DB_TOOL' init '$LOGIN_DB' '$SERVER_DIR/tools/vm/login-schema.sql'"
	chmod 600 "$LOGIN_DB"
	echo "Made a new account database: $LOGIN_DB"
else
	echo "Keeping the existing account database: $LOGIN_DB"
fi
if [[ -n "$OWNER" && -n "$OWNER_PASSWORD" ]]; then
	if is_registered "$OWNER"; then
		echo "\"$OWNER\" is already registered."
	else
		printf '%s' "$OWNER_PASSWORD" |
			sudo -u "$RUN_USER" -H "$NODE_BIN" --no-warnings "$LOGIN_DB_TOOL" set-password "$LOGIN_DIR" "$LOGIN_DB" "$OWNER"
	fi
fi
unset OWNER_PASSWORD

# ---------------------------------------------------------------------------
step "Client: downloading and building (the longest step: 10-20 minutes on a small VM)"
bash "$SERVER_DIR/tools/vm/build-client.sh" "$CLIENT_REPO" "$CLIENT_DIR" "$RUN_USER"

# ---------------------------------------------------------------------------
step "Services (they start on boot and restart if they crash)"
cat > /etc/systemd/system/showdown-login.service <<EOF
[Unit]
Description=Pokemon Showdown login server
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$LOGIN_DIR
ExecStart=$NODE_BIN src/index.js config/config.cjs
KillSignal=SIGINT
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/showdown.service <<EOF
[Unit]
Description=Pokemon Showdown game server
After=network-online.target showdown-login.service
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$SERVER_DIR
ExecStart=$NODE_BIN pokemon-showdown start --skip-build 8000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --quiet showdown-login showdown
systemctl restart showdown-login showdown

# ---------------------------------------------------------------------------
step "HTTPS and routing (Caddy)"
if [[ -f /etc/caddy/Caddyfile && ! -f /etc/caddy/Caddyfile.original ]]; then
	cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.original
fi
cat > /etc/caddy/Caddyfile <<EOF
# Written by tools/vm/install.sh in the Pokémon Showdown server repo (re-running it rewrites this).
$DOMAIN {
	# the game server: battles and chat, custom avatars and CSS
	@game path /showdown/* /avatars/* /custom.css
	handle @game {
		reverse_proxy 127.0.0.1:8000
	}

	# the login server: registering, logging in and out
	@login path_regexp ^/(~~[^/]*/)?action\.php$
	handle @login {
		reverse_proxy 127.0.0.1:8080
	}

	# the client
	handle {
		root * $CLIENT_DIR/play.pokemonshowdown.com
		encode zstd gzip
		# sprites, sounds and anything else this client doesn't have: load them from Showdown
		# (Caddy's file check counts the home page "/" as missing, so it's left out)
		@missing {
			not path /
			not file
		}
		redir @missing https://play.pokemonshowdown.com{uri} 302
		file_server
	}
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ||
	fail "Caddy didn't accept /etc/caddy/Caddyfile. See: caddy validate --config /etc/caddy/Caddyfile"
systemctl enable --quiet caddy
systemctl restart caddy

# ---------------------------------------------------------------------------
step "Checking everything is running"
check() { # description, command, service to look at
	if bash -c "$2" >/dev/null 2>&1; then
		echo "OK: $1"
	else
		warn "$1 isn't answering yet. To see why: sudo journalctl -u $3 -n 50"
	fi
}
for _ in $(seq 1 24); do curl -fsS http://127.0.0.1:8000/ >/dev/null 2>&1 && break; sleep 5; done
check "game server" "curl -fsS http://127.0.0.1:8000/" showdown
check "login server" "curl -fsS -d act=upkeep http://127.0.0.1:8080/action.php | grep -q loggedin" showdown-login
for _ in $(seq 1 12); do curl -fsS --max-time 10 "https://$DOMAIN/" -o /dev/null 2>/dev/null && break; sleep 5; done
check "HTTPS (https://$DOMAIN)" "curl -fsS --max-time 10 https://$DOMAIN/ -o /dev/null" caddy

RANKED=$(printf '%s\n' "$USERGROUPS" | awk -F, -v owner="$(printf '%s' "${OWNER:-$OWNER_DEFAULT}" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')" \
	'$2 != "" {gsub(/ /, "", $1); if ($1 != owner) print "  " $1 " (" $2 ")"}')
if [[ -n "$RANKED" ]]; then
	echo
	echo "Other ranked names on your server. They should register soon, before anyone else does:"
	echo "$RANKED"
fi

MINUTES=$(( ($(date +%s) - STARTED) / 60 ))
printf '\n\033[1;32mDone in %s minutes.\033[0m Your site: https://%s\n' "$MINUTES" "$DOMAIN"
echo "Updates later:  sudo bash $SERVER_DIR/tools/vm/update.sh"
