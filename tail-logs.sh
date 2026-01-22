#!/bin/bash

# Tail Logs Script
# Watches both agent and frontend logs in real-time

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log files
AGENT_LOG="agent.log"
FRONTEND_LOG="frontend.log"

echo -e "${BLUE}Research Canvas - Log Viewer${NC}"
echo "======================================"
echo ""

# Check if logs exist
AGENT_EXISTS=false
FRONTEND_EXISTS=false

if [ -f "$AGENT_LOG" ]; then
    AGENT_EXISTS=true
fi

if [ -f "$FRONTEND_LOG" ]; then
    FRONTEND_EXISTS=true
fi

if [ "$AGENT_EXISTS" = false ] && [ "$FRONTEND_EXISTS" = false ]; then
    echo -e "${YELLOW}No log files found yet.${NC}"
    echo "Start the development server first: ./start-dev.sh"
    exit 0
fi

echo -e "${BLUE}Watching logs (Ctrl+C to stop)${NC}"
echo -e "${CYAN}[AGENT]${NC} - Python agent logs"
echo -e "${GREEN}[FRONTEND]${NC} - Frontend logs"
echo ""

# Use tail with labels
# The -F flag follows files and retries if they don't exist yet
TAIL_CMD=""

if [ "$AGENT_EXISTS" = true ]; then
    TAIL_CMD="tail -F $AGENT_LOG"
fi

if [ "$FRONTEND_EXISTS" = true ]; then
    if [ -n "$TAIL_CMD" ]; then
        TAIL_CMD="$TAIL_CMD & tail -F $FRONTEND_LOG"
    else
        TAIL_CMD="tail -F $FRONTEND_LOG"
    fi
fi

# Simple approach: use tail with sed to add prefixes and colors
if [ "$AGENT_EXISTS" = true ] && [ "$FRONTEND_EXISTS" = true ]; then
    # Both logs exist - tail them together with labels
    (tail -F "$AGENT_LOG" 2>/dev/null | sed "s/^/$(printf '\033[0;36m')[AGENT]$(printf '\033[0m') /" &
     tail -F "$FRONTEND_LOG" 2>/dev/null | sed "s/^/$(printf '\033[0;32m')[FRONTEND]$(printf '\033[0m') /") | cat
elif [ "$AGENT_EXISTS" = true ]; then
    # Only agent log
    tail -F "$AGENT_LOG" 2>/dev/null | sed "s/^/$(printf '\033[0;36m')[AGENT]$(printf '\033[0m') /"
else
    # Only frontend log
    tail -F "$FRONTEND_LOG" 2>/dev/null | sed "s/^/$(printf '\033[0;32m')[FRONTEND]$(printf '\033[0m') /"
fi
