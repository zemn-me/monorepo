import { CustomResourceOptions, dynamic, Output } from "@pulumi/pulumi";
import twilio from "twilio";
import { IncomingPhoneNumberInstance, IncomingPhoneNumberListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/incomingPhoneNumber.js";

export interface TwilioPhoneNumberArgs {
	countryCode: string;
	options: Omit<IncomingPhoneNumberListInstanceCreateOptions, 'phoneNumber'>
}

const accountSID = () => process.env["TWILIO_ACCOUNT_SID"];
const authToken = () => process.env["TWILIO_AUTH_TOKEN"];
const apiKeySid = () => process.env["TWILIO_API_KEY_SID"];

const Client = () => twilio(apiKeySid(), authToken(), { accountSid: accountSID() });

type SerializedIncomingPhoneNumberInstance =
	ReturnType<IncomingPhoneNumberInstance["toJSON"]>;

export function getTwilioPhoneNumber(id: string): Promise<IncomingPhoneNumberInstance> {
	return Client().incomingPhoneNumbers(id).fetch();
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
        args: TwilioPhoneNumberArgs,
        opts?: CustomResourceOptions
    ) {
		super(new TwilioPhoneNumberProvider(), name, {
			phoneNumber: undefined,
			...args
		}, opts);
    }
}
