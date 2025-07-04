package main

import (
    "context"
    "fmt"
    "log"
    "net"
    "net/http"

    apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

func main() {
    srv, err := apiserver.NewServer(context.Background())
    if err != nil {
        log.Fatalf("failed to create server: %v", err)
    }

    ln, err := net.Listen("tcp", ":0")
    if err != nil {
        log.Fatalf("listen: %v", err)
    }
    addr := ln.Addr().(*net.TCPAddr)
    fmt.Printf("PORT=%d\n", addr.Port)
    if err := http.Serve(ln, srv); err != nil {
        log.Fatalf("serve: %v", err)
    }
}
