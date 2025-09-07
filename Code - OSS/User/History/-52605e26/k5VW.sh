#!/bin/bash

cd "~/habit-tracker/backend" || exit 1
eval "npm run dev &"

cd "~/habit-tracker" || exit 1
eval "npm run tailwind:build &"
eval "open index.html"