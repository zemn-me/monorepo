"""Exercise the generated archive schema through its production Go validator."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


VALIDATOR, SCHEMA = sys.argv[1:3]
del sys.argv[1:3]


class ArchiveSchemaTest(unittest.TestCase):
    def test_tuple_validation(self):
        document = {
            "tweet": {
                "edit_info": {"initial": {
                    "editTweetIds": ["1"],
                    "editableUntil": "2026-09-30T00:00:00Z",
                    "editsRemaining": "0",
                    "isEditEligible": False,
                }},
                "created_at": "2026-09-30T00:00:00Z",
                "id": "1",
                "id_str": "1",
                "full_text": "A synthetic post",
                "favorited": False,
                "source": "fixture",
                "truncated": False,
                "entities": {"hashtags": [{"text": "fixture", "indices": ["0", "7"]}]},
                "display_text_range": ["0", "16"],
                "coordinates": {"type": "Point", "coordinates": ["1", "2"]},
            },
        }
        cases = [("valid", document, True)]
        for invalid in [["0"], ["0", "16", "17"], [0, 16]]:
            candidate = copy.deepcopy(document)
            candidate["tweet"]["display_text_range"] = invalid
            cases.append((repr(invalid), candidate, False))
        nested = copy.deepcopy(document)
        nested["tweet"]["entities"]["hashtags"][0]["indices"] = [0, 7]
        cases.append(("nested tuple type", nested, False))
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp) / "post.json"
            for name, candidate, valid in cases:
                with self.subTest(name=name):
                    fixture.write_text(json.dumps(candidate))
                    result = subprocess.run(
                        [str(Path(VALIDATOR).resolve()), str(Path(SCHEMA).resolve()), str(fixture)],
                        capture_output=True, text=True,
                    )
                    self.assertEqual(result.returncode, 0 if valid else 1, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
