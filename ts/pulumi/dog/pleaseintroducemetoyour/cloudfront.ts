import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { bucket, index } from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour/public';
import { A } from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour/A';


const s3OriginId = "myS3Origin";
export const s3Distribution = new aws.cloudfront.Distribution("s3Distribution", {
    origins: [{
        domainName: bucket.bucketRegionalDomainName,
        originId: s3OriginId,
    }],
    enabled: true,
    isIpv6Enabled: true,
    defaultRootObject: index.key,
    aliases: [ A.name, ],
    defaultCacheBehavior: {
        allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
        ],
        cachedMethods: [
            "GET",
            "HEAD",
        ],
        targetOriginId: s3OriginId,
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        viewerProtocolPolicy: "redirect-to-https",
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
    tags: {
        Environment: "production",
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});