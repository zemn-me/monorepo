// glyphcss exports font outlines as CSS image shapes for floated initials.
package main

import (
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

func main() {
	fontPath := flag.String("font", "", "source OpenType or TrueType font")
	letters := flag.String("letters", "", "ASCII capitals to export")
	output := flag.String("output", "", "output stylesheet")
	flag.Parse()
	if err := run(*fontPath, *letters, *output); err != nil {
		log.Fatal(err)
	}
}

func run(fontPath, letters, output string) error {
	data, err := os.ReadFile(fontPath)
	if err != nil {
		return err
	}
	face, err := sfnt.Parse(data)
	if err != nil {
		return err
	}
	if letters == "" {
		return fmt.Errorf("no letters specified")
	}
	var css strings.Builder
	css.WriteString("/* Generated font outlines for floated initials. */\n")
	var buffer sfnt.Buffer
	for _, letter := range letters {
		if letter < 'A' || letter > 'Z' {
			return fmt.Errorf("expected an ASCII capital, got %q", letter)
		}
		index, err := face.GlyphIndex(&buffer, letter)
		if err != nil {
			return err
		}
		if index == 0 {
			return fmt.Errorf("font has no glyph for %q", letter)
		}
		segments, err := face.LoadGlyph(&buffer, index, fixed.I(1000), nil)
		if err != nil {
			return err
		}
		bounds := segments.Bounds()
		width := float64(bounds.Max.X-bounds.Min.X) / 64
		height := float64(bounds.Max.Y-bounds.Min.Y) / 64
		if width <= 0 || height <= 0 {
			return fmt.Errorf("empty outline for %q", letter)
		}
		var path strings.Builder
		for _, segment := range segments {
			var count int
			switch segment.Op {
			case sfnt.SegmentOpMoveTo:
				// Close each contour to preserve counters in the font outline.
				if path.Len() > 0 {
					path.WriteByte('Z')
				}
				path.WriteByte('M')
				count = 1
			case sfnt.SegmentOpLineTo:
				path.WriteByte('L')
				count = 1
			case sfnt.SegmentOpQuadTo:
				path.WriteByte('Q')
				count = 2
			case sfnt.SegmentOpCubeTo:
				path.WriteByte('C')
				count = 3
			default:
				return fmt.Errorf("unsupported outline segment %d", segment.Op)
			}
			for _, point := range segment.Args[:count] {
				fmt.Fprintf(&path, "%.4f %.4f ", float64(point.X)/64, float64(point.Y)/64)
			}
		}
		path.WriteByte('Z')
		// Relative dimensions make CSS Shapes rasterize at the float size, not
		// the font coordinate size, which would produce a clipped rectangle.
		svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="100%%" height="100%%" viewBox="%.4f %.4f %.4f %.4f"><path d="%s"/></svg>`, float64(bounds.Min.X)/64, float64(bounds.Min.Y)/64, width, height, path.String())
		fmt.Fprintf(&css, ".initial-%c { --initial-width: %.6fem; --initial-shape: url(\"data:image/svg+xml;base64,%s\"); }\n", letter+'a'-'A', width/height, base64.StdEncoding.EncodeToString([]byte(svg)))
	}
	return os.WriteFile(output, []byte(css.String()), 0o644)
}
