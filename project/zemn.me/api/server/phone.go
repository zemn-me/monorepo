package apiserver

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
	"unicode"

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

// Handles an error gracefully with a Twilio <Say/> response.
func (Server) HandleErrorForTwilio(rw http.ResponseWriter, rq *http.Request, err error) {
	if err == nil {
		panic("Incorrect usage.")
	}
	doc, response := twiml.CreateDocument()
	response.CreateElement("Say").SetText(
		fmt.Sprintf(
			"Something went wrong and we are unable to fulfil your request. Apologies. The issue was as follows: %s",
			err,
		),
	)

	twiML, _ := twiml.ToXML(doc)
	rw.Header().Set("Content-Type", "application/xml")
	rw.Write([]byte(twiML))

	return
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
func (s *Server) getPhoneInit(w http.ResponseWriter, r *http.Request, params GetPhoneInitParams) (err error) {
	if err = s.TestTwilioChallenge(params.Secret); err != nil {
		return
	}

	success, err := s.handleEntryViaPartyMode(w, r)

	if err != nil || success {
		return
	}

	salutation, err := Salutation()
	if err != nil {
		return
	}

	fmt.Println(
		"Rcv call",
		r.FormValue("From"),
	)

	doc, response := twiml.CreateDocument()
	gather := response.CreateElement("Gather")

	gather.CreateAttr("action", (&url.URL{
		Path: "/phone/handleEntry",
		RawQuery: url.Values{
			"secret": []string{params.Secret},
		}.Encode(),
	}).String())
	gather.CreateAttr("method", "GET")
	gather.CreateAttr("actionOnEmptyResult", "true")
	gather.CreateElement("Say").SetText(
		salutation +
			"Enter entry code now, or hold.",
	)

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}
	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiML))

	return
}

func (s *Server) GetPhoneInit(rw http.ResponseWriter, rq *http.Request, params GetPhoneInitParams) {
	err := s.getPhoneInit(rw, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(rw, rq, err)
	}
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

func (s *Server) handleEntryViaPartyMode(w http.ResponseWriter, rq *http.Request) (success bool, err error) {
	success, err = s.inPartyMode(rq.Context())
	if err != nil {
		return
	}

	if success {
		s.log.Printf("Allowed access via party mode.")
		doc, response := twiml.CreateDocument()
		response.CreateElement("Play").SetText(nook_phone_yes)
		response.CreateElement("Play").CreateAttr("digits", "9w9")

		var t string
		t, err = twiml.ToXML(doc)
		if err != nil {
			return
		}

		w.Header().Set("Content-Type", "application/xml")
		w.Write([]byte(t))
	}

	return
}

func (s *Server) handleEntryViaCode(w http.ResponseWriter, rq *http.Request, params GetPhoneHandleEntryParams) (success bool, err error) {
	codes, err := s.getLatestEntryCodes(rq.Context())
	if err != nil {
		return
	}

	var digits string

	if params.Digits != nil {
		digits = *params.Digits
	}

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

	twiml, err := twiml.ToXML(doc)
	if err != nil {
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiml))
	return
}

func (s *Server) handleEntryViaAuthorizer(w http.ResponseWriter, rq *http.Request, params GetPhoneHandleEntryParams) (err error) {
	allowedNumbers, err := s.getAllowedNumbers(rq.Context())
	if err != nil || len(allowedNumbers) == 0 {
		return fmt.Errorf("no authoriser numbers available")
	}

	// Default to the first number
	selectedNumber := allowedNumbers[0].Intl
	if params.Digits != nil {
		for _, number := range allowedNumbers {
			if number.Local == *params.Digits {
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
	conf.CreateAttr("waitUrl", fmt.Sprintf("https://api.zemn.me/phone/hold-music?secret=%s", url.QueryEscape(params.Secret)))
	conf.SetText(TWILIO_CONFERENCE_NAME)

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}

	// Make the outbound call to the authoriser
	callParams := &twilioApi.CreateCallParams{}
	callParams.SetTo(selectedNumber)
	callParams.SetFrom(os.Getenv("CALLBOX_PHONE_NUMBER"))
	callParams.SetUrl(fmt.Sprintf("https://api.zemn.me/phone/join-conference?secret=%s", url.QueryEscape(params.Secret)))

	_, err = s.twilioClient.Api.CreateCall(callParams)
	if err != nil {
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	_, _ = w.Write([]byte(twiML))
	return
}

// Takes a param of a phone number to forward the call to (the owner of that
// phone may then press 9 to open the door).
func (s *Server) getPhoneHandleEntry(w http.ResponseWriter, r *http.Request, params GetPhoneHandleEntryParams) (err error) {
	if err = s.TestTwilioChallenge(params.Secret); err != nil {
		return
	}

	ok, err := s.handleEntryViaCode(w, r, params)
	if ok || err != nil {
		return
	}

	return s.handleEntryViaAuthorizer(w, r, params)
}

func (s *Server) GetPhoneHandleEntry(w http.ResponseWriter, rq *http.Request, params GetPhoneHandleEntryParams) {
	err := s.getPhoneHandleEntry(w, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(w, rq, err)
	}
}

func (s *Server) getPhoneNumber(w http.ResponseWriter, r *http.Request) (err error) {
	if err := useOIDCAuth(w, r); err != nil {
		return err
	}

	response := GetPhoneNumberResponse{PhoneNumber: os.Getenv("CALLBOX_PHONE_NUMBER")}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

	return
}

func (s *Server) GetPhoneNumber(w http.ResponseWriter, r *http.Request) {
	if err := s.getPhoneNumber(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
