#!/usr/bin/env python3
"""Mirror a single Google Drive-hosted XML file into data/raw.

This follows the confirmation flow that the team verified in shell:

1. Request ``https://drive.google.com/uc?export=download&id=FILE_ID``.
2. If Google returns the warning page, extract the hidden ``confirm`` token
   and ``uuid``.
3. Request ``https://drive.usercontent.google.com/download?...`` with those
   values to receive the XML bytes.

The helper is intentionally simple so it can be used in a shell loop to mirror
the raw corpus into ``data/raw/IRS990Data/XML Files/<year>_<form>/``.
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

WARNING_CONFIRM_RE = re.compile(r'name="confirm"\s+value="([^"]+)"', re.IGNORECASE)
WARNING_UUID_RE = re.compile(r'name="uuid"\s+value="([^"]+)"', re.IGNORECASE)


def _download_url(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request) as response:
        return response.read(), response.headers.get_content_type()


def _extract_confirmation_tokens(html: bytes) -> tuple[str, str] | None:
    text = html.decode("utf-8", errors="ignore")
    confirm_match = WARNING_CONFIRM_RE.search(text)
    uuid_match = WARNING_UUID_RE.search(text)
    if not confirm_match or not uuid_match:
        return None
    return confirm_match.group(1), uuid_match.group(1)


def download_drive_xml(file_id: str) -> bytes:
    initial_url = f"https://drive.google.com/uc?export=download&id={urllib.parse.quote(file_id)}"
    payload, content_type = _download_url(initial_url)

    if content_type == "text/html":
        tokens = _extract_confirmation_tokens(payload)
        if tokens is not None:
            confirm, uuid = tokens
            confirmation_url = (
                "https://drive.usercontent.google.com/download"
                f"?id={urllib.parse.quote(file_id)}&export=download"
                f"&confirm={urllib.parse.quote(confirm)}&uuid={urllib.parse.quote(uuid)}"
            )
            payload, _ = _download_url(confirmation_url)

    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mirror one Drive XML file into data/raw.")
    parser.add_argument("--file-id", required=True, help="Google Drive file ID for the XML blob.")
    parser.add_argument("--output", required=True, type=Path, help="Local path to write the XML file.")
    args = parser.parse_args(argv)

    xml_bytes = download_drive_xml(args.file_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(xml_bytes)
    print(f"Wrote {args.output} ({len(xml_bytes)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
