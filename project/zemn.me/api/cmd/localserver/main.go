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
	APIPort string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
}

func main() {
	flag.Parse()

	assignedPorts := os.Getenv("ASSIGNED_PORTS")
	if assignedPorts != "" {
		var ports AssignedPorts
		if err := json.Unmarshal([]byte(assignedPorts), &ports); err != nil {
			log.Fatalf("failed to parse ASSIGNED_PORTS: %v (%s)", err)
		}

		ddbAddress = ports.APIPort
	}

	err := os.Setenv("DYNAMODB_ENDPOINT", ddbAddress)
	if err != nil {
		log.Fatalf("failed to set DYNAMODB_ENDPOINT: %v", err)
	}

	srv, err := apiserver.NewServer(context.Background(), apiserver.NewServerOptions{
		LocalStack: true,
	})
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
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
