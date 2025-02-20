import { CustomResourceOptions, dynamic } from "@pulumi/pulumi";
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
	ReturnType<IncomingPhoneNumberInstance["toJSON"]>

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

		const newNumber = chosenNumber.then(n => client.incomingPhoneNumbers.create({
			phoneNumber: n?.phoneNumber,
			...args.options
		}))

		return newNumber.then(n => ({
			id: n.sid,
			outs: n.toJSON()
		}))
    }

    public async read(id: string) {
		const client = Client();
		const num = await client.incomingPhoneNumbers(id).fetch();
		return {
			id: num.sid,
			outs: num.toJSON()
		};
    }

    public async update(id: string, _: SerializedIncomingPhoneNumberInstance, news: TwilioPhoneNumberArgs) {
		const client = Client();

        const updatedNumber = client.incomingPhoneNumbers(id).update({
			...news.options
        });

		return updatedNumber.then(n => ({
			id: n.sid,
			outs: n.toJSON()
		}))
    }

    public async delete(id: string, _: SerializedIncomingPhoneNumberInstance) {
		const client = Client();
        await client.incomingPhoneNumbers(id).remove();
    }
}

export class TwilioPhoneNumber extends dynamic.Resource {
    constructor(
        name: string,
        args: TwilioPhoneNumberArgs,
        opts?: CustomResourceOptions
    ) {
        super(new TwilioPhoneNumberProvider(), name, args, opts);
    }
}
