package main

import (
	"encoding/json"
	"encoding/pem"
	"encoding/xml"
	"flag"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Independent response views keep the HTTP assertions separate from generated tags.
const route53Namespace = "https://route53.amazonaws.com/doc/2013-04-01/"

type queryLoggingResponse struct {
	XMLName xml.Name
	Config  struct {
		ID                        string `xml:"Id"`
		HostedZoneID              string `xml:"HostedZoneId"`
		CloudWatchLogsLogGroupARN string `xml:"CloudWatchLogsLogGroupArn"`
	} `xml:"QueryLoggingConfig"`
}

type egressResponse struct {
	XMLName xml.Name
	Return  bool `xml:"return"`
}

type testGateway struct {
	url    string
	client *http.Client
	events *[]event
}

func startGateway(t *testing.T, upstream http.HandlerFunc) testGateway {
	t.Helper()
	backend := httptest.NewTLSServer(upstream)
	t.Cleanup(backend.Close)
	client := backend.Client()
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	events := []event{}
	server := httptest.NewServer(newGateway(backend.URL, client, func(value event) { events = append(events, value) }))
	t.Cleanup(server.Close)
	return testGateway{server.URL, server.Client(), &events}
}

func (g testGateway) request(t *testing.T, method, path, action, body string) (int, http.Header, []byte) {
	t.Helper()
	request, err := http.NewRequest(method, g.url+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if action != "" {
		request.Header.Set("X-Amz-Target", "Service."+action)
	}
	response, err := g.client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return response.StatusCode, response.Header, data
}

func rejectUpstream(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected upstream request: %s", r.URL)
		w.WriteHeader(500)
	}
}

func TestQueryLoggingXMLRoundTrip(t *testing.T) {
	g := startGateway(t, rejectUpstream(t))
	status, headers, body := g.request(t, "POST", "/2013-04-01/queryloggingconfig", "", `<?xml version="1.0"?><r:CreateQueryLoggingConfigRequest xmlns:r="https://route53.amazonaws.com/doc/2013-04-01/"><r:HostedZoneId>zone&amp;&lt;é</r:HostedZoneId><r:CloudWatchLogsLogGroupArn><![CDATA[arn:logs:a&<b>]]></r:CloudWatchLogsLogGroupArn></r:CreateQueryLoggingConfigRequest>`)
	if status != 201 {
		t.Fatalf("create status %d: %s", status, body)
	}
	var created queryLoggingResponse
	if err := xml.Unmarshal(body, &created); err != nil {
		t.Fatal(err)
	}
	if created.XMLName != (xml.Name{Space: route53Namespace, Local: "CreateQueryLoggingConfigResponse"}) {
		t.Fatalf("unexpected root: %+v", created.XMLName)
	}
	if created.Config.HostedZoneID != "zone&<é" || created.Config.CloudWatchLogsLogGroupARN != "arn:logs:a&<b>" || len(created.Config.ID) != 36 {
		t.Fatalf("unexpected config: %+v", created.Config)
	}
	if headers.Get("Location") != "/2013-04-01/queryloggingconfig/"+created.Config.ID {
		t.Fatal("missing config location")
	}
	status, _, body = g.request(t, "GET", headers.Get("Location"), "", "")
	var read queryLoggingResponse
	if err := xml.Unmarshal(body, &read); err != nil {
		t.Fatal(err)
	}
	if status != 200 || read.XMLName.Local != "GetQueryLoggingConfigResponse" || read.Config != created.Config {
		t.Fatalf("get differs: %d %s", status, body)
	}
}

func TestMalformedQueryLoggingXML(t *testing.T) {
	g := startGateway(t, rejectUpstream(t))
	for _, body := range []string{`<CreateQueryLoggingConfigRequest`, `<Wrong/>`, `<CreateQueryLoggingConfigRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/"/><extra/>`, `<CreateQueryLoggingConfigRequest xmlns="wrong"/>`} {
		status, _, result := g.request(t, "POST", "/2013-04-01/queryloggingconfig", "", body)
		if status != 400 {
			t.Fatalf("status %d for %s: %s", status, body, result)
		}
	}
	if len(*g.events) != 0 {
		t.Fatal("malformed requests were recorded as fixtures")
	}
}

func TestS3ControlXML(t *testing.T) {
	g := startGateway(t, rejectUpstream(t))
	status, _, body := g.request(t, "GET", "/v20180820/tags/arn:aws:s3:bucket", "", "")
	var result struct {
		XMLName xml.Name
		Tags    *struct{} `xml:"Tags"`
	}
	if err := xml.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if status != 200 || result.XMLName.Space != "http://awss3control.amazonaws.com/doc/2018-08-20/" || result.XMLName.Local != "ListTagsForResourceResult" || result.Tags == nil {
		t.Fatalf("unexpected tags: %d %s", status, body)
	}
}

func TestEC2DefaultEgress(t *testing.T) {
	g := startGateway(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		query, _ := url.ParseQuery(string(body))
		w.WriteHeader(400)
		code := "InvalidPermission.NotFound"
		if query.Get("Action") == "AuthorizeSecurityGroupEgress" {
			code = "InvalidPermission.Duplicate"
		}
		_, _ = io.WriteString(w, `<Response xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><Errors><Error><Code>`+code+`</Code></Error></Errors></Response>`)
	})
	for _, action := range []string{"AuthorizeSecurityGroupEgress", "RevokeSecurityGroupEgress"} {
		status, _, body := g.request(t, "POST", "/", "", "Action="+action+"&IpPermissions.1.IpProtocol=-1&IpPermissions.1.IpRanges.1.CidrIp=0.0.0.0%2F0")
		var result egressResponse
		if err := xml.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		if status != 200 || !result.Return || result.XMLName.Local != action+"Response" {
			t.Fatalf("unexpected egress response: %d %s", status, body)
		}
	}
	status, _, _ := g.request(t, "POST", "/", "", "Action=RevokeSecurityGroupEgress&IpPermissions.1.IpProtocol=-1&IpPermissions.1.IpRanges.1.CidrIp=10.0.0.0%2F8")
	if status != 400 {
		t.Fatal("non-default rule was reconciled")
	}
}

func TestEC2ErrorMessageDoesNotMatchCode(t *testing.T) {
	g := startGateway(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		_, _ = io.WriteString(w, `<Response><Errors><Error><Code>Other</Code><Message>InvalidPermission.NotFound</Message></Error></Errors></Response>`)
	})
	status, _, _ := g.request(t, "POST", "/", "", "Action=RevokeSecurityGroupEgress&IpPermissions.1.IpProtocol=-1&IpPermissions.1.IpRanges.1.CidrIp=0.0.0.0%2F0")
	if status != 400 {
		t.Fatal("message text triggered reconciliation")
	}
}

func TestProxyPinsDestinationAndPreservesResponse(t *testing.T) {
	g := startGateway(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if r.Method != "POST" || r.URL.RequestURI() != "/opaque%2Fpath?q=a%26b" || string(body) != "opaque<&>" || r.Header.Get("X-Amz-Target") != "Unknown.Action" {
			t.Errorf("request changed: %s %s %s", r.Method, r.URL, body)
		}
		w.Header().Set("X-Upstream", "kept")
		w.WriteHeader(409)
		_, _ = io.WriteString(w, "unchanged<&>")
	})
	request, _ := http.NewRequest("POST", g.url+"/opaque%2Fpath?q=a%26b", strings.NewReader("opaque<&>"))
	// Exercise the absolute-form request used by an HTTP proxy, including the SDK's numeric host.
	proxyURL, _ := url.Parse(g.url)
	client := &http.Client{Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)}}
	request.URL.Host = "000000000000." + proxyURL.Host
	request.Host = request.URL.Host
	request.Header.Set("X-Amz-Target", "Unknown.Action")
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != 409 || string(body) != "unchanged<&>" || response.Header.Get("X-Upstream") != "kept" {
		t.Fatalf("response changed: %d %s", response.StatusCode, body)
	}
	if len(*g.events) != 1 || !(*g.events)[0].Forwarded {
		t.Fatalf("missing forwarding event: %+v", *g.events)
	}
}

func TestProxyRejectsOtherHosts(t *testing.T) {
	g := startGateway(t, rejectUpstream(t))
	request, _ := http.NewRequest("GET", g.url, nil)
	request.Host = "aws.amazon.com"
	response, err := g.client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 403 {
		t.Fatal("accepted external host")
	}
}

func TestDomainFixtures(t *testing.T) {
	g := startGateway(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"Nameservers":[],"StatusList":[],"Other":"preserved"}`)
	})
	_, _, body := g.request(t, "POST", "/", "UpdateDomainNameservers", `{"DomainName":"example.com","Nameservers":[{"Name":"ns.example.com"}]}`)
	var operation struct {
		OperationID string `json:"OperationId"`
	}
	if err := json.Unmarshal(body, &operation); err != nil {
		t.Fatal(err)
	}
	_, _, body = g.request(t, "POST", "/", "GetOperationDetail", `{"OperationId":"`+operation.OperationID+`"}`)
	var detail map[string]any
	_ = json.Unmarshal(body, &detail)
	if detail["Status"] != "SUCCESSFUL" || detail["Type"] != "UPDATE_NAMESERVER" {
		t.Fatalf("unexpected operation: %s", body)
	}
	g.request(t, "POST", "/", "EnableDomainTransferLock", `{"DomainName":"example.com"}`)
	_, _, body = g.request(t, "POST", "/", "GetDomainDetail", `{"DomainName":"example.com"}`)
	if err := json.Unmarshal(body, &detail); err != nil {
		t.Fatal(err)
	}
	if detail["Other"] != "preserved" || !strings.Contains(string(body), "ns.example.com") || !strings.Contains(string(body), "clientTransferProhibited") {
		t.Fatalf("unexpected domain: %s", body)
	}
	g.request(t, "POST", "/", "UpdateTagsForDomain", `{"DomainName":"example.com","TagsToUpdate":[{"Key":"a","Value":"b"}]}`)
	_, _, body = g.request(t, "POST", "/", "ListTagsForDomain", `{"DomainName":"example.com"}`)
	if string(body) != `{"TagList":[{"Key":"a","Value":"b"}]}` {
		t.Fatalf("unexpected tags: %s", body)
	}
}

func TestCostAllocationTags(t *testing.T) {
	g := startGateway(t, rejectUpstream(t))
	g.request(t, "POST", "/", "UpdateCostAllocationTagsStatus", `{"CostAllocationTagsStatus":[{"TagKey":"one","Status":"Active"},{"TagKey":"two","Status":"Inactive"}]}`)
	_, _, body := g.request(t, "POST", "/", "ListCostAllocationTags", `{"TagKeys":["one"]}`)
	if string(body) != `{"CostAllocationTags":[{"Status":"Active","TagKey":"one","Type":"UserDefined"}]}` {
		t.Fatalf("unexpected tags: %s", body)
	}
}

func TestMountTargetGroups(t *testing.T) {
	g := startGateway(t, func(w http.ResponseWriter, r *http.Request) { _, _ = io.WriteString(w, `{"MountTargetId":"fsmt-one"}`) })
	g.request(t, "POST", "/2015-02-01/mount-targets", "", `{"SecurityGroups":["sg-one","sg-two"]}`)
	_, _, body := g.request(t, "GET", "/2015-02-01/mount-targets/fsmt-one/security-groups", "", "")
	if string(body) != `{"SecurityGroups":["sg-one","sg-two"]}` {
		t.Fatalf("unexpected groups: %s", body)
	}
}

// Run the real entry point in a subprocess so readiness and report framing use
// the same stdout/stdin protocol as the Pulumi driver.
func TestGatewayProcess(t *testing.T) {
	if os.Getenv("GATEWAY_TEST_PROCESS") != "1" {
		return
	}
	flag.CommandLine = flag.NewFlagSet("gateway", flag.ExitOnError)
	os.Args = []string{os.Args[0], "--upstream-port", os.Getenv("GATEWAY_TEST_PORT"), "--certificate", os.Getenv("GATEWAY_TEST_CA")}
	main()
}

func TestProcessReadinessAndReporting(t *testing.T) {
	backend := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(404) }))
	defer backend.Close()
	ca := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(ca, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: backend.Certificate().Raw}), 0600); err != nil {
		t.Fatal(err)
	}
	backendURL, _ := url.Parse(backend.URL)
	_, port, _ := net.SplitHostPort(backendURL.Host)
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	command := exec.Command(executable, "-test.run=^TestGatewayProcess$")
	command.Env = append(os.Environ(), "GATEWAY_TEST_PROCESS=1", "GATEWAY_TEST_PORT="+port, "GATEWAY_TEST_CA="+ca)
	stdout, err := command.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	stdin, err := command.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	command.Stderr = os.Stderr
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = command.Process.Kill(); _ = command.Wait() }()
	decoder := json.NewDecoder(stdout)
	var ready event
	if err := decoder.Decode(&ready); err != nil {
		t.Fatal(err)
	}
	if ready.Endpoint == "" {
		t.Fatal("no readiness endpoint")
	}
	g := testGateway{url: ready.Endpoint, client: http.DefaultClient}
	g.request(t, "GET", "/v20180820/tags/example", "", "")
	status, _, _ := g.request(t, "GET", "/not-a-fixture", "", "")
	if status != 404 {
		t.Fatalf("upstream status %d", status)
	}
	if _, err := io.WriteString(stdin, "report\n"); err != nil {
		t.Fatal(err)
	}
	operations := []string{}
	forwarded := 0
	for {
		var value event
		if err := decoder.Decode(&value); err != nil {
			t.Fatal(err)
		}
		if value.Operation != "" {
			operations = append(operations, value.Operation)
		}
		if value.Forwarded {
			forwarded++
		}
		if value.Report {
			break
		}
	}
	if len(operations) != 1 || operations[0] != "S3Control.ListTagsForResource" || forwarded != 1 {
		t.Fatalf("unexpected report: %v %d", operations, forwarded)
	}
}
