package main

import (
	"fmt"
	"os"
	"github.com/xeipuuv/gojsonschema"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: validator <schema.json> <document.json>")
		os.Exit(1)
	}

	schemaFile := os.Args[1]
	documentFile := os.Args[2]

	schemaLoader := gojsonschema.NewReferenceLoader("file://" + schemaFile)
	documentLoader := gojsonschema.NewReferenceLoader("file://" + documentFile)

	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}

	if result.Valid() {
		os.Exit(0)
	} else {
		fmt.Println("Invalid. Errors:")
		for _, desc := range result.Errors() {
			fmt.Printf("- %s\n", desc)
		}
		os.Exit(1)
	}
}
