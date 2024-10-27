import pulumi
import pulumi_crane as crane

my_random_resource = crane.Random("myRandomResource", length=24)
pulumi.export("output", {
    "value": my_random_resource.result,
})
