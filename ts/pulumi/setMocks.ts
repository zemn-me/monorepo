import * as pulumi from '@pulumi/pulumi';

pulumi.runtime.setMocks({
	// Mock requests to provision cloud resources and return a canned response.
	newResource: (
		args: pulumi.runtime.MockResourceArgs
	): { id: string; state: { inputs: unknown } } =>
		// Here, we're returning a same-shaped object for all resource types.
		// We could, however, use the arguments passed into this function to
		// customize the mocked-out properties of a particular resource based
		// on its type. See the unit-testing docs for details:
		// https://www.pulumi.com/docs/guides/testing/unit
		({
			id: `${args.name}-id`,
			state: args.inputs,
		}),

	// Mock function calls and return whatever input properties were provided.
	call: (args: pulumi.runtime.MockCallArgs) => args.inputs,
});
