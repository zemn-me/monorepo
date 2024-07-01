// cmd version_sync keeps go.mod and go_version.bzl in sync
package main

import (
	"bufio"
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"regexp"
)

var (
	fix            bool
	test           bool
	module_bazel   string
	go_module_file string
)

const example_line = `go_sdk.download(version = "1.22.2")`

func init() {
	flag.BoolVar(&fix, "fix", false, "Whether to fix the bazel file if it is not in sync.")
	flag.BoolVar(&test, "test", true, "Whether to return a non-zero status if not in sync.")
	flag.StringVar(&module_bazel, "module_bazel", "MODULE.bazel", fmt.Sprintf("The go module file to update. Must have a line like %+q.", example_line))
	flag.StringVar(&go_module_file, "moduleFile", "go.mod", "The go.mod file to read from.")
}

type FileLike interface {
	io.Reader
	io.Seeker
	io.Writer
	io.Closer
	Truncate(size int64) error
	Name() string
}

type File struct {
	FileLike
}

func (v File) GetFirstSubmatch(re *regexp.Regexp) (start int, end int, err error) {
	if _, err = v.Seek(0, io.SeekStart); err != nil {
		return
	}
	versionIndex := re.FindReaderSubmatchIndex(bufio.NewReader(v))
	if len(versionIndex) < 2*1+2 {
		err = errors.New("Could not find match")
		return
	}

	start, end = versionIndex[2*1], versionIndex[2*1+2-1]

	return
}

// FileFiddler, given a File, and a SegementMatcher, provides
// convenient tools for efficiently finding and replacing
// part of a file matching a regex.
type FileFiddler struct {
	File
	SegmentMatcher *regexp.Regexp
	start          *int
	end            *int
	segment        []byte
}

func (f *FileFiddler) Offsets() (start int, end int, err error) {
	if f.start == nil || f.end == nil {
		f.start, f.end = new(int), new(int)
		if *f.start, *f.end, err = f.GetFirstSubmatch(f.SegmentMatcher); err != nil {
			f.start, f.end = nil, nil
			err = fmt.Errorf("find %+q in %+q: %v", f.SegmentMatcher.String(), f.File.Name(), err)
			return
		}
	}

	return *f.start, *f.end, nil
}

func (f *FileFiddler) ReadSegment() (segment []byte, err error) {
	if f.segment != nil {
		return f.segment, nil
	}

	var start int
	var end int
	if start, end, err = f.Offsets(); err != nil {
		err = fmt.Errorf("read matched segment: %v", err)
		return
	}

	f.Seek(int64(start), io.SeekStart)
	segment = make([]byte, end-start)
	if _, err = f.Read(segment); err != nil {
		err = fmt.Errorf("read from byte %d to %d of %+q:", start, end, f.File.Name())
		return
	}

	return
}

func (f FileFiddler) OverwriteSegment(n []byte) (err error) {
	var start int
	if start, _, err = f.Offsets(); err != nil {
		return
	}
	// buffer the whole file after the end of the match
	var b bytes.Buffer
	if _, err = io.Copy(&b, f); err != nil {
		return
	}
	// truncate the file at the beginning of the match
	if err = f.Truncate(int64(start)); err != nil {
		return
	}

	// append the new segment
	if _, err = f.Seek(int64(start), io.SeekStart); err != nil {
		return
	}

	if _, err = io.Copy(f, io.MultiReader(bytes.NewReader(n), &b)); err != nil {
		return
	}

	return
}

var ReVersionFileVersion = regexp.MustCompile(`go_sdk.download\s*\(\s*version\s*=\s*"([^"]*)"\s*\)\n`)

type VersionFile struct {
	FileFiddler
}

func (v *VersionFile) LazyInit() {
	if v.FileFiddler.SegmentMatcher == nil {
		v.FileFiddler.SegmentMatcher = ReVersionFileVersion
	}
}

func (v *VersionFile) Version() (version []byte, err error) {
	v.LazyInit()
	version, err = v.ReadSegment()
	if err != nil {
		err = fmt.Errorf("While getting version from %+q: %v", v.File.Name(), err)
	}
	return
}

func (v *VersionFile) SetVersion(b []byte) (err error) {
	v.LazyInit()
	if err = v.OverwriteSegment(b); err != nil {
		err = fmt.Errorf("While setting new version (%+q) in %+q: %v", b, v.File.Name(), err)
	}
	return
}

var ReModuleFileVersion = regexp.MustCompile(`go ([^\s]+)\n`)

type ModuleFile struct {
	FileFiddler
}

func (v *ModuleFile) LazyInit() {
	if v.FileFiddler.SegmentMatcher == nil {
		v.FileFiddler.SegmentMatcher = ReModuleFileVersion
	}
}

func (v *ModuleFile) Version() (version []byte, err error) {
	v.LazyInit()
	return v.ReadSegment()
}

func (v *ModuleFile) SetVersion(b []byte) (err error) {
	v.LazyInit()
	return v.OverwriteSegment(b)
}

func do() (err error) {
	var fileMode int = os.O_RDONLY
	if fix {
		fileMode = os.O_RDWR
	}
	vff, err := os.OpenFile(module_bazel, fileMode, 0o777)
	if err != nil {
		err = fmt.Errorf("Opening version file %+q: %v", module_bazel, err)
		return
	}

	versionFile := VersionFile{FileFiddler: FileFiddler{File: File{FileLike: vff}}}
	defer versionFile.Close()

	modf, err := os.OpenFile(go_module_file, fileMode, 0o777)
	if err != nil {
		err = fmt.Errorf("Opening go module file %+q: %v", go_module_file, err)
		return
	}

	moduleFile := ModuleFile{FileFiddler: FileFiddler{File: File{FileLike: modf}}}
	defer moduleFile.Close()

	versionFileVersion, err := versionFile.Version()
	if err != nil {
		err = fmt.Errorf("While getting version from bazel module: %v", err)
		return
	}

	moduleFileVersion, err := moduleFile.Version()
	if err != nil {
		err = fmt.Errorf("While getting version from go module: %v", err)
		return
	}

	inSync := bytes.Equal(versionFileVersion, moduleFileVersion)

	if fix && !inSync {
		err = versionFile.OverwriteSegment(moduleFileVersion)
		if err != nil {
			err = fmt.Errorf("While setting bazel module version to +%q: %v", moduleFileVersion, err)
			return
		}
	}

	if test && !inSync {
		return fmt.Errorf("%+q and %+q are not in sync. %+q has: %+q; %+q has: %+q.", module_bazel, go_module_file, module_bazel, versionFileVersion, go_module_file, moduleFileVersion)
	}

	return
}

func main() {
	flag.Parse()
	if err := do(); err != nil {
		panic(err)
	}
}
