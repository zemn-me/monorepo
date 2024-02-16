import { Input } from '@pulumi/pulumi';
import { CreateResult, ResourceProvider } from '@pulumi/pulumi/dynamic/index.js';

export interface AssociatePhoneNumberContactFlowInputs {
	ContactFlowId: Input<string>;
	InstanceId: Input<string>;
}

/**
 * @see https://docs.aws.amazon.com/connect/latest/APIReference/API_AssociatePhoneNumberContactFlow.html
 */
class AssociatePhoneNumberContactFlowResourceProvider implements ResourceProvider {
	static endpoint = "/phone-number/PhoneNumberId/contact-flow"
	static method = "PUT"
	async create(inputs: AssociatePhoneNumberContactFlowInputs): Promise<CreateResult> {
		fetch(
	}
}
