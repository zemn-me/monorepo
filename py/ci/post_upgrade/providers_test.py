import unittest

from py.ci.post_upgrade.providers import synchronize


class ProvidersTest(unittest.TestCase):
    def test_all_provider_pins_follow_sdk_updates(self):
        source = 'PULUMI_AWS_PROVIDER_VERSION = "1.0.0"\nPULUMI_RANDOM_PROVIDER_VERSION = "2.0.0"\n'
        manifest = {"dependencies": {"@pulumi/aws": "9.12.3", "@pulumi/random": "6.2.1"}}
        updated = synchronize(source, manifest)
        self.assertEqual(updated, source.replace('"1.0.0"', '"9.12.3"').replace('"2.0.0"', '"6.2.1"'))
        self.assertEqual(synchronize(updated, manifest), updated)

    def test_missing_or_ambiguous_sdk_cannot_publish_a_provider(self):
        for version in (None, "^9.0.0", "latest", "9.0", "9.0.0+metadata"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                synchronize('PULUMI_GCP_PROVIDER_VERSION = "1.0.0"', {"dependencies": {"@pulumi/gcp": version}})

    def test_conflicting_manifest_sections_are_rejected(self):
        with self.assertRaises(ValueError):
            synchronize('PULUMI_AWS_PROVIDER_VERSION = "1.0.0"', {
                "dependencies": {"@pulumi/aws": "2.0.0"},
                "devDependencies": {"@pulumi/aws": "3.0.0"},
            })


if __name__ == "__main__":
    unittest.main()
