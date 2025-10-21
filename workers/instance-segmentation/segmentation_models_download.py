# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import sys
import shutil
import logging
import argparse
import openvino as ov
import subprocess as np
from urllib.parse import urlparse
import urllib.request
import requests

from pathlib import Path
from ultralytics import YOLO

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


# Pre-define the models and their types
SEGMENTATION_MODELS = {
    #Mask RCNN models
    "mask_rcnn_inception_resnet_v2_atrous_coco": "mask_rcnn",
    "mask_rcnn_resnet50_atrous_coco": "mask_rcnn",
   
    # YOLO v11 segmentation models
    "yolo11n-seg": "yolo_v11_seg",
    "yolo11s-seg": "yolo_v11_seg",
    "yolo11m-seg": "yolo_v11_seg",
    "yolo11l-seg": "yolo_v11_seg",
    "yolo11x-seg": "yolo_v11_seg",
    
    # YOLO v8 segmentation models
    "yolov8n-seg": "YOLOv8-SEG",
    "yolov8s-seg": "YOLOv8-SEG",
    "yolov8m-seg": "YOLOv8-SEG",
    "yolov8l-seg": "YOLOv8-SEG",
    "yolov8x-seg": "YOLOv8-SEG",
}


# Define the MODELS_DIR environment variable
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

def ensure_venv_in_path():
    venv_bin = str(Path(sys.executable).parent)
    path_val = os.environ.get("PATH", "")
    if venv_bin not in path_val.split(":"):
        os.environ["PATH"] = f"{venv_bin}:{path_val}"
        logging.info(f"Prepended venv bin to PATH: {venv_bin}")

ensure_venv_in_path()


def is_path_safe(base_dir: Path, path: Path) -> bool:
    """Make sure resolved path is within in the intended base directory."""
    try:
        base_dir = base_dir.resolve(strict=False)
        path = path.resolve(strict=False)
        return str(path).startswith(str(base_dir))
    except Exception:
        return False


def model_files_exist_and_safe(model_path_fp32: Path, model_path_fp16: Path) -> bool:
    if model_path_fp32.exists() and model_path_fp16.exists():
        logging.info(f"Model already exists: {model_path_fp32} and {model_path_fp16}")
        if os.path.realpath(model_path_fp32) != os.path.abspath(model_path_fp32) or os.path.realpath(model_path_fp16) != os.path.abspath(model_path_fp16):
            logging.info(f"Error: Model file is a symlink. Refusing to open for security reasons.")
            return False
        return True
    return False

def export_model(model_name, model_parent_dir=MODELS_DIR):
    if model_name in SEGMENTATION_MODELS and model_name.startswith("yolo"):
        return export_yolo_model(model_name, model_parent_dir)
    else:
        return export_omz_model(model_name, model_parent_dir)

def export_omz_model(model_name, model_parent_dir=MODELS_DIR):
    if model_name not in SEGMENTATION_MODELS:
        logging.error(f"Error: Invalid Open Model Zoo model name '{model_name}'.")    
        return False

    base_dir = Path(model_parent_dir).resolve()
    model_dir = base_dir / model_name
    fp32_dir = model_dir / "FP32"
    fp16_dir = model_dir / "FP16"
    os.makedirs(fp32_dir, exist_ok=True)
    os.makedirs(fp16_dir, exist_ok=True)

    model_path_FP32 = fp32_dir / f"{model_name}.xml"
    model_path_FP16 = fp16_dir / f"{model_name}.xml"
    model_proc_path = list(model_dir.glob("*.json"))
    logging.info (model_path_FP32)

    # Check if the model already exists
    if model_files_exist_and_safe(model_path_FP32, model_path_FP16):
        logging.info(f"Model already exists: {model_path_FP32} and {model_path_FP16}")
        return True

    logging.info(f"Downloading and converting {model_name} from Open Model Zoo")

    try:
        # Download model
        download_model = [
            "omz_downloader", "--name", model_name, "--output_dir", str(model_dir)
        ]
        
        logging.info(download_model)
        result = np.run(download_model, capture_output=True, text=True)
        if result.returncode != 0:
            logging.error(f"Download failed: {result.stderr}")
            return False

        # Convert model
        convert_model = [
            "omz_converter", "--name", model_name,
            "-d", str(model_dir),
            "-o", str(model_dir),
            "--precisions", "FP16,FP32"
        ]
        
        logging.info(convert_model)
        
        result = np.run(convert_model, capture_output=True, text=True)
        if result.returncode != 0:
            logging.error(f"Conversion failed: {result.stderr}")
            return False

        # Move converted files to FP32/FP16 folders if needed
        for precision in ["FP32", "FP16"]:
            converted_path = model_dir / "public" / model_name / precision
            logging.info(converted_path)
            if converted_path.exists():
                for file in converted_path.glob("*"):
                    shutil.move(str(file), str(model_dir / precision / file.name))
        shutil.rmtree(str(model_dir / "public"))
        logging.info(f"Model saved: {model_path_FP32} and {model_path_FP16}")
        
        # Download mask-rcnn proc file if needed
        if not model_proc_path:
            model_proc_path = model_dir / "mask-rcnn.json"
            url = "https://raw.githubusercontent.com/dlstreamer/dlstreamer/master/samples/gstreamer/model_proc/public/mask-rcnn.json"
            parse_url = urlparse(url)
            if parse_url.scheme != "https":
                logging.error(f"Blocked download for non-HTTPS URL: {url}")
                return False
            allowed_domains = ["raw.githubusercontent.com"]
            if parse_url.netloc not in allowed_domains:
                logging.error(f"Blocked download from untrusted domain: {parse_url.netloc}")
                return False
            for attempt in range(3):
                try:
                    res = requests.get(url, timeout=30, stream=True)
                    res.raise_for_status()
                    with open(model_proc_path, "wb") as out_file:
                        for chunk in res.iter_content(chunk_size=8192):
                            out_file.write(chunk)    
                    logging.info(f"Downloaded mask-rcnn model processing file to {model_proc_path}")
                    break
                except Exception as e:
                    logging.warning(f"mask-rcnn model processing file download attempt {attempt+1}: {e}")
            else:
                logging.error("Failed to download mask-rcnn model processing file")
                return False
        else:
            logging.info(f"Model proc file already exists: {model_proc_path[0]}")
            
        return True
    except Exception as e:
        logging.error(f"Error exporting OMZ model {model_name}: {e}")
        return False        


def export_yolo_model(model_name, model_parent_dir=MODELS_DIR):
    """
    Download and convert models to OpenVINO format.
    """

    # Validate the model name
    if model_name not in SEGMENTATION_MODELS:
        logging.error(f"Error: Invalid model name '{model_name}'.")
        logging.info(f"Available models: {', '.join(SEGMENTATION_MODELS.keys())}")
        return False

    # Retrieve the model type
    model_type = SEGMENTATION_MODELS[model_name]

    # Define paths for FP32 and FP16 models
    base_dir = Path(model_parent_dir).resolve()
    model_dir = base_dir / model_name 
    
    #create directories
    os.makedirs(model_dir, exist_ok=True)
    os.makedirs(model_dir / "FP32", exist_ok=True)
    os.makedirs(model_dir / "FP16", exist_ok=True)

    model_path_FP32 = model_dir / "FP32" / f"{model_name}.xml"
    model_path_FP16 = model_dir / "FP16" / f"{model_name}.xml"

    # Validate all paths are within the base directory
    for p in [model_dir, model_dir / "FP32", model_dir / "FP16", model_path_FP32, model_path_FP16]:
        if not is_path_safe(base_dir, p):
            logging.error(f"Unsafe model path detected: {p}")
            sys.exit(1)

    # Check if the model already exists
    is_model_exist = model_files_exist_and_safe(model_path_FP32, model_path_FP16)
    if is_model_exist:
        logging.info(f"Model already exists: {model_path_FP32} and {model_path_FP16}")
        return True

    logging.info(f"Downloading and converting: {model_name}")
    
    try:
        #download and convert the model
        current_dir = os.getcwd()
        
        os.chdir(model_dir)
        
        #download model
        logging.info(f"Downloading {model_name}.pt using ultralytics...")
        model = YOLO(f"{model_name}.pt")
        model.info()
        
        #export to openvino format
        logging.info(f"Exporting {model_name} to OpenVINO format...")
        converted_path = Path(model.export(format="openvino")).resolve()
        
        #validate converted part is safe
        if not is_path_safe(Path.cwd(), converted_path):
            logging.error(f"Unsafe converted path detected: {converted_path}")
            os.chdir(current_dir)
            return False 
        
        #load coverted model
        core = ov.Core()
        ov_model_path = os.path.join(converted_path, f"{model_name}.xml")
        ov_model = core.read_model(model=ov_model_path)
        
        #set model metadata
        ov_model.set_rt_info(model_type, ["model_info", "model_type"])
        
        #set output names for segmentation models
        if model_type in ["YOLOv8-SEG", "yolo_v11_seg"]:
            if len(ov_model.outputs) >= 2:
                ov_model.output(0).set_names({"boxes"})
                ov_model.output(1).set_names({"masks"})
        
        #save fp32 model
        logging.info(f"Saving FP32 model to {model_path_FP32}")
        ov.save_model(ov_model, str(model_path_FP32), compress_to_fp16=False)
        
        #save FP16 model
        logging.info(f"Savig FP16 model to {model_path_FP16}")
        ov.save_model(ov_model, str(model_path_FP16), compress_to_fp16=True)
        
        #clean up temp files
        shutil.rmtree(str(converted_path))
        pt_file = Path(f"{model_name}.pt").resolve()
        if pt_file.exists():
            os.remove(pt_file)
            logging.info(f"Removed {pt_file}")
        
        #return to originas director
        os.chdir(current_dir)
        logging.info(f"Model saved: {model_path_FP32} and {model_path_FP16}")
        return True
    
    except Exception as e:
        logging.error(f"Error exporting YOLO model {model_name}: {e}")
        if "current_dir" in locals():
            os.chdir(current_dir)
        return False        
        

def parse_arguments():
    """
    Parse command-line arguments.
    """
    parser = argparse.ArgumentParser(
        description="Download and convert segmentation models.."
    )
    parser.add_argument(
        "model_name",
        type=str,
        help="The name of the model to download and convert.",
    )
    args = parser.parse_args()
    # Validate model_name
    if args.model_name not in SEGMENTATION_MODELS:
        logging.info(f"Error: Invalid model name '{args.model_name}'.")
        logging.info("Available models:", ", ".join(SEGMENTATION_MODELS.keys()))
        sys.exit(1)
    return args


if __name__ == "__main__":
    # Parse command-line arguments
    args = parse_arguments()
    
    # Create models directory if it doesn't exist
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Export the specified model
    export_model(args.model_name, SEGMENTATION_MODELS[args.model_name])
