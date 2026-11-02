package apiserver

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
)

type AssignedPorts struct {
	APIPort         string `json:"@@//project/me/zemn/api/cmd/localserver:localserver_itest_service"`
	CalendarAPIPort string `json:"@@//project/me/zemn/api/cmd/localserver:localserver_calendar_fixture_itest_service"`
}

func ApiRoot() (u *url.URL, err error) {
	ports := os.Getenv("ASSIGNED_PORTS")
	if ports == "" {
		origin := os.Getenv("ZEMN_API_ORIGIN")
		if origin == "" {
			origin = "https://api.zemn.me"
		}
		u, err := url.Parse(origin)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
			return nil, fmt.Errorf("ZEMN_API_ORIGIN must be an HTTPS origin without a path")
		}
		return u, nil
	}

	var assignedPorts AssignedPorts
	if err = json.Unmarshal([]byte(ports), &assignedPorts); err != nil {
		return
	}
	if assignedPorts.APIPort == "" {
		assignedPorts.APIPort = assignedPorts.CalendarAPIPort
	}

	if assignedPorts.APIPort == "" {
		err = fmt.Errorf("Unable to locate api server port in assignment set: %+q", ports)
		return
	}

	str := fmt.Sprintf("http://localhost:%s", assignedPorts.APIPort)

	return url.Parse(str)
}
