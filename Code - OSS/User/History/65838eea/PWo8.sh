#!/bin/bash

cd "$HOME/habit-tracker/backend" || { exit 1; }
npm run dev &

cd "$HOME/habit-tracker" || {  exit 1; }

npm run tailwind:build & 

xdg-open index.html & 




