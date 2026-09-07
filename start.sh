#!/bin/bash
# Start PainLocator dev server (Vite — matches Vercel public asset paths).
# Usage: ./start.sh [port]   (default / forced repo port: 5500)

PORT="${1:-5500}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting PainLocator at http://localhost:$PORT"
echo "Serving from: $DIR"
echo ""
echo "Press Ctrl+C to stop."
echo ""

cd "$DIR" || exit 1

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Fail if another process already owns the port (do not silently hop).
exec npx vite --host 0.0.0.0 --port "$PORT" --strictPort
