import * as regular_contact_flow from '#root/ts/pulumi/lib/contact_flow_language.js';

export interface ActionBase {
	Type: string;
	Parameters: unknown;
	Transitions?: {
		NextAction?: ContactFlowAction;
		Errors?: ErrorTransition[];
		Conditions?: string[];
	};
}

export interface ErrorTransition {
	NextAction: ContactFlowAction,
	ErrorType: string
}

export interface ConditionTransition {
	NextAction: ContactFlowAction,
	Condition: unknown // TBD
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
		NextAction: ContactFlowAction;
	};
}

export type ContactFlowAction =
	| MessageParticipantAction
	| EndFlowExecutionAction;



export function compileContactFlow(main: ContactFlowAction): regular_contact_flow.ContactFlowLanguage {
	const [self, actions] = _compileContactFlow(main, "root");
	return {
		Version: "2019-10-30",
		StartAction: self.Identifier,
		Actions: [...actions] as regular_contact_flow.ContactFlowAction[]

	}
}

function _compileContactFlow(main: ActionBase, id: string): [
	self: regular_contact_flow.ActionBase,
	subActions: Set<regular_contact_flow.ActionBase>
] {
	let actions = new Set<regular_contact_flow.ActionBase>();
	const n = {
		...main,
		Identifier: id,
	}

	let ctr = 0;

	function translateAction(a: ContactFlowAction): string {
		const myId = `${id}|${ctr++}`;
		const [, subActions] = _compileContactFlow(
			a,
			`${id}|${ctr++}`
		);

		actions = actions.union(
			subActions
		);

		return myId;
	}

	const Transitions = n.Transitions
		? {
			NextAction: n.Transitions.NextAction ?
				translateAction(n.Transitions.NextAction) :
				n.Transitions.NextAction
		} : n.Transitions;

	const self = {
		...n,
		Transitions
	};

	actions.add(self)

	return [ self, actions ]
}
