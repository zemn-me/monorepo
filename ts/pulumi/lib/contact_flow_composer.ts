import * as regular_contact_flow from '#root/ts/pulumi/lib/contact_flow_language.js';

export interface ActionBase {
	Type: string;
	Parameters: unknown;
	Transitions?: {
		NextAction?: ContactFlowAction;
		Errors?: ErrorTransition[];
		Conditions?: regular_contact_flow.ConditionOperator[];
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

export interface ErrorTransition<ErrorName extends string = string> {
	NextAction: ContactFlowAction,
	ErrorType: ErrorName
}

export interface GetParticipantInputAction extends ActionBase {
	Type: 'GetParticipantInput',

	Parameters: {
		/**
		 *  A prompt ID or prompt ARN to play to the participant along with
		 *  gathering input. May not be specified if Text or SSML is also
		 *  specified. Must be either statically defined or a single valid JSONPath
		 *  identifier.
		 */
		PromptId?: string
		/**
		 * An optional string that defines text to send to the participant along
		 * with gathering input. May not be specified if PromptId or SSML is also
		 * specified. May be defined statically or dynamically. 
		 */
		Text?: string
		/**
		 * An optional string that defines SSML to send to the participant along
		 * with gathering input. May not be specified if Text or PromptId is also
		 * specified. May be defined statically or dynamically. 
		 */
		SSML?: string
		/**
		 * An external media source to play.
		 */
		Media?: {
			Uri: string,
			/**
			 * The source from which the message will be fetched. The only
			 * supported type is S3.
			 */
			SourceType: "S3",
			/**
			 * The type of the message to be played. The only supported type is
			 * Audio.
			 */
			MediaType: "Audio"
		},

		/**
		 * The number of seconds to wait for input to be collected before
		 * proceeding with a timeout error. For the Voice channel this is the
		 * timeout until the *first* DTMF digit is entered. Must be defined
		 * statically, and must be a valid integer larger than zero.
		 */
		InputTimeoutSeconds: string

		StoreInput?: "True" | "False"

		/**
		 * An object that defines how to validate customer inputs, required if and
		 * only if StoreInput is True
		 */
		InputValidation?: {
			/**
			 * Optional, one of the ways to validate inputs, make sure that it's a
			 * valid phone number. May not be specified if CustomValidation is
			 * specified. 
			 */
			PhoneNumberValidation?: {
				/**
				 * If "Local" is specified, it is validated to be a local number
				 * (without the + and the country code), "E164" enforces
				 * Participant actions 4074 Amazon Connect API Reference that the
				 * customer input is a fully defined e.164 phone number. Must be
				 * defined statically. 
				 */
				NumberFormat: "Local" | "E164",
				/**
				 * If the number format is "Local", this must be defined. This is
				 * the two letter country code to be associated with the input
				 * number when validating.  Must be defined statically. 
				 */
				CountryCode?: string
			},

			/**
			 *  Optional, the other way to validate inputs. May not be specified if
			 *  PhoneNumberValidation is specified. 
			 */
			CustomValidation?: {
				/**
				 * A number representing the maximum length of the input.  Must be
				 * defined statically. 
				 */
				MaxLength: string
			},


		},

		/**
		 * An optional object that defines how to encrypt the customer input.
		 * May only be specified if "CustomValidation" is provided. 
		 */
		InputEncryption?: {
			/**
			 * The identifier of a key that has been uploaded in the AWS
			 * console for the purposes of customer input encryption. May be
			 * specified statically or dynamically.
			 */
			EncryptionKeyId: string

			/**
			 * The PEM definition of the public key to use to encrypt this
			 * data. This key must be signed with the encryption key identified
			 * by the EncryptionKeyId. May be specified statically or
			 * dynamically. 
			 */
			Key?: string
		},

		/**
		 * An optional object to override default DTMF behavior for voice calls.
		 */
		DTMFConfiguration?: {
			/**
			 * Up to five digits to serve as the terminating sequence when
			 * gathering DTMF 
			 */
			InputTerminationSequence?: string

			/**
			 * "True" or "False". If "True", the "*" key doesn't cancel gathering
			 * DTMF digits. 
			 */
			DisableCancelKey?: "True" | "False"
		},
	},

	Transitions?: {
		Errors: (
			ErrorTransition<"NoMatchingConditon"> |
			ErrorTransition<"NoMatchingError"> |
			ErrorTransition<"InvalidPhoneNumber"> |
			ErrorTransition<"InputTimeLimitExceeded">
		)[]
	}
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


export interface InvokeLambdaFunctionAction extends ActionBase {
	Type: 'InvokeLambdaFunction',
	Parameters: {
		LambdaFunctionARN: string,
		InvocationTimeLimitSeconds: string,
		ResponseValidation: {
			/**
			 * Validates the response from the lambda is either a JSON map of
			 * depth 1 ("STRING_MAP"), or arbitrary JSON ("JSON").
			 *
			 * I would strongly argue that "JSON" is a misnomer here, as both
			 * formats are definitely JSON.
			 */
			ResponseType: "STRING_MAP" | "JSON"
		}
	}
}

export type ContactFlowAction =
	| MessageParticipantAction
	| EndFlowExecutionAction
	| GetParticipantInputAction
	| InvokeLambdaFunctionAction;



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
				n.Transitions.NextAction,
			Errors: n.Transition.Errors?.map(
				({NextAction, ...etc}) => ( {
					NextAction: translateAction(NextAction),
					...etc
				} )
			)
				
		} : n.Transitions;

	const self = {
		...n,
		Transitions
	};

	actions.add(self)

	return [ self, actions ]
}
