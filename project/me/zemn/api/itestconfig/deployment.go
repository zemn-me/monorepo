// Package itestconfig reads the zemn.me runtime bindings published by the Pulumi rules_itest task.
package itestconfig

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Deployment struct {
	Environment     map[string]string `json:"environment"`
	JournalQueueURL string            `json:"journalQueueURL"`
}

func Load() (Deployment, error) {
	var deployment Deployment
	data, err := os.ReadFile(filepath.Join(os.Getenv("TEST_TMPDIR"), "zemn-deployment.json"))
	if err != nil {
		return deployment, fmt.Errorf("read Pulumi deployment: %w", err)
	}
	if err := json.Unmarshal(data, &deployment); err != nil {
		return deployment, err
	}
	if deployment.JournalQueueURL == "" || len(deployment.Environment) == 0 {
		return deployment, fmt.Errorf("incomplete zemn.me Pulumi deployment")
	}
	return deployment, nil
}
