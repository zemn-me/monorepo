package selenium

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// PageCommands sends browser commands to one page without ChromeDriver's
// JavaScript navigation probes. Keep navigation itself on WebDriver so its
// configured page-load strategy and explicit UI readiness checks still apply.
type PageCommands struct {
	conn *websocket.Conn
	mu   sync.Mutex
	id   int
}

// OpenPageCommands attaches to the selected window. Attach before navigating;
// the connection follows the same page target across navigation. Emulation
// overrides belong to this connection and must be released through it.
func (d *Driver) OpenPageCommands() (*PageCommands, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	conn, err := d.dialPage(ctx)
	if err != nil {
		return nil, err
	}
	return &PageCommands{conn: conn}, nil
}

func (d *Driver) dialPage(ctx context.Context) (*websocket.Conn, error) {
	if d.debuggerAddress == "" {
		return nil, fmt.Errorf("Chromium debugger address is unavailable")
	}
	handle, err := d.CurrentWindowHandle()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+d.debuggerAddress+"/json/list", nil)
	if err != nil {
		return nil, err
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Chromium target discovery: %s", response.Status)
	}
	var targets []struct {
		ID           string `json:"id"`
		WebSocketURL string `json:"webSocketDebuggerUrl"`
	}
	if err := json.NewDecoder(response.Body).Decode(&targets); err != nil {
		return nil, err
	}
	for _, target := range targets {
		if target.ID == strings.TrimPrefix(handle, "CDwindow-") {
			conn, _, err := websocket.DefaultDialer.DialContext(ctx, target.WebSocketURL, nil)
			return conn, err
		}
	}
	return nil, fmt.Errorf("Chromium page %q has no debugger target", handle)
}

// Execute waits for this command's result, ignoring unrelated protocol events.
// A stalled or broken command is an error rather than an apparently valid frame.
func (p *PageCommands) Execute(ctx context.Context, method string, params map[string]any, result any) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		return fmt.Errorf("%s requires a command deadline", method)
	}
	stop := context.AfterFunc(ctx, func() { p.conn.Close() })
	defer stop()
	p.conn.SetReadDeadline(deadline)
	p.conn.SetWriteDeadline(deadline)
	p.id++
	if err := p.conn.WriteJSON(map[string]any{"id": p.id, "method": method, "params": params}); err != nil {
		return err
	}
	for {
		var message struct {
			ID     int             `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := p.conn.ReadJSON(&message); err != nil {
			return fmt.Errorf("%s: %w", method, err)
		}
		if message.ID != p.id {
			continue
		}
		if message.Error != nil {
			return fmt.Errorf("%s: %s", method, message.Error.Message)
		}
		if result != nil {
			return json.Unmarshal(message.Result, result)
		}
		return nil
	}
}

// Evaluate awaits the real page operation, preserving JavaScript failures.
func (p *PageCommands) Evaluate(ctx context.Context, expression string, value any) error {
	var response struct {
		Result struct {
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		Exception json.RawMessage `json:"exceptionDetails"`
	}
	if err := p.Execute(ctx, "Runtime.evaluate", map[string]any{"expression": expression, "awaitPromise": true, "returnByValue": true}, &response); err != nil {
		return err
	}
	if len(response.Exception) != 0 {
		return fmt.Errorf("page JavaScript failed: %s", response.Exception)
	}
	if len(response.Result.Value) == 0 {
		return fmt.Errorf("page operation returned no JSON value")
	}
	return json.Unmarshal(response.Result.Value, value)
}

// ViewScreenshot uses the same visible-view PNG capture as Driver.ViewScreenshot,
// without surrounding it with renderer JavaScript roundtrips.
func (p *PageCommands) ViewScreenshot(ctx context.Context) ([]byte, error) {
	var result struct {
		Data string `json:"data"`
	}
	if err := p.Execute(ctx, "Page.captureScreenshot", map[string]any{"format": "png", "fromSurface": false}, &result); err != nil {
		return nil, err
	}
	if result.Data == "" {
		return nil, fmt.Errorf("Chromium returned an empty screenshot")
	}
	return base64.StdEncoding.DecodeString(result.Data)
}

func (p *PageCommands) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.conn.Close()
}
