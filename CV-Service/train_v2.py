import argparse
import os
import shutil

import numpy as np
import torch
from ultralytics import YOLO

if not hasattr(np, "trapz"):
    np.trapz = np.trapezoid


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune BuildSphere glass counting model on v2 data.")
    parser.add_argument("--data", default="glass_counting_v2_split/data.yaml")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default="")
    parser.add_argument("--name", default="v2_run3")
    parser.add_argument("--model", default="")
    parser.add_argument("--workers", type=int, default=0)
    return parser.parse_args()


def train_v2():
    args = parse_args()

    device = args.device or (0 if torch.cuda.is_available() else "cpu")
    print(f"Training v2 on: {device}")

    current_best = args.model or "models/best_v2.pt"
    if os.path.exists(current_best):
        print(f"Fine-tuning from existing model: {current_best}")
        model = YOLO(current_best)
    else:
        print("Starting from base YOLOv8m weights")
        model = YOLO("yolov8m.pt")

    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        workers=args.workers,
        project="glass_counting_v2",
        name=args.name,
        plots=True,
    )

    best_path = f"glass_counting_v2/{args.name}/weights/best.pt"
    if os.path.exists(best_path):
        target_path = "models/best_v2.pt"
        shutil.copy(best_path, target_path)
        print(f"\nTraining complete. New model saved at: {target_path}")
    else:
        print("\nTraining failed or best.pt not found.")


if __name__ == "__main__":
    train_v2()
