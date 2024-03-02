import {
	ContactFlow as BaseContactFlow,
	ContactFlowArgs,
} from '@pulumi/aws/connect/index.js';
import {
	all,
	ComponentResource,
	ComponentResourceOptions,
	Input,
	Lifted,
} from '@pulumi/pulumi';
import { RandomPet } from '@pulumi/random';

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

type S3Uri = `s3://${string}`;

/**
 * Configuration for managing interactions with participants, including input gathering and validation.
 */
interface GetParticipantInputAction extends ActionBase {
	Type: 'GetParticipantInput';
	Parameters: {
		/**
		 * Optional. A prompt ID or prompt ARN to play to the participant along with gathering input.
		 * May not be specified if Text or SSML is also specified. Must be either statically defined
		 * or a single valid JSONPath identifier.
		 */
		PromptId?: string;

		/**
		 * Optional. A string that defines text to send to the participant along with gathering input.
		 * May not be specified if PromptId or SSML is also specified. May be defined statically or dynamically.
		 */
		Text?: string;

		/**
		 * Optional. A string that defines SSML to send to the participant along with gathering input.
		 * May not be specified if Text or PromptId is also specified. May be defined statically or dynamically.
		 */
		SSML?: string;

		/**
		 * Optional. An object that defines an external media source.
		 */
		Media?: {
			/**
			 * Location of the message.
			 */
			Uri: S3Uri;

			/**
			 * The source from which the message will be fetched. The only supported type is S3.
			 */
			SourceType: 'S3';

			/**
			 * The type of the message to be played. The only supported type is Audio.
			 */
			MediaType: 'Audio';
		};

		/**
		 * The number of seconds to wait for input to be collected before proceeding with a timeout error.
		 * For the Voice channel, this is the timeout until the *first* DTMF digit is entered. Must be defined
		 * statically, and must be a valid integer larger than zero.
		 */
		InputTimeoutSeconds: number;

		/**
		 * "True" or "False". Must be statically defined.
		 */
		StoreInput: boolean;

		/**
		 * An object that defines how to validate customer inputs, required if and only if StoreInput is True.
		 */
		InputValidation?: {
			/**
			 * Optional. One of the ways to validate inputs, make sure that it's a valid phone number.
			 * May not be specified if CustomValidation is specified.
			 */
			PhoneNumberValidation?: {
				/**
				 * "Local" or "E164". If "Local" is specified, it is validated to be a local number
				 * (without the + and the country code), "E164" enforces that the customer input is
				 * a fully defined e.164 phone number. Must be defined statically.
				 */
				NumberFormat: 'Local' | 'E164';

				/**
				 * If the number format is "Local", this must be defined. This is the two-letter country
				 * code to be associated with the input number when validating. Must be defined statically.
				 */
				CountryCode: string;
			};

			/**
			 * Optional. The other way to validate inputs. May not be specified if PhoneNumberValidation is specified.
			 */
			CustomValidation?: {
				/**
				 * A number representing the maximum length of the input. Must be defined statically.
				 */
				MaximumLength: number;
			};
		};

		/**
		 * Optional. An object that defines how to encrypt the customer input. May only be specified
		 * if "CustomValidation" is provided.
		 */
		InputEncryption?: {
			/**
			 * The identifier of a key that has been uploaded in the AWS console for the purposes of customer
			 * input encryption. May be specified statically or dynamically.
			 */
			EncryptionKeyId: string;

			/**
			 * The PEM definition of the public key to use to encrypt this data. This key must be signed with
			 * the encryption key identified by the EncryptionKeyId. May be specified statically or dynamically.
			 */
			Key: string;
		};

		/**
		 * Optional. An object to override default DTMF behavior for voice calls.
		 */
		DTMFConfiguration?: {
			/**
			 * Up to five digits to serve as the terminating sequence when gathering DTMF.
			 */
			InputTerminationSequence: string;

			/**
			 * "True" or "False". If "True", the "*" key doesn't cancel gathering DTMF digits.
			 */
			DisableCancelKey: boolean;
		};
	};
}

/**
 * Configuration for managing call settings and behaviors.
 */
export interface TransferParticipantToThirdPartyAction extends ActionBase {
	Type: 'TransferParticipantToThirdParty';
	Parameters: {
		/**
		 * Optional. Only for phone number type. A phone number, in e.164 format,
		 * of the external number to which to transfer the contact. Ignored when
		 * using VoiceConnectors. May be defined statically or dynamically.
		 */
		ThirdPartyPhoneNumber?: string;

		/**
		 * An integer, between 0 and 600 (inclusive), representing the number of seconds
		 * to wait for the third party to answer before canceling the third party call.
		 * Only used if ContinueFlowExecution is not False. Must be defined fully statically
		 * or as a single valid JSONPath identifier.
		 */
		ThirdPartyConnectionTimeoutSeconds: number;

		/**
		 * Optional. Only for phone number type. "True" or "False". If not defined or True,
		 * the flow continues running after the third party call finishes. If False, the flow
		 * does not continue, as long as the phone call to the third party succeeds.
		 * Must be defined statically.
		 */
		ContinueFlowExecution?: boolean;

		/**
		 * Optional. Only for phone number type. A series of DTMF digits to send to the third party
		 * when the call succeeds. Must be defined fully statically or as a single valid JSONPath identifier.
		 * Must be 50 or fewer characters chosen from numeric digits, comma, asterisk, and pound sign.
		 */
		ThirdPartyDTMFDigits?: string;

		/**
		 * Optional. Only for phone number type. An override of the caller ID to present
		 * when dialing the third party.
		 */
		CallerId?: {
			/**
			 * The caller ID number to present when dialing the third party. Must be defined
			 * fully statically or as a single valid JSONPath identifier.
			 */
			Number: string;

			/**
			 * The caller ID name to present when dialing the third party.
			 * May be defined statically or dynamically.
			 */
			Name?: string;
		};

		/**
		 * Optional. Only for voice connector type. Contains the configuration of the voice connector.
		 */
		VoiceConnector?: {
			/**
			 * Only support "ChimeConnector". Must be defined statically.
			 */
			VoiceConnectorType: 'ChimeConnector';

			/**
			 * The Arn of Voice Connector. Can be set statically or dynamically.
			 */
			VoiceConnectorArn: string;

			/**
			 * The user who makes the call. Can be set statically or dynamically.
			 */
			FromUser: string;

			/**
			 * The user who receives the call. Can be set statically or dynamically.
			 */
			ToUser: string;

			/**
			 * Optional. SIP user to user information. Can be set statically or dynamically.
			 */
			UserToUserInformation?: string;
		};
	};
	Transitions: {
		NextAction: string;
	};
}

export interface ContactFlowActions {
	MessageParticipantAction: MessageParticipantAction;
	EndFlowExecutionAction: EndFlowExecutionAction;
	TransferParticipantToThirdPartyAction: TransferParticipantToThirdPartyAction;
	GetParticipantInputAction: GetParticipantInputAction;
}

type Values<T> = T[keyof T];

export type ContactFlowActionNoIdentifier = Values<{
	[k in keyof ContactFlowActions]: Omit<ContactFlowActions[k], 'Identifier'>;
}>;

export type ContactFlowAction = Values<ContactFlowActions>;

export interface ContactFlowLanguage {
	Version: '2019-10-30';
	StartAction: string;
	Actions: ContactFlowAction[];
}

type InputRecursive<T> = {
	[P in keyof T]: T[P] extends string | number
		? Input<T[P]>
		: T[P] extends Array<infer A>
			? Array<Input<A>>
			: InputRecursive<T[P]>;
};

export const contactFlowBuilder = () => {
	let n = 0;
	return (v: ContactFlowActionNoIdentifier) => ({
		...v,
		Identifier: (n++).toString(),
	});
};

/**
 * CompnentResource that creates a ContactFlowAction
 * JSON object, creating a random ID for the action.
 */
export class UniqueContactFlowAction extends ComponentResource {
	get: Lifted<ContactFlowAction>;
	constructor(
		name: string,
		args: InputRecursive<Omit<ContactFlowAction, 'Identifier'>>,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:ContactFlowModule', name, args, opts);
		const id = new RandomPet(`${name}_id`, {}, { parent: this });

		this.get = all([id.id, args]).apply(([id, args]) => ({
			...args,
			Identifier: id,
		})) as Lifted<ContactFlowAction>;
	}
}
export interface Args extends Omit<ContactFlowArgs, 'content'> {
	content: Input<InputRecursive<ContactFlowLanguage>>;
}

/**
 * Creates a ContactFlowModule, but it's typechecked.
 */
export class ContactFlow extends ComponentResource {
	readonly value: BaseContactFlow;
	constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
		super('ts:pulumi:lib:ContactFlowModule', name, args, opts);

		all([args.content]).apply(
			([c]) =>
				void ContactFlow.validate(c!).then(v => {
					if (v instanceof Error) throw v;
				})
		);

		this.value = new BaseContactFlow(
			`${name}_contact_flow_module`,
			{
				...args,
				content: all([args.content]).apply(([v]) => JSON.stringify(v)),
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
