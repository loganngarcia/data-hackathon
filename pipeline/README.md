# Hackathon Pipeline Scaffold

This package is the data-foundation layer for Aggies Data Hackathon 2026.

## Source corpus

The canonical source lives in Google Drive under `Hackathon Student Files`:

- `https://drive.google.com/drive/folders/1_MUTzkNlqps25vj_Yl4uyEjqAcOIXKZq`

Within that folder, the IRS 990 corpus is organized under:

- `IRS990Data`
- `IRS990Data/XML Files`
- year/form partitions such as `2025_990PF` and `2025_990T`

## Local mirror

Mirror the Drive corpus into `data/raw` with the same folder names. The inventory
routine scans `data/raw` recursively, so the important convention is:

- `data/raw/IRS990Data/XML Files/<year>_<form>/*.xml`

Processed artifacts should land under `data/processed`:

- `data/processed/manifests`
- `data/processed/normalized`
- `data/processed/features`
- `data/processed/artifacts`

## Commands

Run the CLI from the repo root with:

```bash
python scripts/hackathon_pipeline.py inventory
python scripts/hackathon_pipeline.py normalize
python scripts/hackathon_pipeline.py build-features
python scripts/mirror_drive_xml.py --file-id FILE_ID --output data/raw/IRS990Data/XML Files/2025_990PF/example.xml
```

`inventory` is implemented now. `normalize` and `build-features` are safe
placeholders until the raw XML ingestion contract is finalized.

## Mirroring helper

The helper script follows the Google Drive confirmation flow that the team
verified in shell:

1. Request `drive.google.com/uc?export=download&id=FILE_ID`.
2. Read the warning page for the hidden `confirm` token and `uuid`.
3. Request `drive.usercontent.google.com/download?...` with those values.

This gives us a repeatable pattern for pulling files into the local raw mirror
before inventory and normalization run.
