"""
BuildSphere CV Service — Configuration & Constants.

Centralizes all tunable parameters for YOLO inference,
file upload validation, and server settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# ─── Resolve project paths ───────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    with sensible defaults for development.
    """

    # ── Server ────────────────────────────────────────────────────────
    APP_NAME: str = "BuildSphere Glass Panel Detector"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── YOLO Model ────────────────────────────────────────────────────
    # Path to the trained YOLO weights file.
    # Updated to use the custom glass panel model.
    MODEL_PATH: str = "models/best.pt"

    # Target class names to filter from COCO detections.
    # When using the pre-trained model, we look for "window" as a proxy
    # for glass panels. After custom training, this becomes ["glass_panel"].
    TARGET_CLASSES: list[str] = ["glass_panel"]

    # Set to False to use our custom trained model (glass_panel class)
    USE_PRETRAINED_COCO: bool = False
    COCO_PROXY_CLASSES: list[str] = ["window", "glass"]

    # ── Inference Thresholds ──────────────────────────────────────────
    # Confidence threshold — lower than typical (0.5) because glass edges
    # are subtle, transparent, and produce softer activations.
    # Set very low (0.05) to catch all thin panels in your specific photos.
    CONFIDENCE_THRESHOLD: float = 0.05

    # Lowered to 0.30 to prevent merging thin panels that are right next to each other.
    NMS_IOU_THRESHOLD: float = 0.30

    # Maximum detections per image.
    # Construction facades can have 100+ panels; 300 gives headroom.
    MAX_DETECTIONS: int = 300

    # Increased to 1024 to see thin glass panels much more clearly.
    INFERENCE_IMAGE_SIZE: int = 1024

    # ── Upload Constraints ────────────────────────────────────────────
    ALLOWED_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    MAX_UPLOAD_SIZE_MB: int = 15
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    # ── Timeout ───────────────────────────────────────────────────────
    INFERENCE_TIMEOUT_SECONDS: int = 60

    # ── AI Integrations ───────────────────────────────────────────────
    GEMINI_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Singleton settings instance
settings = Settings()
