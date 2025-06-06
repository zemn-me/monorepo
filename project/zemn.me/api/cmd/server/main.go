package main

import (
    "context"
    "log"
    "net/http"
    "os"

    apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

func main() {
    ctx := context.Background()
    srv, err := apiserver.NewServer(ctx)
    if err != nil {
        log.Fatal(err)
    }
    addr := ":8080"
    if p := os.Getenv("PORT"); p != "" {
        addr = ":" + p
    }
    if err := http.ListenAndServe(addr, srv); err != nil {
        log.Fatal(err)
    }
}
