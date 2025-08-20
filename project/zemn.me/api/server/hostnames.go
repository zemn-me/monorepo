package apiserver

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
)

type AssignedPorts struct {
	APIPort string `json:"@@//project/zemn.me/api/cmd/localserver:localserver_itest_service"`
}

func ApiRoot() (u *url.URL, err error) {
	ports := os.Getenv("ASSIGNED_PORTS")
	if ports == "" {
		return url.Parse("https://api.zemn.me")
	}

	var assignedPorts AssignedPorts
	if err = json.Unmarshal([]byte(ports), &assignedPorts); err != nil {
		return
	}

	if assignedPorts.APIPort == "" {
		err = fmt.Errorf("Unable to locate api server port in assignment set: %+q", ports)
		return
	}

	str := fmt.Sprintf("http://localhost:%s", assignedPorts.APIPort)

	return url.Parse(str)
}
