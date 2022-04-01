import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import config from './zonefile.json';


export const zemn_me = aws.route53.getZone({
    name: 'zemn.me',
});


for (const recordSet of config.ResourceRecordSets) {
    const base = {
        zoneId: zemn_me.then(domain => domain.zoneId),
        name: recordSet.Name,
        type: recordSet.Type,
        ttl: recordSet.TTL
    };

    let args: aws.route53.RecordArgs;

    if (recordSet.AliasTarget) {
        args = {
            ...base,
            aliases: [{
                evaluateTargetHealth: recordSet.AliasTarget.EvaluateTargetHealth,
                name: recordSet.AliasTarget.DNSName,
                zoneId: recordSet.AliasTarget.HostedZoneId
            }]
        };
    } else if (recordSet.ResourceRecords) {
        args = {
            ...base,
            records: recordSet.ResourceRecords.map(v => v.Value)
        }
    } else {
        throw new Error();
    }

    new aws.route53.Record(base.name, args);
}






