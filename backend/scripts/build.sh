#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing backend dependencies..."
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir

echo "==> Building the React frontend..."
cd frontend
npm ci --no-audit --no-fund --loglevel=error
npm run build

echo "==> Done. Backend will serve frontend/dist + /api on the same port."
