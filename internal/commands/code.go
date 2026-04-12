package commands

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
	"github.com/wesbragagt/exacli/internal/client"
	"github.com/wesbragagt/exacli/internal/formatters"
)

var validTokensNum = map[string]bool{
	"dynamic": true, "1000": true, "5000": true, "50000": true,
}

var codeCmd = &cobra.Command{
	Use:   "code <query>",
	Short: "Search code using the Exa Code API",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := strings.Join(args, " ")

		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		tokensNumStr, _ := cmd.Flags().GetString("tokens-num")
		if !validTokensNum[tokensNumStr] {
			fmt.Fprintf(os.Stderr, "Error: invalid --tokens-num %q. Valid values: dynamic, 1000, 5000, 50000\n", tokensNumStr)
			os.Exit(1)
		}

		var tokensNum any = tokensNumStr
		if tokensNumStr != "dynamic" {
			n, _ := strconv.Atoi(tokensNumStr)
			tokensNum = n
		}

		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		resp, err := c.CodeContext(query, client.CodeContextOptions{TokensNum: tokensNum})
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		fmt.Print(formatters.FormatCodeContextResult(resp, asJSON, asToon))
		return nil
	},
}

func init() {
	codeCmd.Flags().String("tokens-num", "dynamic", "Token budget for context (dynamic|1000|5000|50000)")
	rootCmd.AddCommand(codeCmd)
}
