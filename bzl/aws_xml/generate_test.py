"""The wire projection must reject unsupported model changes explicitly."""

import unittest

from bzl.aws_xml.projection import generate


def model(member):
    return {
        "smithy": "2.0",
        "shapes": {
            "example#Service": {
                "type": "service",
                "traits": {
                    "aws.protocols#restXml": {},
                    "smithy.api#xmlNamespace": {"uri": "https://example.com"},
                },
            },
            "example#Read": {
                "type": "operation",
                "output": {"target": "example#Result"},
            },
            "example#Result": {"type": "structure", "members": {"Value": member}},
            "example#Unsupported": {"type": "map"},
        },
    }


class RejectedModelsTest(unittest.TestCase):
    def test_unsupported_xml_trait(self):
        source = model(
            {"target": "smithy.api#String", "traits": {"smithy.api#xmlAttribute": {}}}
        )
        with self.assertRaisesRegex(ValueError, "Unsupported XML trait"):
            generate(source, "Example", ["Read:output"])

    def test_unsupported_shape_kind(self):
        with self.assertRaisesRegex(ValueError, "Unsupported shape"):
            generate(
                model({"target": "example#Unsupported"}), "Example", ["Read:output"]
            )

    def test_ec2_request_is_not_xml(self):
        source = model({"target": "smithy.api#String"})
        source["shapes"]["example#Service"]["traits"] = {
            "aws.protocols#ec2Query": {},
            "smithy.api#xmlNamespace": {"uri": "https://example.com"},
        }
        with self.assertRaisesRegex(ValueError, "form-encoded"):
            generate(source, "Example", ["Read:input"])


if __name__ == "__main__":
    unittest.main()
