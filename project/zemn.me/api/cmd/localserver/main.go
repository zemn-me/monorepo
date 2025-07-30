package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"

	apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

var address string

func init() {
	flag.StringVar(&address, "address", ":0", "Address to listen on")
}

func main() {
	flag.Parse()
	srv, err := apiserver.NewServer(context.Background())
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
