

interface AbstractConditionOperator {
	Operator: string
	Operands: string[]
}

interface Equals extends AbstractConditionOperator {
	Operator: "Equals"
	Operands: string[]
}

export type ConditionOperator = Equals


export interface ActionBase {
	Identifier: string;
	Type: string;
	Parameters: unknown;
	Transitions?: {
		NextAction?: string;
		Errors?: ErrorTransition[];
		Conditions?: ConditionOperator[];
	};
}

export interface ErrorTransition<ErrorName extends string = string> {
	NextAction: string,
	ErrorType: ErrorName
}

export interface ConditionTransition {
	NextAction: string,
	Condition: unknown // TBD
}


interface ContactFlowActions {
	GetParticipantInputAction: GetParticipantInputAction
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
		InputTimeoutSeconds?: string

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

interface ContactFlowActions {
	EndFlowExecutionAction: EndFlowExecutionAction
}

export interface EndFlowExecutionAction extends ActionBase {
	Type: 'DisconnectParticipant';
	Parameters: Record<string, never>;
	Transitions?: Record<string, never>;
}

interface ContactFlowActions {
	MessageParticipantAction: MessageParticipantAction
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

export type ContactFlowAction = ContactFlowActions[keyof ContactFlowActions]

export interface ContactFlowLanguage {
	Version: '2019-10-30';
	StartAction: string;
	Actions: ContactFlowAction[];
}
