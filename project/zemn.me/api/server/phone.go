package apiserver

import (
	"context"
	"crypto/subtle"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
	"unicode"

	"github.com/beevik/etree"
	"github.com/nyaruka/phonenumbers"
	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
	"github.com/twilio/twilio-go/twiml"
)

func Salutation() (salutation string, err error) {
	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		return
	}

	now := time.Now().In(loc)
	hour := now.Hour()

	switch {
	case hour < 12:
		salutation = "Good morning. "
	case hour < 18:
		salutation = "Good day. "
	default:
		salutation = "Good evening. "
	}

	return
}

// normalizePhoneNumber trims the international prefix and returns the local format.
func normalizePhoneNumber(number string) (string, string, error) {
	parsedNumber, err := phonenumbers.Parse(number, "")
	if err != nil {
		return "", "", err
	}
	localFormat := phonenumbers.GetNationalSignificantNumber(parsedNumber)
	fullFormat := phonenumbers.Format(parsedNumber, phonenumbers.E164)
	return localFormat, fullFormat, nil
}

type AllowedNumber struct {
	// number in international format.
	Intl string
	// number in local format.
	Local string
}

// getAllowedNumbers returns international format and local format numbers
// in pairs so end-users can enter their numbers without faffing
// with exit codes or +.
func (s *Server) getAllowedNumbers(ctx context.Context) (numbers []AllowedNumber, err error) {
	var allowedWithPrefix []Authorizer
	allowedWithPrefix, err = s.getLatestAuthorizers(ctx)

	for _, num := range allowedWithPrefix {
		var n AllowedNumber
		n.Local, n.Intl, err = normalizePhoneNumber(num.PhoneNumber)
		if err != nil {
			return
		}
		numbers = append(numbers, n)
	}

	return
}

func (s *Server) getAllowedEntryCodes(ctx context.Context) (entryCodes []EntryCodeEntry, err error) {
	return s.getLatestEntryCodes(ctx)
}

type TwimlResponse struct {
	*etree.Document
	Code int
}

func (t *TwimlResponse) SendHTTP(w http.ResponseWriter) (err error) {
	twiML, err := twiml.ToXML(t.Document)
	if err != nil {
		return
	}
	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiML))
	code := t.Code
	if code == 0 {
		code = http.StatusOK
	}
	w.WriteHeader(code)
	return
}

func (t TwimlResponse) VisitPostPhoneJoinConferenceResponse(w http.ResponseWriter) (err error) {
	return t.SendHTTP(w)
}

func (t TwimlResponse) VisitPostPhoneHoldMusicResponse(w http.ResponseWriter) (err error) {
	return t.SendHTTP(w)
}

func (t TwimlResponse) VisitGetPhoneHandleEntryResponse(w http.ResponseWriter) (err error) {
	return t.SendHTTP(w)
}

func (t TwimlResponse) VisitPostPhoneInitResponse(w http.ResponseWriter) (err error) {
	return t.SendHTTP(w)
}

func (t TwimlResponse) VisitPostPhoneHandleEntryResponse(w http.ResponseWriter) (err error) {
	return t.SendHTTP(w)
}

// Handles an error gracefully with a Twilio <Say/> response.
func twilioError(i error) (tree *etree.Document, err error) {
	if i == nil {
		panic("Incorrect usage.")
	}
	doc, response := twiml.CreateDocument()
	response.CreateElement("Say").SetText(
		fmt.Sprintf(
			"Something went wrong and we are unable to fulfil your request. Apologies. The issue was as follows: %s",
			i,
		),
	)

	return doc, nil
}

func (s Server) TestTwilioChallenge(challenge string) (err error) {
	if challenge != s.twilioSharedSecret {
		err = fmt.Errorf("Invalid Twilio challenge.")
	}

	return
}

// Prompts the user to enter a phone number (which may be on the list of
// resident phone numbers). The user is still moved onto the next step if
// they enter nothing.
func (s *Server) postPhoneInit(ctx context.Context, rq PostPhoneInitRequestObject) (rs PostPhoneInitResponseObject, err error) {
	if err = s.TestTwilioChallenge(rq.Params.Secret); err != nil {
		return
	}

	rs, err = s.handleEntryViaPartyMode(ctx, rq)

	if err != nil || rs != nil {
		return
	}

	salutation, err := Salutation()
	if err != nil {
		return
	}

	fmt.Println(
		"Rcv call",
		rq.Body.From,
	)

	doc, response := twiml.CreateDocument()
	gather := response.CreateElement("Gather")

	gather.CreateAttr("action", (&url.URL{
		Path: "/phone/handleEntry",
		RawQuery: url.Values{
			"secret": []string{rq.Params.Secret},
		}.Encode(),
	}).String())
	// todo(@Zemnmez): change to POST.
	gather.CreateAttr("method", "GET")
	gather.CreateAttr("actionOnEmptyResult", "true")
	gather.CreateElement("Say").SetText(
		salutation +
			"Enter entry code now, or hold.",
	)

	return TwimlResponse{Document: doc}, nil
}

func (s *Server) PostPhoneInit(ctx context.Context, rq PostPhoneInitRequestObject) (rs PostPhoneInitResponseObject, err error) {
	rs, err = s.postPhoneInit(ctx, rq)
	if err != nil {
		doc, _ := twilioError(err)
		err = nil
		rs = TwimlResponse{
			Document: doc,
		}
	}

	return
}

func removeDuplicateDigits(input string) string {
	var result []rune
	var lastDigit rune
	inDigitSeq := false

	for _, r := range input {
		if unicode.IsDigit(r) {
			if !inDigitSeq || r != lastDigit {
				result = append(result, r)
			}
			lastDigit = r
			inDigitSeq = true
		} else {
			result = append(result, r)
			inDigitSeq = false
		}
	}
	return string(result)
}

func (s *Server) handleEntryViaPartyMode(ctx context.Context, rq PostPhoneInitRequestObject) (rs PostPhoneInitResponseObject, err error) {
	var success bool
	success, err = s.inPartyMode(ctx)
	if err != nil {
		return
	}

	if success {
		s.log.Printf("Allowed access via party mode.")
		doc, response := twiml.CreateDocument()

		response.CreateElement("Play").SetText(nook_phone_yes)
		response.CreateElement("Play").CreateAttr("digits", "9w9")

		return TwimlResponse{Document: doc}, nil
	}

	return
}

func (s *Server) handleEntryViaCode(ctx context.Context, rq GetPhoneHandleEntryRequestObject) (rsp GetPhoneHandleEntryResponseObject, err error) {
	codes, err := s.getLatestEntryCodes(ctx)
	if err != nil {
		return
	}

	var digits string

	if rq.Params.Digits != nil {
		digits = *rq.Params.Digits
	}

	var success bool

	for _, code := range codes {
		if success = subtle.ConstantTimeCompare(
			[]byte(removeDuplicateDigits(code.Code)), []byte(removeDuplicateDigits(digits)),
		) == 1; success {
			break
		}
	}

	if !success {
		s.log.Printf("Denied access via code entry: %+q is not a valid entry code.", digits)
		return
	}

	s.log.Printf("Allowed access via code entry: %+q", digits)

	doc, response := twiml.CreateDocument()
	response.CreateElement("Play").SetText(nook_phone_yes)
	response.CreateElement("Play").CreateAttr("digits", "9w9")

	return TwimlResponse{Document: doc}, nil
}

func (s *Server) handleEntryViaAuthorizer(ctx context.Context, rq GetPhoneHandleEntryRequestObject) (rs GetPhoneHandleEntryResponseObject, err error) {
	allowedNumbers, err := s.getAllowedNumbers(ctx)
	if err != nil {
		return
	}

	if len(allowedNumbers) == 0 {
		err = fmt.Errorf("no authoriser numbers available")
		return
	}

	// Default to the first number
	selectedNumber := allowedNumbers[0].Intl
	if rq.Params.Digits != nil {
		for _, number := range allowedNumbers {
			if number.Local == *rq.Params.Digits {
				selectedNumber = number.Intl
				break
			}
		}
	}

	// Place the caller into the conference with hold music
	doc, response := twiml.CreateDocument()
	dial := response.CreateElement("Dial")
	conf := dial.CreateElement("Conference")
	conf.CreateAttr("startConferenceOnEnter", "true")
	conf.CreateAttr("waitUrl", fmt.Sprintf("https://api.zemn.me/phone/hold-music?secret=%s", url.QueryEscape(rq.Params.Secret)))
	conf.SetText(TWILIO_CONFERENCE_NAME)

       // Make the outbound call to the authoriser
       callParams := &twilioApi.CreateCallParams{}
       callParams.SetTo(selectedNumber)
       callParams.SetFrom(os.Getenv("CALLBOX_PHONE_NUMBER"))
       callParams.SetUrl(fmt.Sprintf("https://api.zemn.me/phone/join-conference?secret=%s&attempt=1", url.QueryEscape(rq.Params.Secret)))

       _, err = s.twilioClient.Api.CreateCall(callParams)
       if err != nil {
               return
       }

	return TwimlResponse{Document: doc}, nil
}

// Takes a param of a phone number to forward the call to (the owner of that
// phone may then press 9 to open the door).
func (s *Server) getPhoneHandleEntry(ctx context.Context, rq GetPhoneHandleEntryRequestObject) (rs GetPhoneHandleEntryResponseObject, err error) {
	if err = s.TestTwilioChallenge(rq.Params.Secret); err != nil {
		return
	}

	rs, err = s.handleEntryViaCode(ctx, rq)
	if rs != nil || err != nil {
		return
	}

	return s.handleEntryViaAuthorizer(ctx, rq)
}

func (s *Server) GetPhoneHandleEntry(ctx context.Context, rq GetPhoneHandleEntryRequestObject) (rs GetPhoneHandleEntryResponseObject, err error) {
	rs, err = s.getPhoneHandleEntry(ctx, rq)
	if err != nil {
		doc, _ := twilioError(err)
		err = nil
		rs = TwimlResponse{
			Document: doc,
			// 200 bc twilio
		}
	}

	return
}

func (s *Server) GetPhoneNumber(ctx context.Context, rq GetPhoneNumberRequestObject) (rs GetPhoneNumberResponseObject, err error) {
	response := GetPhoneNumberResponse{PhoneNumber: os.Getenv("CALLBOX_PHONE_NUMBER")}

	return GetPhoneNumber200JSONResponse(response), nil
}
