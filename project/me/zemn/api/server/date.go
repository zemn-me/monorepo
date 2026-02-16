package apiserver

import (
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type Time struct {
	time.Time
}

var (
	_ attributevalue.Marshaler   = new(Time)
	_ attributevalue.Unmarshaler = new(Time)
)

// String returns the instant in RFC 9557 (IXDTF) form:
// 2006-01-02T15:04:05.999999999Z07:00[Zone]
func (d Time) String() string {
	// Ensure we have a sensible zone tag; fall back to UTC.
	zone := d.Location().String()
	if zone == "Local" {
		zone = "UTC"
	}
	return fmt.Sprintf("%s[%s]", d.Format(time.RFC3339Nano), zone)
}

func Now() Time {
	return Time{Time: time.Now()}
}

func (d Time) MarshalDynamoDBAttributeValue() (types.AttributeValue, error) {
	return &types.AttributeValueMemberS{Value: d.String()}, nil
}

func (d *Time) UnmarshalDynamoDBAttributeValue(av types.AttributeValue) error {
	var s string
	if err := attributevalue.Unmarshal(av, &s); err != nil {
		return err
	}

	// First parse the RFC 3339 part (up to the first '[').
	bracket := strings.IndexByte(s, '[')
	if bracket == -1 {
		bracket = len(s)
	}
	t, err := time.Parse(time.RFC3339Nano, s[:bracket])
	if err != nil {
		return err
	}

	d.Time = t
	return nil
}
