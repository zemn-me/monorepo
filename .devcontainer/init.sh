#!/usr/bin/env bash

export NONINTERACTIVE=1

# install brew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# install sapling
brew install --build-from-source sapling
