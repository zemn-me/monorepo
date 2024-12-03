# Define a recursive function to process JSON schemas.
# This function transforms schemas with `items` arrays (used for tuple validation in older drafts)
# into schemas using `prefixItems`, which is the modern approach for tuple validation.

def process_schema:
  # Bind the current schema to $schema for ease of reference
  . as $schema
  | if type == "object" then
      # Iterate over all keys in the current schema
      reduce keys[] as $key (
        .;
        # Recursively process each value in the schema
        .[$key] = (.[$key] | process_schema)
      )
      # Check if the current schema is an array type
      # and if `items` is defined as an array (indicating tuple validation in older drafts)
      | if .type == "array" and (.items | type == "array") then
          # Replace `items` with `prefixItems` for compatibility with modern drafts
          .prefixItems = .items
          # Remove the legacy `items` field
          | del(.items)
        else
          # Leave the schema unchanged if no transformation is needed
          .
        end
    elif type == "array" then
      # If the current schema is an array of schemas, recursively process each element
      map(process_schema)
    else
      # For all other types, return the schema unchanged
      .
    end;

# Apply the transformation function to the root schema
process_schema
