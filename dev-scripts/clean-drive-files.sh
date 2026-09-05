#!/bin/bash
# clean-drive-files.sh — remove Google Drive auto-generated desktop.ini files
#
# Google Drive drops a desktop.ini into every directory it syncs, including
# .git/ internals where .gitignore has no effect. Left alone they accumulate:
# 268 had built up by 2026-09-04, three of them inside .git/refs/, which git
# parses as refs. That was enough to break `gh pr merge`'s local steps with
# `fatal: bad object refs/desktop.ini`.
#
# Run before:
#   - git pull (to avoid sync conflicts)
#   - any tool that walks .git/ directly (gitleaks, BFG, git-filter-repo)
#   - any pre-commit hook that scans the repo
#
# Also wired as the first pre-commit hook, and as `git clean-drive`.
#
# Idempotent, and always exits 0. It runs as a pre-commit hook, so trouble
# cleaning stray sync files must never be what blocks a commit.

# No `set -e` here, deliberately. The contract above is "always exits 0", and
# under `set -e` a failing command substitution below would exit non-zero and
# break that promise. Each step is instead written so failure is survivable.

# Resolve the repo root from this script's own location rather than the
# caller's working directory.
#
# The find targets used to be cwd-relative (`find .git`, `find .`), which meant
# the script silently did the wrong thing when invoked from anywhere but the
# repo root: from a subdirectory it found no .git at all and cleaned only that
# subtree, reporting success either way.
#
# `builtin cd` rather than plain cd is not paranoia. An fnm `--use-on-cd` setup
# aliases cd to a wrapper that fails in any shell where fnm's environment was
# never initialised, and returns non-zero for every directory. This script
# should not inherit whatever the caller has done to cd.
script_dir=$(CDPATH= builtin cd -- "$(dirname -- "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)
if [ -z "$script_dir" ]; then
    echo "clean-drive-files: could not resolve script location; nothing cleaned." >&2
    exit 0
fi
root=$(dirname -- "$script_dir")

# Every path below is quoted: this repo lives under "C:\Google Drive\Web
# Projects\Projects - Personal\", so unquoted expansion splits on the spaces.

# .git/ internals first. -print -delete reports what it removed, so the output
# distinguishes "cleaned 268 files" from "cleaned nothing" — the original
# printed the same success line either way, which is how a run that never
# executed at all looked identical to a successful one.
git_removed=$(find "$root/.git" -name 'desktop.ini' -type f -print -delete 2>/dev/null | wc -l)

# Working tree. .gitignore catches these at staging time, but that does not
# remove files already on disk, and tools that walk the tree still trip on them.
# .git is excluded because the pass above already handled it.
tree_removed=$(find "$root" -name 'desktop.ini' -type f \
    -not -path "$root/.git/*" \
    -not -path "$root/node_modules/*" \
    -not -path "$root/dist/*" \
    -not -path "$root/.astro/*" \
    -print -delete 2>/dev/null | wc -l)

# Default to 0 rather than empty if a find failed outright, so the message
# always reads as a number.
printf 'desktop.ini cleaned: %s in .git, %s in working tree.\n' \
    "${git_removed:-0}" "${tree_removed:-0}"

exit 0
