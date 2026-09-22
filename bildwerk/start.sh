#!/bin/sh
# Bildwerk lokal starten: kleiner Webserver, damit der Browser die
# JavaScript-Module laden darf. Es geht nichts ins Internet.
set -e
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=${1:-8777}

if command -v python3 >/dev/null 2>&1; then
  SERVER="python3 -m http.server $PORT --bind 127.0.0.1 --directory $DIR"
elif command -v python >/dev/null 2>&1; then
  SERVER="python -m http.server $PORT --bind 127.0.0.1 --directory $DIR"
elif command -v npx >/dev/null 2>&1; then
  SERVER="npx --yes http-server $DIR -p $PORT -a 127.0.0.1"
else
  echo "Weder Python noch Node gefunden."
  echo "Alternative ohne Server: bildwerk-standalone.html im Browser oeffnen"
  echo "(erzeugen mit: python3 tools/build-standalone.py)."
  exit 1
fi

URL="http://127.0.0.1:$PORT/"
echo "Bildwerk laeuft auf $URL  (Beenden mit Strg+C)"
(sleep 1
 for OPEN in xdg-open open start; do
   command -v $OPEN >/dev/null 2>&1 && $OPEN "$URL" >/dev/null 2>&1 && break
 done) &
exec $SERVER
