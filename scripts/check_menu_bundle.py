"""Check which sidebar menu variant is in a production bundle."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
dist = ROOT / "dist" / "assets"
index_files = sorted(dist.glob("index-*.js"))
if not index_files:
    print("No index-*.js in dist/assets")
    sys.exit(1)

path = index_files[0]
text = path.read_text(encoding="utf-8", errors="ignore")
print(f"bundle: {path.name}")

checks = {
    "menu_raw_material_qc_id": "id:`raw-material-qc`",
    "menu_kiln_feed_id": "id:`kiln-feed`",
    "menu_routing_id": "id:`routing`",
    "menu_screening_id": "id:`screening`",
    "menu_quality_testing_id": "id:`quality-testing`",
    "menu_raw_material_label": "label:`Raw Material`",
    "menu_raw_material_inward_label": "label:`Raw Material Inward`",
}
for name, needle in checks.items():
    print(f"{name}: {needle in text}")
