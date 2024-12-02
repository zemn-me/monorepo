// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package main

import (
	"context"
	"flag"
	"log"

	"github.com/hashicorp/terraform-plugin-framework/providerserver"

	"github.com/zemn-me/monorepo/go/terraform/crane/provider"
	version "github.com/zemn-me/monorepo/go/terraform/crane/version"
)

func main() {
	var debug bool

	flag.BoolVar(&debug, "debug", false, "set to true to run the provider with support for debuggers like delve")
	flag.Parse()

	opts := providerserver.ServeOpts{
		// TODO: Update this string with the published name of your provider.
		// Also update the tfplugindocs generate command to either remove the
		// -provider-name flag or set its value to the updated provider name.
		Address: "registry.terraform.io/zemn-me/crane",
		Debug:   debug,
	}

	err := providerserver.Serve(context.Background(), provider.New(version.Version), opts)
	if err != nil {
		log.Fatal(err.Error())
	}
}
