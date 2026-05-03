# dev-scripts/

Local-only helper scripts. Not part of the build, not deployed.

## Files

- `clean-drive-files.sh` (bash) / `clean-drive-files.ps1` (PowerShell) — recursively delete `desktop.ini` files from `.git/` and the working tree.

## Why these exist

This repo lives under `C:\Google Drive\Web Projects\Projects - Personal\` for backup redundancy. Google Drive auto-creates `desktop.ini` files in every directory it indexes — including inside `.git/`. These break tools that walk git internals (gitleaks fails with `fatal: bad object refs/desktop.ini`; some operations log warnings).

`.gitignore` excludes `desktop.ini` from being staged, but `.gitignore` doesn't apply inside `.git/` itself. So the cleanup script handles both: working-tree pruning AND `.git/` internals.

## When to run

The cleanup runs **automatically** as the first step of the pre-commit hook (configured in `.pre-commit-config.yaml`). You don't need to invoke it manually before commits.

Run **manually** before:
- `git pull` (use `git pull-safe` alias which runs cleanup + pull)
- Tools that walk `.git/` directly: `gitleaks`, `git-filter-repo`, BFG Repo-Cleaner

## Aliases

After cloning, run once:

```bash
git config --local alias.clean-drive '!bash dev-scripts/clean-drive-files.sh'
git config --local alias.pull-safe '!bash dev-scripts/clean-drive-files.sh && git pull'
```

Then `git clean-drive` and `git pull-safe` work as repo-local commands.
