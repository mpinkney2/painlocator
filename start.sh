#!/bin/bash
# Start PainLocator dev server from the correct directory.
# Usage: ./start.sh [port]   (default port: 5500)

PORT="${1:-5500}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting PainLocator at http://localhost:$PORT"
echo "Serving from: $DIR"
echo ""
echo "Press Ctrl+C to stop."
echo ""

cd "$DIR" || exit 1
python3 -m http.server "$PORT"
