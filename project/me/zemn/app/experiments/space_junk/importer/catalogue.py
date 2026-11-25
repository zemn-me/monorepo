"""Select dated Earth-orbit free-flight phases from McDowell's GCAT."""

import csv
from datetime import datetime
import json
import re
import sys


def iso_date(value):
    # GCAT also has ranges, approximate days and month-only dates. Keep only
    # definite days; retain a clock time only if it too is definite.
    match = re.fullmatch(r"(\d{4} [A-Z][a-z]{2} +\d{1,2})(?: +(\d{4})(\?)?)?", value)
    if not match:
        return None
    day = datetime.strptime(match[1], "%Y %b %d").date().isoformat()
    if match[2] and not match[3]:
        return day + "T" + match[2][:2] + ":" + match[2][2:]
    return day


def read_catalogue(stream):
    columns = next(stream).strip().split("\t")
    updated = next(stream).split()
    as_of = datetime.strptime(" ".join(updated[2:5]), "%Y %b %d").date().isoformat()
    objects = []
    for row in csv.DictReader(stream, fieldnames=columns, delimiter="\t"):
        kind = row["Type"].strip()
        number = row["Satcat"].strip()
        if not number.isdecimal() or row["Primary"].strip() != "Earth":
            continue
        if kind[:1] not in {"C", "D", "R"}:
            continue
        start = iso_date(row["SDate"].strip())
        end = iso_date(row["DDate"].strip())
        # A lost object or a phase with an unknown end is not an open orbit.
        if not start or (not end and (row["DDate"].strip() != "-" or row["Status"].strip() != "O")):
            continue
        if end and end[:10] < start[:10]:
            continue
        objects.append({
            "id": int(number),
            "name": row["Name"].strip(),
            "piece": row["Piece"].strip(),
            "kind": kind[:1],
            "eva": kind.startswith("C  H E"),
            "start": start,
            "end": end,
        })
    return {"asOf": as_of, "objects": objects}


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as source, open(sys.argv[2], "w", encoding="utf-8") as output:
        json.dump(read_catalogue(source), output, ensure_ascii=False, separators=(",", ":"))
