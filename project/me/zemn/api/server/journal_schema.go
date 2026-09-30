package apiserver

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/xeipuuv/gojsonschema"
	apiSpec "github.com/zemn-me/monorepo/project/me/zemn/api"
)

// Go reflection loses OpenAPI enums and bounds. Export the reachable API
// schemas instead so the agent sees the same wire contract as API clients.
var journalCurationOutputSchema = sync.OnceValues(func() (map[string]any, error) {
	spec, err := openapi3.NewLoader().LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		return nil, err
	}
	definitions := map[string]any{}
	pending := []string{"JournalCurationResult"}
	var rewrite func(any) error
	rewrite = func(value any) error {
		switch value := value.(type) {
		case map[string]any:
			if ref, ok := value["$ref"].(string); ok {
				const prefix = "#/components/schemas/"
				if !strings.HasPrefix(ref, prefix) {
					return fmt.Errorf("unsupported curation schema reference")
				}
				name := strings.TrimPrefix(ref, prefix)
				value["$ref"] = "#/definitions/" + name
				pending = append(pending, name)
			}
			if value["type"] == "object" {
				value["additionalProperties"] = false
			}
			for key, child := range value {
				if strings.HasPrefix(key, "x-") {
					delete(value, key)
					continue
				}
				if err := rewrite(child); err != nil {
					return err
				}
			}
		case []any:
			for _, child := range value {
				if err := rewrite(child); err != nil {
					return err
				}
			}
		}
		return nil
	}
	for len(pending) > 0 {
		name := pending[0]
		pending = pending[1:]
		if _, ok := definitions[name]; ok {
			continue
		}
		ref := spec.Components.Schemas[name]
		if ref == nil || ref.Value == nil {
			return nil, fmt.Errorf("missing curation schema component")
		}
		data, err := json.Marshal(ref.Value)
		if err != nil {
			return nil, err
		}
		var definition map[string]any
		if err := json.Unmarshal(data, &definition); err != nil {
			return nil, err
		}
		if err := rewrite(definition); err != nil {
			return nil, err
		}
		definitions[name] = definition
	}
	return map[string]any{"$schema": "http://json-schema.org/draft-07/schema#", "$ref": "#/definitions/JournalCurationResult", "definitions": definitions}, nil
})

// Compile the very schema supplied to the agent, so wire constraints have one
// authority. Evidence and cross-document integrity still need corpus checks.
var journalCurationValidator = sync.OnceValues(func() (*gojsonschema.Schema, error) {
	schema, err := journalCurationOutputSchema()
	if err != nil {
		return nil, err
	}
	return gojsonschema.NewSchema(gojsonschema.NewGoLoader(schema))
})

func validateJournalCurationSchema(result JournalCurationResult) error {
	schema, err := journalCurationValidator()
	if err != nil {
		return err
	}
	validation, err := schema.Validate(gojsonschema.NewGoLoader(result))
	if err != nil {
		return fmt.Errorf("cannot validate journal output schema")
	}
	if !validation.Valid() {
		// Validation descriptions can contain private values. Only expose the
		// validator's fixed error category, never the value or field path.
		return fmt.Errorf("journal output violates schema: %s", validation.Errors()[0].Type())
	}
	return nil
}
