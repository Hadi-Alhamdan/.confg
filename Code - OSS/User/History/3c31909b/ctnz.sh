#!/bin/sh
# Manually set the PATH before launching rofi
export PATH="$HOME/.local/bin:$PATH"
rofi "$@"