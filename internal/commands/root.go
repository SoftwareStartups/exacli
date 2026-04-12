package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
)

var rootCmd = &cobra.Command{
	Use:   "exacli",
	Short: "AI-powered search and content retrieval",
	Long:  helpText,
	RunE: func(cmd *cobra.Command, args []string) error {
		v, _ := cmd.Flags().GetBool("version")
		if v {
			fmt.Printf("exacli version %s\n", Version)
			return nil
		}
		return cmd.Help()
	},
}

// Version is set via -ldflags at build time
var Version = "dev"

const helpText = `exacli — Exa AI search CLI

Commands:
  search     Search the web using Exa
  code       Search code using the Exa Code API
  contents   Get content from URLs
  similar    Find similar pages to a URL
  answer     Get an AI-powered answer to a query
  research   Start a deep research task
  research-status  Get status of a research task
  research-list    List research tasks
  login      Store your Exa API key in the OS keychain
  logout     Remove your Exa API key from the OS keychain

Global Flags:
  --api-key string   Exa API key (overrides EXA_API_KEY env var and keychain)
  --json             Output raw JSON
  --toon             Output compact TOON format
  --version          Show version information

Examples:
  exacli search "latest AI news" --num-results 5
  exacli contents https://example.com --text
  exacli answer "What is the capital of France?"
  exacli research "trends in quantum computing" --poll
  exacli login`

func init() {
	rootCmd.PersistentFlags().String("api-key", "", "Exa API key (or EXA_API_KEY env var)")
	rootCmd.PersistentFlags().Bool("json", false, "Output raw JSON")
	rootCmd.PersistentFlags().Bool("toon", false, "Output compact TOON format")
	rootCmd.Flags().Bool("version", false, "Show version information")
}

func Execute() error {
	return rootCmd.Execute()
}

// ResolveAPIKey resolves the API key from flag → env → keychain.
func ResolveAPIKey(cmd *cobra.Command) (string, error) {
	// 1. --api-key flag (check persistent flags on root too)
	if key, _ := cmd.Flags().GetString("api-key"); key != "" {
		return key, nil
	}
	if key, _ := cmd.InheritedFlags().GetString("api-key"); key != "" {
		return key, nil
	}
	// 2. EXA_API_KEY env var
	if key := os.Getenv("EXA_API_KEY"); key != "" {
		return key, nil
	}
	// 3. OS keychain via go-keyring
	key, err := keyring.Get("exacli", "EXA_API_KEY")
	if err == nil && key != "" {
		return key, nil
	}
	return "", fmt.Errorf("no API key found. Run \"exacli login\", use --api-key, or set EXA_API_KEY environment variable")
}
