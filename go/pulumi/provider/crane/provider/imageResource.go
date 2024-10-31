package provider

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/google/go-containerregistry/pkg/crane"
	"github.com/google/go-containerregistry/pkg/name"
	Name "github.com/google/go-containerregistry/pkg/name"
	cranename "github.com/google/go-containerregistry/pkg/name"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/partial"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/tarball"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type Image struct{}

type ImageArgs struct {
	Image pulumi.Asset `pulumi:"Image"`
	Tag   string       `pulumi:"tag"`
}

type ImageState struct {
	ImageArgs
	Result string `pulumi:"result"`
}

func assetToOpener(a pulumi.Asset) tarball.Opener {
	return func() (io.ReadCloser, error) {
		if path := a.Path(); path != "" {
			return os.Open(path)
		}

		if text := a.Text(); text != "" {
			return io.NopCloser(strings.NewReader(text)), nil
		}

		panic("unimplmented")
	}
}

func (Image) Create(ctx context.Context, name string, input ImageArgs, preview bool) (string, ImageState, error) {
	state := ImageState{ImageArgs: input}

	if preview {
		return name, state, nil
	}

	tag, err := Name.NewTag("")
	if err != nil {
		return "", ImageState{}, err
	}

	// Load and push the image using crane
	img, err := tarball.Image(assetToOpener(input.Image), &tag)
	if err != nil {
		return name, state, err
	}

	ref, err := cranename.ParseReference(input.Tag)
	if err != nil {
		return name, state, err
	}

	if err := pushImage(ref, img); err != nil {
		return name, state, err
	}

	// Get the image digest and update the state
	var h v1.Hash
	switch t := img.(type) {
	case v1.Image:
		h, err = t.Digest()
		if err != nil {
			return name, state, err
		}
	case v1.ImageIndex:
		h, err = t.Digest()
		if err != nil {
			return name, state, err
		}
	}

	digest := ref.Context().Digest(h.String())
	state.Result = digest.String()

	return name, state, nil
}

func pushImage(ref name.Reference, img partial.WithRawManifest) error {
	switch t := img.(type) {
	case v1.Image:
		return remote.Write(ref, t)
	case v1.ImageIndex:
		return remote.WriteIndex(ref, t)
	default:
		return fmt.Errorf("cannot push type (%T) to registry", img)
	}
}

func (Image) Update(ctx pulumi.Context, id string, state ImageState, input ImageArgs, preview bool) (ImageState, error) {
	if preview {
		return state, nil
	}

	// Step 1: Pull the current image from the registry using crane
	ref, err := name.ParseReference(state.Result) // Assuming state.Result contains the image tag
	if err != nil {
		return state, fmt.Errorf("error parsing reference: %w", err)
	}

	// Pull the current image
	currentImg, err := crane.Pull(ref.Name())
	if err != nil {
		return state, fmt.Errorf("error pulling current image: %w", err)
	}

	tag, err := Name.NewTag("")
	if err != nil {
		return state, err
	}

	// Step 2: Load the new image from the provided path
	newImg, err := tarball.Image(assetToOpener(input.Image), &tag)
	if err != nil {
		return state, fmt.Errorf("error loading new image: %w", err)
	}

	// Step 3: Compare the manifests instead of the digest
	currentManifest, err := currentImg.RawManifest() // Get raw manifest of the current image
	if err != nil {
		return state, fmt.Errorf("error getting current image manifest: %w", err)
	}

	newManifest, err := newImg.RawManifest() // Get raw manifest of the new image
	if err != nil {
		return state, fmt.Errorf("error getting new image manifest: %w", err)
	}

	// Compare the manifests. If they are identical, skip the update
	if bytes.Equal(currentManifest, newManifest) {
		return state, nil
	}

	// Step 4: Push the new image if the manifests differ
	ref, err = name.ParseReference(input.Tag) // Parse the new image tag
	if err != nil {
		return state, fmt.Errorf("error parsing reference: %w", err)
	}

	if err := pushImage(ref, newImg); err != nil {
		return state, fmt.Errorf("error pushing new image: %w", err)
	}

	// Step 5: Update the state with the new image digest
	newDigest := ref.Context().Digest(fmt.Sprintf("%x", newManifest)) // Use the manifest bytes to generate a digest-like value
	state.Result = newDigest.String()

	return state, nil
}

func (Image) Delete(ctx pulumi.Context, id string, state ImageState) error {
	// Step 1: Parse the image reference from the state
	ref, err := name.ParseReference(state.Result) // Assuming state.Result contains the image tag
	if err != nil {
		return fmt.Errorf("error parsing image reference for deletion: %w", err)
	}

	// Step 2: Delete the image from the remote registry
	if err := crane.Delete(ref.Name()); err != nil {
		return fmt.Errorf("error deleting image: %w", err)
	}

	return nil
}
