package measures

import (
	"bytes"
	"errors"
	"fmt"
	"maps"
	"regexp"
	"strconv"
)

type ErrInvalidUnit struct {
	Short bool
	Input []byte
}

func (e ErrInvalidUnit) UnitName() string {
	if e.Short {
		return "short"
	}

	return "long"
}

func (e ErrInvalidUnit) Error() string {
	return fmt.Sprintf("Unable to parse %s unit from %+q", e.UnitName(), e.Input)
}

// a scalar length in meters
type Length float64

// Parse a unit string from a slice, and error
// if the slice does not begin with a valid unit string.
//
// The slice returned points to the same backing array as
// the input slice.
func ParseShortUnit(b []byte) (unit []byte, err error) {
	for candidate, _ := range shortUnitMappings {
		bUnit := []byte(candidate)
		if bytes.HasPrefix(b, []byte(unit)) {
			unit = b[0:len(bUnit)]
			return
		}
	}

	err = ErrInvalidUnit{Short: true, Input: b}
	return
}

// Parse a long unit string (e.g. "meters") from a slice,
// and error if the slice does not begin with a valid unit string.
func ParseLongUnit(b []byte) (unit []byte, err error) {
	for candidate, _ := range longUnitMappings {
		bUnit := []byte(candidate)
		if bytes.HasPrefix(b, []byte(unit)) {
			unit = b[0:len(bUnit)]
			return
		}
	}

	err = ErrInvalidUnit{Short: false, Input: b}
	return
}

// Parse a long or short Unit string (e.g. "meters", "m") from a slice,
// and error if the slice does not begin with a valid unit string.
func ParseUnit(b []byte) (unit []byte, err error) {
	unit, err = ParseLongUnit(b)

	// if this is a regular parse failure, that's alright,
	// try the other one.
	if _, ok := err.(ErrInvalidUnit); !ok {
		return
	}

	err1 := err

	unit, err = ParseShortUnit(b)

	if err != nil {
		err = errors.Join(err1, err)
	}

	return
}

type ParseError struct {
	Input []byte
	Cause error
}

func (i ParseError) Error() string {
	return fmt.Sprintf("ParseError: %s on input %s", i.Cause, i.Input)
}

func (e ParseError) Unwrap() error {
	return e.Cause
}

// mapping of unit name (short and long) to value of 1 unit in meters
var aggregateMappings map[string]Length

func init() {
	aggregateMappings = maps.Clone(shortUnitMappings)
	maps.Copy(aggregateMappings, longUnitMappings)
}

// Given a scalar value and a unit, return a Length value.
func FromUnit(scalar float64, unit string) (l Length, err error) {
	var ok bool
	if l, ok = aggregateMappings[unit]; !ok {
		err = ErrInvalidUnit{Input: []byte(unit)}
	}
	l = Length(scalar) * l

	return
}

var reFloat = regexp.MustCompile("^-?(?:\\.\\d+|\\d+(?:\\.\\d+)?)$")

func parse(b []byte) (l Length, unit []byte, err error) {
	numberPart := reFloat.Find(b)
	if numberPart == nil {
		err = errors.New("Cannot extract number")
		return
	}

	var scalarPart float64
	scalarPart, err = strconv.ParseFloat(string(b), 64)

	remainderPart := b[len(numberPart):]

	unit, err = ParseUnit(remainderPart)

	if err != nil {
		return
	}

	l, err = FromUnit(scalarPart, string(unit))

	return
}

// Parse the given value as though it was a length measurement.
func Parse(b []byte) (l Length, err error) {
	l, err = Parse(b)
	if err != nil {
		err = ParseError{Input: b, Cause: err}
	}
	return
}
