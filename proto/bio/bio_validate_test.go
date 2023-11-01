package proto

import (
	"os"
	"testing"

	proto "github.com/zemnmez/monorepo/proto"
	prototext "google.golang.org/protobuf/encoding/prototext"
)

func TestBioValidate(t *testing.T) {
	bt, err := os.ReadFile("bio.textpb")
	if err != nil {
		t.Fatal(err)
	}
	var card proto.Bio
	err = prototext.Unmarshal(bt, &card)
	if err != nil {
		t.Fatal(err)
	}
}
