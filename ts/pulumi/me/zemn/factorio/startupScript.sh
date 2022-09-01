#!/usr/bin/env bash

# See https://hub.docker.com/r/factoriotools/factorio/

set -e

function apt {
    DEBIAN_FRONTEND=noninteractive sudo apt -yqq $@
}

echo Installing docker server...
apt update
apt install docker

# mount the ebs volume in opt
sudo ln -s /dev/sdh /opt/factorio
sudo chown 845:845 /opt/factorio

sudo docker pull factoriotools/factorio

sudo docker run -d \
  -p 34197:34197/udp \
  -p 27015:27015/tcp \
  -v /opt/factorio:/factorio \
  --name factorio \
  --restart=always \
  factoriotools/factorio

