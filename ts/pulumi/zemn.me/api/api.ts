import * as aws from "@pulumi/aws";
import * as Pulumi from '@pulumi/pulumi';

import Certificate from "#root/ts/pulumi/lib/certificate.js";
import { LambdaFunction } from "#root/ts/pulumi/lib/lambda_function.js";
import { ApiZemnMeLambdaImage } from '#root/ts/pulumi/zemn.me/api/cmd/api/ApiZemnMeLambdaImage.js';

export interface Args {
    zoneId: Pulumi.Input<string>;
    domain: string;
    callboxPhoneNumber: Pulumi.Input<string>;
}

const lambdaImageCache = new Map<string, ApiZemnMeLambdaImage>();

export class ApiZemnMe extends Pulumi.ComponentResource {
    constructor(
        name: string,
        args: Args,
        opts?: Pulumi.ComponentResourceOptions
    ) {
        super('ts:pulumi:zemn.me:api', name, args, opts);

        const lambdaRole = new aws.iam.Role(`${name}-lambda-role`, {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: "lambda.amazonaws.com",
            }),
            managedPolicyArns: [aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole],
        }, { parent: this });

        const repo = new aws.ecr.Repository(`${name}_repo`, {
            forceDelete: true,
        }, { parent: this });

        const auth = aws.ecr.getAuthorizationToken();

        const imageCacheKey = `${repo.repositoryUrl}`;

        let image = lambdaImageCache.get(imageCacheKey);
        if (!image) {
            image = new ApiZemnMeLambdaImage(`apizemnmelambdaimage`, {
                repository: repo.repositoryUrl,
                token: auth.then(auth => auth.authorizationToken),
            }, { parent: this });
            lambdaImageCache.set(imageCacheKey, image);
        }

        const logGroup = new aws.cloudwatch.LogGroup(`${name}-log-group`, {
            retentionInDays: 14,
        }, { parent: this });

        // Create a DynamoDB table and use its name as the identifier.
        const dynamoTable = new aws.dynamodb.Table(`${name}-dynamodb`, {
            attributes: [{
                name: "id",
                type: "S",
			}, {
				name: "when",
				type: "S"
			}],
            billingMode: "PAY_PER_REQUEST",
            hashKey: "id",
			rangeKey: "when",
        }, { parent: this });

        // Attach IAM policy to allow dynamodb:Query on the table.
        const dynamoPolicy = new aws.iam.Policy(`${name}-dynamo-policy`, {
            policy: dynamoTable.arn.apply(arn => JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
					Action: [
						"dynamodb:Query",
						"dynamodb:PutItem",
						"dynamodb:UpdateItem",
						"dynamodb:DeleteItem"
					],
                    Effect: "Allow",
                    Resource: arn,
                }],
            })),
        }, { parent: this });

        new aws.iam.RolePolicyAttachment(`${name}-dynamo-attach`, {
            role: lambdaRole.name,
            policyArn: dynamoPolicy.arn,
        }, { parent: this });

        const gateway = new aws.apigatewayv2.Api(`${name}-api`, {
            protocolType: "HTTP",
        }, { parent: this });

        const PERSONAL_PHONE_NUMBER = process.env["PERSONAL_PHONE_NUMBER"];

        // Pass the DynamoDB table name to your Lambda environment.
        const lambdaFn = new LambdaFunction(`apizemnmelambdafunction`, {
            packageType: "Image",
            role: lambdaRole.arn,
            imageUri: image.url,
            timeout: 30,
            memorySize: 512,
            environment: {
                variables: {
                    ARE_VARIABLES_ACTUALLY_BEING_SET: "yes!",
                    ...(PERSONAL_PHONE_NUMBER !== undefined ? { PERSONAL_PHONE_NUMBER } : {}),
                    CALLBOX_PHONE_NUMBER: args.callboxPhoneNumber,
                    DYNAMODB_TABLE_NAME: dynamoTable.name,
                }
            }
        }, { parent: this }).function;

        const integration = new aws.apigatewayv2.Integration(`${name}-integration`, {
            apiId: gateway.id,
            integrationType: "AWS_PROXY",
            integrationUri: lambdaFn.arn,
        }, { parent: this });

        new aws.lambda.Permission(`zemnmeapipermission`, {
            action: "lambda:InvokeFunction",
            function: lambdaFn.name,
            principal: "apigateway.amazonaws.com",
            sourceArn: Pulumi.interpolate`${gateway.executionArn}/*/*`,
        }, { parent: this });

        new aws.apigatewayv2.Route(`${name}-proxy-route`, {
            apiId: gateway.id,
            routeKey: "$default",
            target: Pulumi.interpolate`integrations/${integration.id}`,
        }, { parent: this });

        new aws.apigatewayv2.Stage(`${name}-stage`, {
            apiId: gateway.id,
            name: "$default",
            autoDeploy: true,
            accessLogSettings: {
                destinationArn: logGroup.arn,
                format: JSON.stringify({
                    requestId: "$context.requestId",
                    sourceIp: "$context.identity.sourceIp",
                    requestTime: "$context.requestTime",
                    httpMethod: "$context.httpMethod",
                    routeKey: "$context.routeKey",
                    status: "$context.status",
                    path: "$context.path"
                })
            },
        }, { parent: this });

        const cert = new Certificate(`${name}_cert`, {
            zoneId: args.zoneId,
            domain: args.domain,
            noCostAllocationTag: true,
        }, { parent: this });

        const customDomain = new aws.apigatewayv2.DomainName(`${name}-domain`, {
            domainName: args.domain,
            domainNameConfiguration: {
                certificateArn: cert.validation.certificateArn,
                endpointType: "REGIONAL",
                securityPolicy: "TLS_1_2"
            }
        }, { parent: this });

        new aws.apigatewayv2.ApiMapping(`${name}-api-mapping`, {
            apiId: gateway.id,
            domainName: customDomain.id,
            stage: "$default",
        }, { parent: this });

        new aws.route53.Record(`${name}-dns`, {
            zoneId: args.zoneId,
            name: args.domain,
            type: "A",
            aliases: [{
                name: customDomain.domainNameConfiguration.targetDomainName,
                zoneId: customDomain.domainNameConfiguration.hostedZoneId,
                evaluateTargetHealth: false,
            }],
        }, { parent: this });

        super.registerOutputs({
            lambdaEnvironment: lambdaFn.environment,
            callboxPhoneNumber: args.callboxPhoneNumber,
            dynamoDBTableName: dynamoTable.name,
        });
    }
}
