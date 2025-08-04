// do not manually update this file, instead run:
// go mod tidy && bazel mod tidy

module github.com/zemn-me/monorepo

go 1.24.0

require (
	github.com/a-h/generate v0.0.0-20220105161013-96c14dfdfb60
	github.com/aws/aws-lambda-go v1.49.0
	github.com/aws/aws-sdk-go-v2 v1.37.2
	github.com/aws/aws-sdk-go-v2/config v1.30.3
	github.com/aws/aws-sdk-go-v2/credentials v1.18.3
	github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue v1.20.2
	github.com/aws/aws-sdk-go-v2/service/dynamodb v1.46.0
	github.com/aws/aws-sdk-go-v2/service/s3 v1.86.0
	github.com/awslabs/aws-lambda-go-api-proxy v0.16.2
	github.com/bazelbuild/bazel-gazelle v0.44.0
	github.com/bazelbuild/bazel-watcher v0.26.10
	github.com/bazelbuild/buildtools v0.0.0-20240918101019-be1c24cc9a44
	github.com/bazelbuild/rules_go v0.56.1
	github.com/beevik/etree v1.5.1
	github.com/blang/semver/v4 v4.0.0
	github.com/coreos/go-oidc v2.4.0+incompatible
	github.com/getkin/kin-openapi v0.132.0
	github.com/go-chi/chi/v5 v5.2.2
	github.com/go-chi/cors v1.2.2
	github.com/go-delve/delve v1.25.1
	github.com/golang/protobuf v1.5.4
	github.com/google/go-containerregistry v0.20.6
	github.com/google/uuid v1.6.0
	github.com/gorilla/websocket v1.5.3
	github.com/hashicorp/terraform-plugin-framework v1.15.1
	github.com/itchyny/gojq v0.12.17
	github.com/nyaruka/phonenumbers v1.6.4
	github.com/oapi-codegen/nethttp-middleware v1.1.2
	github.com/oapi-codegen/oapi-codegen/v2 v2.5.0
	github.com/oapi-codegen/runtime v1.1.2
	github.com/sergi/go-diff v1.4.0
	github.com/tdewolff/parse/v2 v2.8.1
	github.com/tebeka/selenium v0.9.9
	github.com/twilio/twilio-go v1.27.0
	github.com/xeipuuv/gojsonschema v1.2.0
	golang.org/x/sync v0.16.0
	golang.org/x/tools v0.35.0
	golang.org/x/tools/gopls v0.17.1
	honnef.co/go/tools v0.6.1
)

require (
	github.com/BurntSushi/toml v1.4.1-0.20240526193622-a339e1f7089c // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.0 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.2 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.2 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.2 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.8.3 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/dynamodbstreams v1.28.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.8.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/endpoint-discovery v1.11.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.27.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.32.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.36.0 // indirect
	github.com/aws/smithy-go v1.22.5 // indirect
	github.com/blang/semver v3.5.1+incompatible // indirect
	github.com/cilium/ebpf v0.11.0 // indirect
	github.com/containerd/stargz-snapshotter/estargz v0.16.3 // indirect
	github.com/cosiner/argv v0.1.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.7 // indirect
	github.com/derekparker/trie v0.0.0-20230829180723-39f4de51ef7d // indirect
	github.com/docker/cli v28.2.2+incompatible // indirect
	github.com/docker/distribution v2.8.3+incompatible // indirect
	github.com/docker/docker-credential-helpers v0.9.3 // indirect
	github.com/dprotaso/go-yit v0.0.0-20220510233725-9ba8df137936 // indirect
	github.com/fatih/color v1.18.0 // indirect
	github.com/fsnotify/fsevents v0.2.0 // indirect
	github.com/fsnotify/fsnotify v1.9.0 // indirect
	github.com/go-delve/liner v1.2.3-0.20231231155935-4726ab1d7f62 // indirect
	github.com/go-openapi/jsonpointer v0.21.0 // indirect
	github.com/go-openapi/swag v0.23.0 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.2 // indirect
	github.com/golang/mock v1.7.0-rc.1 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/go-dap v0.12.0 // indirect
	github.com/gorilla/mux v1.8.1 // indirect
	github.com/hashicorp/go-hclog v1.6.3 // indirect
	github.com/hashicorp/go-plugin v1.6.3 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/hashicorp/terraform-plugin-go v0.27.0 // indirect
	github.com/hashicorp/terraform-plugin-log v0.9.0 // indirect
	github.com/hashicorp/terraform-registry-address v0.2.5 // indirect
	github.com/hashicorp/terraform-svchost v0.1.1 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/itchyny/timefmt-go v0.1.6 // indirect
	github.com/jaschaephraim/lrserver v0.0.0-20240306232639-afed386b3640 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.15 // indirect
	github.com/mattn/go-shellwords v1.0.12 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/oasdiff/yaml v0.0.0-20250309154309-f31be36b4037 // indirect
	github.com/oasdiff/yaml3 v0.0.0-20250309153720-d2182401db90 // indirect
	github.com/oklog/run v1.0.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.1 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pquerna/cachecontrol v0.2.0 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/speakeasy-api/jsonpath v0.6.0 // indirect
	github.com/speakeasy-api/openapi-overlay v0.10.2 // indirect
	github.com/spf13/cobra v1.9.1 // indirect
	github.com/spf13/pflag v1.0.6 // indirect
	github.com/vbatts/tar-split v0.12.1 // indirect
	github.com/vmihailenco/msgpack/v5 v5.4.1 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	github.com/vmware-labs/yaml-jsonpath v0.3.2 // indirect
	github.com/xeipuuv/gojsonpointer v0.0.0-20180127040702-4e3ac2762d5f // indirect
	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 // indirect
	go.starlark.net v0.0.0-20231101134539-556fd59b42f6 // indirect
	golang.org/x/arch v0.11.0 // indirect
	golang.org/x/crypto v0.37.0 // indirect
	golang.org/x/exp v0.0.0-20250305212735-054e65f0b394 // indirect
	golang.org/x/exp/typeparams v0.0.0-20231108232855-2478ac86f678 // indirect
	golang.org/x/mod v0.25.0 // indirect
	golang.org/x/net v0.39.0 // indirect
	golang.org/x/oauth2 v0.30.0 // indirect
	golang.org/x/sys v0.34.0 // indirect
	golang.org/x/telemetry v0.0.0-20241106142447-58a1122356f5 // indirect
	golang.org/x/text v0.24.0 // indirect
	golang.org/x/tools/go/vcs v0.1.0-deprecated // indirect
	golang.org/x/vuln v1.0.4 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250218202821-56aae31c358a // indirect
	google.golang.org/grpc v1.72.1 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
	gopkg.in/go-jose/go-jose.v2 v2.6.3 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	mvdan.cc/gofumpt v0.7.0 // indirect
	mvdan.cc/xurls/v2 v2.5.0 // indirect
)

// gopls needs this very specific version of tools.
replace golang.org/x/tools => golang.org/x/tools v0.27.1-0.20241219162658-575221bfbda3
