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

import { Err, Ok, Result } from '#root/ts/result.js';

interface ActionBase {
	Identifier: string;
	Type: string;
	Parameters: unknown;
	Transitions?: {
		NextAction?: string;
		Errors?: string[];
		Conditions?: string[];
	};
}

export interface EndFlowExecutionAction extends ActionBase {
	Type: 'DisconnectParticipant';
	Parameters: Record<string, never>;
	Transitions?: Record<string, never>;
}

export interface MessageParticipantAction extends ActionBase {
	Type: 'MessageParticipant';
	Parameters: {
		/**
		 * A prompt ID or prompt ARN to play to the participant along with gathering input. May not be specified if Text or SSML is also specified.
		 * Must be specified either statically or as a single valid JSONPath identifier
		 */
		PromptId?: string;
		/**
		 * An optional string that defines text to send to the participant along with gathering input.
		 * May not be specified if PromptId or SSML is also specified. May be specified statically or dynamically.
		 */
		Text?: string;
		/**
		 * An optional string that defines SSML to send to the participant along with gathering input. May not be specified if Text or
		 * PromptId is also specified May be specified statically or dynamically.
		 */
		SSML?: string;
		media?: {
			uri: string;
			SourceType: 'S3';
			MediaType: 'Audio';
		};
	};
	Transitions: {
		NextAction: string;
	};
}

export type ContactFlowAction =
	| MessageParticipantAction
	| EndFlowExecutionAction;

export interface ContactFlowLanguage {
	Version: '2019-10-30';
	StartAction: string;
	Actions: ContactFlowAction[];
}

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

		void ContactFlow.validate(content).then(v => {
			if (v instanceof Error) throw v;
		});

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
	): Promise<Result<void, Error>> {
		if (!flow.Actions.some(v => v.Identifier == flow.StartAction))
			return {
				[Err]: new Error(`Missing entry point ${flow.StartAction}`),
			};

		return { [Ok]: undefined };
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
