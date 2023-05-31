import * as pulumi from "@pulumi/pulumi";
import mime from 'mime';
import * as aws from "@pulumi/aws";
import path from 'node:path';
import fs from 'node:fs';

type Eventually<T> = Promise<T> | T;


async function relative(from: Eventually<string>, to: Eventually<string>): Promise<string> {
    const f = path.normalize(await from), t = path.normalize(await to);

    if (!t.startsWith(f)) throw new Error(
        `Cannot amake ${t} relative to ${f}; ${t} does not start with ${f}.`
    )

    return t.slice(f.length);

}

export interface Args {
    /**
     * Zone to create any needed DNS records in.
     */
    zone: aws.route53.Zone,

    /**
     * The domain or subdomain itself within the zone to create the website for
     * @example
     * "mywebsite.com."
     */
    domain: string

    /**
     * A directory to upload to the S3 bucket.
     */
    directory: string

    /**
     * The index document to serve.
     */
    index: pulumi.asset.FileAsset

    /**
     * The 404 document to serve.
     */
    notFound: pulumi.asset.FileAsset
}



const second = 1;
const minute = 60 * second;


/**
 * Provisions an S3 Bucket, CloudFront instance and certificate
 * to serve a static website.
 */
export class Website extends pulumi.ComponentResource {
    constructor(name: string, args: Args, opts?: pulumi.ComponentResourceOptions) {
        super('ts:pulumi:lib:Website', name, args, opts);

        const cert = new aws.acm.Certificate(`${name}_cert`, {
            domainName: args.domain,
            validationMethod: 'DNS',
        });

        const validatingRecord = new aws.route53.Record(`${name}_validating_record`, {
            name: cert.domainValidationOptions[0].resourceRecordName,
            records: [cert.domainValidationOptions[0].resourceRecordValue],
            type: cert.domainValidationOptions[0].resourceRecordType,
            zoneId: args.zone.zoneId,
            ttl: 1 * minute, // because these really don't need to be cached
        });


        const validation = new aws.acm.CertificateValidation(
            `${name}_validation`,
            {
                certificateArn: cert.arn,
                validationRecordFqdns: [validatingRecord.fqdn],
            }
        );

        // i want to have the error checking logic here but constructors cannot
        // be async sooo....
        
        const indexDocument = relative(args.directory, args.index.path);
        const errorDocument = relative(args.directory, args.notFound.path);

        const bucket = new aws.s3.Bucket(`${name}_bucket`, {
            acl: 'public-read',
            website: {
                indexDocument,
                errorDocument
            }
        });

        // upload the files to the bucket

        const indexDocumentObject =new aws.s3.BucketObject(`${name}_indexdocument_object`, {
			key: indexDocument,
			bucket,
			contentType: args.index.path.then(path => {
                const mimeType = mime.getType(path);
                if (mimeType === null) throw new Error(`Unable to determine MimeType: ${path}`);

                return mimeType
            }),
			source: args.index,
			acl: 'public-read',
		});


        const errorDocumentObject = new aws.s3.BucketObject(`${name}_errordocument_object`, {
			key: errorDocument,
			bucket,
			contentType: args.notFound.path.then(path => {
                const mimeType = mime.getType(path);
                if (mimeType === null) throw new Error(`Unable to determine MimeType: ${path}`);

                return mimeType
            }),
			source: args.notFound,
			acl: 'public-read',
		});


        // upload the non-special files

        // this needs an actuall synchronous walk
        for (const item of fs.readdirSync(args.directory)) {
            const fPath = path.join(args.directory, item);
        }




        // create the cloudfront

        const distribution =
            new aws.cloudfront.Distribution(`${name}_cloudfront_distribution`, {
                origins: [
                    {
                        domainName: bucket.bucketRegionalDomainName,
                        originId: `${name}_cloudfront_distribution`,
                    },
                ],
                enabled: true,
                isIpv6Enabled: true,
                defaultRootObject: index.key,
                aliases: [zone.name, pulumi.interpolate`thomas.${zone.name}`],
                defaultCacheBehavior: {
                    allowedMethods: [
                        'DELETE',
                        'GET',
                        'HEAD',
                        'OPTIONS',
                        'PATCH',
                        'POST',
                        'PUT',
                    ],
                    cachedMethods: ['GET', 'HEAD'],
                    targetOriginId: s3OriginId,
                    forwardedValues: {
                        queryString: false,
                        cookies: {
                            forward: 'none',
                        },
                    },
                    viewerProtocolPolicy: 'redirect-to-https',
                    minTtl: 0,
                    defaultTtl: 3600,
                    maxTtl: 86400,
                },
                restrictions: {
                    geoRestriction: {
                        restrictionType: 'none',
                    },
                },
                tags: {
                    Environment: 'production',
                },
                viewerCertificate: {
                    acmCertificateArn,
                    sslSupportMethod: 'sni-only', // idk really what this does
                },
            });






    }
}

export default Website;