#!/bin/bash
# PreToolUse hook: Block destructive git and filesystem commands
#
# Matcher scopes this to Bash tool calls. The input is the PreToolUse JSON
# (https://code.claude.com/docs/en/hooks): only tool_input.command is the
# command; tool_input.description, cwd and transcript_path are prose and paths
# that must not be matched.
#
# Blocking is exit 2 with the reason on stderr, which Claude reads as the
# denial reason. Any other non-zero exit lets the call proceed, so a failure
# to read the input also exits 2.
#
# This is a guard against the commands an agent plausibly writes, not a
# security boundary: `sh -c`, aliases and scripts are out of reach of any
# text match. It errs toward blocking, so quoted text that spells out a
# destructive command (a commit message, a heredoc) is blocked too; pass such
# text from a file instead (`git commit -F`).

block() {
    echo "$1" >&2
    exit 2
}

input=$(cat)

# jq when present, otherwise the Node.js this repository already requires
if command -v jq >/dev/null 2>&1; then
    command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty') \
        || block "Could not read the Bash command from the hook input"
elif command -v node >/dev/null 2>&1; then
    command=$(printf '%s' "$input" | node -e '
        let text = "";
        process.stdin.on("data", chunk => { text += chunk; });
        process.stdin.on("end", () => process.stdout.write(JSON.parse(text).tool_input?.command ?? ""));
    ') || block "Could not read the Bash command from the hook input"
else
    block "The destructive-command hook needs jq or node on PATH to read its input"
fi

# True when the current segment matches the extended regex. Matched by bash
# itself: an external matcher that is missing would let every command through.
has() {
    [[ $segment =~ $1 ]]
}

# `git`, any global options (-C <path>, -c <key=value>, --no-pager, ...), then
# the subcommand, so `git -C . push` is read as a push
git_sub() {
    has "(^|[^[:alnum:]_-])git([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|--?[[:alnum:]-]+(=[^[:space:]]*)?))*[[:space:]]+$1([^[:alnum:]_-]|\$)"
}

# A short option cluster holding the letter (-f, -fd, -xfd) or the long option
flag() {
    has "[[:space:]](-[a-zA-Z]*$1[a-zA-Z]*|--$2)([[:space:]]|\$)"
}

# A pathspec naming the whole tree
ALL_FILES='[[:space:]]\./?([[:space:]]|$)'

# Each command of a compound line is judged on its own, so one command's
# arguments (a --force-with-lease, a `.`) cannot excuse or condemn another.
# Substitutions and subshells are split too, so `$(git clean -f)` is seen.
segments=$command
# shellcheck disable=SC2016 # the separators are literal text, not expansions
for separator in '&&' '||' ';' '|' '&' '$(' '`' '(' ')'; do
    segments=${segments//"$separator"/$'\n'}
done

while IFS= read -r segment; do
    # Quoting does not change what runs: git "reset" --hard, git checkout -- "."
    segment=${segment//[\"\']/}

    # rm with recursive and force (-rf, -fr, -r -f, --recursive --force, mixed),
    # read from rm's own arguments so `grep -rf rm` is not taken for one
    if [[ $segment =~ (^|[^[:alnum:]_.-])rm([[:space:]].*)$ ]]; then
        command_line=$segment
        segment=${BASH_REMATCH[2]}
        if flag '[rR]' recursive && flag f force; then
            block "rm -rf permanently deletes files with no recovery — use git clean or be specific"
        fi
        segment=$command_line
    fi

    if git_sub reset && has '[[:space:]]--hard([[:space:]]|$)'; then
        block "git reset --hard discards all uncommitted changes permanently — use git stash to preserve them"
    fi

    if git_sub clean && flag f force; then
        block "git clean -f permanently deletes untracked files — list them with git clean -n first"
    fi

    # --force and -f, and a +refspec, which forces that one ref.
    # --force-with-lease and --force-if-includes are different options and pass.
    if git_sub push && { flag f force || has '[[:space:]]\+[^[:space:]]'; }; then
        block "git push --force overwrites remote history and can destroy others' work — use --force-with-lease"
    fi

    if git_sub checkout && has "$ALL_FILES"; then
        block "git checkout . discards all unstaged changes across every file — be specific about which files to restore"
    fi

    if git_sub restore && has "$ALL_FILES"; then
        block "git restore . discards changes across all files — be specific about which files to restore"
    fi
done <<< "$segments"

exit 0
