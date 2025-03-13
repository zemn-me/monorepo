package apiserver

import (
	"encoding/json"
	"net/http"
	"os"
)

func (Server) GetPhoneNumber(w http.ResponseWriter, r *http.Request) {
	response := GetPhoneNumberResponse{PhoneNumber: os.Getenv("CALLBOX_PHONE_NUMBER")}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
