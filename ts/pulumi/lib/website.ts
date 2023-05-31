
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface Args {
    /**
     * Zone to create any needed DNS records in.
     */
    zone: pulumi.Input<aws.route53.Zone>,

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

/**
 * Provisions an S3 Bucket, CloudFront instance and certificate
 * to serve a static website.
 */
export class Website extends pulumi.ComponentResource {
    constructor(name: string, args: Args, opts?: pulumi.ComponentResourceOptions) {
        super('ts:pulumi:lib:Website', name, args, opts);


    }
}

export default Website;