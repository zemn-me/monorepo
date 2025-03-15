package apiserver

import (
	"errors"
	"time"

	ddb "github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

type Time struct {
	time.Time
}

var (
	_ ddb.Marshaler   = new(Time)
	_ ddb.Unmarshaler = new(Time)
)

func Now() Time {
	return Time {
		Time: time.Now()
	}
}

func (d Time) MarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) (err error) {
	var s string
	s = d.Time.Format(time.RFC3339Nano)
	av.S = &s

	return
}

func (d *Date) UnmarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) (err error) {
	if av.S == nil {
		return errors.New("failed to unmarshal date: expected string")
	}

	d.Time, err := time.Parse(time.RFC3339Nano, *av.S)
	if err != nil {
		return
	}

	return
}
