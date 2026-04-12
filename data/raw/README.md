# Raw Data Mirror

Mirror the Google Drive corpus here before running normalization.

Expected structure:

- `data/raw/IRS990Data/XML Files/<year>_<form>/*.xml`

The inventory command scans this directory recursively and writes a manifest to
`data/processed/manifests/raw_inventory.json`.
