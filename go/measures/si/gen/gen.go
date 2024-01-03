package main

// i think this should all be replaced at some point
// with a generic package that turns a CSV into
// a .go file

import (
	"math/bits"
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

	type Datum struct {
		scalar    int
		shortName string
		longName  string
	}

	var data []Datum

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

		var scalar int64

		scalar, err = strconv.ParseInt(record[0], 10, int(bits.UintSize))
		if err != nil {
			return
		}

		data = append(data, Datum{
			scalar:    int(scalar),
			shortName: record[1],
			longName:  record[2],
		})
	}

	var delta int
	delta, err = fmt.Fprintf(w, "package si\n")
	n += int64(delta)

	delta, err = fmt.Fprintf(w, "const (\n")
	n += int64(delta)

	if err != nil {
		return
	}

	for _, datum := range data {
		delta, err = fmt.Fprintf(w, "%s Multiplier = %d;\n", constName(datum.longName), datum.scalar)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, ")\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintf(w, "var multiplier_long_names = [...]string{\n")
	n += int64(delta)

	for _, datum := range data {
		delta, err = fmt.Fprintf(w, "%+q,\n", datum.longName)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintf(w, "var multiplier_short_names = [...]string{\n")
	n += int64(delta)

	for _, datum := range data {
		delta, err = fmt.Fprintf(w, "%+q,\n", datum.shortName)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}


	delta, err = fmt.Fprintf(w, "var multiplier_scalars = [...]Multiplier{\n")
	n += int64(delta)

	for _, datum := range data {
		delta, err = fmt.Fprintf(w, "%v,\n", constName(datum.longName))
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintf(w, "var short_name_to_index = map[string]uint{\n")
	n += int64(delta)

	for i, datum := range data {
		delta, err = fmt.Fprintf(w, "%+q: %d,\n", datum.shortName, i)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}


	delta, err = fmt.Fprintf(w, "var long_name_to_index = map[string]uint{\n")
	n += int64(delta)

	for i, datum := range data {
		delta, err = fmt.Fprintf(w, "%+q: %d,\n", datum.longName, i)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintf(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}


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
