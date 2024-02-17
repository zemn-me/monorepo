import {
	AssociatePhoneNumberContactFlowCommand,
	AssociatePhoneNumberContactFlowCommandInput,
	ConnectClient,
	DisassociatePhoneNumberContactFlowCommand,
} from '@aws-sdk/client-connect';
import { CustomResourceOptions, Input } from '@pulumi/pulumi';
import { Resource, ResourceProvider } from '@pulumi/pulumi/dynamic/index.js';

type AssociatePhoneNumberContactFlowResourceInput = {
	[Prop in keyof AssociatePhoneNumberContactFlowCommandInput]: Input<
		AssociatePhoneNumberContactFlowCommandInput[Prop]
	>;
};

type ProviderInput = AssociatePhoneNumberContactFlowCommandInput;
type ProviderOutput = AssociatePhoneNumberContactFlowCommandInput;

/**
 * AWS doesn't give us an association ID or something, so to stably identify
 * an association, we just derive the ID from a tuple of the input.
 */
function deriveId(input: AssociatePhoneNumberContactFlowCommandInput): string {
	return [input.PhoneNumberId, input.InstanceId].join('-');
}

/**
 * Binds a ContactFlow to a phone number. This isn't in terraform or CloudFormation yet.
 *
 * @see https://docs.aws.amazon.com/connect/latest/APIReference/API_AssociatePhoneNumberContactFlow.html
 */
const AssociatePhoneNumberContactFlowResourceProvider: ResourceProvider<
	ProviderInput,
	ProviderOutput
> = {
	/**
	 * Since we literally get NO metadata we have
	 */
	async diff(id: string, olds: ProviderOutput, news: ProviderInput) {
		const oldsM = new Map(Object.entries(olds));
		const newsM = new Map(Object.entries(news));

		const allKeys = new Set(...oldsM.keys(), ...newsM.keys());

		const diffKeys = new Set(
			[...allKeys].filter(k => oldsM.get(k) != newsM.get(k))
		);

		const changes = diffKeys.size > 0;
		const replaces = [...diffKeys];
		const stables = [...allKeys].filter(k => !diffKeys.has(k));
		// always deleteBeforeReplace -- there is no endpoint to change
		const deleteBeforeReplace = changes;

		return {
			changes,
			replaces,
			stables,
			deleteBeforeReplace,
		};
	},

	async create(inputs: AssociatePhoneNumberContactFlowCommandInput) {
		await new ConnectClient().send(
			new AssociatePhoneNumberContactFlowCommand(inputs)
		);

		return {
			id: deriveId(inputs),

			// there isn't a metadata api for this or anything
			outs: inputs,
		};
	},

	async delete(id: string, props: ProviderOutput) {
		await new ConnectClient().send(
			new DisassociatePhoneNumberContactFlowCommand(props)
		);
	},
};

export class PhoneNumberContactFlowAssociation extends Resource {
	constructor(
		name: string,
		props: AssociatePhoneNumberContactFlowResourceInput,
		opts?: CustomResourceOptions
	) {
		super(
			AssociatePhoneNumberContactFlowResourceProvider,
			name,
			props,
			opts
		);
	}
}
