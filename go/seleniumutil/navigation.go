package selenium

import (
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// GetWithNetworkRetry navigates and waits for same-origin requests to settle.
// Chromium can cancel initial module loads with ERR_NETWORK_CHANGED while its
// network service starts. Retry only that failure, before test input begins;
// blocked downloads, HTTP errors, and application failures remain observable.
func (d *Driver) GetWithNetworkRetry(address string) error {
	origin, err := url.Parse(address)
	if err != nil {
		return err
	}
	for attempt := 0; attempt < 3; attempt++ {
		watch, err := d.watchNavigation(origin)
		if err != nil {
			return err
		}
		navigateErr := d.Get(address)
		changed, settleErr := watch.settle()
		watch.close()
		if changed || (navigateErr != nil && strings.Contains(navigateErr.Error(), "net::ERR_NETWORK_CHANGED")) {
			log.Printf("navigation to %s interrupted by ERR_NETWORK_CHANGED (attempt %d of 3)", address, attempt+1)
			continue
		}
		if navigateErr != nil {
			return navigateErr
		}
		return settleErr
	}
	return fmt.Errorf("navigate %s: ERR_NETWORK_CHANGED persisted after three attempts", address)
}

type navigationWatch struct {
	conn         *websocket.Conn
	origin       *url.URL
	mu           sync.Mutex
	pending      map[string]bool
	lastActivity time.Time
	changed      bool
	err          error
	done         chan struct{}
}

type navigationEvent struct {
	ID     int    `json:"id"`
	Method string `json:"method"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
	Params struct {
		RequestID string `json:"requestId"`
		Request   struct {
			URL string `json:"url"`
		} `json:"request"`
		ErrorText string `json:"errorText"`
	} `json:"params"`
}

func (d *Driver) watchNavigation(origin *url.URL) (*navigationWatch, error) {
	page, err := d.OpenPageCommands()
	if err != nil {
		return nil, err
	}
	conn := page.conn
	conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
	if err := conn.WriteJSON(map[string]any{"id": 1, "method": "Network.enable"}); err != nil {
		conn.Close()
		return nil, err
	}
	for {
		var event navigationEvent
		if err := conn.ReadJSON(&event); err != nil {
			conn.Close()
			return nil, err
		}
		if event.ID == 1 {
			if event.Error != nil {
				conn.Close()
				return nil, fmt.Errorf("watch navigation: %s", event.Error.Message)
			}
			break
		}
	}
	conn.SetReadDeadline(time.Time{})
	watch := &navigationWatch{conn: conn, origin: origin, pending: make(map[string]bool), lastActivity: time.Now(), done: make(chan struct{})}
	go func() {
		defer close(watch.done)
		for {
			var event navigationEvent
			if err := conn.ReadJSON(&event); err != nil {
				watch.mu.Lock()
				watch.err = err
				watch.mu.Unlock()
				return
			}
			watch.mu.Lock()
			watch.record(event)
			watch.mu.Unlock()
		}
	}()
	return watch, nil
}

func (w *navigationWatch) record(event navigationEvent) {
	id := event.Params.RequestID
	switch event.Method {
	case "Network.requestWillBeSent":
		address, err := url.Parse(event.Params.Request.URL)
		if err == nil && address.Scheme == w.origin.Scheme && address.Host == w.origin.Host {
			w.pending[id] = true
			w.lastActivity = time.Now()
		}
	case "Network.loadingFinished", "Network.loadingFailed":
		if w.pending[id] {
			delete(w.pending, id)
			w.lastActivity = time.Now()
			if event.Params.ErrorText == "net::ERR_NETWORK_CHANGED" {
				w.changed = true
			}
		}
	}
}

func (w *navigationWatch) settle() (bool, error) {
	deadline := time.Now().Add(30 * time.Second)
	for {
		w.mu.Lock()
		changed, err := w.changed, w.err
		ready := len(w.pending) == 0 && time.Since(w.lastActivity) >= 250*time.Millisecond
		w.mu.Unlock()
		if changed {
			return true, nil
		}
		if err != nil {
			return false, fmt.Errorf("observe navigation: %w", err)
		}
		if ready {
			return false, nil
		}
		if time.Now().After(deadline) {
			return false, fmt.Errorf("same-origin navigation requests did not settle within 30s")
		}
		time.Sleep(25 * time.Millisecond)
	}
}

func (w *navigationWatch) close() { w.conn.Close(); <-w.done }
