


export interface ActionBase {
	Identifier: string;
	Type: string;
	Parameters: unknown;
	Transitions?: {
		NextAction?: string;
		Errors?: ErrorTransition[];
		Conditions?: string[];
	};
}

export interface ErrorTransition {
	NextAction: string,
	ErrorType: string
}

export interface ConditionTransition {
	NextAction: string,
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
