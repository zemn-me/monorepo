package apiserver

import (
	"net/http"

	"github.com/twilio/twilio-go/twiml"
)

const TWILIO_CONFERENCE_NAME = "CallboxConference"

func (s *Server) getPhoneJoinConference(rw http.ResponseWriter, rq *http.Request, params GetPhoneJoinConferenceParams) (err error) {
	if err = s.TestTwilioChallenge(params.Secret); err != nil {
		return
	}

	doc, response := twiml.CreateDocument()
	response.CreateElement("Say").SetText("You are being connected to a person requesting entry. Press 9 to grant entry.")

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
func (s *Server) GetPhoneJoinConference(rw http.ResponseWriter, rq *http.Request, params GetPhoneJoinConferenceParams) {
	err := s.getPhoneJoinConference(rw, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(rw, rq, err)
	}
}
