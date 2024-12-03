def jsonschema_test(name, srcs, schema):
    test_names = []
    batch_size = 1000  # Number of srcs per batch

    # Split srcs into batches of 100
    for i in range(0, len(srcs), batch_size):
        batch = srcs[i:min(i + batch_size, len(srcs))]
        batch_name = "{}.batch_{}".format(name, i // batch_size + 1)
        test_names.append(batch_name)

        native.sh_test(
            name = batch_name,
            size = "small",
            srcs = ["//go/cmd/jsonschemavalidator:jsonschema_test.sh"],
            data = batch + [
                schema,
                "//go/cmd/jsonschemavalidator",
            ],
            args = [
                "$(location //go/cmd/jsonschemavalidator)",  # Path to the validator binary
                "$(location {})".format(schema),
            ] + ["$(location {})".format(src) for src in batch],
        )

    native.test_suite(
        name = name,
        tests = test_names,
    )
