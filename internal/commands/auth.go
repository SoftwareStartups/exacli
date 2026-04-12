package commands

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/SoftwareStartups/exacli/internal/client"
	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Store your Exa API key in the OS keychain",
	RunE: func(cmd *cobra.Command, args []string) error {
		skipValidation, _ := cmd.Flags().GetBool("skip-validation")

		// Prompt user for API key
		fmt.Print("Enter your Exa API key: ")
		reader := bufio.NewReader(os.Stdin)
		key, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("failed to read API key: %w", err)
		}
		key = strings.TrimSpace(key)

		// Validate API key if not skipped
		if !skipValidation {
			c := client.New(key)
			_, err := c.Search("test", client.SearchOptions{NumResults: 1})
			if err != nil {
				fmt.Fprintf(os.Stderr, "API key validation failed: %v\n", err)
				os.Exit(1)
			}
		}

		// Store in keyring
		err = keyring.Set("exacli", "EXA_API_KEY", key)
		if err != nil {
			return fmt.Errorf("failed to store API key in keyring: %w", err)
		}

		fmt.Println("API key stored successfully.")
		return nil
	},
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove your Exa API key from the OS keychain",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := keyring.Delete("exacli", "EXA_API_KEY")
		if err != nil {
			fmt.Println("No API key stored.")
			return nil
		}
		fmt.Println("API key removed.")
		return nil
	},
}

func init() {
	loginCmd.Flags().Bool("skip-validation", false, "Skip validating the API key")
	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(logoutCmd)
}
