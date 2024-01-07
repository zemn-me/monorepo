package main

import (
	"bytes"
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"
	"text/tabwriter"
)

func main() {

	var err error
	if err = do(); err == nil {
		return
	}

	switch err.(type) {
	case errUsage:
		flag.Usage()
	}

	panic(err)
}

type lineWhitespaceTrimmer struct {
	out         io.Writer
	co
	currentLine []byte
}

func (l lineWhitespaceTrimmer) trimmedCurrentLine() []byte {
	return bytes.TrimSpace(l.currentLine)
}

func (l *lineWhitespaceTrimmer) Flush() (err error) {
	_, err = l.out.Write(l.trimmedCurrentLine())
	l.currentLine = nil

	return
}

func (l *lineWhitespaceTrimmer) Close() (err error) {
	l.Flush()
	return nil
}

func (l *lineWhitespaceTrimmer) Write(b []byte) (n int, err error) {
	l.currentLine = append(l.currentLine, b...)

	for bytes.Contains(l.currentLine, []byte("\n")) {
		splits := bytes.SplitN(l.currentLine, []byte("\n"), 2)
		l.currentLine = splits[1]
		_, err = l.out.Write(append(bytes.TrimSpace(splits[0]), []byte("\n")...))

		if err != nil {
			err = fmt.Errorf("lineWhitespaceTrimmer: %w", err)
			return
		}
	}

	n = len(b)

	return
}

type byteReplacer struct {
	out  io.Writer
	from byte
	to   string
}

func (br byteReplacer) Write(b []byte) (n int, err error) {
	n, err = br.out.Write(bytes.Replace(b, []byte{br.from}, []byte(br.to), -1))
	if err != nil {
		err = fmt.Errorf("byteReplacer: %w", err)
	}
	return len(b), err
}

var input string
var output string
var overwrite bool
var debug bool
var validate bool
var comma string

func init() {
	flag.StringVar(&input, "input", "", "input file")
	flag.StringVar(&output, "output", "", "output file")
	flag.StringVar(&comma, "comma", ",", "CSV separator (sometimes ';')")
	flag.BoolVar(&overwrite, "w", false, "overwrite input with output")
	flag.BoolVar(&debug, "debug", false, "print debug info")
	flag.BoolVar(&validate, "validate", false, "Validate the number of fields is the same on every row.")
}

const holder = '\x01'

type errUsage string

func (e errUsage) Error() string { return string(e) }

var missingInput errUsage = "missing input"

type byteWriteCounter struct {
	out io.Writer
	ctr uint64
}

func (b *byteWriteCounter) Write(bt []byte) (n int, err error) {
	n, err = b.out.Write(bt)

	b.ctr += uint64(n)

	if err != nil {
		err = fmt.Errorf("byteWriteCounter: %w", err)
	}

	return
}

type PrettyCSV struct {
	rd    io.ReadCloser
	debug bool
}

func (p PrettyCSV) Read(b []byte) (n int, err error) {
	panic("this is secretly not a reader! Please use WriteTo()")
}

func (p PrettyCSV) Close() (err error) {
	return p.rd.Close()
}

func (p PrettyCSV) WriteTo(w io.Writer) (n int64, err error) {
	var padChr byte = ' '

	var tabFlags uint = 0
	if p.debug {
		tabFlags |= tabwriter.Debug
		padChr = '-'
	}

	// This is a pipeline of
	// csv reader -> csv writer -> lineReplacer -> tabReplacer -> tabWriter -> lineWhitespaceTrimmer -> byteWriteCounter -> out

	ctr := &byteWriteCounter{out: w}

	trimmer := &lineWhitespaceTrimmer{
		out: ctr,
	}

	tabWriter := tabwriter.NewWriter(trimmer, 0, 1, 3, padChr, tabFlags)

	tabReplacer := byteReplacer{
		out:  tabWriter,
		from: holder,
		to:   comma + "\t",
	}

	lineReplacer := byteReplacer{
		out:  tabReplacer,
		from: '\n',
		to:   "\t\n",
	}

	csvWriter := csv.NewWriter(lineReplacer)
	csvWriter.Comma = holder

	csvRd := csv.NewReader(p.rd)
	csvRd.Comma = []rune(comma)[0]

	for {
		var row []string
		row, err = csvRd.Read()

		if errors.Is(err, csv.ErrFieldCount) && !validate {
			err = nil
		}

		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			err = fmt.Errorf("Reading CSV row: %w", err)
			return
		}

		// strip any parsed spaces
		for i, f := range row {
			row[i] = strings.TrimSpace(f)
		}

		if err = csvWriter.Write(row); err != nil {
			err = fmt.Errorf("Writing CSV row: %w", err)
			return
		}
	}

	csvWriter.Flush()

	if err = csvWriter.Error(); err != nil {
		err = fmt.Errorf("CSV flush: %w", err)
		return
	}

	if _, err = tabWriter.Write([]byte{'\t'}); err != nil {
		err = fmt.Errorf("Writing final tab: %w", err)
		return
	}

	if err = tabWriter.Flush(); err != nil {
		err = fmt.Errorf("Flushing tabWriter: %w", err)
		return
	}

	if err = trimmer.Flush(); err != nil {
		err = fmt.Errorf("Flushing line trimmer: %w", err)
		return
	}

	return int64(ctr.ctr), nil
}

func do() (err error) {
	flag.Parse()

	if input == "" {
		return missingInput
	}

	if overwrite {
		output = input
	}

	inputFile, err := os.Open(input)

	defer inputFile.Close()

	if err != nil {
		err = fmt.Errorf("Opening input file: %w", err)
		return
	}

	tempOut, err := ioutil.TempFile("", "csvpretty")
	defer os.Remove(tempOut.Name())

	if err != nil {
		err = fmt.Errorf("Creating temporary file: %w", err)
		return
	}

	_, err = io.Copy(tempOut, PrettyCSV{rd: inputFile, debug: debug})
	if err != nil {
		err = fmt.Errorf("Copying pretty CSV to out: %w", err)
		return
	}

	if err = inputFile.Close(); err != nil {
		err = fmt.Errorf("Closing input file: %w", err)
		return
	}

	outputFile, err := os.OpenFile(output, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0700)
	defer outputFile.Close()

	if err != nil {
		err = fmt.Errorf("Opening output file: %w", err)
		return
	}

	// return to beginning of the file
	_, err = tempOut.Seek(0, 0)

	if err != nil {
		err = fmt.Errorf("Seeking to beginning of temp file: %w", err)
		return
	}

	_, err = io.Copy(outputFile, tempOut)

	if err != nil {
		err = fmt.Errorf("Copying temp file to output: %w", err)
		return
	}

	outputFile.Close()

	return nil
}
