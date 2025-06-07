import csv
import json
import os
from os import environ
from typing import Optional

from python.runfiles import runfiles

r = runfiles.Create()


def is_northern_hemisphere(latitude) -> Optional[bool]:
    if latitude.startswith('+'):
        return True
    elif latitude.startswith('-'):
        return False
    else:
        return None

# Parse the file and generate the JSON mapping
def parse_tzdb_to_json(input_file):
    timezone_mapping = {}

    with open(input_file, 'r', encoding='utf-8') as file:
        # Create a CSV reader, skipping lines that start with '#'
        reader = csv.reader((line for line in file if not line.startswith('#')), delimiter='\t')
        for row in reader:
            if len(row) < 3:
                continue  # Skip malformed rows

            coordinates, tz_name = row[1], row[2]
            latitude = coordinates[:7]  # Extract latitude from coordinates
            northern_hemisphere = is_northern_hemisphere(latitude)
            timezone_mapping[tz_name] = northern_hemisphere

    # Print the JSON mapping to stdout
    print(json.dumps(timezone_mapping, indent=2))

# Input file name
zone_tab = environ.get("ZONE_TAB")
if zone_tab and os.path.isabs(zone_tab):
    input_file = zone_tab
else:
    if not zone_tab:
        # Default to the tzdb shipped with this repository. If the code is executed
        # as a tool within another rule, the `ZONE_TAB` environment variable may
        # not be set, so resolve the runfile relative to the current repository.
        try:
            repo = r.CurrentRepository()
        except Exception:
            repo = ""
        if repo:
            zone_tab = f"{repo}/etc/zone1970.tab"
        else:
            zone_tab = "etc/zone1970.tab"
    input_file = r.Rlocation(zone_tab) if zone_tab else r.Rlocation("etc/zone1970.tab")

# Run the script
parse_tzdb_to_json(input_file)
