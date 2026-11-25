import io
import unittest

from project.me.zemn.app.experiments.space_junk.importer.catalogue import read_catalogue


class CatalogueTest(unittest.TestCase):
    def test_dates_and_collections(self):
        source = io.StringIO(
            "Satcat\tType\tName\tPiece\tPrimary\tSDate\tDDate\tStatus\n"
            "# Updated 2026 Nov 23\n"
            "29257\tC  H E\tspatula\t1998-067AJ\tEarth\t2006 Jul 12 0810?\t2006 Sep 29\tR\n"
            "14670\tP\tShiyan Weixing\t1984-008A\tEarth\t1984 Jan 29 1241?\t-\tO\n"
            "7\tD\tfragment\t-\tEarth\t2000 Feb 29 0914\t-\tOX\n"
            "8\tD\tfragment\t-\tEarth\t2000 Feb 29 0914\t2001 Jan 1?\tR\n"
        )
        catalogue = read_catalogue(source)
        self.assertEqual(catalogue["asOf"], "2026-11-23")
        self.assertEqual([obj["id"] for obj in catalogue["objects"]], [29257])
        spatula = catalogue["objects"][0]
        self.assertEqual((spatula["start"], spatula["end"], spatula["eva"]),
                         ("2006-07-12", "2006-09-29", True))
        self.assertEqual([obj["name"] for obj in catalogue["originals"]], ["STTW-T1"])


if __name__ == "__main__":
    unittest.main()
