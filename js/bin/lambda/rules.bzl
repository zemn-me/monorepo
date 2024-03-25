def _lambda_sources_nodejs_binary(
        name,
        srcs,
        entry_point,
        visibility = None):
    # see docs at https://www.npmjs.com/package/aws-lambda-ric
    # idk why they made this its own executable. very strange to me
    bin.aws_lambda_ric(
        name = name,
        data = srcs,
        args = ["$(location entry_point)"],
        visibility = visibility,
    )

def _lambda_sources_archive(
        name,
        srcs,
        entry_point,
        visibility = None):
    nodejs_binary_tag = name + "_nodejs_binary"
    _lambda_sources_nodejs_binary(
        name = nodejs_binary_tag,
        srcs = srcs,
        entry_point = entry_point,
        visibility = visibility,
    )
