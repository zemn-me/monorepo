package apiserver

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/twilio/twilio-go/twiml"

	"github.com/zemn-me/monorepo/project/zemn.me/api/server/acnh"
)

func (s *Server) postPhoneHoldMusic(rw http.ResponseWriter, rq *http.Request, params PostPhoneHoldMusicParams) (err error) {
	if err = s.TestTwilioChallenge(params.Secret); err != nil {
		return
	}

	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		return
	}

	track, err := acnh.Track(acnh.Sunny, time.Now().In(loc))
	if err != nil {
		return
	}

	doc, response := twiml.CreateDocument()
	play := response.CreateElement("Play")
	// yeah im not making it so it moves onto the next song correctly
	// right now I'm not crazy.
	play.CreateAttr("loop", "0")
	play.SetText(fmt.Sprintf("https://static.zemn.me/acnh_music/%s", url.PathEscape(track)))

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}

	rw.Header().Set("Content-Type", "application/xml")
	_, _ = rw.Write([]byte(twiML))
	return
}

// Returns a conference response with the correct animal crossing new horizons
// track as backing music!
func (s *Server) PostPhoneHoldMusic(rw http.ResponseWriter, rq *http.Request, params PostPhoneHoldMusicParams) {
	err := s.postPhoneHoldMusic(rw, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(rw, rq, err)
	}
}
