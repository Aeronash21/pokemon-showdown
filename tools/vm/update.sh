#!/usr/bin/env bash
#
# Updates the self-hosted VM: pulls the newest game server and client from
# GitHub, rebuilds them and restarts. Accounts, ranks, ladders and logs are kept.
#
# Usage, on the VM:  sudo bash /opt/showdown/server/tools/vm/update.sh
#
# Restarting ends any battles in progress, so update when it's quiet (or use
# /lockdown on the server first and wait for battles to finish).

set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Run it with sudo:  sudo bash $0"; exit 1; }
DOMAIN=$(cat /opt/showdown/domain 2>/dev/null || true)
[[ -n "$DOMAIN" ]] || { echo "Couldn't find /opt/showdown/domain. Run install.sh again with your web address instead."; exit 1; }

# Re-running the installer updates everything. Use the newest one from GitHub
# (so fixes to the installer itself apply straight away), or this VM's copy if
# GitHub can't be reached.
if ! curl -fsSL --max-time 30 -o /tmp/showdown-install.sh \
	https://raw.githubusercontent.com/Aeronash21/pokemon-showdown/master/tools/vm/install.sh; then
	echo "Couldn't download the newest installer; using this VM's copy."
	cp /opt/showdown/server/tools/vm/install.sh /tmp/showdown-install.sh
fi
exec bash /tmp/showdown-install.sh "$DOMAIN"
