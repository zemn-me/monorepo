package main

import (
	p "github.com/pulumi/pulumi-go-provider"
	"github.com/pulumi/pulumi-xyz/provider"
)

func main() {
	p.RunProvider(provider.Name, provider.Version, provider.Provider())
}
