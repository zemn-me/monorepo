package provider

import (
	"context"
	"fmt"
	"os"

	"github.com/google/go-containerregistry/pkg/crane"
	"github.com/google/go-containerregistry/pkg/name"
	cranename "github.com/google/go-containerregistry/pkg/name"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/layout"
	"github.com/google/go-containerregistry/pkg/v1/partial"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

type Image struct{}

type ImageArgs struct {
	Path string `pulumi:"path"`
	Tag  string `pulumi:"tag"`
}

type ImageState struct {
	ImageArgs
	Result string `pulumi:"result"`
}

func (Image) Create(ctx context.Context, name string, input ImageArgs, preview bool) (string, ImageState, error) {
	state := ImageState{ImageArgs: input}

	if preview {
		return name, state, nil
	}

	// Load and push the image using crane
	img, err := loadImage(input.Path, false)
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

func loadImage(path string, index bool) (partial.WithRawManifest, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	if !stat.IsDir() {
		img, err := crane.Load(path)
		if err != nil {
			return nil, fmt.Errorf("loading %s as tarball: %w", path, err)
		}
		return img, nil
	}

	l, err := layout.ImageIndexFromPath(path)
	if err != nil {
		return nil, fmt.Errorf("loading %s as OCI layout: %w", path, err)
	}

	if index {
		return l, nil
	}

	m, err := l.IndexManifest()
	if err != nil {
		return nil, err
	}
	if len(m.Manifests) != 1 {
		return nil, fmt.Errorf("layout contains %d entries, consider using index mode", len(m.Manifests))
	}

	desc := m.Manifests[0]
	if desc.MediaType.IsImage() {
		return l.Image(desc.Digest)
	} else if desc.MediaType.IsIndex() {
		return l.ImageIndex(desc.Digest)
	}

	return nil, fmt.Errorf("layout contains non-image (mediaType: %q), consider --index", desc.MediaType)
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
