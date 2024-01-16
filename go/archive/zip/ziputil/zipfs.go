package ziputil

import (
	"archive/zip"
	"io"
	"io/fs"
)

func ZipFs(w io.Writer, f fs.FS) (err error) {
	z := zip.NewWriter(w)

	defer z.Close()

	return fs.WalkDir(f, ".", func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			return nil
		}
		dst, err := z.Create(path)
		if err != nil {
			return err
		}

		src, err := f.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()

		_, err = io.Copy(dst, src)
		if err != nil {
			return err
		}

		return nil
	})
}
