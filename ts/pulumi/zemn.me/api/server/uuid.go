package apiserver

import (
	"github.com/google/uuid"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type UUID struct {
	uuid.UUID
}

var (
	_ attributevalue.Marshaler   = new(UUID)
	_ attributevalue.Unmarshaler = new(UUID)
)

func NewUUID() UUID {
	return UUID{uuid.New()}
}

func (u UUID) MarshalDynamoDBAttributeValue() (av types.AttributeValue, err error) {
	return &types.AttributeValueMemberS{
		Value: u.String(),
	}, nil
}

func (u *UUID) UnmarshalDynamoDBAttributeValue(av types.AttributeValue) (err error) {
	var s string
	err = attributevalue.Unmarshal(
		av,
		&s,
	)
	if err != nil {
		return
	}

	u.UUID, err = uuid.Parse(s)
	if err != nil {
		return
	}

	return
}
