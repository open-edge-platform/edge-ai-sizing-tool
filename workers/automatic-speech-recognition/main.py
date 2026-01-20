# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import io
import sys
import time
import base64
import logging
import librosa
import uvicorn
import zipfile
import platform
import requests
import argparse
import subprocess
import urllib.parse
import openvino_genai
import huggingface_hub
from pathlib import Path

import openvino as ov
from typing import Dict
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from modelscope.hub.snapshot_download import snapshot_download


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

MODELS_DIR = Path("models")
CUSTOM_MODEL_DIR = Path("../custom_models/automatic-speech-recognition")
ENV_PATH = Path("../../frontend/.env")
PIPE = None


def setup_env():
    load_dotenv(ENV_PATH)

    env = os.environ.copy()
    venv_path = Path(sys.executable).parent
    if platform.system() == "Windows":
        env["PATH"] = f"{venv_path};{env['PATH']}"
    else:
        env["PATH"] = f"{venv_path}:{env['PATH']}"
    return env


def optimum_cli(
    args: argparse.Namespace,
    output_dir: Path,
    env: Dict[str, str],
    additional_args: Dict[str, str] = None,
):
    if args.repo_source == "huggingface":
        export_command = (
            f"optimum-cli export openvino --model {args.model_name} {output_dir}"
        )
    else:
        export_command = (
            f"optimum-cli export openvino --model {output_dir} {output_dir}"
        )
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
        update_payload_status(args.id, status="failed", port=args.port)
        sys.exit(1)


def update_payload_status(workload_id: int, status: str, port: int):
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

    data = {"status": status, "port": port}
    try:
        response = requests.patch(url, json=data)
        response.raise_for_status()
        logging.info(f"Successfully updated status to {status} for {workload_id}.")
    except requests.exceptions.RequestException as e:
        logging.info(f"Failed to update status: {e}")


def setup_model(args: argparse.Namespace, env: Dict[str, str]):
    global PIPE
    # Prepare model path and extraction if needed
    MODELS_DIR.mkdir(exist_ok=True)

    core = ov.Core()
    available_devices = core.available_devices

    # handle custom model in zip format
    if args.model_name.endswith(".zip"):
        logging.info(f"Processing zip file: {args.model_name}")
        model_zipfile_name = Path(args.model_name).stem
        model_path = MODELS_DIR / model_zipfile_name

        if not model_path.exists():
            logging.info(f"Extracting {args.model_name} to {model_path}")
            try:
                with zipfile.ZipFile(Path(args.model_name).resolve(), "r") as zip_ref:
                    zip_ref.extractall(model_path)
            except Exception as e:
                logging.error(f"Failed to extract zip file {args.model_name}: {e}")
                update_payload_status(args.id, status="failed", port=args.port)
                sys.exit(1)
        else:
            logging.info(
                f"Model directory {model_path} already exists and is not empty, skipping extraction."
            )
    else:
        # handle custom model uploaded to directory
        model_path = CUSTOM_MODEL_DIR / args.model_name

        if not model_path.exists():
            # predefined model or model id
            model_path = MODELS_DIR / args.model_name
            if platform.system() == "Windows":
                model_path = Path.cwd() / model_path
            logging.info(f"Model: {model_path}")
        else:
            logging.info(f"Custom model found: {model_path}")
            if not any(model_path.iterdir()):
                logging.error(f"Custom model directory {model_path} is empty.")
                update_payload_status(args.id, status="failed", port=args.port)
                sys.exit(1)

    # download model if it doesn't exist
    if model_path.exists() and not any(model_path.iterdir()):
        logging.info(f"Removing empty model directory: {model_path}")
        try:
            model_path.rmdir()
        except OSError as e:
            logging.warning(f"Failed to remove empty directory {model_path}: {e}")
            update_payload_status(args.id, status="failed", port=args.port)
            sys.exit(1)

    if not model_path.exists():
        logging.info(f"Model {model_path} not found. Downloading...")

        is_openvino_model = any(
            keyword in args.model_name.lower() for keyword in ["openvino", "ov"]
        )

        try:
            if args.repo_source == "modelscope":
                logging.info(
                    f"Downloading model {args.model_name} from ModelScope to {model_path}"
                )
                snapshot_download(
                    repo_id=args.model_name,
                    local_dir=str(model_path),
                )

                if not is_openvino_model:
                    additional_args = {"task": "automatic-speech-recognition"}
                    optimum_cli(args, model_path, env, additional_args)

            else:
                logging.info(
                    f"Downloading model {args.model_name} from Hugging Face to {model_path}"
                )

                if is_openvino_model:
                    huggingface_hub.snapshot_download(
                        args.model_name, local_dir=str(model_path)
                    )
                else:
                    additional_args = None
                    if "NPU" in available_devices:
                        additional_args = {"disable-stateful": None}
                    optimum_cli(args, model_path, env, additional_args)

        except Exception as e:
            logging.error(f"Failed to download model: {e}")
            update_payload_status(args.id, status="failed", port=args.port)
            sys.exit(1)

    if (
        model_path.resolve() != model_path.absolute()
    ):  # Check if the model path is a symlink
        logging.error(
            f"Model file {model_path} is a symlink or contains a symlink in its path. Refusing to open for security reasons."
        )
        update_payload_status(args.id, status="failed", port=args.port)
        sys.exit(1)

    try:
        PIPE = openvino_genai.WhisperPipeline(str(model_path), args.device)
        update_payload_status(args.id, status="active", port=args.port)
    except Exception as e:
        logging.error(f"Failed to load model: {e}")
        update_payload_status(args.id, status="failed", port=args.port)
        sys.exit(1)


class Request(BaseModel):
    file: str
    task: str
    language: str


def parse_args():
    parser = argparse.ArgumentParser(
        description="FastAPI server for OpenVINO automatic speech recognition model"
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="openai/whisper-tiny",
        help="Name of the OpenVINO model (.xml file) or hugging face ID",
    )
    parser.add_argument(
        "--repo-source",
        type=str,
        default="huggingface",
        help="Source of the model (huggingface or modelscope)",
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
    return parser.parse_args()


def create_app(args: argparse.Namespace, env: Dict[str, str]):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        setup_model(args, env)
        yield

    app = FastAPI(lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/infer")
    async def process_audio(request: Request):
        global PIPE
        try:
            file = request.file.split(",")[1]
            audio_data = base64.b64decode(file)
            audio_file = io.BytesIO(audio_data)
            raw_speech, _ = librosa.load(audio_file, sr=16000)
            start_time = time.perf_counter()
            result = PIPE.generate(
                raw_speech.tolist(),
                task=request.task,
                language=f"<|{request.language}|>",
            )
            inference_time = time.perf_counter() - start_time

            return {"text": str(result), "generation_time_s": round(inference_time, 1)}
        except Exception as e:
            logging.error(f"Error processing audio: {e}")
            return JSONResponse(
                {
                    "status": False,
                    "message": "An error occurred while processing the audio",
                }
            )

    return app


if __name__ == "__main__":
    args = parse_args()
    env = setup_env()

    app = create_app(args, env)

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=args.port,
    )
