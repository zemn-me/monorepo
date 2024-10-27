import pulumi
import go.pulumi.provider.crane.sdk.python.pulumi_xyz as crane

my_random_resource = crane.Random("myRandomResource", length=24)
pulumi.export("output", {
    "value": my_random_resource.result,
})
