package main

import (
	"flag"
	"log"
	"net/http"
	"time"
)

func main() {
	address := flag.String("address", ":0", "HTTP listen address")
	flag.Parse()
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		// A healthy service can take longer than 50ms to render its readiness page.
		timer := time.NewTimer(150 * time.Millisecond)
		defer timer.Stop()
		select {
		case <-r.Context().Done():
			return
		case <-timer.C:
			_, _ = w.Write([]byte("OK"))
		}
	})
	log.Fatal(http.ListenAndServe(*address, nil))
}
