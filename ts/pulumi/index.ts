import * as Pulumi from '@pulumi/pulumi';
import * as PleaseIntroduceMeToYourDog from 'ts/pulumi/pleaseintroducemetoyour.dog';
import * as ZemnMe from 'ts/pulumi/zemn.me';
import * as ShadwellIm from 'ts/pulumi/shadwell.im';
import * as aws from '@pulumi/aws';

interface StagableZoneArgs {
    staging: boolean,
    /**
     * The name for the hosted zone.
     */
    name: string
}

/**
 * A staging-aware Zone. If the 'staging' arg is true,
 * the constructed zone is `staging.${name}`.
 */
class StagableZone extends Pulumi.ComponentResource {
    zone: aws.route53.Zone;
    constructor(
        name: string,
        args: StagableZoneArgs,
        opts?: Pulumi.ComponentResourceOptions
    ) {
        super("ts::pulumi::StagableZone", name, args, opts);

        this.zone = new aws.route53.Zone(`${name}_zone`,{
            name:
                args.staging
                    ? `staging.${args.name}`
                    : args.name
        }, { parent: this })

        super.registerOutputs({
            zone: this.zone
        })

    }
}


export interface Args {
    staging: boolean
}

/**
 * The Pulumi infrastructure.
 */
export class Component extends Pulumi.ComponentResource {
    pleaseIntroduceMeToYourDog: PleaseIntroduceMeToYourDog.Component;
    zemnMe: ZemnMe.Component;
    shadwellIm: ShadwellIm.Component;
    constructor(
        name: string,
        args: Args,
        opts?: Pulumi.ComponentResourceOptions
    ) {
        super("ts::pulumi", name, args, opts);

        const pleaseIntroduceMeToYourDogZone = new StagableZone(`${name}_pleaseintroducemetoyour.dog_zone`, {
            name: 'pleaseintroducemetoyour.dog',
            staging: args.staging
        }, { parent: this });

        this.pleaseIntroduceMeToYourDog = new PleaseIntroduceMeToYourDog.Component(`${name}_pleaseintroducemetoyour.dog`, {
            zone: pleaseIntroduceMeToYourDogZone.zone
        }, { parent: this });

        const zemnMeZone = new StagableZone(`${name}_zemn.me_zone`, {
            name: 'zemn.me',
            staging: args.staging
        }, { parent: this });

        this.zemnMe = new ZemnMe.Component(`${name}_zemn.me`, {
            zone: zemnMeZone.zone
        }, { parent: this });

        const shadwellImZone = new StagableZone(`${name}_shadwell.im_zone`, {
            name: 'shadwell.im',
            staging: args.staging
        }, { parent: this });

        this.shadwellIm = new ShadwellIm.Component(`${name}_shadwell.im`, {
            zone: shadwellImZone.zone,
        }, { parent: this });

        super.registerOutputs({
            pleaseIntroduceMeToYourDog: this.pleaseIntroduceMeToYourDog,
        });
    }

}

