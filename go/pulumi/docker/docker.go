// because rules_oci builds our images, we have to
// monkeypatch @pulumi/docker to just let
// us upload an image instead of making the whole damn image for us.
// monkeypatched version of pulumi docker
// that provisions via rules_oci image.
// I guess I just call ImagePush myself ..? https://pkg.go.dev/github.com/docker/docker/client#Client.ImagePush
package provider

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/docker/cli/cli/config"
	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/cli/cli/config/credentials"
	"github.com/docker/cli/cli/connhelper"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	registrytypes "github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/jsonmessage"
	controlapi "github.com/moby/buildkit/api/services/control"
	"github.com/moby/moby/registry"

	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
)

const (
	defaultDockerfile = "Dockerfile"
	defaultBuilder    = "2"
)

type Image struct {
	Name     string
	SkipPush bool
	Registry Registry
	Tag      string
	Build    Build
}

type Registry struct {
	Server   string
	Username string
	Password string
}

type Build struct {
	Context        string
	Dockerfile     string
	CachedImages   []string
	Args           map[string]*string
	Target         string
	Platform       string
	Network        string
	ExtraHosts     []string
	BuilderVersion types.BuilderVersion
}

type Config struct {
	Host     string
	SSHOpts  []string
	Ca       string
	Cert     string
	Key      string
	CertPath string
}

func pullDockerImage(ctx context.Context, p *dockerNativeProvider, urn resource.URN,
	docker *client.Client, authConfig registrytypes.AuthConfig, cachedImage string, platform string,
) error {
	if cachedImage != "" {
		_ = p.host.LogStatus(ctx, "info", urn, fmt.Sprintf("Pulling cached image %s", cachedImage))

		cachedImageAuthBytes, err := json.Marshal(authConfig)
		if err != nil {
			return err
		}
		cachedImageRegistryAuth := base64.URLEncoding.EncodeToString(cachedImageAuthBytes)

		pullOutput, err := docker.ImagePull(ctx, cachedImage, types.ImagePullOptions{
			RegistryAuth: cachedImageRegistryAuth,
			Platform:     platform,
		})
		if err != nil {
			return fmt.Errorf("Error pulling cached image %s: %v", cachedImage, err)
		}

		defer pullOutput.Close()

		err = p.processLog(ctx, urn, pullOutput, nil)
		if err != nil {
			return fmt.Errorf("error reading pull output: %v", err)
		}
	}
	return nil
}

func marshalBuildAndApplyDefaults(b resource.PropertyValue) (Build, error) {
	// build can be nil, a string or an object; we will also use reasonable defaults here.
	var build Build
	if b.IsNull() {
		// use the default build context
		build.Context = "."
		build.Dockerfile = defaultDockerfile
		return build, nil
	}

	if !b.IsObject() {
		return build, nil
	}
	// read in the build type fields
	buildObject := b.ObjectValue()

	// Context
	if !buildObject["context"].ContainsUnknowns() {
		if buildObject["context"].IsNull() {
			// set default
			build.Context = "."
		} else {
			build.Context = buildObject["context"].StringValue()
		}
	}

	// Dockerfile
	if !buildObject["dockerfile"].ContainsUnknowns() {
		if buildObject["dockerfile"].IsNull() {
			// set default
			build.Dockerfile = path.Join(build.Context, defaultDockerfile)
		} else {
			build.Dockerfile = buildObject["dockerfile"].StringValue()
		}
	}

	// BuildKit
	version, err := marshalBuilder(buildObject["builderVersion"])
	if err != nil {
		return build, err
	}
	build.BuilderVersion = version

	// Args
	build.Args = marshalArgs(buildObject["args"])

	// Target
	if !buildObject["target"].IsNull() && !buildObject["target"].ContainsUnknowns() {
		build.Target = buildObject["target"].StringValue()
	}

	// CacheFrom
	cache, err := marshalCachedImages(b)
	if err != nil {
		return build, err
	}
	build.CachedImages = cache

	// AddHosts
	hosts, err := marshalExtraHosts(b)
	if err != nil {
		return build, err
	}
	build.ExtraHosts = hosts

	// Network
	if !buildObject["network"].IsNull() {
		build.Network = buildObject["network"].StringValue()
	}

	// Platform
	if !buildObject["platform"].IsNull() && !buildObject["platform"].ContainsUnknowns() {
		build.Platform = buildObject["platform"].StringValue()
	}
	return build, nil
}

func marshalExtraHosts(b resource.PropertyValue) ([]string, error) {
	var extraHosts []string
	if b.IsNull() || b.ObjectValue()["addHosts"].IsNull() {
		return extraHosts, nil
	}
	hosts := b.ObjectValue()["addHosts"].ArrayValue()

	for _, host := range hosts {
		if !host.IsString() {
			continue
		}
		extraHosts = append(extraHosts, host.StringValue())
	}
	return extraHosts, nil
}

func marshalCachedImages(b resource.PropertyValue) ([]string, error) {
	var cacheImages []string
	if b.IsNull() {
		return cacheImages, nil
	}
	if !b.IsObject() {
		return cacheImages, nil
	}
	c := b.ObjectValue()["cacheFrom"]

	if c.IsNull() || !c.IsObject() {
		return cacheImages, nil
	}

	// if we specify a list of stages, then we only pull those
	cacheFrom := c.ObjectValue()
	images, ok := cacheFrom["images"]
	if !ok {
		return cacheImages, fmt.Errorf("cacheFrom requires an `images` field")
	}
	if images.IsNull() {
		return cacheImages, nil
	}

	if !images.IsArray() {
		if !images.ContainsUnknowns() {
			return cacheImages, fmt.Errorf("the `images` field must be a list of strings")
		}
		return cacheImages, nil
	}

	stages := images.ArrayValue()
	for _, img := range stages {
		if !img.IsNull() && !img.ContainsUnknowns() {
			stage := img.StringValue()
			cacheImages = append(cacheImages, stage)
		}
	}
	return cacheImages, nil
}

func marshalRegistry(r resource.PropertyValue) Registry {
	var reg Registry

	if !r.IsNull() && r.IsObject() {

		if !r.ObjectValue()["server"].IsNull() && !r.ObjectValue()["server"].ContainsUnknowns() {
			reg.Server = r.ObjectValue()["server"].StringValue()
		}
		if !r.ObjectValue()["username"].IsNull() && !r.ObjectValue()["username"].ContainsUnknowns() {
			reg.Username = r.ObjectValue()["username"].StringValue()
		}
		if !r.ObjectValue()["password"].IsNull() && !r.ObjectValue()["password"].ContainsUnknowns() {
			reg.Password = r.ObjectValue()["password"].StringValue()
		}
	}
	return reg
}

func marshalArgs(a resource.PropertyValue) map[string]*string {
	args := make(map[string]*string)
	if !a.IsNull() {
		for k, v := range a.ObjectValue() {
			key := fmt.Sprintf("%v", k)
			if !v.ContainsUnknowns() {
				vStr := v.StringValue()
				args[key] = &vStr
			}
		}
	}
	if len(args) == 0 {
		return nil
	}
	return args
}

func marshalBuilder(builder resource.PropertyValue) (types.BuilderVersion, error) {
	var version types.BuilderVersion

	if builder.IsNull() {
		// set default
		return defaultBuilder, nil
	}
	// verify valid input
	switch builder.StringValue() {
	case "BuilderV1":
		return "1", nil
	case "BuilderBuildKit":
		return "2", nil
	default:
		// because the Docker client will default to `BuilderV1`
		// when version isn't set, we return an error
		return version, fmt.Errorf("invalid Docker Builder version")
	}
}

func marshalSkipPush(sp resource.PropertyValue) bool {
	if sp.IsNull() {
		// defaults to false
		return false
	}
	return sp.BoolValue()
}

func getDefaultDockerConfig() (*configfile.ConfigFile, error) {
	cfg, err := config.Load(config.Dir())
	if err != nil {
		return nil, err
	}
	cfg.CredentialsStore = credentials.DetectDefaultStore(cfg.CredentialsStore)
	return cfg, nil
}

func getRegistryAuth(img Image, cfg *configfile.ConfigFile) (registrytypes.AuthConfig, string, error) {
	// authentication for registry push or cache pull
	// we check if the user set creds in the Pulumi program, and use those preferentially,
	// otherwise we use host machine creds via authConfigs.
	var regAuthConfig registrytypes.AuthConfig
	var msg string

	if img.Registry.Username != "" && img.Registry.Password != "" {
		regAuthConfig.Username = img.Registry.Username
		regAuthConfig.Password = img.Registry.Password
		serverAddr, err := getRegistryAddrForAuth(img.Registry.Server, img.Name)
		if err != nil {
			return regAuthConfig, msg, err
		}
		regAuthConfig.ServerAddress = serverAddr

	} else {
		// send warning if user is attempting to use in-program credentials
		if img.Registry.Username == "" && img.Registry.Password != "" {
			msg = "username was not set, although password was; using host credentials file"
		}
		if img.Registry.Password == "" && img.Registry.Username != "" {
			msg = "password was not set, although username was; using host credentials file"
		}

		registryServer, err := getRegistryAddrForAuth(img.Registry.Server, img.Name)
		if err != nil {
			return regAuthConfig, msg, err
		}

		cliPushAuthConfig, err := cfg.GetAuthConfig(registryServer)
		if err != nil {
			return regAuthConfig, msg, err
		}

		regAuthConfig = registrytypes.AuthConfig(cliPushAuthConfig)
	}
	return regAuthConfig, msg, nil
}

// Because the authConfigs provided by the host may return URIs with the `https://` scheme in the
// map keys, `getRegistryAddrForAuth` ensures we return either the legacy Docker IndexServer's URI,
// which is special cased, or a registry hostname.
func getRegistryAddrForAuth(serverName, imgName string) (string, error) {
	var hostname string

	if serverName == "" {
		// if there is no servername in the registry input, we attempt to build it from the fully qualified image name.
		var err error
		hostname, err = getRegistryAddrFromImage(imgName)
		if err != nil {
			return "", err
		}
	} else {
		hostname = registry.ConvertToHostname(serverName)
	}

	switch hostname {
	// handle historically permitted names, mapping them to the v1 registry hostname
	case registry.IndexHostname, registry.IndexName, registry.DefaultV2Registry.Host:
		return registry.IndexServer, nil
	}
	return hostname, nil
}

func getRegistryAddrFromImage(imgName string) (string, error) {
	named, err := reference.ParseNamed(imgName)
	if err != nil {
		msg := fmt.Errorf("%q: %w.\nThis resource requires all image names to be fully qualified.\n"+
			"For example, if you are attempting to push to Dockerhub, prefix your image name with `docker.io`:\n\n"+
			"`docker.io/repository/image:tag`", imgName, err)
		return "", msg
	}
	addr := reference.Domain(named)
	return addr, nil
}

func (p *dockerNativeProvider) processLog(ctx context.Context, urn resource.URN,
	in io.Reader, onAuxMessage func(json.RawMessage) (bool, string, error),
) error {
	decoder := json.NewDecoder(in)
	for {
		var jm jsonmessage.JSONMessage
		err := decoder.Decode(&jm)
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("error parsing Docker output: %v", err)
		}

		msg, err := processLogLine(jm, onAuxMessage)
		if err != nil {
			return err
		}
		if msg != "" {
			_ = p.host.LogStatus(ctx, "info", urn, msg)
		}
	}

	return nil
}

// processLogLine interprets the output from the Docker Engine, handling JSON encoded messages and
// passing aux messages to a callback to handle.
//
// When `onAuxMessage` is not nil, it will be called with the aux message and should return either a
// bool indicating whether the message was handled, a string to append to the log output, or an
// error.
func processLogLine(jm jsonmessage.JSONMessage,
	onAuxMessage func(json.RawMessage) (bool, string, error),
) (string, error) {
	var info string
	if jm.Error != nil {
		if jm.Error.Code == 401 {
			return "", fmt.Errorf("authentication is required")
		}
		if jm.Error.Message == "EOF" {
			return "", fmt.Errorf("%s\n: This error is most likely due to incorrect or mismatched registry "+
				"credentials. Please double check you are using the correct credentials and registry name.",
				jm.Error.Message)
		}
		return "", fmt.Errorf(jm.Error.Message)
	}
	if jm.From != "" {
		info += jm.From
	}
	if jm.Progress != nil {
		info += jm.Status + " " + jm.Progress.String()
	} else if jm.Stream != "" {
		info += jm.Stream
	} else {
		info += jm.Status
	}
	if jm.Aux != nil {
		// if we're dealing with buildkit tracer logs, we need to decode
		if jm.ID == "moby.buildkit.trace" {
			// Process the message like the 'tracer.write' method in build_buildkit.go
			// https://github.com/docker/docker-ce/blob/master/components/cli/cli/command/image/build_buildkit.go#L392
			var resp controlapi.StatusResponse
			var infoBytes []byte
			// ignore messages that are not understood
			if err := json.Unmarshal(*jm.Aux, &infoBytes); err != nil {
				info += "failed to parse aux message: " + err.Error()
			}
			if err := (&resp).Unmarshal(infoBytes); err != nil {
				info += "failed to parse info bytes: " + err.Error()
			}
			for _, vertex := range resp.Vertexes {
				info += fmt.Sprintf("digest: %+v\n", vertex.Digest)
				info += fmt.Sprintf("%s\n", vertex.Name)
				if vertex.Error != "" {
					info += fmt.Sprintf("error: %s\n", vertex.Error)
				}
			}
			for _, status := range resp.Statuses {
				info += fmt.Sprintf("%s\n", status.GetID())
			}
			for _, log := range resp.Logs {
				info += fmt.Sprintf("%s\n", string(log.Msg))
			}
			for _, warn := range resp.Warnings {
				info += fmt.Sprintf("%s\n", string(warn.Short))
			}

		} else {
			var handled bool
			var output string
			var err error
			if onAuxMessage != nil && jm.Aux != nil {
				handled, output, err = onAuxMessage(*jm.Aux)
			}
			if err != nil {
				return "", err
			} else if !handled {
				// in the case of non-BuildResult aux messages we print out the whole object.
				infoBytes, err := json.Marshal(jm.Aux)
				if err != nil {
					info += "failed to parse aux message: " + err.Error()
				}
				info += string(infoBytes)
			} else if output != "" {
				info += output
			}
		}
	}

	info = strings.TrimSpace(info)
	return info, nil
}

// When `verify` is set, this function will check that the connection to the docker daemon works.
// If it doesn't and no host was configured, it will try to connect to the user's docker daemon
// instead of the system-wide one.
// `verify` is a testing affordance and will always be true in production.
func configureDockerClient(configs map[string]string, verify bool) (*client.Client, error) {
	host, isExplicitHost := configs["host"]

	if !isExplicitHost {
		host = client.DefaultDockerHost
	}

	cli, err := configureDockerClientInner(configs, host)
	if err != nil {
		return nil, err
	}
	if !verify {
		return cli, nil
	}

	// Skip checking connection for SSH.
	// When a user uses an SSH-based client, we do not want to fall back on default hosts.
	// Additionally, due to https://github.com/kreuzwerker/terraform-provider-docker/issues/262,
	// we want to limit making connections to our remote host.
	if cli.DaemonHost() == "http://docker.example.com" {
		return cli, err
	}

	// Check if the connection works. If not and we used the default host, try the possible user hosts.
	// See "Adminless install on macOS" on https://www.docker.com/blog/docker-desktop-4-18/
	testConnection := func(cli *client.Client) bool {
		_, err = cli.Ping(context.Background())
		if err != nil {
			log.Printf("error connecting to docker daemon at %s: %v", cli.DaemonHost(), err)
			return false
		}

		log.Printf("successful connection to docker daemon at %s", cli.DaemonHost())
		return true
	}

	success := testConnection(cli)
	if !success && !isExplicitHost && runtime.GOOS != "windows" {
		home, err2 := os.UserHomeDir()
		if err2 != nil {
			return nil, err2
		}

		userHosts := []string{"unix://%s/.docker/run/docker.sock", "unix://%s/.docker/desktop/docker.sock"}
		for _, userHost := range userHosts {
			userSock := fmt.Sprintf(userHost, home)
			cli, err = configureDockerClientInner(configs, userSock)
			if err != nil {
				return cli, err
			}
			if testConnection(cli) {
				success = true
				break
			}
		}
	}

	if success {
		return cli, err
	}
	return nil, fmt.Errorf("failed to connect to any docker daemon")
}

func configureDockerClientInner(configs map[string]string, host string) (*client.Client, error) {
	// check for TLS inputs
	var caMaterial, certMaterial, keyMaterial, certPath string
	if val, ok := configs["caMaterial"]; ok {
		caMaterial = val
	}
	if val, ok := configs["certMaterial"]; ok {
		certMaterial = val
	}
	if val, ok := configs["keyMaterial"]; ok {
		keyMaterial = val
	}
	if val, ok := configs["certPath"]; ok {
		certPath = val
	}

	var err error
	clientOpts := []client.Opt{}

	// Create the https client with raw TLS certificates that have been provided directly
	if certMaterial != "" || keyMaterial != "" || caMaterial != "" {
		if certMaterial == "" || keyMaterial == "" || caMaterial == "" {
			return nil, fmt.Errorf("certMaterial, keyMaterial, and caMaterial must all be specified")
		}
		if certPath != "" {
			return nil, fmt.Errorf("when using raw certificates, certPath must not be specified")
		}

		httpClient, err := buildHTTPClientFromBytes([]byte(caMaterial), []byte(certMaterial), []byte(keyMaterial))
		if err != nil {
			return nil, err
		}

		clientOpts = append(clientOpts, client.WithHTTPClient(httpClient))
		// Set host before env to preserve previous logic
		if host != "" {
			clientOpts = append(clientOpts, client.WithHost(host))
		}
		clientOpts = append(clientOpts,
			client.FromEnv,
			client.WithAPIVersionNegotiation())
	} else if certPath != "" {
		// Create the https client with TLS certificate material at the specified path
		var ca, cert, key string
		ca = filepath.Join(certPath, "ca.pem")
		cert = filepath.Join(certPath, "cert.pem")
		key = filepath.Join(certPath, "key.pem")

		clientOpts = append(clientOpts,
			client.FromEnv,
			client.WithTLSClientConfig(ca, cert, key),
			client.WithAPIVersionNegotiation())

		if host != "" {
			clientOpts = append(clientOpts, client.WithHost(host))
		}
	} else {
		// No TLS certificate material provided, create an http client
		if host != "" {
			var sshopts []string
			if opts, ok := configs["sshOpts"]; ok {
				err := json.Unmarshal([]byte(opts), &sshopts)
				if err != nil {
					return nil, err
				}
			}
			// first, check for ssh host
			helper, err := connhelper.GetConnectionHelperWithSSHOpts(host, sshopts)
			if err != nil {
				return nil, err
			}
			if helper != nil {
				clientOpts = append(clientOpts,
					client.FromEnv,
					client.WithAPIVersionNegotiation(),
					client.WithDialContext(helper.Dialer),
					client.WithHost(helper.Host))
			} else {
				// if no helper is registered for the scheme, we return a non-SSH client using the supplied host.
				clientOpts = append(clientOpts,
					client.FromEnv,
					client.WithHost(host),
					client.WithAPIVersionNegotiation())
			}
		} else {
			clientOpts = append(clientOpts,
				client.FromEnv,
				client.WithAPIVersionNegotiation())
		}
	}

	res, err := client.NewClientWithOpts(clientOpts...)

	return res, err
}

// buildHTTPClientFromBytes builds the http client from bytes (content of the files)
func buildHTTPClientFromBytes(caPEMCert, certPEMBlock, keyPEMBlock []byte) (*http.Client, error) {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
		MaxVersion: 0,
	}
	if certPEMBlock != nil && keyPEMBlock != nil {
		tlsCert, err := tls.X509KeyPair(certPEMBlock, keyPEMBlock)
		if err != nil {
			return nil, err
		}
		tlsConfig.Certificates = []tls.Certificate{tlsCert}
	}

	if len(caPEMCert) == 0 {
		return nil, fmt.Errorf("certificate authority must be specified")
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEMCert) {
		return nil, fmt.Errorf("could not add RootCA pem")
	}
	tlsConfig.RootCAs = caPool

	tr := defaultTransport()
	tr.TLSClientConfig = tlsConfig
	return &http.Client{Transport: tr}, nil
}

// defaultTransport returns a new http.Transport with similar default values to
// http.DefaultTransport, but with idle connections and keepalives disabled.
func defaultTransport() *http.Transport {
	transport := defaultPooledTransport()
	transport.DisableKeepAlives = true
	transport.MaxIdleConnsPerHost = -1
	return transport
}

// defaultPooledTransport returns a new http.Transport with similar default
// values to http.DefaultTransport.
func defaultPooledTransport() *http.Transport {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConnsPerHost:   runtime.GOMAXPROCS(0) + 1,
	}
	return transport
}
