package apiserver

import (
	"net/http"

	"github.com/twilio/twilio-go/twiml"
)

const TWILIO_CONFERENCE_NAME = "CallboxConference"

func (s *Server) postPhoneJoinConference(rw http.ResponseWriter, rq *http.Request, params PostPhoneJoinConferenceParams) (err error) {
	if err = s.TestTwilioChallenge(params.Secret); err != nil {
		return
	}

	doc, response := twiml.CreateDocument()
	dial := response.CreateElement("Dial")
	conf := dial.CreateElement("Conference")
	conf.CreateAttr("startConferenceOnEnter", "true")
	conf.CreateAttr("endConferenceOnExit", "true")
	conf.SetText(TWILIO_CONFERENCE_NAME)

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}

	rw.Header().Set("Content-Type", "application/xml")
	_, _ = rw.Write([]byte(twiML))
	return
}

// dials into a given conference name (?name=xxx)
func (s *Server) PostPhoneJoinConference(rw http.ResponseWriter, rq *http.Request, params PostPhoneJoinConferenceParams) {
	err := s.postPhoneJoinConference(rw, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(rw, rq, err)
	}
}
