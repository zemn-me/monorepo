package provider

import (
	"context"
	"fmt"
	"os"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/crane"
	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// Ensure the implementation satisfies the expected interfaces
var (
	_ resource.Resource                = &CranePushResource{}
	_ resource.ResourceWithConfigure   = &CranePushResource{}
	_ resource.ResourceWithImportState = &CranePushResource{}
)

// NewCranePushResource is a helper function to simplify the provider implementation.
func NewCranePushResource() resource.Resource {
	return &CranePushResource{}
}

// CranePushResource is the resource implementation.
type CranePushResource struct {
	authenticator authn.Authenticator
}

// CranePushResourceModel maps the resource schema data.
type CranePushResourceModel struct {
	ID    types.String `tfsdk:"id"`
	Image types.String `tfsdk:"image"` // Path to the local OCI image tarball
	Repo  types.String `tfsdk:"repo"`  // Repository URI to push the image to
}

func (r *CranePushResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = "crane_push_image"
}

func (r *CranePushResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Resource to push an OCI image to a repository using crane.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The ID of the pushed image (image digest).",
				Computed:    true,
			},
			"image": schema.StringAttribute{
				Description: "Path to the local OCI image tarball.",
				Required:    true,
			},
			"repo": schema.StringAttribute{
				Description: "Repository URI to push the image to.",
				Required:    true,
			},
		},
	}
}

func (r *CranePushResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	provider, ok := req.ProviderData.(*CraneProvider)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Provider Data Type",
			fmt.Sprintf("Expected *CraneProvider, got: %T", req.ProviderData),
		)
		return
	}

	r.authenticator = provider.authenticator
}

func (r *CranePushResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var data CranePushResourceModel

	// Read the plan data
	diags := req.Plan.Get(ctx, &data)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Use helper function to push the image
	if err := r.cranePushImage(ctx, data.Image.ValueString(), data.Repo.ValueString(), &data, &resp.Diagnostics); err != nil {
		resp.Diagnostics.AddError(
			"Error Pushing Image",
			fmt.Sprintf("Could not push image to repository: %s", err),
		)
		return
	}

	// Set the ID to the image digest
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *CranePushResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var data CranePushResourceModel

	// Read the state data
	diags := req.State.Get(ctx, &data)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Use helper function to get the image digest from the repository
	digest, err := r.craneDigest(ctx, data.Repo.ValueString(), &resp.Diagnostics)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Reading Image",
			fmt.Sprintf("Could not read image from repository: %s", err),
		)
		return
	}

	// Update the ID with the current digest
	data.ID = types.StringValue(digest)
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *CranePushResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var data CranePushResourceModel

	// Read the plan data
	diags := req.Plan.Get(ctx, &data)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Use helper function to push the updated image
	if err := r.cranePushImage(ctx, data.Image.ValueString(), data.Repo.ValueString(), &data, &resp.Diagnostics); err != nil {
		resp.Diagnostics.AddError(
			"Error Updating Image",
			fmt.Sprintf("Could not push updated image to repository: %s", err),
		)
		return
	}

	// Set the ID to the new image digest
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *CranePushResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var data CranePushResourceModel

	// Read the state data
	diags := req.State.Get(ctx, &data)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Use helper function to delete the image from the repository
	if err := r.craneDeleteImage(ctx, data.Repo.ValueString(), &resp.Diagnostics); err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting Image",
			fmt.Sprintf("Could not delete image from repository: %s", err),
		)
		return
	}

	// Remove the resource from state by not setting it
}

func (r *CranePushResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	// Set the ID from the import
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("id"), req.ID)...)
}

// Helper function to push the image using crane
func (r *CranePushResource) cranePushImage(ctx context.Context, imagePath string, repo string, data *CranePushResourceModel, diags *diag.Diagnostics) error {
	// Check if the image file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return fmt.Errorf("image file does not exist at path: %s", imagePath)
	}

	// Parse the repository reference
	ref, err := name.ParseReference(repo)
	if err != nil {
		return fmt.Errorf("failed to parse repository reference: %w", err)
	}

	// Load the image from the tarball
	img, err := crane.Load(imagePath)
	if err != nil {
		return fmt.Errorf("failed to load image from %s: %w", imagePath, err)
	}

	// Push the image with authentication
	err = remote.Write(ref, img, remote.WithAuth(r.authenticator))
	if err != nil {
		return fmt.Errorf("failed to push image: %w", err)
	}

	// Get the image digest
	digest, err := img.Digest()
	if err != nil {
		return fmt.Errorf("failed to get image digest: %w", err)
	}

	// Set the ID to the image digest
	data.ID = types.StringValue(digest.String())

	return nil
}

// Helper function to get the image digest from the repository
func (r *CranePushResource) craneDigest(ctx context.Context, repo string, diags *diag.Diagnostics) (string, error) {
	ref, err := name.ParseReference(repo)
	if err != nil {
		return "", fmt.Errorf("failed to parse repository reference: %w", err)
	}

	desc, err := remote.Head(ref, remote.WithAuth(r.authenticator))
	if err != nil {
		return "", fmt.Errorf("failed to get image descriptor: %w", err)
	}

	return desc.Digest.String(), nil
}

// Helper function to delete the image from the repository
func (r *CranePushResource) craneDeleteImage(ctx context.Context, repo string, diags *diag.Diagnostics) error {
	ref, err := name.ParseReference(repo)
	if err != nil {
		return fmt.Errorf("failed to parse repository reference: %w", err)
	}

	err = remote.Delete(ref, remote.WithAuth(r.authenticator))
	if err != nil {
		return fmt.Errorf("failed to delete image: %w", err)
	}

	return nil
}
