package benchmark_test

import (
	_ "embed"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

//go:embed network_benchmark_bundle.js
var benchmarkScript string

func TestNetworkPerformance(t *testing.T) {
	driver, err := seleniumutil.NewWithChromeArguments("--disable-features=WebRtcHideLocalIpsWithMdns")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.SetAsyncScriptTimeout(3 * time.Minute); err != nil {
		t.Fatal(err)
	}
	result, err := driver.ExecuteScriptAsync(benchmarkScript+`
        const done = arguments[arguments.length - 1];
        networkBenchmark.run().then(report => done({report}), error => done({error: error.stack ?? String(error)}));
    `, nil)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	t.Log(string(data))
	if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
		if err := os.WriteFile(filepath.Join(dir, "network-performance.json"), data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	var envelope struct {
		Error  string `json:"error"`
		Report struct {
			Results []struct {
				Kind            string  `json:"kind"`
				ReceivedPackets int     `json:"receivedPackets"`
				LossPercent     float64 `json:"lossPercent"`
				Samples         int     `json:"samples"`
			} `json:"results"`
		} `json:"report"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Error != "" {
		t.Fatal(envelope.Error)
	}
	if len(envelope.Report.Results) != 5 {
		t.Fatal("missing benchmark cases")
	}
	for _, sample := range envelope.Report.Results {
		// Timing is diagnostic: shared CI hosts cannot promise a throughput floor.
		// A local burst must still deliver enough data to produce a useful result.
		if sample.Kind == "ping" && sample.Samples != 80 {
			t.Fatal("missing RTT samples")
		}
		if sample.Kind == "bidirectional burst" && (sample.ReceivedPackets < 1 || sample.LossPercent > 5) {
			t.Fatalf("excessive loopback packet loss: %+v", sample)
		}
	}
}
