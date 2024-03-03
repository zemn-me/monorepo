import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import { RandomPet } from '@pulumi/random';

import {
	ContactFlow,
	contactFlowBuilder,
	UniqueContactFlowAction,
} from '#root/ts/pulumi/lib/contact_flow.js';
import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';

export interface Args {
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class Voice extends Pulumi.ComponentResource {
	phoneNumber: Pulumi.Output<string>;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:voice', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		/*
		new CostAllocationTag(
			`${name}_cost_tag`,
			{
				status: 'Active',
				tagKey: tag,
			},
			{ parent: this }
		);
		*/

		const connectInstance = new aws.connect.Instance(
			`${name}_connect_instance`,
			{
				inboundCallsEnabled: true,
				outboundCallsEnabled: true,
				identityManagementType: 'CONNECT_MANAGED',
				instanceAlias: new RandomPet(
					`${name}_connect_instance_alias_name`,
					{},
					{ parent: this }
				).id,
			},
			{ parent: this }
		);

		const action = contactFlowBuilder();

		// i think I'll just have to use twilio.
		// I say this because this DX sucks & they dont
		// have the thing where you can call a bunch of numbers
		// at once and have the first one available pick up.

		const forwardToUsers =

		const getCode = action({
			Type: 'GetParticipantInput',
			Parameters: {
				Text: 'Enter code now, followed by the pound or hash key; or hold to talk to a human. You have 10 seconds.',
				InputTimeoutSeconds: 10,
				StoreInput: false,
			},
		});


		const helloWorld = new UniqueContactFlowAction(
			`${name}_disconnect_flow_id`,
			{
				Type: 'DisconnectParticipant',
				Parameters: {},
			},
			{ parent: this }
		);

		new ContactFlow(
			`${name}_contact_flow`,
			{
				instanceId: connectInstance.id,
				name: 'Hello world flow',
				type: 'CONTACT_FLOW',
				content: {
					Version: '2019-10-30',
					StartAction: helloWorld.get.Identifier,
					Actions: [helloWorld.get],
				},
			},
			{ parent: this }
		);

		const phone = new aws.connect.PhoneNumber(
			`${name}_phone_number`,
			{
				countryCode: 'US',
				type: 'DID',
				targetArn: connectInstance.arn,
				tags,
			},
			{ parent: this }
		);

		this.phoneNumber = phone.phoneNumber;
	}
}
