"""
This lambda function will cause versioned objects to expire after some time
instead of being immediately deleted.

The purpose of this is so that items in a CDN (CloudFront) backing store
can be removed once the updates to the CDN are totally propagated, or
I guess some reasonable time after which someone would probably have
refreshed.


"""

# gazelle:include_dep @pip//boto3_stubs
import boto3
from datetime import datetime, timedelta
from typing import Dict
from aws_lambda_typing.events import S3Event
from aws_lambda_typing.context import Context
# gazelle:include_dep @pip//botocore_stubs
from botocore.client import BaseClient

def lambda_handler(event: S3Event, context: Context) -> Dict[str, str]:
	"""
	Lambda function triggered by S3 delete marker creation.
	It removes the delete marker, sets an expiration tag on the object.

	Args:
		event (S3Event): The delete event triggered by S3.
		context (Context): Lambda context.

	Returns:
		Dict[str, str]: Success or error message.
	"""
	s3_client: BaseClient = boto3.client('s3')
	expiration_days: int = 7

	# Extract bucket name and object key from the event
	record = event['Records'][0]
	bucket_name: str = record['s3']['bucket']['name']
	object_key: str = record['s3']['object']['key']
	version_id: str = record['s3']['object']['versionId']

	try:
		# Check if this event corresponds to a delete marker
		object_metadata = s3_client.head_object(Bucket=bucket_name, Key=object_key, VersionId=version_id)
		if object_metadata.get('DeleteMarker', False):
			# Remove the delete marker
			s3_client.delete_object(Bucket=bucket_name, Key=object_key, VersionId=version_id)
			print(f"Removed delete marker for {object_key} in {bucket_name}")

			# Calculate the expiration date
			expiration_date: str = (datetime.now() + timedelta(days=expiration_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

			# Add an expiration tag to the object
			s3_client.put_object_tagging(
				Bucket=bucket_name,
				Key=object_key,
				Tagging={
					'TagSet': [
						{'Key': 'ExpireOn', 'Value': expiration_date}
					]
				}
			)
			print(f"Set expiration tag for {object_key} to {expiration_date}")

			return {
				'statusCode': 200,
				'body': f"Removed delete marker and set expiration for {object_key}."
			}

	except Exception as e:
		print(f"Error handling delete marker for {object_key}: {e}")
		return {
			'statusCode': 500,
			'body': f"Error: {str(e)}"
		}

	return {}

