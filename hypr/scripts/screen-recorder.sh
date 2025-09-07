#!/bin/bash

PID_FILE="/tmp/wf-recorder.pid"

if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")"
    rm "$PID_FILE"
    notify-send "Recording Stopped"
    exit 0
fi

options="MediaAudio\nMicAudio\nSilent"
chosen=$(echo -e "$options" | rofi -dmenu -p "Start Recording")

case "$chosen" in
"MediaAudio")
    wf-recorder -r 30 -g "$(slurp)" \
        -p "crf=25" -p "preset=slow" -p "bitrate=1000k" \
        --audio=alsa_output.pci-0000_05_00.6.analog-stereo.monitor \
        -f recording.mp4 &
    echo $! >"$PID_FILE"
    ;;
"MicAudio")
    wf-recorder -r 30 -g "$(slurp)" \
        -p "crf=25" -p "preset=slow" -p "bitrate=1000k" \
        -a -f recording.mp4 &
    echo $! >"$PID_FILE"
    ;;
"Silent")
    wf-recorder -r 30 -g "$(slurp)" \
        -p "crf=25" -p "preset=slow" -p "bitrate=1000k" \
        -f recording.mp4 &
    echo $! >"$PID_FILE"
    ;;
*)
    exit 1
    ;;
esac

notify-send "Recording Started"
