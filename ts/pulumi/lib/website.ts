
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

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
    directory: pulumi.asset.FileArchive

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



// should use this one because it waits for the certificate to actualy be validated
export const arn = validation.certificateArn;

export const site = new staticwebsite.Website('staging.zemn.me', {
    withCDN: true,
    indexHTML: 'index.html',
    error404: '404.html',
    sitePath: 'project/zemn.me/next/out',
    targetDomain: 'staging.zemn.me',
    certificateARN: arn,
});


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




        const bucket = new aws.s3.Bucket(`${name}_bucket`, {
            acl: 'public-read',
            website: {
                indexDocument,
                errorDocument
            }
        })






    }
}

export default Website;