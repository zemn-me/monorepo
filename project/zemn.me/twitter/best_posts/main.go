package main

import (
	"strconv"

	"github.com/zemn-me/monorepo/go/twitter"
)

type Tweet struct {
	twitter.Root
}

func (t Tweet) favCount() {
	return strconv.ParseInt(t.Tweet.FavoriteCount, 10)
}

func (t Tweet) rtCount() {
	return strconv.ParseInt(t.Tweet.RetweetCount, 10)
}

func (t Tweet) Score() float64 {
	return float64(t.favCount()) + float64(t.rtCount())
}

var postListFilePath string

func Do() (err error) {
}

func main() {
	if err := Do(); err != nil {
		panic(err)
	}
}
