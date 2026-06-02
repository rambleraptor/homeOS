package cmd

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/rambleraptor/aepbase/pkg/user"

	"homestead/cli/internal/project"
	"homestead/cli/internal/usersadmin"
)

// runUsers dispatches the `homestead users` verbs. The top-level dispatcher is
// a flat switch; users nests its own subcommands.
func runUsers(args []string) error {
	if len(args) == 0 {
		printUsersUsage()
		return fmt.Errorf("missing users subcommand")
	}
	sub, rest := args[0], args[1:]
	switch sub {
	case "list":
		return runUsersList(rest)
	case "get":
		return runUsersGet(rest)
	case "create":
		return runUsersCreate(rest)
	case "update":
		return runUsersUpdate(rest)
	case "delete":
		return runUsersDelete(rest)
	case "help", "-h", "--help":
		printUsersUsage()
		return nil
	default:
		printUsersUsage()
		return fmt.Errorf("unknown users subcommand %q", sub)
	}
}

// parseInterspersed parses fs while tolerating positional arguments that
// appear before, between, or after flags. Go's flag package stops at the first
// non-flag token, which makes `users delete <id> --yes` silently drop --yes;
// this loop keeps parsing the remainder after each positional so flag order
// doesn't matter. Returns the collected positionals.
func parseInterspersed(fs *flag.FlagSet, args []string) ([]string, error) {
	var positionals []string
	for {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		if fs.NArg() == 0 {
			return positionals, nil
		}
		positionals = append(positionals, fs.Arg(0))
		args = fs.Args()[1:]
	}
}

// resolveDataDir returns the data dir to operate on: the explicit --data-dir
// flag when set, otherwise the project's default (<project>/data).
func resolveDataDir(dataDir string) (string, error) {
	if dataDir != "" {
		return dataDir, nil
	}
	p, err := project.Load(".")
	if err != nil {
		return "", err
	}
	return p.DataDir, nil
}

func runUsersList(args []string) error {
	fs := flag.NewFlagSet("users list", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		return err
	}
	d, err := usersadmin.Open(dir, "")
	if err != nil {
		return err
	}
	defer d.Close()

	users, err := usersadmin.List(d)
	if err != nil {
		return err
	}
	if len(users) == 0 {
		fmt.Println("no users")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tEMAIL\tTYPE\tDISPLAY_NAME\tCREATE_TIME")
	for _, u := range users {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", u.ID, u.Email, u.Type, u.DisplayName, u.CreateTime)
	}
	return w.Flush()
}

func runUsersGet(args []string) error {
	fs := flag.NewFlagSet("users get", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	email := fs.String("email", "", "look up by email instead of id")
	pos, err := parseInterspersed(fs, args)
	if err != nil {
		return err
	}

	selector := *email
	if selector == "" {
		if len(pos) == 0 {
			return fmt.Errorf("usage: homestead users get <id|--email E>")
		}
		selector = pos[0]
	}

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		return err
	}
	d, err := usersadmin.Open(dir, "")
	if err != nil {
		return err
	}
	defer d.Close()
	u, err := usersadmin.Get(d, selector)
	if err != nil {
		return err
	}
	if u == nil {
		return fmt.Errorf("no user matching %q", selector)
	}
	printUser(u)
	return nil
}

func runUsersCreate(args []string) error {
	fs := flag.NewFlagSet("users create", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	email := fs.String("email", "", "email address (required)")
	displayName := fs.String("display-name", "", "display name")
	typ := fs.String("type", user.TypeRegular, "user type: regular or superuser")
	superuser := fs.Bool("superuser", false, "shorthand for --type=superuser")
	password := fs.String("password", "", "password (a random one is generated if omitted)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	resolvedType := *typ
	if *superuser {
		resolvedType = user.TypeSuperuser
	}

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		return err
	}
	d, err := usersadmin.Open(dir, "")
	if err != nil {
		return err
	}
	defer d.Close()

	u, generated, err := usersadmin.Create(d, usersadmin.CreateParams{
		Email:       *email,
		DisplayName: *displayName,
		Type:        resolvedType,
		Password:    *password,
	})
	if err != nil {
		return err
	}

	fmt.Printf("created user %s (%s, %s)\n", u.Email, u.ID, u.Type)
	if generated != "" {
		fmt.Printf("generated password: %s\n", generated)
		fmt.Println("(store this now — it is not recoverable later)")
	}
	return nil
}

func runUsersUpdate(args []string) error {
	fs := flag.NewFlagSet("users update", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	email := fs.String("email", "", "new email address")
	displayName := fs.String("display-name", "", "new display name")
	typ := fs.String("type", "", "new user type: regular or superuser")
	superuser := fs.Bool("superuser", false, "shorthand for --type=superuser")
	password := fs.String("password", "", "new password")
	force := fs.Bool("force", false, "allow demoting the last superuser")
	pos, err := parseInterspersed(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: homestead users update <id> [flags]")
	}
	id := pos[0]

	var p usersadmin.UpdateParams
	// Only forward flags the user actually set, so unspecified fields stay put.
	seen := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { seen[f.Name] = true })
	if seen["email"] {
		p.Email = email
	}
	if seen["display-name"] {
		p.DisplayName = displayName
	}
	if *superuser {
		su := user.TypeSuperuser
		p.Type = &su
	} else if seen["type"] {
		p.Type = typ
	}
	if seen["password"] {
		p.Password = password
	}

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		return err
	}
	d, err := usersadmin.Open(dir, "")
	if err != nil {
		return err
	}
	defer d.Close()

	u, err := usersadmin.Update(d, id, p, *force)
	if err != nil {
		return err
	}
	fmt.Printf("updated user %s (%s, %s)\n", u.Email, u.ID, u.Type)
	return nil
}

func runUsersDelete(args []string) error {
	fs := flag.NewFlagSet("users delete", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	yes := fs.Bool("yes", false, "skip the confirmation prompt")
	force := fs.Bool("force", false, "allow deleting the last superuser")
	pos, err := parseInterspersed(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: homestead users delete <id> [--yes] [--force]")
	}
	id := pos[0]

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		return err
	}
	d, err := usersadmin.Open(dir, "")
	if err != nil {
		return err
	}
	defer d.Close()

	u, err := usersadmin.Get(d, id)
	if err != nil {
		return err
	}
	if u == nil {
		return fmt.Errorf("no user with id %q", id)
	}

	if !*yes {
		fmt.Printf("delete user %s (%s)? [y/N]: ", u.Email, u.ID)
		reader := bufio.NewReader(os.Stdin)
		answer, _ := reader.ReadString('\n')
		if a := strings.ToLower(strings.TrimSpace(answer)); a != "y" && a != "yes" {
			fmt.Println("aborted")
			return nil
		}
	}

	deleted, err := usersadmin.Delete(d, u.ID, *force)
	if err != nil {
		return err
	}
	if !deleted {
		return fmt.Errorf("no user with id %q", u.ID)
	}
	fmt.Printf("deleted user %s (%s)\n", u.Email, u.ID)
	return nil
}

func printUser(u *user.User) {
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintf(w, "id\t%s\n", u.ID)
	fmt.Fprintf(w, "email\t%s\n", u.Email)
	fmt.Fprintf(w, "type\t%s\n", u.Type)
	fmt.Fprintf(w, "display_name\t%s\n", u.DisplayName)
	fmt.Fprintf(w, "create_time\t%s\n", u.CreateTime)
	fmt.Fprintf(w, "update_time\t%s\n", u.UpdateTime)
	w.Flush()
}

func printUsersUsage() {
	lines := []string{
		"homestead users — manage user accounts directly in the aepbase database.",
		"",
		"Usage:",
		"  homestead users list",
		"  homestead users get <id|--email E>",
		"  homestead users create --email E [--display-name N] [--type regular|superuser] [--superuser] [--password P]",
		"  homestead users update <id> [--email E] [--display-name N] [--type T] [--superuser] [--password P] [--force]",
		"  homestead users delete <id> [--yes] [--force]",
		"",
		"All subcommands accept --data-dir=PATH (default <project>/data).",
		"On create, a random password is generated and printed once when --password is omitted.",
	}
	fmt.Println(strings.Join(lines, "\n"))
}
