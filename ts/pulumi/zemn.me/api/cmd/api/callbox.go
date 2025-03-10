package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/nyaruka/phonenumbers"
	"github.com/twilio/twilio-go/twiml"
)

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

// getAllowedNumbers retrieves and normalizes allowed phone numbers from the environment.
func getAllowedNumbers() (numbers []AllowedNumber, err error) {
	allowedUsersEnv := os.Getenv("PERSONAL_PHONE_NUMBER")
	allowedWithPrefix := strings.Split(allowedUsersEnv, ",")
	numbers = make([]AllowedNumber, 0, len(allowedWithPrefix))

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
func TwilioErrorHandler(f func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rsp := f(w, r)
		if rsp == nil {
			return
		}

		doc, response := twiml.CreateDocument()
		response.CreateElement("Say").SetText(
			fmt.Sprintf(
				"Something went wrong and we are unable to fulfil your request. Apologies. The issue was as follows: %s",
				rsp,
			),
		)

		twiML, _ := twiml.ToXML(doc)
		w.Header().Set("Content-Type", "application/xml")
		w.Write([]byte(twiML))

		return
	}
}

// Prompts the user to enter a phone number (which may be on the list of
// resident phone numbers). The user is still moved onto the next step if
// they enter nothing.
func TwilioCallboxEntryPoint(w http.ResponseWriter, r *http.Request) (err error) {
	doc, response := twiml.CreateDocument()
	gather := response.CreateElement("Gather")
	gather.CreateAttr("action", "/phone/handleEntry")
	gather.CreateAttr("method", "GET")
	gather.CreateAttr("actionOnEmptyResult", "true")
	gather.CreateElement("Say").SetText(
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

// Takes a param of a phone number to forward the call to (the owner of that
// phone may then press 9 to open the door).
func TwilioCallboxProcessPhoneEntry(w http.ResponseWriter, r *http.Request) (err error) {
	allowedNumbers, err := getAllowedNumbers()
	if err != nil {
		return
	}

	// default to the first one in the list.
	selectedNumber := allowedNumbers[0].Intl

	for _, number := range allowedNumbers {
		if number.Local == r.URL.Query().Get("Digits") {
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
