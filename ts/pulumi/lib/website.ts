
import * as pulumi from "@pulumi/pulumi";
import * as pulumiAws from "@pulumi/aws";

export interface Args {

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