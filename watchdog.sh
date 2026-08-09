#!/bin/bash
# Watchdog script to keep Next.js dev server alive
cd /home/z/my-project

while true; do
  if ! ss -tlnp | grep -q ':3000'; then
    echo "[$(date)] Server down, restarting..." >> /home/z/my-project/dev.log
    > /tmp/next-server.log
    setsid sh -c 'exec bun run dev >> /home/z/my-project/dev.log 2>&1' 2>/dev/null &
    sleep 15
  fi
  sleep 3
done
