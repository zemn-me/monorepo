package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
)

// below is generated files
//go:embed multiplayer/*
var f embed.FS

//go:embed public/index.html
var index []byte

func Do() (err error) {
	nf, err := fs.Sub(f, "multiplayer")
	if err != nil {
		return
	}
	fmt.Println("Starting HTTP server @ http://localhost:8080/index.html")
	mux := http.NewServeMux()
	fileServer := http.FileServer(http.FS(nf))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			r.URL.Path = "/index.html"
			w.Write(index)
			return
		}

		fileServer.ServeHTTP(w, r)
	})

	return http.ListenAndServe(
		":8080",
		mux,
	)
}

func main() {
	if err := Do(); err != nil {
		panic(err)
	}
}
