package apiserver

import (
	"testing"
)

func TestSmoke(t *testing.T) {
       var s Server
       _, _ = s.isDoorOpen(nil)
}
