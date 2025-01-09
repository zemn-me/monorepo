import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";

import { ContactFlow } from "#root/ts/pulumi/lib/contact_flow.js";
import { compileContactFlow, ContactFlowAction } from "#root/ts/pulumi/lib/contact_flow_composer.js";
import { tagTrue } from "#root/ts/pulumi/lib/tags.js";


export interface Args {
	zoneId: Input<string>;
	domain: Input<string>
	tags?: Input<Record<string, Input<string>>>;
}

export class Component extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:doorperson', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		function begin(): ContactFlowAction {
			return {
				Type: "GetParticipantInput",
				Parameters: {
					Text: "Enter a code now, or hold to contact the occupier.",
				},
				Transitions: {
					CustomValidation: {
						MaxLength: "5"
					},
					InputTimeSeconds: "10",
					Errors: [
						{
							ErrorType: 'InputTimeLimitExceeded',
							NextAction: contactTheOccupier(),
						},
						{
							// always true if there is input since I have not
							// specified any conditions.
							ErrorType: 'NoMatchingCondition',
							NextAction: userInputAccessCode()
						}
					]
				}
			}
		}


		const flow = new ContactFlow(`${name}_contactFlow`, {
			content: compileContactFlow(
				begin
			)
		}, {parent: this})

	}
}

