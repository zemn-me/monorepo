import * as aws from "@pulumi/aws";
import * as Pulumi from '@pulumi/pulumi';

import { ApiZemnMeLambdaImage } from '#root/project/zemn.me/api/cmd/api/ApiZemnMeLambdaImage.js';
import Certificate from "#root/ts/pulumi/lib/certificate.js";
import { LambdaFunction } from "#root/ts/pulumi/lib/lambda_function.js";




const pick_env = <T extends string>(k: T): (
	Record<never, never> | Record < T, string>
) =>
	process.env[k] === undefined ? {} : {
		[k]: process.env[k]
	};


export interface Args {
    zoneId: Pulumi.Input<string>;
    domain: string;
    callboxPhoneNumber: Pulumi.Input<string>;
	protectDatabases: boolean
	/**
	 * Used to auth calls from twilio to the api server.
	 */
	twilioSharedSecret: Pulumi.Input<string>
}

const lambdaImageCache = new Map<string, ApiZemnMeLambdaImage>();

export class ApiZemnMe extends Pulumi.ComponentResource {
    constructor(
        name: string,
        args: Args,
        opts?: Pulumi.ComponentResourceOptions
    ) {
                super('ts:pulumi:zemn.me:api', name, args, opts);

                const oidcKey = new aws.kms.Key(`${name}-oidc-key`, {
                        customerMasterKeySpec: "ECC_NIST_P256",
                        keyUsage: "SIGN_VERIFY",
                }, { parent: this });

                const oidcPublicKey = oidcKey.keyId.apply(id =>
                        aws.kms.getPublicKey({ keyId: id }).then(r =>
                                `-----BEGIN PUBLIC KEY-----\n${r.publicKey}\n-----END PUBLIC KEY-----\n`));

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
                }, { parent: this, protect: args.protectDatabases });

                const grievancesTable = new aws.dynamodb.Table(`${name}-grievances`, {
                        attributes: [{
                                name: "id",
                                type: "S",
                        }],
                        billingMode: "PAY_PER_REQUEST",
                        hashKey: "id",
                }, { parent: this, protect: args.protectDatabases });

		const lambdaRole = new aws.iam.Role(`${name}-lambda-role`, {
			assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
				Service: "lambda.amazonaws.com",
			}),
			managedPolicyArns: [aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole],
                        inlinePolicies: [{
                                name: `${name}-dynamodb-inline-policy`,
                                policy: Pulumi.all([dynamoTable.arn, grievancesTable.arn]).apply(
                                        ([settingsArn, grievancesArn]) =>
                                                JSON.stringify({
                                                        Version: "2012-10-17",
                                                        Statement: [
                                                                {
                                                                        Action: [
                                                                                "dynamodb:Query",
                                                                                "dynamodb:PutItem",
                                                                                "dynamodb:UpdateItem",
                                                                                "dynamodb:DeleteItem",
                                                                                "dynamodb:GetItem",
                                                                                "dynamodb:Scan",
                                                                        ],
                                                                        Effect: "Allow",
                                                                        Resource: [settingsArn, grievancesArn],
                                                                },
                                                        ],
                                                })
                                ),
                        }, {
                                name: `${name}-kms-inline-policy`,
                                policy: oidcKey.arn.apply(arn => JSON.stringify({
                                        Version: "2012-10-17",
                                        Statement: [{
                                                Action: ["kms:Sign"],
                                                Effect: "Allow",
                                                Resource: arn,
                                        }],
                                })),
                        }]
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
                                        GRIEVANCES_TABLE_NAME: grievancesTable.name,
                                        TWILIO_SHARED_SECRET: args.twilioSharedSecret,
                                        OIDC_JWT_KMS_KEY_ID: oidcKey.keyId,
                                        OIDC_JWT_PUBLIC_KEY: oidcPublicKey,
                                        ...pick_env("TWILIO_ACCOUNT_SID"),
                                        ...pick_env("TWILIO_AUTH_TOKEN"),
                                        ...pick_env("TWILIO_API_KEY_SID")
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
                        grievancesTableName: grievancesTable.name,
                });
    }
}
