import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import { RandomPet } from '@pulumi/random';

import { PhoneNumberContactFlowAssociation } from '#root/ts/pulumi/lib/associate_phone_number_contact_flow.js';
import {
	ContactFlow,
	ContactFlowAction,
	ContactFlowLanguage,
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

		const disconnectAction = new RandomPet(
			`${name}_disconnect_flow_id`,
			{},
			{ parent: this }
		).id.apply(
			id =>
				({
					Identifier: id,
					Type: 'DisconnectParticipant',
					Parameters: {},
				}) satisfies ContactFlowAction
		);

		const action = Pulumi.all([
			new RandomPet(`${name}_flow_id`, {}, { parent: this }).id,
			disconnectAction,
		]).apply(
			([Identifier, disconnectAction]) =>
				({
					Identifier,
					Type: 'MessageParticipant',
					Parameters: {
						Text: 'Greetings, world!',
					},
					Transitions: {
						NextAction: disconnectAction.Identifier,
					},
				}) satisfies ContactFlowAction
		);

		const flow: Pulumi.Input<ContactFlowLanguage> = Pulumi.all([
			action,
			disconnectAction,
		]).apply(
			([action, disconnectAction]) =>
				({
					Version: '2019-10-30',
					StartAction: action!.Identifier,
					Actions: [action!, disconnectAction],
				}) satisfies ContactFlowLanguage
		);

		const contactFlow = new ContactFlow(
			`${name}_contact_flow`,
			{
				instanceId: connectInstance.id,
				name: 'Hello world flow',
				type: 'CONTACT_FLOW',
				content: flow,
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

		new PhoneNumberContactFlowAssociation(
			`${name}_contact_flow_association`,
			{
				PhoneNumberId: phone.id,
				ContactFlowId: contactFlow.value.id,
				InstanceId: connectInstance.id,
			},
			{ parent: this }
		);

		this.phoneNumber = phone.phoneNumber;
	}
}
