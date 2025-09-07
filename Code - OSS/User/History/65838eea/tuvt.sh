#!/bin/bash

BACKEND_PID=""
TAILWIND_PID=""

echo "Starting backend server..."
cd "$HOME/habit-tracker/backend" || { echo "Failed to cd to backend directory"; exit 1; }
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Building/watching Tailwind CSS..."
cd "$HOME/habit-tracker" || { echo "Failed to cd to project root directory"; exit 1; }

npm run tailwind:build & 
TAILWIND_PID=$!
echo "Tailwind PID: $TAILWIND_PID"
sleep 1 # Give watchers a moment to start and do an initial build

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


