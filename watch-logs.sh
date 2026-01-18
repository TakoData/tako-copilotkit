#!/bin/bash

# Watch Tako CopilotKit Development Logs
# This script tails the active log files from the background processes

LOG_DIR="/private/tmp/claude/-Users-robertabbott-Desktop-tako-copilotkit/tasks"

# Find the most recent log file
LATEST_LOG=$(ls -t "$LOG_DIR"/*.output 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "No log files found in $LOG_DIR"
    exit 1
fi

echo "================================================"
echo "Watching Tako CopilotKit Logs"
echo "================================================"
echo "Log file: $LATEST_LOG"
echo "Press Ctrl+C to stop"
echo "================================================"
echo ""

# Tail the log file with colored output
tail -f "$LATEST_LOG" | while read -r line; do
    case "$line" in
        *"[ui]"*)
            # Blue for UI logs
            echo -e "\033[0;34m$line\033[0m"
            ;;
        *"[agent]"*)
            # Red for agent logs
            echo -e "\033[0;31m$line\033[0m"
            ;;
        *"ERROR"*|*"Error"*|*"error"*)
            # Bold red for errors
            echo -e "\033[1;31m$line\033[0m"
            ;;
        *"WARNING"*|*"Warning"*)
            # Yellow for warnings
            echo -e "\033[0;33m$line\033[0m"
            ;;
        *"✓"*|*"SUCCESS"*|*"success"*)
            # Green for success
            echo -e "\033[0;32m$line\033[0m"
            ;;
        *)
            # Default color
            echo "$line"
            ;;
    esac
done
