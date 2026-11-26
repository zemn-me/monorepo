"""Build population-ranked GeoNames shards for local prefix search and ID lookup."""

import csv
import gzip
import json
import sys
import unicodedata
import zipfile
from pathlib import Path


def fold(name):
    return "".join(
        char for char in unicodedata.normalize("NFKD", name.lower())
        if not unicodedata.category(char).startswith("M")
    ).strip()


def build(archive, region_file, outputs):
    with zipfile.ZipFile(archive) as source:
        cities = json.loads(source.read("geonamescache/data/cities500.json"))
        countries = json.loads(source.read("geonamescache/data/countries.json"))
    with open(region_file, encoding="utf-8") as source:
        regions = {row[0]: row[1] for row in csv.reader(source, delimiter="\t")}
    shards = [[] for _ in outputs]
    for city in sorted(cities.values(), key=lambda c: -c["population"]):
        if not city["timezone"]:
            continue
        city_id = city["geonameid"]
        names = {fold(n) for n in [city["name"], *city["alternatenames"]]}
        groups = {city_id % len(outputs): []}
        for name in sorted(names):
            if len(name) >= 2:
                key = (ord(name[0]) * 31 + ord(name[1])) % len(outputs)
                groups.setdefault(key, []).append(name)
        cc = city["countrycode"]
        record = [city_id, city["name"], regions.get(cc + "." + city["admin1code"], ""),
                  countries.get(cc, {}).get("name", cc), city["latitude"],
                  city["longitude"], city["timezone"]]
        for key, aliases in groups.items():
            shards[key].append([*record, aliases])
    for output, rows in zip(outputs, shards, strict=True):
        data = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode()
        Path(output).write_bytes(gzip.compress(data, compresslevel=6, mtime=0))


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], sys.argv[3:])
