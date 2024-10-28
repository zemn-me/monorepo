Crane Provider for Pulumi
-------------------------

This directory includes code for using [crane] with Pulumi. Pulumi only has
support explicitly for docker and requires running a daemon etc to manipulate
images. [rules_oci] takes a much more agnostic approach that Pulumi
doesn't well support.

This provider exports one single resource, `Image`, which has arguments for the
target OCI image and the target repository to place it in.

[crane]: https://github.com/google/go-containerregistry/tree/main/cmd/crane
[rules_oci]: https://github.com/bazel-contrib/rules_oci

The following is useful information from the Pulumi boilerplate this was
partially generated from.

***

### Build & test the boilerplate XYZ provider

1. Create a new Github CodeSpaces environment using this repository.
1. Open a terminal in the CodeSpaces environment.
1. Run `make build install` to build and install the provider.
1. Run `make gen_examples` to generate the example programs in `examples/` off of the source `examples/yaml` example program.
1. Run `make up` to run the example program in `examples/yaml`.
1. Run `make down` to tear down the example program.

### Creating a new provider repository

Pulumi offers this repository as a [GitHub template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) for convenience.  From this repository:

1. Click "Use this template".
1. Set the following options:
   * Owner: pulumi
   * Repository name: pulumi-crane-native (replace "crane" with the name of your provider)
   * Description: Pulumi provider for crane
   * Repository type: Public
1. Clone the generated repository.

From the templated repository:

1. Run the following command to update files to use the name of your provider (third-party: use your GitHub organization/username):

    ```bash
    make prepare NAME=foo REPOSITORY=github.com/pulumi/pulumi-foo ORG=myorg
    ```

   This will do the following:
   - rename folders in `provider/cmd` to `pulumi-resource-{NAME}`
   - replace dependencies in `provider/go.mod` to reflect your repository name
   - find and replace all instances of the boilerplate `crane` with the `NAME` of your provider.
   - find and replace all instances of the boilerplate `zemn-me` with the `ORG` of your provider.
   - replace all instances of the `github.com/zemn-me/monorepo` repository with the `REPOSITORY` location

#### Build the provider and install the plugin

   ```bash
   $ make build install
   ```

This will:

1. Create the SDK codegen binary and place it in a `./bin` folder (gitignored)
2. Create the provider binary and place it in the `./bin` folder (gitignored)
3. Generate the dotnet, Go, Node, and Python SDKs and place them in the `./sdk` folder
4. Install the provider on your machine.

#### Test against the example

```bash
$ cd examples/simple
$ yarn link @pulumi/crane
$ yarn install
$ pulumi stack init test
$ pulumi up
```

Now that you have completed all of the above steps, you have a working provider that generates a random string for you.

#### A brief repository overview

You now have:

1. A `provider/` folder containing the building and implementation logic
    1. `cmd/pulumi-resource-crane/main.go` - holds the provider's sample implementation logic.
2. `deployment-templates` - a set of files to help you around deployment and publication
3. `sdk` - holds the generated code libraries created by `pulumi-gen-crane/main.go`
4. `examples` a folder of Pulumi programs to try locally and/or use in CI.
5. A `Makefile` and this `README`.

#### Additional Details

This repository depends on the pulumi-go-provider library. For more details on building providers, please check
the [Pulumi Go Provider docs](https://github.com/pulumi/pulumi-go-provider).

### Build Examples

Create an example program using the resources defined in your provider, and place it in the `examples/` folder.

You can now repeat the steps for [build, install, and test](#test-against-the-example).

## Configuring CI and releases

1. Follow the instructions laid out in the [deployment templates](./deployment-templates/README-DEPLOYMENT.md).

## References

Other resources/examples for implementing providers:
* [Pulumi Command provider](https://github.com/pulumi/pulumi-command/blob/master/provider/pkg/provider/provider.go)
* [Pulumi Go Provider repository](https://github.com/pulumi/pulumi-go-provider)
