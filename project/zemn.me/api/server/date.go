package apiserver

import (
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

func Now() Time {
	return Time{
		Time: time.Now(),
	}
}

func (d Time) MarshalDynamoDBAttributeValue() (av types.AttributeValue, err error) {
	return &types.AttributeValueMemberS{
		Value: d.Time.Format(time.RFC3339Nano),
	}, nil
}

func (d *Time) UnmarshalDynamoDBAttributeValue(av types.AttributeValue) (err error) {
	var s string
	err = attributevalue.Unmarshal(
		av,
		&s,
	)
	if err != nil {
		return
	}

	d.Time, err = time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return
	}

	return
}
