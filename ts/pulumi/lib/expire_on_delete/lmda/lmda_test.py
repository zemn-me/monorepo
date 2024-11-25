import json
# gazelle:include_dep @pip//boto3_stubs
import boto3
from unittest.mock import MagicMock
from ts.pulumi.lib.expire_on_delete.lmda.lib import lambda_handler


def test_lambda_handler():
    # Mock S3 event
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": "test-object", "versionId": "test-version-id"}
                }
            }
        ]
    }
    context = MagicMock()  # Mock Lambda context if needed

    # Mock boto3 client
    boto3.client = MagicMock()
    s3_client = boto3.client("s3")

    # Simulate head_object response indicating a delete marker
    s3_client.head_object.return_value = {"DeleteMarker": True}
    # Simulate successful delete_object and put_object_tagging responses
    s3_client.delete_object.return_value = {}
    s3_client.put_object_tagging.return_value = {}

    # Run the function
    response = lambda_handler(event, context)
    print(json.dumps(response, indent=2))

# Call the test
test_lambda_handler()

