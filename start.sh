#!/usr/bin/env bash
# Start ChillDesk for a demo: backend, Ollama, public tunnel for the ElevenLabs voice agent, browser tabs.
# Services that are already running are reused. Everything is detached, so closing this window keeps it running.
set -u
cd "$(dirname "$(readlink -f "$0")")"
ROOT=$PWD
LOGS="$ROOT/.run"; mkdir -p "$LOGS"
AGENT_URL="https://elevenlabs.io/app/agents/agents/agent_9701m4n0fvv3fxfvp13knx1xcdqm/agent"
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; B='\033[1m'; N='\033[0m'
ok()   { printf "  ${G}OK${N}    %s\n" "$1"; }
warn() { printf "  ${Y}NOTE${N}  %s\n" "$1"; }
fail() { printf "  ${R}FAIL${N}  %s\n" "$1"; }

printf "\n${B}ChillDesk · Mallard — starting${N}\n\n"

# 1. Ollama (EmbeddingGemma for the knowledge base, local Gemma 4 fallback)
if curl -s -o /dev/null localhost:11434; then ok "Ollama is running"
else
  setsid nohup ollama serve >"$LOGS/ollama.log" 2>&1 < /dev/null &
  for _ in $(seq 20); do curl -s -o /dev/null localhost:11434 && break; sleep 0.5; done
  curl -s -o /dev/null localhost:11434 && ok "Ollama started" || fail "Ollama did not start (see .run/ollama.log)"
fi

# 2. Backend (FastAPI on :8000)
if curl -s -o /dev/null localhost:8000/api/config; then ok "Backend is running on :8000"
else
  ( cd backend && setsid nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 >"$LOGS/backend.log" 2>&1 < /dev/null & )
  for _ in $(seq 40); do curl -s -o /dev/null localhost:8000/api/config && break; sleep 0.5; done
  curl -s -o /dev/null localhost:8000/api/config && ok "Backend started on :8000" || { fail "Backend did not start (see .run/backend.log)"; }
fi

# 3. Public tunnel for the ElevenLabs Custom LLM
URL=""
if pgrep -f "cloudflared tunnel --url http://127.0.0.1:8000" >/dev/null; then
  URL=$(cat "$LOGS/tunnel_url" 2>/dev/null)
  [ -n "$URL" ] && curl -s -o /dev/null -m 8 "$URL/api/config" || URL=""
  if [ -z "$URL" ]; then
    # a tunnel from an earlier session whose URL we don't know: replace it
    pkill -f "cloudflared tunnel --url http://127.0.0.1:8000"; sleep 1
  fi
fi
if [ -z "$URL" ]; then
  setsid nohup cloudflared tunnel --url http://127.0.0.1:8000 >"$LOGS/tunnel.log" 2>&1 < /dev/null &
  for _ in $(seq 40); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1); [ -n "$URL" ] && break; sleep 0.5; done
fi
OLD=$(cat "$LOGS/tunnel_url" 2>/dev/null)
if [ -n "$URL" ]; then
  echo "$URL" > "$LOGS/tunnel_url"
  if [ "$URL" = "$OLD" ]; then ok "Tunnel: $URL (unchanged, voice agent is already set)"
  else
    ok "Tunnel: $URL"
    printf "%s/v1" "$URL" | wl-copy 2>/dev/null || printf "%s/v1" "$URL" | xclip -selection clipboard 2>/dev/null
    warn "New tunnel URL. In ElevenLabs: Agent → LLM → Server URL → paste (already copied):"
    printf "        ${B}%s/v1${N}   then press Publish.\n" "$URL"
    notify-send -a ChillDesk "ChillDesk: update the voice agent" "Paste $URL/v1 as the Custom LLM Server URL in ElevenLabs, then Publish. (Copied to clipboard.)" 2>/dev/null
    xdg-open "$AGENT_URL" >/dev/null 2>&1 &
  fi
else
  fail "Tunnel did not start (see .run/tunnel.log). Chat still works; only the voice call needs it."
fi

# 4. Open the store and the dashboard
xdg-open "http://localhost:8000/?t=$(date +%s)" >/dev/null 2>&1 &
sleep 0.4
xdg-open "http://localhost:8000/dashboard" >/dev/null 2>&1 &

printf "\n  Store      ${B}http://localhost:8000${N}\n  Dashboard  ${B}http://localhost:8000/dashboard${N}\n  Demo       demo/DEMO.md\n"
printf "\n  Services keep running after this window closes. To stop them: ${B}./stop.sh${N}\n\n"
read -r -t 600 -p "  Press Enter to close this window." _ || true
