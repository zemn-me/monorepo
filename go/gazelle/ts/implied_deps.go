package ts

// these naughty packages did not declare
// their deps correctly...
var impliedDeps = map[string][]string{
	"@tanstack/react-query":          {"react"},
	"@tanstack/react-query-devtools": {"@tanstack/query-core"},
	"next":                           {"react-dom"},
}
