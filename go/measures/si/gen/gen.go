package main

// i think this should all be replaced at some point
// with a generic package that turns a CSV into
// a .go file

import (
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"unicode"
)

var outPath string
var multipliersPath string
var unitsPath string

func init() {
	flag.StringVar(&outPath, "out", "", "Output")
	flag.StringVar(&multipliersPath, "multipliers", "", "multipliers.csv")
	flag.StringVar(&unitsPath, "units", "", "units.csv")
}

type Record struct {
	name  string
	value uint
}

type OutputWriter struct {
	multipliers io.Reader
	units       io.Reader
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

func newCSVReader(r io.Reader) (rd *csv.Reader) {
	rd = csv.NewReader(r)
	rd.TrimLeadingSpace = true
	rd.ReuseRecord = true

	return
}

func readAllCSVRows(r io.Reader) (rows [][]string, err error) {
	rd := newCSVReader(r)

	// skip header
	_, err = rd.Read()

	if err != nil {
		return
	}

	return rd.ReadAll()
}

func (o *OutputWriter) writeTo(w io.Writer) (n int64, err error) {
	var multipliers [][]string
	var units [][]string
	multipliers, err = readAllCSVRows(o.multipliers)
	if err != nil {
		return
	}

	units, err = readAllCSVRows(o.units)
	if err != nil {
		return
	}

	var delta int

	delta, err = fmt.Fprintln(w, "package si")
	n += int64(delta)

	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "type BaseUnit int; type Multiplier int; type Unit struct { BaseUnit BaseUnit; Multiplier Multiplier }")
	n += int64(delta)

	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "// multiplier definitions")
	n += int64(delta)

	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "const (")
	n += int64(delta)

	if err != nil {
		return
	}

	for _, multiplier := range multipliers {
		scalar, shortName, longName := multiplier[0], multiplier[1], multiplier[2]

		delta, err = fmt.Fprintf(w, "\t// %s, %s: 10^%s\n", longName, shortName, scalar)
		n += int64(delta)
		if err != nil {
			return
		}
		delta, err = fmt.Fprintf(w, "\t%s Multiplier = %s\n", constName(longName), scalar)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintln(w, ")")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "const (")
	n += int64(delta)

	if err != nil {
		return
	}

	for i, unit := range units {
		symbol, name, meaning := unit[0], unit[1], unit[2]

		delta, err = fmt.Fprintf(w, "\t// %s (%s), a measure of %s.\n", name, symbol, meaning)
		n += int64(delta)
		if err != nil {
			return
		}
		delta, err = fmt.Fprintf(w, "\t%s BaseUnit = %d\n", constName(name), i)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintln(w, ")\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "// Symbol returns the SI symbol for the given SI base unit")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "func (u BaseUnit) Symbol() string {")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "\tswitch u {")
	n += int64(delta)
	if err != nil {
		return
	}

	for _, unit := range units {
		symbol, name, _ := unit[0], unit[1], unit[2]

		delta, err = fmt.Fprintf(w, "\t\tcase %s: return %+q\n", constName(name), symbol)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintln(w, "\t};panic(\"unknown baseunit\")")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "// Description returns the quanity definition of the SI unit")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "func (u BaseUnit) Description() string {")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "\tswitch u {")
	n += int64(delta)
	if err != nil {
		return
	}

	for _, unit := range units {
		_, name, desc := unit[0], unit[1], unit[2]

		delta, err = fmt.Fprintf(w, "\t\tcase %s: return %+q\n", constName(name), desc)
		n += int64(delta)
		if err != nil {
			return
		}
	}

	delta, err = fmt.Fprintln(w, "\t};panic(\"unkown base unit\")")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "}\n")
	n += int64(delta)
	if err != nil {
		return
	}

	delta, err = fmt.Fprintln(w, "// unit definitions\n")
	n += int64(delta)

	if err != nil {
		return
	}

	if err != nil {
		return
	}
	for _, multiplier := range multipliers {
		multiplierScalar, _, multiplierLongName := multiplier[0], multiplier[1], multiplier[2]
		multiplierConstName := constName(multiplierLongName)
		for _, unit := range units {
			unitSymbol, unitName, unitMeaning := unit[0], unit[1], unit[2]
			unitConstName := constName(unitName)
			ident := multiplierConstName + unitConstName
			help := fmt.Sprintf("// %s represents 10^%s%s.\n// A %s (%s) is a measure of %s.", ident, multiplierScalar, unitSymbol, unitName, unitSymbol, unitMeaning)
			delta, err = fmt.Fprintf(w, "%s\nvar %s = Unit { Multiplier: %s, BaseUnit: %s }\n\n", help, ident, multiplierConstName, unitConstName)

			n += int64(delta)

			if err != nil {
				return
			}

		}
	}

	delta, err = fmt.Fprintln(w, "var Units = map[string] Unit {")
	n += int64(delta)

	for _, multiplier := range multipliers {
		_, multiplierShortName, multiplierLongName := multiplier[0], multiplier[1], multiplier[2]
		multiplierConstName := constName(multiplierLongName)
		for _, unit := range units {
			unitShortName, unitName, _ := unit[0], unit[1], unit[2]
			unitConstName := constName(unitName)
			ident := multiplierConstName + unitConstName
			delta, err = fmt.Fprintf(w, "%+q: %s,\n", multiplierShortName+unitShortName, ident)

			n += int64(delta)

			if err != nil {
				return
			}

		}
	}

	delta, err = fmt.Fprintln(w, "}")

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

	if multipliersPath == "" {
		return errors.New("at least specify an input path...")
	}

	fmt.Println("Writing to", outPath, "\n")
	src, err := os.Open(multipliersPath)

	defer src.Close()

	dst, err := os.OpenFile(outPath, os.O_WRONLY|os.O_CREATE, 0755)
	defer dst.Close()
	if err != nil {
		return
	}

	units, err := os.Open(unitsPath)
	defer units.Close()
	if err != nil {
		return
	}

	_, err = io.Copy(dst, &OutputWriter{multipliers: src, units: units})

	return
}

func main() {
	flag.Parse()
	if err := Do(); err != nil {
		panic(err)
	}
}
