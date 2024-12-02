// provider.go

package provider

import (
	"context"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// Ensure CraneProvider satisfies the provider interface.
var (
	_ provider.Provider = &CraneProvider{}
)

// CraneProvider defines the provider implementation.
type CraneProvider struct {
	version       string
	authenticator authn.Authenticator
}

// CraneProviderModel describes the provider data model.
type CraneProviderModel struct {
	RegistryUsername types.String `tfsdk:"registry_username"`
	RegistryPassword types.String `tfsdk:"registry_password"`
}

func (p *CraneProvider) Metadata(ctx context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "crane"
	resp.Version = p.version
}

func (p *CraneProvider) Schema(ctx context.Context, req provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Provider for pushing OCI images using crane.",
		Attributes: map[string]schema.Attribute{
			"registry_username": schema.StringAttribute{
				Description: "Username for authenticating with the container registry.",
				Optional:    true,
			},
			"registry_password": schema.StringAttribute{
				Description: "Password for authenticating with the container registry.",
				Optional:    true,
				Sensitive:   true,
			},
		},
	}
}

func (p *CraneProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config CraneProviderModel

	diags := req.Config.Get(ctx, &config)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Create an authenticator based on the provided credentials
	if !config.RegistryUsername.IsNull() && !config.RegistryPassword.IsNull() {
		p.authenticator = &authn.Basic{
			Username: config.RegistryUsername.ValueString(),
			Password: config.RegistryPassword.ValueString(),
		}
	} else {
		// Use default keychain if no credentials are provided
		p.authenticator = authn.Anonymous
	}

	// Pass the provider instance to resources
	resp.ResourceData = p
}

func (p *CraneProvider) Resources(ctx context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		NewCranePushResource,
	}
}

func (p *CraneProvider) DataSources(ctx context.Context) []func() datasource.DataSource {
	return nil
}

func (p *CraneProvider) Functions(ctx context.Context) []func() function.Function {
	return nil
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &CraneProvider{
			version: version,
		}
	}
}
