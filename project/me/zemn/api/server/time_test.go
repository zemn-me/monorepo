package apiserver

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func TestTime_String_Marshal_Unmarshal(t *testing.T) {
	london, _ := time.LoadLocation("Europe/London") // 1 Jul → BST (+01:00)
	utcNow := time.Date(2025, 6, 30, 14, 2, 24, 537939002, london)
	tt := Time{Time: utcNow}

	want := "2025-06-30T14:02:24.537939002+01:00[Europe/London]"

	// String()
	if got := tt.String(); got != want {
		t.Fatalf("String() = %q, want %q", got, want)
	}

	// Marshal
	av, err := tt.MarshalDynamoDBAttributeValue()
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	gotVal := av.(*types.AttributeValueMemberS).Value
	if gotVal != want {
		t.Fatalf("marshal value = %q, want %q", gotVal, want)
	}

	// Unmarshal round-trip
	var rt Time
	if err := rt.UnmarshalDynamoDBAttributeValue(av); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !rt.Equal(tt.Time) {
		t.Fatalf("round-trip = %v, want %v", rt.Time, tt.Time)
	}
}
