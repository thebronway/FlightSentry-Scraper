#!/bin/sh
set -e

mkdir -p /app/data /app/data/chrome-profile
chown -R node:node /app/data 2>/dev/null || true

export HOSTNAME=0.0.0.0
export PORT="${PORT:-4001}"

exec su -s /bin/sh node -c "$*"