import {
	ContactFlow as BaseContactFlow,
	ContactFlowArgs,
} from '@pulumi/aws/connect/index.js';
import {
	all,
	ComponentResource,
	ComponentResourceOptions,
	Input,
} from '@pulumi/pulumi';

import { ContactFlowLanguage } from '#root/ts/pulumi/lib/contact_flow_language.js';
import { Err, Ok, Result } from '#root/ts/result.js';

export interface Args extends Omit<ContactFlowArgs, 'content'> {
	content: Input<ContactFlowLanguage>;
}

/**
 * Creates a ContactFlowModule, but it's typechecked.
 */
export class ContactFlow extends ComponentResource {
	readonly value: BaseContactFlow;
	constructor(
		name: string,
		{ content, ...args }: Args,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:ContactFlowModule', name, args, opts);

		void ContactFlow.validate(content).then(v => v.as_promise());

		this.value = new BaseContactFlow(
			`${name}_contact_flow_module`,
			{
				...args,
				content: all([content]).apply(([v]) => JSON.stringify(v)),
			},
			{ parent: this }
		);
	}

	private static async validateEntryPointSet(
		flow: ContactFlowLanguage
	): Promise<Result <void, Error>> {
		if (!flow.Actions.some(v => v.Identifier == flow.StartAction))
			return Err( new Error(`Missing entry point ${flow.StartAction}`))

		return Ok(undefined)
	}

	private static async validate(
		v: Input<ContactFlowLanguage>
	): Promise<Result<void, Error>> {
		const flow = await new Promise<ContactFlowLanguage>(ok =>
			all([v]).apply(([flow]) => ok(flow!))
		);

		return ContactFlow.validateEntryPointSet(flow);
	}
}
