package main

import (
	"github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfgen"

	version "github.com/zemn-me/monorepo/go/terraform/crane/version"

	crane "github.com/zemn-me/monorepo/go/pulumi/crane/provider"
)

func main() {
	// Modify the path to point to the new provider
	tfgen.Main("crane", version.Version, crane.Provider())
}
