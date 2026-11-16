// The compatibility gateway supplies explicit fixtures for the pinned emulator.
package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/xml"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws/protocol/ec2query"
	"github.com/zemn-me/monorepo/go/aws_emulator_gateway/wire"
)

type event struct {
	Endpoint  string `json:"endpoint,omitempty"`
	Operation string `json:"operation,omitempty"`
	Forwarded bool   `json:"forwarded,omitempty"`
	Report    bool   `json:"report,omitempty"`
}

type gateway struct {
	mu                sync.Mutex // Protect fixture state and event ordering across HTTP requests.
	upstream          string
	client            *http.Client
	emit              func(event)
	tags              map[string]string
	nameservers       map[string]json.RawMessage
	domainTags        map[string]json.RawMessage
	operations        map[string]string
	lockedDomains     map[string]bool
	queryLogs         map[string]wire.Route53QueryLoggingConfig
	mountTargetGroups map[string]json.RawMessage
}

func newGateway(upstream string, client *http.Client, emit func(event)) *gateway {
	return &gateway{
		upstream:          upstream,
		client:            client,
		emit:              emit,
		tags:              map[string]string{},
		nameservers:       map[string]json.RawMessage{},
		domainTags:        map[string]json.RawMessage{},
		operations:        map[string]string{},
		lockedDomains:     map[string]bool{},
		queryLogs:         map[string]wire.Route53QueryLoggingConfig{},
		mountTargetGroups: map[string]json.RawMessage{},
	}
}

func uuid() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (g *gateway) record(operation string) { g.emit(event{Operation: operation}) }

func decodeXML(data []byte, value any) error {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	if err := decoder.Decode(value); err != nil {
		return err
	}
	// Decode must consume one document; a second root or trailing junk is invalid.
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		switch value := token.(type) {
		case xml.CharData:
			if strings.TrimSpace(string(value)) == "" {
				continue
			}
		case xml.Comment, xml.ProcInst:
			continue
		}
		return fmt.Errorf("unexpected content after XML document")
	}
}

func writeXML(w http.ResponseWriter, status int, value any) {
	data, err := xml.Marshal(value)
	if err != nil {
		log.Print(err)
		http.Error(w, "Emulator compatibility handler failed", 500)
		return
	}
	w.Header().Set("Content-Type", "text/xml")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func (g *gateway) reply(w http.ResponseWriter, operation string, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Print(err)
		http.Error(w, "Emulator compatibility handler failed", 500)
		return
	}
	g.record(operation)
	w.Header().Set("Content-Type", "application/x-amz-json-1.1")
	_, _ = w.Write(data)
}

func textField(input map[string]json.RawMessage, field string) string {
	var value string
	_ = json.Unmarshal(input[field], &value)
	return value
}

func defaultEgress(query url.Values, action string) bool {
	return query.Get("Action") == action && query.Get("IpPermissions.1.IpProtocol") == "-1" &&
		query.Get("IpPermissions.1.IpRanges.1.CidrIp") == "0.0.0.0/0" &&
		!query.Has("IpPermissions.2.IpProtocol") && !query.Has("IpPermissions.1.IpRanges.2.CidrIp")
}

func (g *gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// The HTTP proxy must never become an arbitrary destination proxy.
	_, port, err := net.SplitHostPort(r.Context().Value(http.LocalAddrContextKey).(net.Addr).String())
	if err != nil || (r.Host != "127.0.0.1:"+port && r.Host != "000000000000.127.0.0.1:"+port) {
		http.Error(w, "Only the configured emulator endpoint is allowed", 403)
		return
	}
	g.handle(w, r)
}

func (g *gateway) handle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Emulator compatibility handler failed", 500)
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	log.Printf("AWS request %s %s", r.Method, r.URL.RequestURI())
	action := r.Header.Get("X-Amz-Target")
	if index := strings.LastIndex(action, "."); index >= 0 {
		action = action[index+1:]
	}
	var input map[string]json.RawMessage
	// Decode only JSON fixture operations; pass-through payloads remain opaque.
	switch action {
	case "UpdateCostAllocationTagsStatus", "ListCostAllocationTags", "UpdateTagsForDomain", "ListTagsForDomain", "UpdateDomainNameservers", "EnableDomainTransferLock", "GetOperationDetail", "GetDomainDetail":
		if err := json.Unmarshal(body, &input); err != nil {
			http.Error(w, "Malformed JSON request", 400)
			return
		}
	}
	switch action {
	case "UpdateCostAllocationTagsStatus":
		var items []struct {
			TagKey string
			Status string
		}
		if err := json.Unmarshal(input["CostAllocationTagsStatus"], &items); err != nil {
			http.Error(w, "Malformed tag status", 400)
			return
		}
		for _, item := range items {
			g.tags[item.TagKey] = item.Status
		}
		g.reply(w, action, map[string]any{"Errors": []any{}})
		return
	case "ListCostAllocationTags":
		var selected []string
		_ = json.Unmarshal(input["TagKeys"], &selected)
		items := []map[string]string{}
		for key, status := range g.tags {
			include := selected == nil
			for _, value := range selected {
				if key == value {
					include = true
				}
			}
			if include {
				items = append(items, map[string]string{"TagKey": key, "Status": status, "Type": "UserDefined"})
			}
		}
		g.reply(w, action, map[string]any{"CostAllocationTags": items})
		return
	case "UpdateTagsForDomain":
		g.domainTags[textField(input, "DomainName")] = input["TagsToUpdate"]
		g.reply(w, action, map[string]any{})
		return
	case "ListTagsForDomain":
		tags := g.domainTags[textField(input, "DomainName")]
		if len(tags) == 0 {
			tags = json.RawMessage(`[]`)
		}
		g.reply(w, action, map[string]any{"TagList": tags})
		return
	case "UpdateDomainNameservers", "EnableDomainTransferLock":
		domain := textField(input, "DomainName")
		operation := "ENABLE_DOMAIN_TRANSFER_LOCK"
		if action == "UpdateDomainNameservers" {
			g.nameservers[domain] = input["Nameservers"]
			operation = "UPDATE_NAMESERVER"
		} else {
			g.lockedDomains[domain] = true
		}
		id := uuid()
		g.operations[id] = operation
		g.reply(w, action, map[string]any{"OperationId": id})
		return
	case "GetOperationDetail":
		id := textField(input, "OperationId")
		if operation, ok := g.operations[id]; ok {
			g.reply(w, action, map[string]any{"OperationId": id, "Status": "SUCCESSFUL", "Type": operation, "SubmittedDate": float64(time.Now().UnixMilli()) / 1000})
			return
		}
	}
	if r.Header.Get("X-Emulator-Fixture") == "OCI.Publish" {
		g.record("OCI.Publish")
	}
	if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/v20180820/tags/") {
		g.record("S3Control.ListTagsForResource")
		writeXML(w, 200, wire.S3ControlListTagsForResourceResult{Tags: &wire.S3ControlTagList{}})
		return
	}
	const queryLoggingPath = "/2013-04-01/queryloggingconfig"
	if r.URL.Path == queryLoggingPath && r.Method == http.MethodPost {
		var request wire.Route53CreateQueryLoggingConfigRequest
		if err := decodeXML(body, &request); err != nil {
			http.Error(w, "Malformed query logging XML", 400)
			return
		}
		config := wire.Route53QueryLoggingConfig{Id: uuid(), HostedZoneId: request.HostedZoneId, CloudWatchLogsLogGroupArn: request.CloudWatchLogsLogGroupArn}
		g.queryLogs[config.Id] = config
		g.record("Route53.CreateQueryLoggingConfig")
		w.Header().Set("Location", queryLoggingPath+"/"+config.Id)
		writeXML(w, 201, wire.Route53CreateQueryLoggingConfigResponse{QueryLoggingConfig: config})
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, queryLoggingPath+"/") {
		if config, ok := g.queryLogs[strings.TrimPrefix(r.URL.Path, queryLoggingPath+"/")]; ok {
			g.record("Route53.GetQueryLoggingConfig")
			writeXML(w, 200, wire.Route53GetQueryLoggingConfigResponse{QueryLoggingConfig: config})
			return
		}
	}
	const mountPrefix = "/2015-02-01/mount-targets/"
	if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, mountPrefix) && strings.HasSuffix(r.URL.Path, "/security-groups") {
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, mountPrefix), "/security-groups")
		if groups, ok := g.mountTargetGroups[id]; ok {
			g.reply(w, "EFS.DescribeMountTargetSecurityGroups", map[string]any{"SecurityGroups": groups})
			return
		}
	}
	target, err := url.Parse(g.upstream)
	if err != nil {
		http.Error(w, "Emulator upstream request failed", 502)
		return
	}
	target.Path = r.URL.Path
	target.RawPath = r.URL.RawPath
	target.RawQuery = r.URL.RawQuery
	upstream, err := http.NewRequestWithContext(r.Context(), r.Method, target.String(), bytes.NewReader(body))
	if err != nil {
		http.Error(w, "Emulator upstream request failed", 502)
		return
	}
	upstream.Header = r.Header.Clone()
	upstream.Host = r.Host
	g.emit(event{Forwarded: true})
	g.mu.Unlock()
	forwarded, result, err := g.forward(upstream)
	g.mu.Lock()
	if err != nil {
		log.Print(err)
		http.Error(w, "Emulator upstream request failed", 502)
		return
	}
	if forwarded.StatusCode >= 400 {
		diagnostic := result
		if len(diagnostic) > 500 {
			diagnostic = diagnostic[:500]
		}
		log.Printf("AWS response %d %s %s: %s", forwarded.StatusCode, r.Method, r.URL.RequestURI(), diagnostic)
	}
	query, _ := url.ParseQuery(string(body))
	if forwarded.StatusCode == 400 {
		failure, err := ec2query.GetErrorResponseComponents(bytes.NewReader(result))
		if err == nil {
			succeeded := true
			if defaultEgress(query, "AuthorizeSecurityGroupEgress") && failure.Code == "InvalidPermission.Duplicate" {
				g.record("EC2.AuthorizeExistingDefaultEgress")
				writeXML(w, 200, wire.EC2AuthorizeSecurityGroupEgressResult{Return: &succeeded})
				return
			}
			if defaultEgress(query, "RevokeSecurityGroupEgress") && failure.Code == "InvalidPermission.NotFound" {
				g.record("EC2.RevokeDefaultEgress")
				writeXML(w, 200, wire.EC2RevokeSecurityGroupEgressResult{Return: &succeeded})
				return
			}
		}
	}
	if r.URL.Path == "/2015-02-01/mount-targets" && r.Method == http.MethodPost && forwarded.StatusCode == 200 {
		var target struct {
			MountTargetID string `json:"MountTargetId"`
		}
		var request map[string]json.RawMessage
		if json.Unmarshal(result, &target) == nil && json.Unmarshal(body, &request) == nil {
			groups := request["SecurityGroups"]
			if len(groups) == 0 {
				groups = json.RawMessage(`[]`)
			}
			g.mountTargetGroups[target.MountTargetID] = groups
		}
	}
	if action == "GetDomainDetail" && forwarded.StatusCode == 200 {
		var detail map[string]json.RawMessage
		if err := json.Unmarshal(result, &detail); err != nil || detail == nil {
			http.Error(w, "Emulator compatibility handler failed", 500)
			return
		}
		domain := textField(input, "DomainName")
		if nameservers, ok := g.nameservers[domain]; ok {
			detail["Nameservers"] = nameservers
		}
		if g.lockedDomains[domain] {
			detail["StatusList"] = json.RawMessage(`["clientTransferProhibited"]`)
		}
		result, err = json.Marshal(detail)
		if err != nil {
			http.Error(w, "Emulator compatibility handler failed", 500)
			return
		}
	}
	for key, values := range forwarded.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.Header().Del("Transfer-Encoding")
	w.Header().Set("Content-Length", fmt.Sprint(len(result)))
	w.WriteHeader(forwarded.StatusCode)
	_, _ = w.Write(result)
}

// Read upstream responses outside the fixture lock so independent AWS calls
// can progress while an emulator operation is waiting on network I/O.
func (g *gateway) forward(request *http.Request) (*http.Response, []byte, error) {
	response, err := g.client.Do(request)
	if err != nil {
		return nil, nil, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	return response, body, err
}

func main() {
	port := flag.Int("upstream-port", 0, "Pinned emulator's loopback port")
	certificate := flag.String("certificate", "", "Emulator CA certificate")
	flag.Parse()
	ca, err := os.ReadFile(*certificate)
	if err != nil {
		log.Fatal(err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		log.Fatal("Invalid emulator CA")
	}
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig:    &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12},
			DisableCompression: true,
		},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	encoder := json.NewEncoder(os.Stdout)
	emit := func(value event) {
		if err := encoder.Encode(value); err != nil {
			log.Fatal(err)
		}
	}
	emit(event{Endpoint: "http://" + listener.Addr().String()})
	gateway := newGateway(fmt.Sprintf("https://127.0.0.1:%d", *port), client, emit)
	// A report marker fences stdout events before the driver saves its report.
	go func() {
		commands := bufio.NewScanner(os.Stdin)
		for commands.Scan() {
			if commands.Text() == "report" {
				gateway.mu.Lock()
				emit(event{Report: true})
				gateway.mu.Unlock()
			}
		}
	}()
	server := &http.Server{Handler: gateway, ReadHeaderTimeout: 30 * time.Second}
	log.Fatal(server.Serve(listener))
}
