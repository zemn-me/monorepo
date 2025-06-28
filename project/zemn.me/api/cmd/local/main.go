package main

import (
    "context"
    "log"
    "net"
    "net/http"
    "os"

    apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

func main() {
    addr := os.Getenv("ADDR")
    if addr == "" {
        addr = "127.0.0.1:0"
    }

    s, err := apiserver.NewServer(context.Background())
    if err != nil {
        log.Fatal(err)
    }

    ln, err := net.Listen("tcp", addr)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("listening on http://%s", ln.Addr())
    log.Fatal(http.Serve(ln, s))
}
