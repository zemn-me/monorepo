package apiserver

import (
	"encoding/json"
	"net/http"
)

type Client struct {
	Id string `json:"id"`
	Name string `json:"name"`
}

var clients = []Client {
	{ Id: "660171cb-2802-497d-8392-aae34aef9af0", Name: "zemn.me"}
}

func (s *Server) postToken(rw http.ResponseWriter, rq *http.Request) (err error) {
	var oReq TokenExchangeRequest
	if err = json.NewDecoder(rq.Body).Decode(&oReq); err != nil {
		return
	}
}

func (s *Server) PostToken(w http.ResponseWriter, r *http.Request) {
	if err := s.postToken(w, r); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Error{Cause: err.Error()})
	}
}
