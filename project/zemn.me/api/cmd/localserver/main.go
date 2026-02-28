package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

var (
	address    string
	ddbAddress string
)

func init() {
	flag.StringVar(&address, "address", ":0", "Address to listen on")
	flag.StringVar(&ddbAddress, "ddb-address", "", "Address of the DynamoDB server.")
}

type AssignedPorts struct {
	APIPort          string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
	OIDCProviderPort string `json:"@@//project/zemn.me/testing:oidc_provider_itest_service"`
}

func main() {
	flag.Parse()

	assignedPorts := os.Getenv("ASSIGNED_PORTS")
	if assignedPorts != "" {
		var ports AssignedPorts
		if err := json.Unmarshal([]byte(assignedPorts), &ports); err != nil {
			log.Fatalf("failed to parse ASSIGNED_PORTS: %v (%s)", err)
		}

		ddbAddress = "http://localhost:" + ports.APIPort
		if ports.OIDCProviderPort != "" {
			issuer := fmt.Sprintf("http://localhost:%s", ports.OIDCProviderPort)
			mustSetEnv("ZEMN_TEST_OIDC_ISSUER", issuer)
			mustSetEnv("ZEMN_TEST_OIDC_PROVIDER", issuer)
		}
	}

	if os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_CLIENT_ID", "integration-test-client")
	}
	if os.Getenv("ZEMN_TEST_OIDC_SUBJECT") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_SUBJECT", "integration-test-remote")
	}
	if os.Getenv("ZEMN_TEST_OIDC_LOCAL_SUBJECT") == "" {
		mustSetEnv("ZEMN_TEST_OIDC_LOCAL_SUBJECT", "integration-test-local")
	}

	mustSetEnv("DYNAMODB_ENDPOINT", ddbAddress)
	mustSetEnv("DYNAMODB_TABLE_NAME", "table1")
	mustSetEnv("GRIEVANCES_TABLE_NAME", "table2")
	mustSetEnv("USERS_TABLE_NAME", "table3")
	mustSetEnv("CALLBOX_KEY_TABLE_NAME", "table4")

	srv, err := apiserver.NewServer(context.Background(), apiserver.NewServerOptions{
		LocalStack: true,
	})
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	if assignedPorts != "" {
		if err = srv.ProvisionTables(context.Background()); err != nil {
			log.Fatalf("failed to provision tables: %v", err)
		}
	}

	ln, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().(*net.TCPAddr)
	fmt.Printf("PORT=%d\n", addr.Port)
	if err := http.Serve(ln, srv); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func mustSetEnv(key, value string) {
	if value == "" {
		return
	}
	if err := os.Setenv(key, value); err != nil {
		log.Fatalf("failed to set %s: %v", key, err)
	}
}
