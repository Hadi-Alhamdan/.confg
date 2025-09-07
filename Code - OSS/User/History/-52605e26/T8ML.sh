#!/bin/bash

cd "$HOME/habit-tracker/backend" || exit 1
eval "npm run dev &"

cd "$HOME/habit-tracker" || exit 1
eval "npm run tailwind:build &"
eval "open index.html"