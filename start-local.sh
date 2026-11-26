#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"
printf '\nSONORA è disponibile su: http://localhost:%s\n' "$PORT"
printf 'Per interrompere il server premi Ctrl+C.\n\n'
python3 -m http.server "$PORT"
