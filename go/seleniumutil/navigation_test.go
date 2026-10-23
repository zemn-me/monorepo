package selenium

import (
	"encoding/json"
	"net/url"
	"testing"
)

func TestNavigationNetworkChangeScope(t *testing.T) {
	for _, scenario := range []struct {
		name, address, kind, failure string
		retry                        bool
	}{
		{"background fetch", "http://localhost:1234/poll", "Fetch", "net::ERR_NETWORK_CHANGED", false},
		{"initial module", "http://localhost:1234/assets/app.js", "Script", "net::ERR_NETWORK_CHANGED", true},
		{"deliberately blocked download", "http://localhost:1234/game.gz", "Fetch", "net::ERR_BLOCKED_BY_CLIENT", false},
		{"connection refused", "http://localhost:1234/assets/app.js", "Script", "net::ERR_CONNECTION_REFUSED", false},
		{"external service", "https://accounts.google.com/config", "Script", "net::ERR_NETWORK_CHANGED", false},
		{"other local service", "http://localhost:4321/assets/app.js", "Script", "net::ERR_NETWORK_CHANGED", false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			origin, _ := url.Parse("http://localhost:1234/game")
			watch := navigationWatch{origin: origin, pending: make(map[string]string)}
			for _, message := range []map[string]any{
				{"method": "Network.requestWillBeSent", "params": map[string]any{"requestId": "1", "type": scenario.kind, "request": map[string]any{"url": scenario.address}}},
				{"method": "Network.loadingFailed", "params": map[string]any{"requestId": "1", "errorText": scenario.failure}},
			} {
				data, err := json.Marshal(message)
				if err != nil {
					t.Fatal(err)
				}
				var event navigationEvent
				if err := json.Unmarshal(data, &event); err != nil {
					t.Fatal(err)
				}
				watch.record(event)
			}
			if watch.changed != scenario.retry {
				t.Fatalf("retry=%v, want %v", watch.changed, scenario.retry)
			}
			if len(watch.pending) != 0 {
				t.Fatal("failed request still pending")
			}
		})
	}
}
