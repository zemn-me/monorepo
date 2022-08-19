import zone from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour';
import * as aws from '@pulumi/aws';

export const cert = new aws.acm.Certificate("pleaseintroducemetoyour.dog_cert", {
    domainName: zone.name,
    validationMethod: "DNS"
});



