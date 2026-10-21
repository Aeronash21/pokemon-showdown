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

# Re-running the installer updates everything; it's run from a copy because
# the update replaces the original while it runs.
cp /opt/showdown/server/tools/vm/install.sh /tmp/showdown-install.sh
exec bash /tmp/showdown-install.sh "$DOMAIN"
