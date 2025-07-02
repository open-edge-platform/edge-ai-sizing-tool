# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import sys
import shutil
import openvino as ov
import argparse
import logging

from ultralytics import YOLO
from pathlib import Path

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


# Define the models and their types
YOLO_MODELS = {
    "yolov8n": "YOLOv8",
    "yolov8s": "YOLOv8",
    "yolov8m": "YOLOv8",
    "yolov8l": "YOLOv8",
    "yolov8x": "YOLOv8",
    "yolov8n-obb": "YOLOv8-OBB",
    "yolov8s-obb": "YOLOv8-OBB",
    "yolov8m-obb": "YOLOv8-OBB",
    "yolov8l-obb": "YOLOv8-OBB",
    "yolov8x-obb": "YOLOv8-OBB",
    "yolov9t": "YOLOv8",
    "yolov9s": "YOLOv8",
    "yolov9m": "YOLOv8",
    "yolov9c": "YOLOv8",
    "yolov9e": "YOLOv8",
    "yolov10n": "yolo_v10",
    "yolov10s": "yolo_v10",
    "yolov10m": "yolo_v10",
    "yolov10b": "yolo_v10",
    "yolov10l": "yolo_v10",
    "yolov10x": "yolo_v10",
    "yolo11n": "yolo_v11",
    "yolo11s": "yolo_v11",
    "yolo11m": "yolo_v11",
    "yolo11l": "yolo_v11",
    "yolo11x": "yolo_v11",
    "yolo11n-obb": "yolo_v11_obb",
    "yolo11s-obb": "yolo_v11_obb",
    "yolo11ms-obb": "yolo_v11_obb",
    "yolo11l-obb": "yolo_v11_obb",
    "yolo11x-obb": "yolo_v11_obb",
    "yolo11n-pose": "yolo_v11_pose",
    "yolo11s-pose": "yolo_v11_pose",
    "yolo11m-pose": "yolo_v11_pose",
    "yolo11l-pose": "yolo_v11_pose",
    "yolo11x-pose": "yolo_v11_pose",
}

# Define the MODELS_DIR environment variable
MODELS_DIR = os.getenv("MODELS_DIR", "./models")


def is_path_safe(base_dir: Path, path: Path) -> bool:
    """Make sure resolved path is within in the intended base directory."""
    try:
        base_dir = base_dir.resolve(strict=False)
        path = path.resolve(strict=False)
        return str(path).startswith(str(base_dir))
    except Exception:
        return False


def model_files_exist_and_safe(model_path_fp32: Path, model_path_fp16: Path) -> bool:
    """
    Returns True if both model files exist and are not symlinks or do not contain symlinks in their paths.
    """
    if model_path_fp32.exists() and model_path_fp16.exists():
        logging.info(f"Model already exists: {model_path_fp32} and {model_path_fp16}")
        if os.path.realpath(model_path_fp32) != os.path.abspath(
            model_path_fp32
        ) or os.path.realpath(model_path_fp16) != os.path.abspath(
            model_path_fp16
        ):  # Check if the model path is a symlink
            logging.info(
                f"Error: Model file {model_path_fp32} or {model_path_fp16} is a symlink or contains a symlink in its path. Refusing to open for security reasons."
            )
            return False
        return True


def export_yolo_model(model_name, model_parent_dir=MODELS_DIR):
    """
    Download and convert YOLO models to OpenVINO format.
    """
    
    # Validate the model name
    if model_name not in YOLO_MODELS:
        logging.error(f"Error: Invalid model name '{model_name}'.")
        logging.info(f"Available models: {', '.join(YOLO_MODELS.keys())}")
        return False

    # Retrieve the model type
    model_type = YOLO_MODELS[model_name]
    
    # Define paths for FP32 and FP16 models
    base_dir = Path(model_parent_dir).resolve()
    model_dir_fp32 = base_dir / f"{model_name}-FP32"
    model_dir_fp16 = base_dir / f"{model_name}-FP16"
    model_path_fp32 = model_dir_fp32 / f"{model_name}.xml"
    model_path_fp16 = model_dir_fp16 / f"{model_name}.xml"

    # Validate all paths are within the base directory
    for p in [model_dir_fp32, model_dir_fp16, model_path_fp32, model_path_fp16]:
        if not is_path_safe(base_dir, p):
            logging.error(f"Unsafe model path detected: {p}")
            sys.exit(1)

    # Check if the model already exists
    is_model_exist = model_files_exist_and_safe(model_path_fp32, model_path_fp16)
    if is_model_exist:
        logging.info(f"Model already exists: {model_path_fp32} and {model_path_fp16}")
        return True

    logging.info(f"Downloading and converting: {model_name}")

    # Create directories for the model
    model_dir_fp32.mkdir(parents=True, exist_ok=True)
    model_dir_fp16.mkdir(parents=True, exist_ok=True)

    # Download and convert the model
    model = YOLO(f"{model_name}.pt")
    model.info()
    converted_path = Path(model.export(format="openvino")).resolve()

    # Validate converted_path is within cwd
    if not is_path_safe(Path.cwd(), converted_path):
        logging.error(f"Unsafe converted path detected: {converted_path}")
        sys.exit(1)

    # Load the converted model
    core = ov.Core()
    ov_model = core.read_model(model=os.path.join(converted_path, f"{model_name}.xml"))
    ov_model.set_rt_info(model_type, ["model_info", "model_type"])

    # Save FP32 model
    ov.save_model(ov_model, str(model_path_fp32), compress_to_fp16=False)

    # Save FP16 model
    ov.save_model(ov_model, str(model_path_fp16), compress_to_fp16=True)

    # Check that the converted model successfully saved
    model_files_exist_and_safe(model_path_fp32, model_path_fp16)

    # Clean up temporary files
    shutil.rmtree(str(converted_path))
    pt_file = Path(f"{model_name}.pt").resolve()
    if model_name in YOLO_MODELS and pt_file.is_file():
        pt_file.unlink()
        logging.info(f"Removed {pt_file}")

    logging.info(f"Model saved: {model_path_fp32} and {model_path_fp16}")

    return True


def parse_arguments():
    """
    Parse command-line arguments.
    """
    parser = argparse.ArgumentParser(
        description="Download and convert YOLO models to OpenVINO format."
    )
    parser.add_argument(
        "model_name",
        type=str,
        help="The name of the YOLO model to download and convert.",
    )
    args = parser.parse_args()
    # Validate model_name
    if args.model_name not in YOLO_MODELS:
        logging.info(f"Error: Invalid model name '{args.model_name}'.")
        logging.info("Available models:", ", ".join(YOLO_MODELS.keys()))
        sys.exit(1)
    return args


if __name__ == "__main__":
    # Parse command-line arguments
    args = parse_arguments()

    # Export the specified model
    export_yolo_model(args.model_name, YOLO_MODELS[args.model_name])
