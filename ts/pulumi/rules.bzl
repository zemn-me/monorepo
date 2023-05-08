load("//ts:rules.bzl", "ts_project")

"""
Helper function for ts_project that injects pulumi unit tests.
"""
def pulumi_ts_project(name, srcs = None, **kwargs)
    ts_project(
        name = name,
        srcs = srcs,
        **kwargs
    )

    native.genrule(
        name = name + "_pulumi_test_gen",
        cmd = """
echo '
import '@pulumi/pulumi';
import 'ts/pulumi/setMocks';

test('pulumi', async () => {

})

' > $@
        """,
        outs = "pulumi_gen_test.ts"
    )