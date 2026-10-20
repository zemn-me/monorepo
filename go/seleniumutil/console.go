package selenium

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ConsoleLog observes the current page's console without executing JavaScript
// in the renderer. ChromeDriver's GetLog flush executes a script and can block
// while the page is busy, preventing an observer's own deadline from expiring.
// Attach before navigating; the subscription follows that page across navigation.
type ConsoleLog struct {
	conn   *websocket.Conn
	mu     sync.Mutex
	text   strings.Builder
	err    error
	closed bool
	done   chan struct{}
}

// WatchConsole subscribes to Chromium's Runtime.consoleAPICalled events.
func (d *Driver) WatchConsole() (*ConsoleLog, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	conn, err := d.dialPage(ctx)
	if err != nil {
		return nil, err
	}
	log := &ConsoleLog{conn: conn, done: make(chan struct{})}
	deadline, _ := ctx.Deadline()
	conn.SetReadDeadline(deadline)
	conn.SetWriteDeadline(deadline)
	if err := conn.WriteJSON(map[string]any{"id": 1, "method": "Runtime.enable"}); err != nil {
		conn.Close()
		return nil, err
	}
	for {
		var message consoleMessage
		if err := conn.ReadJSON(&message); err != nil {
			conn.Close()
			return nil, err
		}
		log.record(message)
		if message.ID == 1 {
			if message.Error != nil {
				conn.Close()
				return nil, fmt.Errorf("enable console events: %s", message.Error.Message)
			}
			break
		}
	}
	conn.SetReadDeadline(time.Time{})
	conn.SetWriteDeadline(time.Time{})
	go func() {
		defer close(log.done)
		for {
			var message consoleMessage
			if err := conn.ReadJSON(&message); err != nil {
				log.mu.Lock()
				if !log.closed {
					log.err = fmt.Errorf("read console events: %w", err)
				}
				log.mu.Unlock()
				return
			}
			log.record(message)
		}
	}()
	return log, nil
}

type consoleMessage struct {
	ID     int    `json:"id"`
	Method string `json:"method"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
	Params struct {
		Args []struct {
			Value       json.RawMessage `json:"value"`
			Description string          `json:"description"`
			Type        string          `json:"type"`
		} `json:"args"`
	} `json:"params"`
}

func (l *ConsoleLog) record(message consoleMessage) {
	if message.Method != "Runtime.consoleAPICalled" {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for i, arg := range message.Params.Args {
		if i != 0 {
			l.text.WriteByte(' ')
		}
		var value string
		if json.Unmarshal(arg.Value, &value) == nil && len(arg.Value) != 0 && string(arg.Value) != "null" {
			l.text.WriteString(value)
		} else if len(arg.Value) != 0 {
			l.text.Write(arg.Value)
		} else if arg.Description != "" {
			l.text.WriteString(arg.Description)
		} else {
			l.text.WriteString(arg.Type)
		}
	}
	l.text.WriteByte('\n')
}

// Text returns the accumulated events immediately, without a browser command.
// A broken event stream is an error, rather than an apparently quiet page.
func (l *ConsoleLog) Text() (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.text.String(), l.err
}

func (l *ConsoleLog) Close() error {
	l.mu.Lock()
	l.closed = true
	l.mu.Unlock()
	err := l.conn.Close()
	<-l.done
	return err
}
