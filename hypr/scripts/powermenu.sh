#!/bin/bash

# Define options for rofi
# You can add more options here, like"Suspend"
 options="Shutdown\nReboot\nLogout\nLock"

# Use rofi to display the options and get the user's choice
# You can customize the rofi command with themes, prompts, etc.
chosen=$(echo -e "$options" | rofi -dmenu -p "Power Menu")

# Execute the chosen action
case "$chosen" in
    "Shutdown")
       sudo systemctl poweroff
        ;;
    "Reboot")
        sudo systemctl reboot
        ;;
    "Logout")
        hyprctl dispatch exit
        ;;
    "Lock")
        hyprlock
        ;;
    *)
        # If the user escapes or types something invalid, do nothing
        exit 1
        ;;
esac

