#!/bin/bash

BACKEND_PID=""
TAILWIND_PID=""

# Function to clean up background processes on exit
cleanup() {
    echo
    echo "Cleaning up background processes..."
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        if kill "$BACKEND_PID" 2>/dev/null; then
            wait "$BACKEND_PID" 2>/dev/null
            echo "Backend stopped."
        else
            echo "Backend (PID: $BACKEND_PID) was not running or couldn't be killed."
        fi
        BACKEND_PID="" # Clear it
    fi
    if [ -n "$TAILWIND_PID" ]; then
        echo "Stopping Tailwind (PID: $TAILWIND_PID)..."
        if kill "$TAILWIND_PID" 2>/dev/null; then
            wait "$TAILWIND_PID" 2>/dev/null
            echo "Tailwind stopped."
        else
            echo "Tailwind (PID: $TAILWIND_PID) was not running or couldn't be killed."
        fi
        TAILWIND_PID="" # Clear it
    fi
    echo "Cleanup complete."
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

echo "Starting backend server..."
cd "$HOME/habit-tracker/backend" || { echo "Failed to cd to backend directory"; exit 1; }
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Building/watching Tailwind CSS..."
cd "$HOME/habit-tracker" || { echo "Failed to cd to project root directory"; exit 1; }

npm run tailwind:build & # Assuming this is a watch process
TAILWIND_PID=$!
echo "Tailwind PID: $TAILWIND_PID"
sleep 2 # Give watchers a moment to start and do an initial build

echo "Opening index.html..."
if command -v xdg-open &> /dev/null; then
    xdg-open index.html & # Background xdg-open so script continues
elif command -v open &> /dev/null; then # macOS
    open index.html &
elif command -v start &> /dev/null; then # Windows (usually from Git Bash or WSL)
    start index.html &
else
    echo "Could not find xdg-open, open, or start to open index.html"
fi

echo
echo "Development environment started."
echo "Backend is running (PID: $BACKEND_PID)."
if [ -n "$TAILWIND_PID" ]; then
    echo "Tailwind is watching (PID: $TAILWIND_PID)."
fi
echo "The page index.html should be open in your browser."
echo ">>> Press Ctrl+C in this terminal to stop all processes and exit. <<<"


wait "$BACKEND_PID"

echo "Backend process exited."
cleanup