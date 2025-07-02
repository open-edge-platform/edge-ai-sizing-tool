# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import sys
import subprocess
import platform
from typing import Dict
import logging
import openvino_genai
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import argparse
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import requests
import huggingface_hub as hf_hub
import urllib.parse
import zipfile
from huggingface_hub import whoami

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

env = os.environ.copy()
venv_path = os.path.dirname(sys.executable)
env["PATH"] = f"{venv_path}:{env['PATH']}"

hf_token = os.getenv("HF_TOKEN")
if hf_token:
    user = whoami(token=hf_token)

def optimum_cli(model_id, output_dir, additional_args: Dict[str, str] = None):
    export_command = f"optimum-cli export openvino --model {model_id} {output_dir}"
    if additional_args is not None:
        for arg, value in additional_args.items():
            export_command += f" --{arg}"
            if value:
                export_command += f" {value}"
    try:
        subprocess.run(
            export_command.split(" "),
            shell=(platform.system() == "Windows"),
            check=True,
            capture_output=True,
            env=env,
        )
    except Exception as e:
        logging.error(f"optimum-cli failed: {e}")
        update_payload_status(args.id, status="failed")
        sys.exit(1)


def update_payload_status(workload_id: int, status):
    """
    Update the workload status in a safe way, allow-listing scheme, authority,
    and preventing unsafe path traversal.
    """
    if not isinstance(workload_id, int) and workload_id >= 0:
        logging.error(f"Invalid workload ID: {workload_id}. Refusing to update status.")
        return

    # Hardcode scheme & authority (safe allow-list)
    allowed_scheme = "http"
    allowed_netloc = "127.0.0.1:8080"

    # Build the path carefully. Reject characters such as '../'
    # in a real system, you might strictly allow digits only
    path = f"/api/workloads/{workload_id}"

    # Use urllib.parse to verify
    composed_url = f"{allowed_scheme}://{allowed_netloc}{path}"
    parsed_url = urllib.parse.urlparse(composed_url)

    # Enforce scheme & authority are what we expect
    if parsed_url.scheme != allowed_scheme or parsed_url.netloc != allowed_netloc:
        logging.error(f"URL scheme or authority not allowed: {parsed_url.geturl()}")
        return

    # Basic check for path traversal attempts (../, //, whitespace, etc.)
    if ".." in path or "//" in path or " " in path:
        logging.error(f"Invalid characters in URL path: {path}")
        return

    # Now safe to use
    url = parsed_url.geturl()

    data = {"status": status, "port": args.port}
    try:
        response = requests.patch(url, json=data)
        response.raise_for_status()
        logging.info(f"Successfully updated status to {status} for {workload_id}.")
    except requests.exceptions.RequestException as e:
        logging.info(f"Failed to update status: {e}")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = argparse.ArgumentParser(
    description="FastAPI server for OpenVINO text generation model"
)
parser.add_argument(
    "--model-name",
    type=str,
    required=True,
    help="Name of the OpenVINO model (.xml file) or hugging face ID",
)
parser.add_argument(
    "--device",
    type=str,
    default="CPU",
    help="Device to run the model on (e.g., CPU, GPU, MYRIAD)",
)
parser.add_argument(
    "--port", type=int, default=5997, help="Port to run the FastAPI server on"
)
parser.add_argument(
    "--id", type=int, default=1, help="Workload ID to update the workload status"
)

args = parser.parse_args()

# Prepare model path and extraction if needed
models_dir = "models"
custom_models_dir = "../custom_models/text-generation"
os.makedirs(models_dir, exist_ok=True)

# handle custom model in zip format
if args.model_name.endswith(".zip"):
    model_zipfile_name = os.path.splitext(os.path.basename(args.model_name))[0]
    model = os.path.join(models_dir, model_zipfile_name)
    if not os.path.exists(model):
        logging.info(f"Extracting {args.model_name} to {model}")
        try:
            with zipfile.ZipFile(os.path.abspath(args.model_name), 'r') as zip_ref:
                zip_ref.extractall(model)
        except Exception as e:
            logging.error(f"Failed to extract zip file {args.model_name}: {e}")
            update_payload_status(args.id, status="failed")
            sys.exit(1)
    else:
        logging.info(f"Model directory {model} already exists and is not empty, skipping extraction.")
else:
    # handle custom model uploaded to directory
    model = os.path.join(custom_models_dir, args.model_name)
    if not os.path.exists(model):
        # predefined model or hugging face model id
        model = os.path.join(models_dir, args.model_name)
        logging.info(f"Model: {model}")
    else:
        logging.info(f"Custom Model: {model} exists.")

# download model if it doesn't exist
if not os.path.exists(model):
    logging.info(f"Model {model} not found. Downloading...")
    if args.model_name.startswith("OpenVINO/"):
        hf_hub.snapshot_download(args.model_name, local_dir=model)
    else:
        additional_args = {
            "weight-format": "int4",
            "sym": None,
            "ratio": 1.0,
            "group-size": -1,
        }
        optimum_cli(args.model_name, model, additional_args)

if os.path.realpath(model) != os.path.abspath(
    model
):  # Check if the model path is a symlink
    logging.error(
        f"Model file {model} is a symlink or contains a symlink in its path. Refusing to open for security reasons."
    )
    update_payload_status(args.id, status="failed")
    sys.exit(1)

try:
    pipe = openvino_genai.LLMPipeline(model, args.device)
    update_payload_status(args.id, status="active")
except Exception as e:
    logging.error(f"Failed to load model: {e}")
    update_payload_status(args.id, status="failed")
    sys.exit(1)


class Request(BaseModel):
    prompt: str
    max_tokens: int = 100


@app.post("/infer")
async def start_chatting(request: Request):
    try:
        res = pipe.generate([request.prompt], max_new_tokens=request.max_tokens)

        load_time_s = round((res.perf_metrics.get_load_time() / 1e3), 2)
        generation_time_s = round(
            (res.perf_metrics.get_generate_duration().mean / 1e3), 2
        )
        ttft_s = round((res.perf_metrics.get_ttft().mean / 1e3), 2)
        throughput_tokens_s = round(res.perf_metrics.get_throughput().mean, 2)

        return {
            "text": str(res),
            "load_time_s": load_time_s,
            "generation_time_s": generation_time_s,
            "time_to_token_s": ttft_s,
            "throughput_s": throughput_tokens_s,
        }
    except Exception as e:
        logging.error(f"Error starting the chat: {e}")
        return JSONResponse(
            {"status": False, "message": "An error occurred while starting the chat"}
        )


uvicorn.run(
    app,
    host="127.0.0.1",
    port=args.port,
)
