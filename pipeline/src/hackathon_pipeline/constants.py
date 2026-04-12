"""Shared paths and source-of-truth locations for the pipeline."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_ROOT = PROJECT_ROOT / "pipeline"
DATA_ROOT = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_ROOT / "raw"
PROCESSED_DATA_DIR = DATA_ROOT / "processed"
ARTIFACTS_DIR = PROCESSED_DATA_DIR / "artifacts"
MANIFESTS_DIR = PROCESSED_DATA_DIR / "manifests"
NORMALIZED_DIR = PROCESSED_DATA_DIR / "normalized"
FEATURES_DIR = PROCESSED_DATA_DIR / "features"

INVENTORY_MANIFEST_PATH = MANIFESTS_DIR / "raw_inventory.json"

DRIVE_HACKATHON_STUDENT_FILES_URL = (
    "https://drive.google.com/drive/folders/1_MUTzkNlqps25vj_Yl4uyEjqAcOIXKZq"
)
DRIVE_IRS990DATA_URL = "https://drive.google.com/drive/folders/1eQY_3dgnLZBGmh9agynXfButU8dl0Uvm"
DRIVE_XML_FILES_URL = "https://drive.google.com/drive/folders/17tcyhnfVSeWfrccb88F6DGnkxvthu2FF"

DRIVE_MIRROR_NOTE = (
    "Mirror the Google Drive corpus into data/raw using the same folder names, "
    "especially data/raw/IRS990Data/XML Files/<year>_<form>/..."
)

DEFAULT_XML_SUFFIX = ".xml"
