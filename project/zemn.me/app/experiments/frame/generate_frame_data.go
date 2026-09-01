package main

import (
	"encoding/csv"
	"os"
)

type Measurement struct {
	scalar uint
	unit   string
}

func (m Measurement) toTypescript() (string, error) {
}

type Frame struct {
	name string
}

type OutputFile struct {
	frames []Frame
}

func Do() {
	src, err := os.Open("project/zemn.me/app/experiments/frame/frame_sizes.csv")
	if err != nil {
		return
	}
	defer src.Close()
	csvReader := csv.NewReader(src)
	csvReader.TrimLeadingSpace = true
	csvReader.ReuseRecord = true

	dst, err := os.OpenFile("project/zemn.me/app/experiments/frame/frame_sizes.ts")
	if err != nil {
		return
	}

	csvReader.ReadAll()
}

func main() {
	if err := Do(); err != nil {
		panic(err)
	}
}
