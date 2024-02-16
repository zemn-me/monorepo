import {
	ContactFlow as BaseContactFlow,
	ContactFlowArgs,
} from '@pulumi/aws/connect/index.js';
import {
	ComponentResource,
	ComponentResourceOptions,
	Input,
} from '@pulumi/pulumi';

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
}

export type ContactFlowAction = MessageParticipantAction;

export interface ContactFlowLanguage {
	Version: '2019-10-30';
	StartAction: string;
	actions: ContactFlowAction[];
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

		this.value = new BaseContactFlow(
			`${name}_contact_flow_module`,
			{
				...args,
				content: JSON.stringify(content),
			},
			{ parent: this }
		);
	}
}
