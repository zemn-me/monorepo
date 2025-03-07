package main

import (
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

// getAllowedNumbers retrieves and normalizes allowed phone numbers from the environment.
func getAllowedNumbers() map[string]string {
	allowedUsersEnv := os.Getenv("TWILLIO_ALLOWLISTED_USERS")
	allowedWithPrefix := strings.Split(allowedUsersEnv, ",")
	allowedNumbers := make(map[string]string)

	for _, num := range allowedWithPrefix {
		localFormat, fullFormat, err := normalizePhoneNumber(num)
		if err == nil {
			allowedNumbers[localFormat] = fullFormat
		}
	}
	return allowedNumbers
}

// the below ux sucks and needs to be amended.
func TwilioCallboxHandler(w http.ResponseWriter, r *http.Request) {
	allowedNumbers := getAllowedNumbers()
	callerInput := r.URL.Query().Get("Digits")

	w.Header().Set("Content-Type", "application/xml")
	doc, response := twiml.CreateDocument()

	if callerInput == "" {
		gather := response.CreateElement("Gather")
		gather.CreateAttr("numDigits", "10")
		gather.CreateAttr("action", r.URL.Path)
		gather.CreateAttr("method", "GET")
		gather.CreateElement("Say").SetText("Please enter the phone number you wish to call, excluding the international prefix.")
	} else {
		selectedNumber, exists := allowedNumbers[callerInput]
		if !exists {
			response.CreateElement("Say").SetText("The number you entered is not allowed. Please try again.")
			redirect := response.CreateElement("Redirect")
			redirect.CreateAttr("method", "GET")
			redirect.SetText(r.URL.Path)
		} else {
			response.CreateElement("Say").SetText("You have an incoming call from the building entry system. Press 9 a few times to open the door if you wish to grant access.")
			dial := response.CreateElement("Dial")
			dial.SetText(selectedNumber)
		}
	}

	twiML, _ := twiml.ToXML(doc)
	w.Write([]byte(twiML))
}
