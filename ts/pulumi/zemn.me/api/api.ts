/**
 * @fileoverview api.zemn.me
 */

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

        const gateway = new aws.apigatewayv2.Api(`${name}-api`, {
            protocolType: "HTTP",
        }, { parent: this });

        const lambdaFn = new LambdaFunction(`apizemnmelambdafunction`, {
            packageType: "Image",
            role: lambdaRole.arn,
            imageUri: image.url,
            timeout: 30,
            memorySize: 512,
			environment: {
				variables: {
					CALLBOX_PHONE_NUMBER: args.callboxPhoneNumber,
				}
			}
        }, { parent: this }).function;

        const integration = new aws.apigatewayv2.Integration(`${name}-integration`, {
            apiId: gateway.id,
            integrationType: "AWS_PROXY",
            integrationUri: lambdaFn.arn,
        }, { parent: this });

        new aws.apigatewayv2.Route(`${name}-proxy-route`, {
            apiId: gateway.id,
            routeKey: "$default", // Matches all methods and paths
            target: Pulumi.interpolate`integrations/${integration.id}`,
        }, { parent: this });

        new aws.apigatewayv2.Stage(`${name}-stage`, {
            apiId: gateway.id,
            name: "$default", // Use the default stage
            autoDeploy: true,
        }, { parent: this });

		const cert = new Certificate(`${name}_cert`, {
			zoneId: args.zoneId,
			domain: args.domain,
		}, { parent: this })

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
    }
}
