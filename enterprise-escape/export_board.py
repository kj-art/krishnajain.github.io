"""
Re-runnable export: reads the map editor's canonical station/connection data
(stations_trimmed.py) and the current hand-edited layout
(layouts/layout_trimmed.json) from ../ScotlandYardEnterprise, and writes a
single board.json + a web-sized background image into this project.

Does not modify anything under ScotlandYardEnterprise. Re-run this whenever
the layout is updated in the map editor (positions are still being fitted
into the ship silhouette by hand as of this writing).

Usage:
    python export_board.py
"""

import json
import sys
from pathlib import Path

from PIL import Image

EDITOR_DIR = Path(r"C:\Users\krjar\Downloads\ScotlandYardEnterprise")
LAYOUT_PATH = EDITOR_DIR / "layouts" / "layout_trimmed.json"
OUT_DIR = Path(__file__).resolve().parent
OUT_BOARD_JSON = OUT_DIR / "board.json"
OUT_BG_IMAGE = OUT_DIR / "assets" / "board-bg.jpg"

MAX_BG_DIMENSION = 2500  # long-side pixels for the web-sized background
JPEG_QUALITY = 85

sys.path.insert(0, str(EDITOR_DIR))
import stations_trimmed as station_module  # noqa: E402


def load_layout():
    with open(LAYOUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def build_stations(stations, layout):
    positions = layout.get("positions", {})
    out = {}
    for number, station in stations.items():
        key = str(number)
        if key in positions:
            x, y = positions[key]
        else:
            x, y = station["gui"]
        out[key] = {
            "taxi": sorted(station["taxi"]),
            "bus": sorted(station["bus"]),
            "underground": sorted(station["underground"]),
            "x": x,
            "y": y,
        }
    return out


def build_edges(edges_by_kind):
    out = {}
    for kind, edge_set in edges_by_kind.items():
        out[kind] = sorted(sorted(pair) for pair in (tuple(e) for e in edge_set))
    return out


def export_background(layout):
    src_path = Path(layout["background_image"])
    if not src_path.is_file():
        print(f"WARNING: background image not found at {src_path}, skipping export")
        return None

    im = Image.open(src_path).convert("RGB")
    native_w, native_h = im.size
    long_side = max(native_w, native_h)
    resize_ratio = min(1.0, MAX_BG_DIMENSION / long_side)

    if resize_ratio < 1.0:
        new_size = (round(native_w * resize_ratio), round(native_h * resize_ratio))
        im = im.resize(new_size, Image.LANCZOS)

    OUT_BG_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_BG_IMAGE, "JPEG", quality=JPEG_QUALITY)

    original_scale = layout.get("background_scale", 1.0)
    adjusted_scale = original_scale / resize_ratio

    return {
        "image": "assets/board-bg.jpg",
        "offset": layout.get("background_offset", [0, 0]),
        "scale": adjusted_scale,
        "alpha": layout.get("background_alpha", 255),
        "nativeSize": list(im.size),
    }


def main():
    stations = station_module.load_stations()
    edges_by_kind = station_module.build_edges(stations)
    layout = load_layout()

    board = {
        "dataset": layout.get("dataset", "trimmed"),
        "stations": build_stations(stations, layout),
        "edges": build_edges(edges_by_kind),
        "colors": layout.get("colors", station_module.DEFAULT_COLORS),
        "roles": layout.get("roles", station_module.DEFAULT_ROLES),
    }

    background = export_background(layout)
    if background:
        board["background"] = background

    with open(OUT_BOARD_JSON, "w", encoding="utf-8") as f:
        json.dump(board, f, indent=2)

    edge_counts = {kind: len(pairs) for kind, pairs in board["edges"].items()}
    print(f"Wrote {OUT_BOARD_JSON}")
    print(f"  stations: {len(board['stations'])}")
    print(f"  edges: {edge_counts}")
    if background:
        print(f"  background: {OUT_BG_IMAGE} ({background['nativeSize'][0]}x{background['nativeSize'][1]})")


if __name__ == "__main__":
    main()
