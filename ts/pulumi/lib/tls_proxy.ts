/**
 * @fileoverview exposes some service on a given
 * domain via a reverse-proxy.
 */

import * as Cert from 'ts/pulumi/lib/certificate';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {
	zoneId: Pulumi.Input<string>,
	domain: string
}

export class TLSProxy extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:TLSProxy', name, args, opts);


	}
}
