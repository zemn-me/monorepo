import argparse

from py.doom.wad import generate

parser = argparse.ArgumentParser()
parser.add_argument('--archive', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--map', default='E1M1')
args = parser.parse_args()
generate(args.archive, args.output, args.map)
