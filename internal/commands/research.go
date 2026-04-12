package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/wesbragagt/exacli/internal/client"
	"github.com/wesbragagt/exacli/internal/formatters"
)

var researchCmd = &cobra.Command{
	Use:   "research <instructions>",
	Short: "Start a deep research task",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		instructions := strings.Join(args, " ")

		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get research flags
		modelFlag, _ := cmd.Flags().GetString("model")
		poll, _ := cmd.Flags().GetBool("poll")
		pollInterval, _ := cmd.Flags().GetInt("poll-interval")
		timeout, _ := cmd.Flags().GetInt("timeout")

		// Map model flag to API value
		apiModel := ""
		switch modelFlag {
		case "fast":
			apiModel = "exa-research-fast"
		case "regular":
			apiModel = "exa-research"
		case "pro":
			apiModel = "exa-research-pro"
		case "":
			apiModel = ""
		default:
			fmt.Fprintf(os.Stderr, "Error: invalid --model %q. Valid: fast, regular, pro\n", modelFlag)
			os.Exit(1)
		}

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		task, err := c.ResearchCreate(instructions, client.ResearchCreateOptions{Model: apiModel})
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		// Print initial task info
		if asJSON {
			data, _ := json.MarshalIndent(task, "", "  ")
			fmt.Println(string(data))
		} else if asToon {
			fmt.Println(formatters.FormatResearchTask(task, false, true))
		} else {
			fmt.Println(formatters.FormatSuccess("Research task created", false))
			fmt.Printf("Task ID: %s\n", task.ResearchID)
			fmt.Printf("Status: %s\n", task.Status)
		}

		if poll {
			fmt.Print("\nPolling for results...\n\n")
			result, err := c.ResearchPollUntilFinished(task.ResearchID, pollInterval, timeout)
			if err != nil {
				fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
				os.Exit(1)
			}
			fmt.Print(formatters.FormatResearchTask(result, asJSON, asToon))
		}

		return nil
	},
}

var researchStatusCmd = &cobra.Command{
	Use:   "research-status <id>",
	Short: "Get status of a research task",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		task, err := c.ResearchGet(id, true)
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		fmt.Print(formatters.FormatResearchTask(task, asJSON, asToon))
		return nil
	},
}

var researchListCmd = &cobra.Command{
	Use:   "research-list",
	Short: "List research tasks",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get list flags
		limit, _ := cmd.Flags().GetInt("limit")
		cursor, _ := cmd.Flags().GetString("cursor")

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		result, err := c.ResearchList(client.ResearchListOptions{Limit: limit, Cursor: cursor})
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		if asJSON {
			data, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Print(formatters.FormatResearchList(result, false, asToon))
		}

		return nil
	},
}

func init() {
	researchCmd.Flags().String("model", "", "Research model (fast|regular|pro)")
	researchCmd.Flags().Bool("poll", false, "Poll until task completes")
	researchCmd.Flags().Int("poll-interval", 1000, "Poll interval in milliseconds")
	researchCmd.Flags().Int("timeout", 600000, "Timeout in milliseconds")

	researchListCmd.Flags().Int("limit", 0, "Maximum number of tasks to return")
	researchListCmd.Flags().String("cursor", "", "Pagination cursor")

	rootCmd.AddCommand(researchCmd)
	rootCmd.AddCommand(researchStatusCmd)
	rootCmd.AddCommand(researchListCmd)
}
