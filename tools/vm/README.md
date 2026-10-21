# Self-hosting on a VM

Runs this server on one Debian/Ubuntu VM (tested for Google Cloud's e2-micro
with Debian 13), with everything behind one web address:

- **the game server** (this repo), on port 8000
- **the client** ([Aeronash21/pokemon-showdown-client](https://github.com/Aeronash21/pokemon-showdown-client))
- **accounts**: Showdown's own login server
  ([smogon/pokemon-showdown-loginserver](https://github.com/smogon/pokemon-showdown-loginserver))
  with a SQLite database, on port 8080. Players register and log in on your
  site; these accounts are separate from main Showdown's.
- **HTTPS**: [Caddy](https://caddyserver.com) gets a free certificate and sends
  each request to the right place

Ports 8000 and 8080 only listen on the VM itself; everything goes through Caddy
on 80/443.

## Install

The web address (e.g. a free `your-name.duckdns.org`) must already point at the
VM, and ports 80 and 443 must be open. On the VM:

    curl -fsSLO https://raw.githubusercontent.com/Aeronash21/pokemon-showdown/master/tools/vm/install.sh
    sudo bash install.sh your-name.duckdns.org

It asks for a password for the owner's name first (the `~` in
`config/usergroups.csv`), then runs by itself for 20-30 minutes. Ranks go by
name, so whoever registers a ranked name first gets its rank: the owner's name
is registered before the site goes up.

## Update

Pulls the newest server and client from GitHub, rebuilds and restarts:

    sudo bash /opt/showdown/server/tools/vm/update.sh

Restarting ends battles in progress, so update when it's quiet (or `/lockdown`
first). Kept across updates: accounts, ranks (`config/usergroups.csv` on the VM),
ladders and logs. Other files the server changed in `config/` take GitHub's
version; the VM's own changes stay in `git stash list` in `/opt/showdown/server`.

## Where things are

| | |
|---|---|
| `/opt/showdown/server` | game server; settings in `config/config.js` |
| `/opt/showdown/client` | client; players get `play.pokemonshowdown.com/index.html` |
| `/opt/showdown/loginserver` | login server; settings in `config/config.cjs` |
| `/opt/showdown/data/login.sqlite` | accounts (back this up) |
| `/opt/showdown/keys` | the key pair the login server signs logins with |
| `/etc/caddy/Caddyfile` | web address and routing |

Services: `showdown`, `showdown-login`, `caddy`.

    sudo systemctl restart showdown          # restart the game server
    sudo journalctl -u showdown -n 100       # its recent log
    sudo journalctl -u showdown-login -n 100 # the login server's log

## Notes

- Sprites, sounds and other images still load from play.pokemonshowdown.com
  (Caddy redirects to it for anything the client doesn't have), so they don't
  use the VM's bandwidth.
- Uploading replays to a replay site isn't set up; downloading replays works.
- After registering, players log in with their password once; after that they
  stay logged in on that browser.
