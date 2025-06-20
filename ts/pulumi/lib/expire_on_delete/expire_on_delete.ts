import * as aws from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";

import { ExpireOnDeleteLambdaImage } from "#root/ts/pulumi/lib/expire_on_delete/cmd/expire_on_delete/ExpireOnDeleteLambdaImage.js";
import { LambdaFunction } from "#root/ts/pulumi/lib/lambda_function.js";
import { TagSet } from "#root/ts/pulumi/lib/tags.js";

export interface S3ExpireOnDeletePolicyArgs {
    bucketId: Input<string>;
    tags?: TagSet;
    expirationDays: Input<number>;
}

function clampString(input: string, maxLength: number): string {
    if (maxLength < 0) {
        throw new Error("maxLength must be a non-negative number");
    }
    return input.length > maxLength ? input.slice(-maxLength) : input;
}

const sanitisedStatementId = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, "_");

// Memoization cache for ExpireOnDeleteLambdaImage
const lambdaImageCache = new Map<string, ExpireOnDeleteLambdaImage>();

/**
 * Sets up an S3 bucket to expire objects after a given number of days when
 * they would otherwise be immediately deleted.
 *
 * This helps in cases where these objects are needed for a while by a CDN
 * that may not be completely up to date.
 */
export class S3ExpireOnDeletePolicy extends ComponentResource {
    public readonly lambda: aws.lambda.Function;

    constructor(name: string, args: S3ExpireOnDeletePolicyArgs, opts?: ComponentResourceOptions) {
        super("ts:pulumi:lib:expire_on_delete", name, args, opts);

        // IAM role for Lambda
        const lambdaRole = new aws.iam.Role(clampString(`${name}_Role`, 64 - 8), {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: "lambda.amazonaws.com",
            }),
        }, { parent: this });

        const bucket = output(args.bucketId).apply(
            i => aws.s3.getBucket({
                bucket: i
            })
        );

        // Attach the AWS Lambda Basic Execution role for logging
        new aws.iam.RolePolicyAttachment(`${name}-lambdaLoggingPolicy`, {
            role: lambdaRole.name,
            policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
        }, { parent: this });

        new aws.s3.BucketVersioningV2(`${name}_versioningpolicy`, {
            bucket: args.bucketId,
            versioningConfiguration: {
                status: "Enabled",
            }
        }, { parent: this });

        const repo = new aws.ecr.Repository(`${name}_repo`, {
            forceDelete: true,
            tags: args.tags,
        }, { parent: this });

        const auth = aws.ecr.getAuthorizationToken();

        const imageCacheKey = `${repo.repositoryUrl}`;

        let image = lambdaImageCache.get(imageCacheKey);
        if (!image) {
            image = new ExpireOnDeleteLambdaImage(`expireOnDeleteLambdaImage`, {
                repository: repo.repositoryUrl,
                token: auth.then(auth => auth.authorizationToken),
            }, { parent: this });
            lambdaImageCache.set(imageCacheKey, image);
        }

        // Create the Lambda function
        this.lambda = new LambdaFunction(clampString(`${name}-lambda`, 64 - 8), {
            packageType: "Image",
            role: lambdaRole.arn,
            imageUri: image.url,
            timeout: 30,
            memorySize: 512,
            tags: args.tags,
        }, { parent: this }).function;

        // Grant the Lambda permissions to access the S3 bucket
        const lambdaBucketPolicy = new aws.iam.Policy(`${name}-lambdaBucketPolicy`, {
            description: "Policy for Lambda to access S3 bucket",
            policy: output(bucket).apply(bucket =>
                JSON.stringify({
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Action: ["s3:GetObject", "s3:PutObjectTagging", "s3:ListBucket"],
                            Effect: "Allow",
                            Resource: [`${bucket.arn}/*`, bucket.arn],
                        },
                    ],
                })
            ),
        }, { parent: this });

        new aws.iam.RolePolicyAttachment(`${name}-lambdaBucketPolicyAttachment`, {
            role: lambdaRole.name,
            policyArn: lambdaBucketPolicy.arn,
        }, { parent: this });

        // Allow S3 to invoke the Lambda
        const allowPerm = new aws.lambda.Permission(clampString(sanitisedStatementId(`${name}-lambdaS3InvokePermission`), 100 - 10), {
            action: "lambda:InvokeFunction",
            function: this.lambda.name,
            principal: "s3.amazonaws.com",
            sourceArn: output(bucket).apply(b => b.arn),
        }, { parent: this });

        // Add an S3 bucket notification to invoke the Lambda on delete events
        new aws.s3.BucketNotification(`${name}-bucketNotification`, {
            bucket: args.bucketId,
            lambdaFunctions: [
                {
                    lambdaFunctionArn: this.lambda.arn,
                    events: ["s3:ObjectRemoved:*"],
                },
            ],
        }, { dependsOn: [this.lambda, allowPerm], parent: this });

        // Add a lifecycle policy to the bucket
        new aws.s3.BucketLifecycleConfigurationV2(`${name}-bucketLifecycle`, {
            bucket: args.bucketId,
            rules: [
                {
                    id: "ExpireSoftDeletedObjects",
                    filter: {
                        tag: {
                            key: "soft_deleted",
                            value: "true",
                        },
                        objectSizeGreaterThan: 0,
                    },
                    status: "Enabled",
                    expiration: {
                        days: args.expirationDays,
                    },
                },
            ],
        }, { parent: this });

        this.registerOutputs({
            lambdaName: this.lambda.name,
        });
    }
}
