package apiserver

import (
	"context"

	"github.com/twilio/twilio-go/twiml"
)

const TWILIO_CONFERENCE_NAME = "CallboxConference"

func (s *Server) postPhoneJoinConference(ctx context.Context, rq PostPhoneJoinConferenceRequestObject) (rs PostPhoneJoinConferenceResponseObject, err error) {
	if err = s.TestTwilioChallenge(rq.Params.Secret); err != nil {
		return
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
