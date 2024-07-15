package jsonc_test

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	jsonc "github.com/zemn-me/monorepo/go/encoding/jsonc"
	testdata "github.com/zemn-me/monorepo/go/encoding/jsonc/testdata"

	diff "github.com/sergi/go-diff/diffmatchpatch"
)

func testDecode(start string, end string, t *testing.T) {
	var p interface{}
	var err error
	if err = jsonc.NewDecoder(strings.NewReader(start)).Decode(&p); err != nil {
		t.Fatal(err)
	}

	var sbt []byte
	if sbt, err = json.Marshal(&p); err != nil {
		return
	}

	var prettyBuf bytes.Buffer

	if err = json.Indent(&prettyBuf, sbt, "", "\t"); err != nil {
		return
	}

	// parse output to get consistent encoding
	var expected interface{}
	if err = json.Unmarshal([]byte(end), &expected); err != nil {
		return
	}

	var expectedBt []byte
	if expectedBt, err = json.Marshal(&expected); err != nil {
		return
	}

	var expectedBuf bytes.Buffer

	if err = json.Indent(&expectedBuf, expectedBt, "", "\t"); err != nil {
		return
	}

	expectedStr := expectedBuf.String()

	if expectedStr != prettyBuf.String() {
		dd := diff.New()
		diff := dd.DiffMain(expectedStr, prettyBuf.String(), true)
		t.Fatalf("\nsummary\n=======\n%s\ngot\n===\n%s\nwanted\n======\n%s\n", dd.DiffPrettyText(diff), dd.DiffText2(diff), dd.DiffText1(diff))
	}
}

func TestDecode1(t *testing.T) {
	testDecode(testdata.Example_Jsonc_File, testdata.Example_Jsonc_File_Out, t)
}

func TestDecode2(t *testing.T) {
	testDecode(testdata.Example2, testdata.Example2_Out, t)
}

func TestDecode3(t *testing.T) {
	testDecode(`{"/*ok":1}`, `{"/*ok":1}`, t)
}
