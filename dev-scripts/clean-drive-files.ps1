# clean-drive-files.ps1 — PowerShell counterpart to clean-drive-files.sh
#
# Run before git pull, gitleaks, git-filter-repo, or any tool that walks .git/
# directly. Idempotent and safe to run repeatedly.

# Clean .git/ internals (gitignore doesn't apply here)
Get-ChildItem -Path .git -Filter desktop.ini -Recurse -Force -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

# Clean working tree (skip vendored / build dirs)
Get-ChildItem -Path . -Filter desktop.ini -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(node_modules|dist|\.astro)\\' } |
    Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "desktop.ini files cleaned."
