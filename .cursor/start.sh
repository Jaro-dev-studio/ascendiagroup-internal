#!/usr/bin/env bash
set -euo pipefail

cd /workspace

RUN_DIR=/tmp/jaro-studio
LOG_FILE="$RUN_DIR/dev-server.log"
PID_FILE="$RUN_DIR/dev-server.pid"
PORT=3000
BASE_URL="http://localhost:${PORT}"
HEALTH_URL="${BASE_URL}/api/auth/csrf"
mkdir -p "$RUN_DIR"

# POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING point at the shared live database,
# so nothing here creates, migrates or seeds schema. `prisma db push`, `prisma
# migrate` and any destructive SQL are deliberately absent and must stay out.
echo "[start] checking live database connectivity (read-only)..."
if node --input-type=module -e '
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.$queryRaw`SELECT 1`;
await prisma.$disconnect();
' >/dev/null 2>&1; then
  echo "[start] database reachable"
else
  echo "[start] WARNING: database unreachable - check the POSTGRES_* secrets. Continuing anyway."
fi

# A server already answering on $PORT is the real success condition. Reuse it rather
# than stacking a second `next dev`, which would silently bind a different port.
if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" 2>/dev/null; then
  echo "[start] dev server already responding on $BASE_URL"
  exit 0
fi

running_pid=""
if [ -f "$PID_FILE" ]; then
  candidate=$(cat "$PID_FILE")
  # Match the command line too, so a recycled PID is never mistaken for the server.
  if kill -0 "$candidate" 2>/dev/null &&
    tr '\0' ' ' <"/proc/$candidate/cmdline" 2>/dev/null | grep -qE 'pnpm|next'; then
    running_pid="$candidate"
  fi
fi

if [ -n "$running_pid" ]; then
  echo "[start] dev server already running (pid $running_pid)"
else
  echo "[start] starting next dev on port $PORT, logs at $LOG_FILE"
  nohup pnpm dev --port "$PORT" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
fi

echo "[start] waiting for the dev server to answer requests..."
for attempt in $(seq 1 90); do
  if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" 2>/dev/null; then
    echo "[start] dev server ready after ${attempt}s: $BASE_URL"
    exit 0
  fi
  sleep 1
done

echo "[start] ERROR: dev server did not become ready within 90s. Last log lines:"
tail -n 40 "$LOG_FILE" || true
exit 1
