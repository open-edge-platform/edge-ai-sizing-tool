# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import re
import sys
import cv2
import time
import math
import socket
import signal
import logging
import uvicorn
import zipfile
import requests
import argparse
import threading
import urllib.parse
import numpy as np
import subprocess as sp

from pathlib import Path
from fastapi import FastAPI
from contextlib import asynccontextmanager
from yolo_download import export_yolo_model
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

# Set environment variables to enable dlstreamer
os.environ["LIBVA_DRIVER_NAME"] = "iHD"
os.environ["GST_PLUGIN_PATH"] = (
    "/opt/intel/dlstreamer/lib:/opt/intel/dlstreamer/gstreamer/lib/gstreamer-1.0:/opt/intel/dlstreamer/streamer/lib/"
)
os.environ["LD_LIBRARY_PATH"] = (
    "/opt/intel/dlstreamer/gstreamer/lib:/opt/intel/dlstreamer/lib:/opt/intel/dlstreamer/lib/gstreamer-1.0:/sr/lib:/opt/intel/dlstreamer/lib:/usr/local/lib/gstreamer-1.0:/usr/local/lib"
)
os.environ["LIBVA_DRIVERS_PATH"] = "/usr/lib/x86_64-linux-gnu/dri"
os.environ["GST_VA_ALL_DRIVERS"] = "1"
os.environ["PATH"] = (
    f"/opt/intel/dlstreamer/gstreamer/bin:/opt/intel/dlstreamer/bin:{os.environ['PATH']}"
)

env = os.environ.copy()
venv_path = os.path.dirname(sys.executable)
env["PATH"] = f"{venv_path}:{env['PATH']}"

VIDEO_DIR = Path("../assets/media")
MODEL_DIR = Path("./models")
CUSTOM_MODELS_DIR = Path("../custom_models/object-detection-(DLStreamer)")
RTSP_SERVER_URL = "rtsp://localhost:8554"


def update_payload_status(workload_id: int, status):
    """
    Update the workload status in a safe way, allow-listing scheme, authority,
    and preventing unsafe path traversal.
    """
    if not is_valid_id(workload_id):
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("--- Initializing object detection worker ---")
    app.state.pipeline_metrics = {
        "total_fps": None,
        "number_streams": None,
        "average_fps_per_stream": None,
        "fps_streams": None,
        "timestamp": None,
    }
    thread = threading.Thread(target=main, daemon=True)
    thread.start()
    yield
    logging.info("--- Shutting down object detection worker ---")
    thread.join()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="FastAPI server for Intel® DLStreamer object detection model"
    )
    parser.add_argument(
        "--input",
        type=str,
        default=f"{VIDEO_DIR}/people-detection.mp4",
        help="Input source e.g. /dev/video0, videofile.mp4, etc",
    )
    parser.add_argument(
        "--inference_mode",
        type=str,
        default="gvadetect",
        help="Inference mode: gvadetect or gvaclassify (default: gvadetect)",
    )
    parser.add_argument(
        "--model", type=str, default="yolo11n", help="Model name (default: yolo11n)"
    )
    parser.add_argument(
        "--model_parent_dir",
        type=str,
        default=MODEL_DIR,
        help=f"Path to the model directory (default: {MODEL_DIR})",
    )
    parser.add_argument(
        "--model_precision",
        type=str,
        default="FP16",
        help="Model precision (default: FP16)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="CPU",
        help="Device to run inference on (default: CPU)",
    )
    parser.add_argument(
        "--decode_device",
        type=str,
        default="CPU",
        help="Device to run decode on (default: CPU)",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=1,
        help="Batch size for inference (default: 1)",
    )
    parser.add_argument(
        "--tcp_port",
        type=int,
        default=5000,
        help="Port to spawn the DLStreamer pipeline (default: 5000)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5997,
        help="Port to run the FastAPI server on (default: 5997)",
    )
    parser.add_argument(
        "--id", type=int, help="Workload ID to update the workload status"
    )
    parser.add_argument(
        "--number_of_streams",
        type=int,
        default=1,
        help="Number of streams to run (default: 1)",
    )
    parser.add_argument(
        "--width_limit",
        type=int,
        default=640,
        help="Width limit for the video stream (default: 640)",
    )
    parser.add_argument(
        "--height_limit",
        type=int,
        default=480,
        help="Height limit for the video stream (default: 480)",
    )
    return parser.parse_args()


args = parse_arguments()


def build_compositor_props(num_streams, final_width, final_height):
    """
    Method to dynamically split a single final_width * final_height compositor output window into a grid of N sub-windows.
    """
    # Determine how many columns and rows a square-ish grid would need
    grid_cols = math.ceil(math.sqrt(num_streams))
    grid_rows = math.ceil(num_streams / grid_cols)

    # Calculate each sub-window width and height
    sub_width = final_width // grid_cols
    sub_height = final_height // grid_rows

    comp_props = []
    for i in range(num_streams):
        row = i // grid_cols
        col = i % grid_cols

        xpos = col * sub_width
        ypos = row * sub_height

        comp_props.append(
            f"sink_{i}::xpos={xpos} "
            f"sink_{i}::ypos={ypos} "
            f"sink_{i}::width={sub_width} "
            f"sink_{i}::height={sub_height}"
        )

    return " ".join(comp_props)


def build_pipeline(
    tcp_port,
    input,
    inference_mode,
    model_full_path,
    model_label_path,
    device,
    decode_device,
    batch_size=1,
    number_of_streams=1,
):
    """
    Build the DLStreamer pipeline for MJPEG streaming.
    """

    # Check if input is a videofile
    if input.endswith((".mp4", ".avi", ".mov")):
        source_command = [" multifilesrc", f"location={input}", "loop=true"]
    elif input.startswith("rtsp://"):
        source_command = ["rtspsrc", f"location={input}", "protocols=tcp"]
    else:
        # Default to webcam
        if number_of_streams > 1:
            source_command = [
                "v4l2src",
                f"device={input}",
                "!",
                "videoconvert",
                "!",
                "tee",
                "name=camtee",
                "!",
                "multiqueue",
                "name=camq",
            ]
        else:
            source_command = ["v4l2src", f"device={input}"]

    # Configure decode element
    if "CPU" in decode_device:
        if input.startswith("/dev/video"):
            decode_element = ["decodebin3", "!", "videoconvert", "!", "video/x-raw"]
        else:
            decode_element = [
                "rtph264depay",
                "!",
                "avdec_h264",
                "!",
                "videoconvert",
                "!",
                "video/x-raw",
            ]
    elif "GPU" in decode_device:
        decode_element = [
            "rtph264depay",
            "!",
            "avdec_h264",
            "!",
            "vapostproc",
            "!",
            "video/x-raw(memory:VAMemory)",
        ]
    else:
        logging.error("Incorrect parameter DECODE_DEVICE. Supported values: CPU, GPU")
        sys.exit(1)

    # Configure inference command
    inference_command = [
        f"{inference_mode}",
        f"model={model_full_path}",
        f"device={device}",
    ]

    if model_label_path is not None:
        inference_command.append(f"labels-file={model_label_path}")

    if "GPU" in decode_device and "GPU" in device:
        inference_command.append(f"batch-size={batch_size}")
        inference_command.append("nireq=4")
        inference_command.append("pre-process-backend=va-surface-sharing")
    elif "GPU" in decode_device and "CPU" in device:
        inference_command.append("pre-process-backend=va")

    comp_props_str = build_compositor_props(
        args.number_of_streams, args.width_limit, args.height_limit
    )
    comp_props = comp_props_str.split()
    logging.info(f"Compositor properties: {comp_props_str}")

    # Build the compositor pipeline
    pipeline = (
        ["gst-launch-1.0", "compositor", "name=comp"]
        + comp_props
        + ["!"]
        + ["jpegenc", "!", "multipartmux", "boundary=frame"]
        + ["!"]
        + ["tcpserversink", f"host=127.0.0.1", f"port={tcp_port}"]
    )
    logging.info(f"Partial Pipeline={pipeline}")

    # Compose the full pipeline
    if input.startswith("/dev/video") and number_of_streams > 1:
        # For multiple webcam streams, use tee to split the source
        pipeline += source_command
        for i in range(number_of_streams):
            pipeline += (
                [
                    f"camtee.",
                    "!",
                    "queue",
                    "max-size-buffers=10",
                    "leaky=downstream",
                    "!",
                ]
                + decode_element
                + [
                    "!",
                    *inference_command,
                    "!",
                    "queue",
                    "!",
                    "gvafpscounter",
                    "!",
                    "gvawatermark",
                    "!",
                    "videoconvert",
                    "!",
                    f"comp.sink_{i}",
                ]
            )
    else:
        for i in range(number_of_streams):
            pipeline += (
                source_command
                + ["!"]
                + decode_element
                + ["!"]
                + inference_command
                + [
                    "!",
                    "queue",
                    "!",
                    "gvafpscounter",
                    "!",
                    "gvawatermark",
                    "!",
                    "videoconvert",
                    "!",
                    f"comp.sink_{i}",
                ]
            )
    # Log the pipeline
    logging.info(f"Full pipeline={' '.join(pipeline)}\n")
    return pipeline


def stop_signal_handler(sig, frame):
    """
    Signal handler for SIGINT to terminate worker
    """
    logging.info("SIGINT received. Stopping the application...")
    exit(0)


signal.signal(signal.SIGINT, stop_signal_handler)


def run_pipeline(pipeline):
    """
    Run the GStreamer pipeline and process its output in real-time.
    Handles EOS for looping and updates pipeline metrics.
    """
    logging.info("Starting GStreamer pipeline...")
    try:
        process = sp.Popen(pipeline, stdout=sp.PIPE, stderr=sp.PIPE, text=True)
        # Monitor the pipeline's stdout
        for line in process.stdout:
            logging.info(line.strip())
            # Process each line of output using filter_result
            metrics = filter_result(line.strip())
            if metrics:
                app.state.pipeline_metrics.update(metrics)

        # Capture any errors from stderr
        for error_line in process.stderr:
            logging.error(error_line.strip())

        # Check if the process exited due to EOS
        if process.returncode == 0 or process.returncode is None:
            logging.info("Pipeline reached EOS. Restarting...")
            process.communicate()
        else:
            logging.error(f"Pipeline exited with error code: {process.returncode}")

    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        if process and process.poll() is None:
            process.terminate()
            process.wait()
    finally:
        if process and process.poll() is None:
            process.terminate()
            process.wait()


def filter_result(output):
    """
    Extract the FPS metrics from the command output.

    Args:
        output (str): The standard output from the command.

    Returns:
        dict: A dictionary containing the total FPS, the number of streams, the average FPS per stream, a mapping of individual stream FPS values and timestamp.
    """
    fps_pattern = re.compile(
        r"FpsCounter\(.*\): total=(\d+\.\d+) fps, number-streams=(\d+), per-stream=(\d+\.\d+) fps(?: \((.*?)\))?"
    )
    match = fps_pattern.search(output)
    if match:
        total_fps_str = match.group(1)
        number_streams_str = match.group(2)
        average_fps_per_stream_str = match.group(3)
        all_streams_fps_str = match.group(4)

        total_fps = float(total_fps_str)
        number_streams = int(number_streams_str)
        average_fps_per_stream = float(average_fps_per_stream_str)

        if all_streams_fps_str:
            all_streams_fps = [float(x.strip()) for x in all_streams_fps_str.split(",")]
        else:
            # If there is only one stream
            all_streams_fps = [average_fps_per_stream]

        fps_streams = {
            f"stream_id {i+1}": fps_val
            for i, fps_val in enumerate(all_streams_fps[:number_streams])
        }

        return {
            "total_fps": total_fps,
            "number_streams": number_streams,
            "average_fps_per_stream": average_fps_per_stream,
            "fps_streams": fps_streams,
            "timestamp": time.time(),
        }
    return None


def is_rtsp_stream_running(rtsp_url, retries=5, delay=1):
    """
    Check if the RTSP stream is running by attempting to open it with OpenCV.
    Retry every second for a maximum number of retries.
    """
    for attempt in range(retries):
        try:
            cap = cv2.VideoCapture(rtsp_url)
            if cap.isOpened():
                logging.info(f"RTSP stream is running at: {rtsp_url}")
                cap.release()
                return True
            else:
                logging.warning(
                    f"RTSP stream is not running at: {rtsp_url}. Retrying... ({attempt + 1}/{retries})"
                )
        except Exception as e:
            logging.error(
                f"Error checking RTSP stream: {e}. Retrying... ({attempt + 1}/{retries})"
            )
        time.sleep(delay)
    return False


def is_valid_video_file(filepath):
    """
    Check if the given file is a valid video file using OpenCV.
    """
    if not os.path.isfile(filepath):
        return False
    cap = cv2.VideoCapture(filepath)
    valid = cap.isOpened()
    cap.release()
    return valid


def is_valid_id(id):
    """
    Validate the workload ID to prevent URL manipulation and ensure it is a positive integer.
    """
    if isinstance(id, int) and id >= 0:
        return True
    return False


def main():
    """
    Main function to start the GStreamer pipeline.
    """
    logging.info(
        f"View stream at url: http://localhost:{args.port}/result/{args.tcp_port}"
    )

    if os.path.realpath(args.input) != os.path.abspath(
        args.input
    ):  # Check if the model path is a symlink
        logging.info(
            f"Error: Input file {args.input} is a symlink or contains a symlink in its path. Refusing to open for security reasons."
        )
        update_payload_status(args.id, status="failed")
        sys.exit(1)

    # Ensure the video file exists
    if not os.path.exists(args.input):
        if args.input.isdigit():
            args.input = "/dev/video" + args.input
            logging.info(
                f"Input is a device index or webcam: {args.input}. Skipping file download."
            )
        else:
            logging.error(
                "Input video file not found and no webcam detected. Please provide a valid input source."
            )
            update_payload_status(args.id, status="failed")
            exit(1)
    else:
        if not is_valid_video_file(args.input):
            logging.error(
                f"Input file '{args.input}' is not a valid video file. Please provide a valid video file."
            )
            update_payload_status(args.id, status="failed")
            exit(1)
        filename = os.path.splitext(os.path.basename(args.input))[0]
        rtsp_url = f"{RTSP_SERVER_URL}/{filename}-{args.id}"
        logging.info(f"Hosting RTSP stream at: {rtsp_url}")
        ffmpeg_command = [
            "ffmpeg",
            "-re",
            "-stream_loop",
            "-1",
            "-i",
            args.input,
            "-c",
            "copy",
            "-f",
            "rtsp",
            "-rtsp_transport",
            "tcp",
            rtsp_url,
        ]
        args.input = rtsp_url

        try:
            # ffmpeg_process = sp.Popen(ffmpeg_command, stdout=sp.DEVNULL, stderr=sp.DEVNULL)
            ffmpeg_process = sp.Popen(
                ffmpeg_command, stdout=sp.DEVNULL, stderr=sp.DEVNULL
            )
            logging.info(f"Started RTSP streaming with PID: {ffmpeg_process.pid}")
        except sp.CalledProcessError as e:
            logging.error(f"Failed to host RTSP stream: {e}")

    # Check if the RTSP stream is running
    if not is_rtsp_stream_running(args.input, retries=5, delay=1):
        logging.error("RTSP stream is not running after multiple attempts. Exiting...")
        update_payload_status(args.id, status="failed")
        exit(1)
    else:
        time.sleep(5)  # Give 5 seconds for mediamtx to start digesting the stream

    model_label_path = None

    if args.model.endswith(".zip"):
        model_zipfile_name = Path(args.model).stem
        model_extract_dir = MODEL_DIR / model_zipfile_name
        if not model_extract_dir.exists():
            logging.info(f"Extracting {args.model} to {model_extract_dir}")
            try:
                with zipfile.ZipFile(args.model, "r") as zip_ref:
                    zip_ref.extractall(model_extract_dir)
            except Exception as e:
                logging.error(f"Failed to extract zip file {args.model}: {e}")
                update_payload_status(args.id, status="failed")
                exit(1)
        else:
            logging.info(
                f"Model directory {model_extract_dir} already exists, skipping extraction."
            )
        # Find for .xml file
        model_files = list(model_extract_dir.glob("*.xml"))
        if not model_files:
            logging.error(f"No model XML files found in {model_extract_dir}.")
            update_payload_status(args.id, status="failed")
            exit(1)
        model_full_path = model_files[0]
        # Find model label file
        label_files = list(model_extract_dir.glob("*.txt"))
        if label_files:
            model_label_path = label_files[0]
    else:
        # handle custom model uploaded to directory
        custom_model_path = CUSTOM_MODELS_DIR / args.model
        if not custom_model_path.exists():
            # predefined model
            model_status = export_yolo_model(
                model_name=args.model, model_parent_dir=args.model_parent_dir
            )

            if not model_status:
                update_payload_status(args.id, status="failed")
                exit(1)

            model_full_path = (
                Path(args.model_parent_dir)
                / f"{args.model}-{args.model_precision}"
                / f"{args.model}.xml"
            )
        else:
            custom_model_files = list(custom_model_path.glob("*.xml"))
            if not custom_model_files:
                logging.error(f"No model XML files found in {custom_model_path}.")
                update_payload_status(args.id, status="failed")
                exit(1)
            model_full_path = custom_model_files[0]
            label_files = list(custom_model_path.glob("*.txt"))
            if label_files:
                model_label_path = label_files[0]

    # Build the pipeline
    pipeline = build_pipeline(
        tcp_port=args.tcp_port,
        inference_mode=args.inference_mode,
        input=args.input,
        model_full_path=model_full_path,
        model_label_path=model_label_path,
        device=args.device,
        decode_device=args.decode_device,
        number_of_streams=args.number_of_streams,
    )

    # Start the pipeline
    logging.info("Starting the pipeline...")
    try:
        update_payload_status(args.id, status="active")
        run_pipeline(pipeline)
    except KeyboardInterrupt:
        logging.info("Pipeline interrupted. Exiting...")
    except Exception as e:
        update_payload_status(args.id, status="failed")
        logging.error(f"An error occurred while running the pipeline: {e}")


def mjpeg_stream(host: str = "127.0.0.1", port: int = 5000):
    """
    Connect to the GStreamer TCP server and yield MJPEG frames.
    """
    # Connect to the TCP server
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client_socket:
        client_socket.connect((host, port))
        buffer = b""

        while True:
            # Read data from the TCP server
            data = client_socket.recv(4096)
            if not data:
                break

            buffer += data
            while b"\r\n\r\n" in buffer:
                frame, _, buffer = buffer.partition(b"\r\n\r\n")

                try:
                    # Convert raw frame data to a NumPy array and decode the frame
                    np_frame = np.frombuffer(frame, dtype=np.uint8)
                    image = cv2.imdecode(np_frame, cv2.IMREAD_COLOR)
                    if image is None:
                        continue

                    # Encode the image as JPEG
                    _, jpeg_frame = cv2.imencode(".jpg", image)

                    # Yield the encoded JPEG frame
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n"
                        + jpeg_frame.tobytes()
                        + b"\r\n"
                    )
                except Exception as e:
                    logging.info(f"Error processing frame: {e}")


@app.get("/result")
def get_mjpeg_stream():
    """
    Serve the MJPEG stream as an HTTP response.
    """
    try:
        return StreamingResponse(
            mjpeg_stream(port=args.tcp_port),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as e:
        return JSONResponse(
            {
                "status": False,
                "message": "An error occurred while retrieving mjpeg stream",
            }
        )


@app.get("/api/metrics")
def get_pipeline_metrics():
    """
    Return the current pipeline metrics.
    """
    try:
        result = {
            "data": app.state.pipeline_metrics,
            "status": "success",
        }
        return JSONResponse(result)
    except Exception as e:
        logging.error(f"Error retrieving metrics: {e}")
        return JSONResponse(
            {"status": False, "message": "An error occurred while retrieving metrics"}
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=args.port)
