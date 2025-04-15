package apiserver

import (
	"encoding/json"
	"net/http"
	"os"
)

func (s *Server) getWorkstation(w http.ResponseWriter, r *http.Request) (err error) {
	w.Header().Set(
		"Location",
		os.Getenv("WORKSTATION_HOST"),
	)

	return
}

func (s *Server) GetWorkstation(w http.ResponseWriter, r *http.Request) {
	if err := s.getWorkstation(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
