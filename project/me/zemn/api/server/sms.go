package apiserver

import (
	"context"
	"fmt"

	"github.com/twilio/twilio-go"
	openapi "github.com/twilio/twilio-go/rest/api/v2010"
)

func sendSMSWithTwilio(ctx context.Context, client *twilio.RestClient, to, from, body string) error {
	if client == nil {
		return fmt.Errorf("twilio client not configured")
	}
	if to == "" || from == "" {
		return fmt.Errorf("missing sms to/from number")
	}
	params := &openapi.CreateMessageParams{}
	params.SetTo(to)
	params.SetFrom(from)
	params.SetBody(body)
	_, err := client.Api.CreateMessage(params)
	_ = ctx
	return err
}
