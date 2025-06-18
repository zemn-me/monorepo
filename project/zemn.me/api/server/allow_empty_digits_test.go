package apiserver

import (
    "testing"

    "github.com/getkin/kin-openapi/openapi3"
    apiSpec "github.com/zemn-me/monorepo/project/zemn.me/api"
)

func TestSpecAllowsEmptyDigits(t *testing.T) {
    loader := openapi3.NewLoader()
    spec, err := loader.LoadFromData([]byte(apiSpec.Spec))
    if err != nil {
        t.Fatalf("failed to load spec: %v", err)
    }

    pathItem := spec.Paths.Find("/phone/handleEntry")
    if pathItem == nil {
        t.Fatalf("path /phone/handleEntry not found")
    }
    if pathItem.Get == nil {
        t.Fatalf("GET operation missing on /phone/handleEntry")
    }

    var param *openapi3.ParameterRef
    for _, p := range pathItem.Get.Parameters {
        if p.Value != nil && p.Value.Name == "Digits" && p.Value.In == "query" {
            param = p
            break
        }
    }
    if param == nil {
        t.Fatalf("Digits query parameter not found")
    }
    if !param.Value.AllowEmptyValue {
        t.Errorf("expected allowEmptyValue to be true for Digits param")
    }
}

