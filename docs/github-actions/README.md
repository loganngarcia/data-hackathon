# GitHub Actions templates

Workflow YAML lives here so normal `git push` works without the GitHub OAuth **`workflow`** scope (required only for files under `.github/workflows/`).

**To enable CI on GitHub:** copy the `.yml` files into `.github/workflows/` in this repo and push using a credential that can update workflows (e.g. `gh auth refresh -s workflow`, SSH deploy key with appropriate access, or a PAT with the `workflow` scope).

See comments inside each file for required secrets.
