package proto

import (
	"os"
	"testing"

	"github.com/zemnmez/monorepo/proto" // this is a generated file
	"google.golang.org/protobuf/encoding/prototext"
)

func TestThomasValidate(t *testing.T) {
	bt, err := os.ReadFile("vcard_example.textpb")
	if err != nil {
		t.Fatal(err)
	}
	var card proto.VCard
	err = prototext.Unmarshal(bt, &card)
	if err != nil {
		t.Fatal(err)
	}
}
