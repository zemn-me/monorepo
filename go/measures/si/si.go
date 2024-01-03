package si

import (
	"fmt"
)


type Multiplier int

func multiplierShortName(shortName string) (mul Multiplier, err error) {
	if index, ok := short_name_to_index[shortName]; ok {
		mul = multiplier_scalars[index]
		return
	}

	err = fmt.Errorf("Invalid short name: %s", shortName)

	return
}

func multiplierLongName(longName string) (mul Multiplier, err error) {
	if index, ok := long_name_to_index[longName]; ok {
		mul = multiplier_scalars[index]
		return
	}

	err = fmt.Errorf("Invalid long name: %s", longName)

	return
}


