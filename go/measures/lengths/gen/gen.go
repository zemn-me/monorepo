package main

import (
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"unicode"
)

var outPath string
var inPath string

func init() {
	flag.StringVar(&outPath, "out", "", "Output")
	flag.StringVar(&inPath, "in", "", "Input")
}

type Record struct {
	name  string
	value uint
}

type OutputWriter struct {
	from io.Reader
}

func constName(s string) string {
	runes := []rune(s)
	return string(append([]rune{unicode.ToTitle(runes[0])}, runes[1:]...))
}

func (*OutputWriter) Read([]byte) (int, error) {
	panic("unimplemented -- use WriteTo")
}

var _ io.WriterTo = &OutputWriter{}
var _ io.Reader = &OutputWriter{}

func (o *OutputWriter) writeTo(w io.Writer) (n int64, err error) {
	rd := csv.NewReader(o.from)
	rd.TrimLeadingSpace = true
	rd.ReuseRecord = true

	type Unit struct {
		name     string
		fullName string
		meters   float64
		plural   string
	}

	var units []Unit

	// skip first row
	_, err = rd.Read()
	if err != nil {
		return
	}

	for {
		var record []string
		record, err = rd.Read()

		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			return
		}

		var meters float64

		meters, err = strconv.ParseFloat(record[3], 64)
		if err != nil {
			return
		}

		units = append(units, Unit{
			name:     record[0],
			fullName: record[1],
			meters:   meters,
			plural:   record[2],
		})
	}

	var delta int
	delta, err = fmt.Fprintf(w, "package measures\n")
	n += int64(delta)

	for _, unit := range units {
		delta, err = fmt.Fprintf(w, "const %s Length = %f\n", constName(unit.fullName), unit.meters)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "var shortUnitMappings map[string] Length = map[string]Length{\n")
	n += int64(delta)
	if err != nil {
		return
	}

	for _, unit := range units {
		delta, err = fmt.Fprintf(w, "%+q: %s,\n", unit.name, constName(unit.fullName))
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)

	delta, err = fmt.Fprintf(w, "var longUnitMappings map[string] Length = map[string]Length{\n")
	n += int64(delta)
	if err != nil {
		return
	}

	for _, unit := range units {
		delta, err = fmt.Fprintf(w, "%+q: %s,\n", unit.plural, constName(unit.fullName))
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)

	return
}

type WriteToError struct {
	err error
}

func (w WriteToError) Error() string {
	return fmt.Sprintf("WriteTo: %s", w.err)
}

func (w WriteToError) Unwrap() error {
	return w.err
}

func (o *OutputWriter) WriteTo(w io.Writer) (n int64, err error) {
	n, err = o.writeTo(w)
	if err != nil {
		err = WriteToError{err}
	}

	return
}

func (o OutputWriter) Close() error {
	return nil
}

func Do() (err error) {
	if outPath == "" {
		return errors.New("at least specify an output path...")
	}

	if inPath == "" {
		return errors.New("at least specify an input path...")
	}

	fmt.Println("Writing to", outPath, "\n")
	src, err := os.Open(inPath)

	defer src.Close()

	dst, err := os.OpenFile(outPath, os.O_WRONLY|os.O_CREATE, 0755)
	defer dst.Close()
	if err != nil {
		return
	}

	_, err = io.Copy(dst, &OutputWriter{from: src})

	return
}

func main() {
	flag.Parse()
	if err := Do(); err != nil {
		panic(err)
	}
}
