// this file exists to ensure that go.mod picks up the appropriate
// dependencies used by the web testing runner.
package main

import (
	mux "github.com/gorilla/mux"
)

func main() {
	mux.NewRouter()
}
