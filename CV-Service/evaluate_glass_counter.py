"""
Manual glass counter evaluation helper.

Use this with 20-30 real capstone images to compare the model's suggested
count against your manually verified count. It uses the same YOLOv8 box
detector and Python post-processing pipeline as the FastAPI service.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
REPORT_COLUMNS = [
    "image_name",
    "actual_count",
    "ai_detected_count",
    "verified_panel_count",
    "absolute_error",
    "result_type",
    "accuracy",
    "notes",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate BuildSphere glass counter accuracy on manually counted images."
    )
    parser.add_argument(
        "--images-dir",
        required=True,
        help="Directory containing the real test images.",
    )
    parser.add_argument(
        "--manifest",
        required=True,
        help=(
            "CSV with image_name, actual_count, optional verified_panel_count, optional notes. "
            "verified_panel_count defaults to actual_count when blank."
        ),
    )
    parser.add_argument(
        "--output-csv",
        default="glass_counter_accuracy_report.csv",
        help="Detailed CSV report output path.",
    )
    parser.add_argument(
        "--output-json",
        default="glass_counter_accuracy_report.json",
        help="Detailed JSON report output path.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Console log level.",
    )
    return parser.parse_args()


def safe_int(value: object, default: int = 0) -> int:
    try:
        if value is None or str(value).strip() == "":
            return default
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def counting_accuracy(actual_count: int, absolute_error: int) -> float:
    if actual_count <= 0:
        return 1.0 if absolute_error == 0 else 0.0
    return max(0.0, 1.0 - (absolute_error / actual_count))


def result_type(actual_count: int, ai_detected_count: int) -> str:
    if ai_detected_count == actual_count:
        return "exact"
    if ai_detected_count > actual_count:
        return "overcount"
    return "undercount"


def load_manifest(manifest_path: Path) -> list[dict]:
    with manifest_path.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {"image_name", "actual_count"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Manifest missing required columns: {', '.join(sorted(missing))}")
        return list(reader)


def evaluate_image(image_path: Path, detector) -> int:
    from PIL import Image

    with Image.open(image_path) as image:
        response = detector.detect(image.convert("RGB"), file_size_bytes=image_path.stat().st_size)
    return response.total_valid_panels


def summarize(rows: list[dict], settings) -> dict:
    total_images = len(rows)
    total_actual = sum(row["actual_count"] for row in rows)
    total_ai = sum(row["ai_detected_count"] for row in rows)
    total_abs_error = sum(row["absolute_error"] for row in rows)
    avg_accuracy = (
        sum(row["accuracy"] for row in rows) / total_images
        if total_images
        else 0.0
    )
    return {
        "total_images": total_images,
        "total_actual_count": total_actual,
        "total_ai_detected_count": total_ai,
        "total_absolute_error": total_abs_error,
        "mean_absolute_error": round(total_abs_error / total_images, 4) if total_images else 0.0,
        "average_accuracy": round(avg_accuracy, 4),
        "exact": sum(1 for row in rows if row["result_type"] == "exact"),
        "overcount": sum(1 for row in rows if row["result_type"] == "overcount"),
        "undercount": sum(1 for row in rows if row["result_type"] == "undercount"),
        "thresholds": {
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "min_box_area_ratio": settings.MIN_BOX_AREA_RATIO,
            "edge_margin": settings.EDGE_MARGIN,
            "duplicate_iou_threshold": settings.DUPLICATE_IOU_THRESHOLD,
        },
        "debug_mode": settings.GLASS_COUNTER_DEBUG,
        "debug_output_dir": settings.GLASS_COUNTER_DEBUG_DIR,
    }


def write_csv(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=REPORT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def write_json(rows: list[dict], summary: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump({"summary": summary, "results": rows}, file, indent=2)


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level), format="%(levelname)s:%(name)s:%(message)s")

    images_dir = Path(args.images_dir)
    manifest_path = Path(args.manifest)
    output_csv = Path(args.output_csv)
    output_json = Path(args.output_json)

    if not images_dir.exists():
        raise FileNotFoundError(f"Images directory not found: {images_dir}")
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    from app.config import settings
    from app.detection import detector

    if not detector.is_loaded:
        detector.load_model()

    report_rows: list[dict] = []
    manifest_rows = load_manifest(manifest_path)

    for row in manifest_rows:
        image_name = str(row.get("image_name", "")).strip()
        if not image_name:
            continue

        image_path = images_dir / image_name
        if image_path.suffix.lower() not in IMAGE_EXTENSIONS or not image_path.exists():
            raise FileNotFoundError(f"Image listed in manifest was not found: {image_path}")

        actual_count = safe_int(row.get("actual_count"))
        verified_panel_count = safe_int(row.get("verified_panel_count"), actual_count)
        notes = str(row.get("notes") or "").strip()
        ai_detected_count = evaluate_image(image_path, detector)
        absolute_error = abs(actual_count - ai_detected_count)
        accuracy = counting_accuracy(actual_count, absolute_error)

        report_rows.append(
            {
                "image_name": image_name,
                "actual_count": actual_count,
                "ai_detected_count": ai_detected_count,
                "verified_panel_count": verified_panel_count,
                "absolute_error": absolute_error,
                "result_type": result_type(actual_count, ai_detected_count),
                "accuracy": round(accuracy, 4),
                "notes": notes,
            }
        )

    summary = summarize(report_rows, settings)
    write_csv(report_rows, output_csv)
    write_json(report_rows, summary, output_json)

    print(f"Evaluated {summary['total_images']} images")
    print(f"Mean absolute error: {summary['mean_absolute_error']}")
    print(f"Average accuracy: {summary['average_accuracy']}")
    print(f"Exact / overcount / undercount: {summary['exact']} / {summary['overcount']} / {summary['undercount']}")
    print(f"CSV report: {output_csv}")
    print(f"JSON report: {output_json}")
    if settings.GLASS_COUNTER_DEBUG:
        print(f"Debug images: {settings.GLASS_COUNTER_DEBUG_DIR}")


if __name__ == "__main__":
    main()
