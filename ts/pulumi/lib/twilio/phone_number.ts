import { CustomResourceOptions, dynamic, Input, Output } from "@pulumi/pulumi";
import twilio from "twilio";
import { IncomingPhoneNumberInstance, IncomingPhoneNumberListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/incomingPhoneNumber.js";


export interface TwilioPhoneNumberInputs {
	countryCode: Input<string>;
	options: Input<TwilioPhoneNumberArgs["options"]>
}

interface TwilioPhoneNumberArgs {
	countryCode: string;
	options: Input<Omit<IncomingPhoneNumberListInstanceCreateOptions, 'phoneNumber'>>
}

const accountSID = () => process.env["TWILIO_ACCOUNT_SID"];
const authToken = () => process.env["TWILIO_AUTH_TOKEN"];
const apiKeySid = () => process.env["TWILIO_API_KEY_SID"];

const maybeClient = () => {
	const [apikeysid, authtoken, accountsid] = [
		apiKeySid(),
		authToken(),
		accountSID(),
	];

	if (apikeysid === undefined) return new Error("missing TWILIO_ API_KEY_SID");
	if (authtoken === undefined) return new Error("missing TWILIO_AUTH TOKEN");
	if (accountsid === undefined) return new Error("missing TWILIO_ACCOUNT_SID");

	return twilio(
			apikeysid, authtoken, {accountSid: accountsid}
		)
}

const Client = () => {
	const m = maybeClient();
	if (m instanceof Error) throw m;

	return m;
}

type SerializedIncomingPhoneNumberInstance =
	ReturnType<IncomingPhoneNumberInstance["toJSON"]>;

/**
 * get info on the twilio phone number.
 *
 * unlike other operations, during testing this just returns
 * a dummy instead of crashing because the client is not configured.
 */
export function getTwilioPhoneNumber(id: string) {
	const m = maybeClient();
	if (m instanceof Error) return Promise.resolve({
		phoneNumber: "dummy"
	});

	return m.incomingPhoneNumbers(id).fetch()
}

class TwilioPhoneNumberProvider implements dynamic.ResourceProvider<TwilioPhoneNumberArgs, SerializedIncomingPhoneNumberInstance> {
    public async create(args: TwilioPhoneNumberArgs) {
		const client =
			Client();

		const availableNumbers =
			client.availablePhoneNumbers.get(args.countryCode)
				.local.list()

		const chosenNumber = availableNumbers.then(
			v => v[0]
		);

		const n = await chosenNumber.then(n => client.incomingPhoneNumbers.create({
			phoneNumber: n?.phoneNumber,
			...args.options
		}))

		const j = n.toJSON();

		return {
			id: n.sid,
			outs: {
				...j,
				phoneNumber: j.phoneNumber,
			}
		}
    }

    public async read(id: string) {
		const client = Client();
		const num = await client.incomingPhoneNumbers(id).fetch();
		const j = num.toJSON();
		return {
			id: num.sid,
			outs: {
				...j,
				phoneNumber: j.phoneNumber,
			}
		};
    }

    public async update(id: string, _: SerializedIncomingPhoneNumberInstance, news: TwilioPhoneNumberArgs) {
		const client = Client();

        const n = await client.incomingPhoneNumbers(id).update({
			...news.options
        });

		const j = n.toJSON();

		return {
			id: n.sid,
			outs: {
				...j,
				phoneNumber: j.phoneNumber,
			}
		}

    }

    public async delete(id: string, _: SerializedIncomingPhoneNumberInstance) {
		const client = Client();
        await client.incomingPhoneNumbers(id).remove();
    }
}

export class TwilioPhoneNumber extends dynamic.Resource {
	public readonly phoneNumber!: Output<string>;
    constructor(
        name: string,
        args: TwilioPhoneNumberInputs,
        opts?: CustomResourceOptions
    ) {
		super(new TwilioPhoneNumberProvider(), name, {
			phoneNumber: undefined,
			...args
		}, opts);
    }
}
