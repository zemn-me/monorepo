import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import { RandomPet } from '@pulumi/random';

import { pin_length_digits } from '#root/project/entryway/constants.js';
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

		const afterPinValidationLambda = action({
			Type: '',
		});

		const endFlow = action({
			Type: 'DisconnectParticipant',
			Parameters: {},
		});

		const connectApprover = action({
			Type: 'TransferParticipantToThirdParty',
			Parameters: {
				ThirdPartyPhoneNumber: '$.PhoneNumber',
				ContinueFlowExecution: false,
				ThirdPartyConnectionTimeoutSeconds: 60,
			},
			Transitions: {
				NextAction: endFlow.Identifier,
			},
		});

		const callApprover = action({
			Type: 'InvokeLambdaFunction',
			Parameters: {
				LambdaFunctionARN: 'xxx', // getApprover
				InvocationTimeLimitSeconds: 30,
				LambdaInvocationAttributes: {},
				ResponseValidation: { ResponseType: 'JSON' },
			},
			Transitions: {
				NextAction: connectApprover.Identifier,
			},
		});

		const validatePinFromInput = action({
			Type: 'InvokeLambdaFunction',
			Parameters: {
				LambdaFunctionARN: 'xxx',
				InvocationTimeLimitSeconds: 30,
				LambdaInvocationAttributes: {
					code: '$.StoredCustomerInput',
				},
				ResponseValidation: { ResponseType: 'JSON' },
			},
			Transitions: {
				NextAction: afterPinValidationLambda.Identifier,
			},
		});

		const askForPin = action({
			Type: 'GetParticipantInput',
			Parameters: {
				InputValidation: {
					CustomValidation: {
						MaximumLength: pin_length_digits,
					},
				},
				Text: 'Enter a PIN now, or hold to be connected with the resident.',
				InputTimeoutSeconds: 10,
				StoreInput: false,
			},
			Transitions: {
				NextAction: validatePinFromInput.Identifier,
				Errors: [
					{
						ErrorType: 'InputTimeLimitExceeded' as const,
						NextAction: callApprover.Identifier,
					},
				],
			},
		});

		const pin_failed = action({
			Type: 'TransferParticipantToThirdParty',
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
