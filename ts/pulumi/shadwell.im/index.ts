import * as zone from 'ts/pulumi/im/shadwell/zone';
import Website from 'ts/pulumi/lib/website';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {

}

/**
 * Handles the provisioning of shadwell.im
 */
export class Component extends Pulumi.ComponentResource {
    site: Website;
    constructor(
        name: string,
        args: Args,
        opts?: Pulumi.ComponentResourceOptions
    ) {
        super("ts::pulumi::shadwell.im", name, args, opts);

        this.site = new Website(`${name}_thomas_shadwell_im_website`, {
            index: 'ts/pulumi/im/shadwell/thomas/public/index.html',
            directory: 'ts/pulumi/im/shadwell/thomas/public',
            zone: zone.zone,
            subDomain: 'thomas',
        }, { parent: this });

        super.registerOutputs({ site: this.site });
    }

}
