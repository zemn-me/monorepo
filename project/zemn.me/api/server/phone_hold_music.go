package apiserver

import (
        "context"
        "fmt"
        "net/url"
        "time"

        "github.com/twilio/twilio-go/twiml"

        "github.com/zemn-me/monorepo/project/zemn.me/api/server/acnh"
)

// trackLookup allows tests to stub the ACNH track lookup function.
var trackLookup = acnh.Track

func (s *Server) postPhoneHoldMusic(ctx context.Context, rq PostPhoneHoldMusicRequestObject) (rs PostPhoneHoldMusicResponseObject, err error) {
	if err = s.TestTwilioChallenge(rq.Params.Secret); err != nil {
		return
	}

	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		return
	}

        track, err := trackLookup(acnh.Sunny, time.Now().In(loc))
	if err != nil {
		return
	}

	doc, response := twiml.CreateDocument()
	play := response.CreateElement("Play")
	// yeah im not making it so it moves onto the next song correctly
	// right now I'm not crazy.
	play.CreateAttr("loop", "0")
	play.SetText(fmt.Sprintf("https://static.zemn.me/acnh_music/%s", url.PathEscape(track)))

	return TwimlResponse{
		Document: doc,
	}, nil
}

// Returns a conference response with the correct animal crossing new horizons
// track as backing music!
func (s *Server) PostPhoneHoldMusic(ctx context.Context, rq PostPhoneHoldMusicRequestObject) (rs PostPhoneHoldMusicResponseObject, err error) {
	rs, err = s.postPhoneHoldMusic(ctx, rq)
	if rs != nil {
		return
	}
	if err != nil {
		tree, _ := twilioError(err)
		rs = TwimlResponse{Document: tree}
		err = nil
		return
	}

	return
}
