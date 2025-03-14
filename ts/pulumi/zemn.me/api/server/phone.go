package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/nyaruka/phonenumbers"
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
	var allowedWithPrefix []string
	allowedWithPrefix, err = s.getLatestAuthorizers(ctx)

	for _, num := range allowedWithPrefix {
		var n AllowedNumber
		n.Local, n.Intl, err = normalizePhoneNumber(num)
		if err != nil {
			return
		}
		numbers = append(numbers, n)
	}

	return
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

// Prompts the user to enter a phone number (which may be on the list of
// resident phone numbers). The user is still moved onto the next step if
// they enter nothing.
func (Server) getPhoneInit(w http.ResponseWriter, r *http.Request) (err error) {
	salutation, err := Salutation()
	if err != nil {
		return
	}

	doc, response := twiml.CreateDocument()
	gather := response.CreateElement("Gather")
	gather.CreateAttr("action", "/phone/handleEntry")
	gather.CreateAttr("method", "GET")
	gather.CreateAttr("actionOnEmptyResult", "true")
	gather.CreateElement("Say").SetText(
		salutation +
			"If you have access, please enter your phone number now, " +
			"or hold to be conected to a resident.\n\n" +
			"Press the pound or hash key when you are done.",
	)

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}
	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiML))

	return
}

func (s Server) GetPhoneInit(rw http.ResponseWriter, rq *http.Request) {
	err := s.getPhoneInit(rw, rq)
	if err != nil {
		s.HandleErrorForTwilio(rw, rq, err)
	}
}

// Takes a param of a phone number to forward the call to (the owner of that
// phone may then press 9 to open the door).
func (s *Server) getPhoneHandleEntry(w http.ResponseWriter, r *http.Request, params GetPhoneHandleEntryParams) (err error) {
	allowedNumbers, err := s.getAllowedNumbers(r.Context())
	if err != nil {
		return
	}

	// default to the first one in the list.
	selectedNumber := allowedNumbers[0].Intl

	var digits string

	if params.Digits != nil {
		digits = *params.Digits
	}

	for _, number := range allowedNumbers {
		if number.Local == digits {
			selectedNumber = number.Intl
			break
		}
	}

	doc, response := twiml.CreateDocument()
	response.CreateElement("Dial").CreateElement("Number").SetText(selectedNumber)

	twiML, err := twiml.ToXML(doc)
	if err != nil {
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiML))
	return
}

func (s *Server) GetPhoneHandleEntry(w http.ResponseWriter, rq *http.Request, params GetPhoneHandleEntryParams) {
	err := s.getPhoneHandleEntry(w, rq, params)
	if err != nil {
		s.HandleErrorForTwilio(w, rq, err)
	}
}

func (Server) GetPhoneNumber(w http.ResponseWriter, r *http.Request) {
	response := GetPhoneNumberResponse{PhoneNumber: os.Getenv("CALLBOX_PHONE_NUMBER")}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
