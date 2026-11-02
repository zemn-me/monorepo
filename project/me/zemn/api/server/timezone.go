package apiserver

// Timezone validation and journal date arithmetic must also work in minimal
// execution and deployment environments without an OS zoneinfo installation.
import _ "time/tzdata"
