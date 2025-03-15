package apiserver

import (
	"errors"

	"github.com/google/uuid"

	ddb "github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

type UUID struct {
	uuid.UUID
}

var (
	_ ddb.Marshaler   = new(UUID)
	_ ddb.Unmarshaler = new(UUID)
)

func NewUUID() UUID {
	return UUID{uuid.New()}
}

func (u UUID) MarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) (err error) {
	var s string
	s = String()
	av.S = &s

	return
}

func (u *UUID) UnmarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) (err error) {
	if av.S == nil {
		return errors.New("failed to unmarshal uuid: expected string")
	}

	u.UUID, err = uuid.Parse(*av.S)
	if err != nil {
		return
	}

	return
}
