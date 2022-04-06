import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { websiteUrl } from '../../../project/cultist/multiplayer/deploy';

export const zemn_me = new aws.route53.Zone("myzone", {
    comment: "",
    name: "zemn.me",
}, {
    protect: true,
});

export const zemn_me_A = new aws.route53.Record("zemn_me_A", {
    aliases: [{
        evaluateTargetHealth: false,
        name: "drunly91pq6ht.cloudfront.net",
        zoneId: "Z2FDTNDATAQYW2",
    }],
    name: "zemn.me",
    type: "A",
    zoneId: zemn_me.zoneId,
}, {
    protect: true,
});

export const cultist_staging_zemn_me_A = new aws.route53.Record("cultist_staging_zemn_me_A", {
    name: "cultist.staging.zemn.me",
    zoneId: zemn_me.zoneId,
    type: "CNAME",
    records: [
        websiteUrl
    ],
    ttl: 300
});