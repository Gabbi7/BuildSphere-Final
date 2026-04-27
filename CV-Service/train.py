from ultralytics import YOLO
import torch
import os

def train_glass_model():
    # 1. Detect device (use GPU if available)
    device = 0 if torch.cuda.is_available() else "cpu"
    print(f"🚀 Training on: {device}")

    # 2. Load model
    model = YOLO("yolov8m.pt")

    # 3. Start Training with optimized params for 152 images
    model.train(
        data="datasets/data.yaml", 
        epochs=100,            # More epochs for small datasets
        patience=30,           # Early stopping if no improvement
        imgsz=640,             # Standard resolution
        batch=16,              # Adjust based on GPU memory
        device=device,
        
        # Augmentations (CRITICAL for small datasets)
        mosaic=1.0,            # Combine 4 images into 1
        mixup=0.1,             # Blend images
        fliplr=0.5,            # Horizontal flip
        
        # Save results
        project="glass_counting",
        name="yolov8m_v2",
        plots=True
    )

    print("\n✅ Training Complete!")
    print(f"Best model saved at: glass_counting/yolov8m_v1/weights/best.pt")

if __name__ == "__main__":
    train_glass_model()
