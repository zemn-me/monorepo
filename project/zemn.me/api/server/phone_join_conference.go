package apiserver

import (
	"context"
	"fmt"
	"net/url"
	"os"

	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
	"github.com/twilio/twilio-go/twiml"
)

const TWILIO_CONFERENCE_NAME = "CallboxConference"

func (s *Server) postPhoneJoinConference(ctx context.Context, rq PostPhoneJoinConferenceRequestObject) (rs PostPhoneJoinConferenceResponseObject, err error) {
	if err = s.TestTwilioChallenge(rq.Params.Secret); err != nil {
		return
	}

	attempt := 1
	if rq.Params.Attempt != nil {
		attempt = *rq.Params.Attempt
	}

	if rq.Body == nil || rq.Body.Digits == nil {
		doc, response := twiml.CreateDocument()
		gather := response.CreateElement("Gather")
		gather.CreateAttr("action", fmt.Sprintf("/phone/join-conference?secret=%s&attempt=%d", url.QueryEscape(rq.Params.Secret), attempt))
		gather.CreateAttr("method", "POST")
		gather.CreateAttr("numDigits", "1")
		gather.CreateAttr("timeout", "20")
		gather.CreateAttr("actionOnEmptyResult", "true")
		gather.CreateElement("Say").SetText("Press any number to accept this call")
		return TwimlResponse{Document: doc}, nil
	}

	if len(*rq.Body.Digits) == 0 {
		if attempt < 2 {
			cp := &twilioApi.CreateCallParams{}
			cp.SetTo(rq.Body.To)
			cp.SetFrom(os.Getenv("CALLBOX_PHONE_NUMBER"))
			cp.SetUrl(fmt.Sprintf("https://api.zemn.me/phone/join-conference?secret=%s&attempt=2", url.QueryEscape(rq.Params.Secret)))
			s.twilioClient.Api.CreateCall(cp)
		}
		doc, response := twiml.CreateDocument()
		response.CreateElement("Say").SetText("No input detected. Goodbye")
		response.CreateElement("Hangup")
		return TwimlResponse{Document: doc}, nil
	}

	doc, response := twiml.CreateDocument()
	dial := response.CreateElement("Dial")
	conf := dial.CreateElement("Conference")
	conf.CreateAttr("startConferenceOnEnter", "true")
	conf.CreateAttr("endConferenceOnExit", "true")
	conf.SetText(TWILIO_CONFERENCE_NAME)

	return TwimlResponse{
		Document: doc,
	}, nil
}

// Dials into a given conference name (?name=xxx)
func (s *Server) PostPhoneJoinConference(ctx context.Context, rq PostPhoneJoinConferenceRequestObject) (rs PostPhoneJoinConferenceResponseObject, err error) {
	rs, err = s.postPhoneJoinConference(ctx, rq)
	if rs != nil {
		return
	}
	if err != nil {
		tree, _ := twilioError(err)
		rs = TwimlResponse{Document: tree}
		err = nil
	}

	return
}
