#!/bin/bash

old_pwd=$(pwd)
dir="$(dirname "$0")"

echo "Create ~/.jackrc file"

# echo "/usr/bin/jackd -P95 -dalsa -dhw:sndrpihifiberry,0 -r48000 -p2048" > "/home/pi/.jackdrc"
# chmod u+x /home/pi/.jackdrc

cd $dir

service="jack-daemon.service"

echo "Registering \"$service\""

sudo cp "$service" /etc/systemd/system/

sudo systemctl enable "$service"
sudo systemctl daemon-reload
sudo systemctl start "$service"

echo "Enabled and Started \"$service\""
