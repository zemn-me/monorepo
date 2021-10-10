// +build windows

package main

import (
	"fmt"
	"syscall"
)

func steamFolderSearchPaths() (paths []string, err error) {
	d, err := drives()
	if err != nil {
		return
	}
	paths = joinPaths(permutePaths(d, "Program Files", "Program Files (x86)"), "Steam")
	return
}

func drives() (root []string, err error) {
	kernel32, err := syscall.LoadLibrary("kernel32.dll")
	if err != nil {
		return
	}

	getLogicalDrivesHandle, err := syscall.GetProcAddress(kernel32, "GetLogicalDrives")

	if err != nil {
		return
	}

	ret, _, callErr := syscall.Syscall(uintptr(getLogicalDrivesHandle), 0, 0, 0, 0)
	if callErr != 0 {
		return nil, fmt.Errorf("Windows syscall error: %d", callErr)
	}

	return bitsToDrives(uint32(ret)), nil
}

func bitsToDrives(bitMap uint32) (drives []string) {
	availableDrives := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"}

	for i := range availableDrives {
		if bitMap&1 == 1 {
			drives = append(drives, availableDrives[i]+":")
		}
		bitMap >>= 1
	}

	return
}
