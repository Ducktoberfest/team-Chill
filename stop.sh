#!/usr/bin/env bash
# Stop the ChillDesk backend and tunnel started by start.sh (Ollama is left running).
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" && echo "backend stopped" || echo "backend was not running"
pkill -f "cloudflared tunnel --url http://127.0.0.1:8000" && echo "tunnel stopped" || echo "tunnel was not running"
