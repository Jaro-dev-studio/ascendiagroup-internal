#!/usr/bin/env bash
set -euo pipefail

cd /workspace

echo "[install] node $(node --version), pnpm $(pnpm --version)"

# The repo's tsx scripts all run with `--env-file=.env`, which aborts when the file
# is missing. Real values arrive as injected environment variables, so an empty
# placeholder is enough to make those scripts runnable.
if [ ! -f .env ]; then
  echo "[install] creating empty .env placeholder for --env-file scripts"
  : > .env
fi

# pnpm-lock.yaml is gitignored in this repo, so dependencies always resolve fresh.
echo "[install] installing dependencies..."
pnpm install

echo "[install] generating Prisma client..."
pnpm exec prisma generate

echo "[install] done"
