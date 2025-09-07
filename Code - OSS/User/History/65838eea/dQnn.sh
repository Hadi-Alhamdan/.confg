#!/bin/bash

cd "$HOME/habit-tracker/backend" || { exit 1; }
npm run dev &

cd "$HOME/habit-tracker" || {  exit 1; }

npm run tailwind:build & 

if command -v xdg-open &> /dev/null; then
    xdg-open index.html & # Background xdg-open so script continues
elif command -v open &> /dev/null; then # macOS
    open index.html &
else
    start index.html &
fi



