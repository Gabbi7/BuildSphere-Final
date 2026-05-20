from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a train/valid/test YOLO split from glass_counting_v2/train."
    )
    parser.add_argument("--source", default="glass_counting_v2")
    parser.add_argument("--output", default="glass_counting_v2_split")
    parser.add_argument("--valid-ratio", type=float, default=0.1)
    parser.add_argument("--test-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = Path(__file__).resolve().parents[1]
    source = root / args.source
    output = root / args.output
    image_dir = source / "train" / "images"
    label_dir = source / "train" / "labels"

    if not image_dir.exists() or not label_dir.exists():
        raise SystemExit(f"Missing source folders under {source}")

    pairs = []
    for image_path in image_dir.iterdir():
        if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        label_path = label_dir / f"{image_path.stem}.txt"
        if label_path.exists():
            pairs.append((image_path, label_path))

    if not pairs:
        raise SystemExit("No image/label pairs found.")

    random.seed(args.seed)
    random.shuffle(pairs)

    test_count = round(len(pairs) * args.test_ratio)
    valid_count = round(len(pairs) * args.valid_ratio)

    splits = {
        "test": pairs[:test_count],
        "valid": pairs[test_count : test_count + valid_count],
        "train": pairs[test_count + valid_count :],
    }

    if output.exists():
        shutil.rmtree(output)

    for split_name, split_pairs in splits.items():
        (output / split_name / "images").mkdir(parents=True, exist_ok=True)
        (output / split_name / "labels").mkdir(parents=True, exist_ok=True)

        for image_path, label_path in split_pairs:
            shutil.copy2(image_path, output / split_name / "images" / image_path.name)
            shutil.copy2(label_path, output / split_name / "labels" / label_path.name)

    normalized_output = output.as_posix()
    (output / "data.yaml").write_text(
        f"path: {normalized_output}\n"
        "train: train/images\n"
        "val: valid/images\n"
        "test: test/images\n\n"
        "nc: 1\n"
        "names: ['glass_panel']\n",
        encoding="utf-8",
    )

    print(f"Created split dataset at: {output}")
    for split_name, split_pairs in splits.items():
        print(f"{split_name}: {len(split_pairs)} images")


if __name__ == "__main__":
    main()
