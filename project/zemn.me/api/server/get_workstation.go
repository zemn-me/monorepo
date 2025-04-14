package apiserver

import (
	"encoding/json"
	"net/http"
	"os"
)

func (s *Server) getWorkstation(w http.ResponseWriter, r *http.Request) (err error) {
	if err := useOIDCAuth(w, r); err != nil {
		return err
	}

	w.Header().Set(
		"Location",
		os.Getenv("WORKSTATION_HOST"),
	)

	return
}

func (s *Server) GetWorkstation(w http.ResponseWriter, r *http.Request) {
	if err := s.getPhoneNumber(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
