import * as website from 'ts/pulumi/lib/website';
import path from 'node:path';
import Website from 'ts/pulumi/lib/website';
import * as pulumi from "@pulumi/pulumi";

export interface Args {
    /**
     * Zone to create any needed DNS records in.
     */
    zone: website.Args["zone"],

    /**
     * The domain or subdomain itself within the zone to create the website for
     * @example
     * "mywebsite.com."
     */
    subDomain: website.Args["subDomain"]

    /**
     * A next.js project directory
     */
    directory: website.Args["directory"]

}

/**
 * Provisions an S3 Bucket, CloudFront instance and certificate
 * to serve a static next.js website.
 */
export class NextWebsite extends pulumi.ComponentResource {
    constructor(name: string, args: Args, opts?: pulumi.ComponentResourceOptions) {
        super('ts:pulumi:lib:Website', name, args, opts);

        const w = new Website(`${name}_website`, {
            zone: args.zone,
            subDomain: args.subDomain,
            directory: args.directory,
            index: path.join(args.directory, 'index.html'),
            notFound: path.join(args.directory, '404.html')
        }, opts);


        super.registerOutputs({
            w
        })
    }
}

export default Website;