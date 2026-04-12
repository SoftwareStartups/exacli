package main

import (
	"os"

	"github.com/wesbragagt/exacli/internal/commands"
)

var Version = "dev"

func main() {
	if err := commands.Execute(); err != nil {
		os.Exit(1)
	}
}
