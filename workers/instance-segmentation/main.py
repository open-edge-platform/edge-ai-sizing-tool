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
import platform
import threading
import urllib.parse
import numpy as np
import subprocess as sp
from segmentation_models_download import SEGMENTATION_MODELS, export_model
from pathlib import Path
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

# configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Detect platform
IS_WINDOWS = sys.platform == "win32"

# Windows-specific configuration to prevent console window popup for subprocesses
if IS_WINDOWS:
    STARTUPINFO = sp.STARTUPINFO()
    STARTUPINFO.dwFlags |= sp.STARTF_USESHOWWINDOW
    STARTUPINFO.wShowWindow = sp.SW_HIDE
else:
    STARTUPINFO = None

# Set environment variables to enable dlstreamer
if not IS_WINDOWS:
    os.environ["LIBVA_DRIVER_NAME"] = "iHD"
    os.environ["GST_PLUGIN_PATH"] = (
        "/opt/intel/dlstreamer/lib:/opt/intel/dlstreamer/gstreamer/lib/gstreamer-1.0:/opt/intel/dlstreamer/streamer/lib/"
    )
    os.environ["LD_LIBRARY_PATH"] = (
        "/opt/intel/dlstreamer/gstreamer/lib:/opt/intel/dlstreamer/lib:/opt/intel/dlstreamer/lib/gstreamer-1.0:/sr/lib:/opt/intel/dlstreamer/lib:/usr/local/lib/gstreamer-1.0:/usr/local/lib:/opt/opencv:/opt/rdkafka"
    )
    os.environ["LIBVA_DRIVERS_PATH"] = "/usr/lib/x86_64-linux-gnu/dri"
    os.environ["GST_VA_ALL_DRIVERS"] = "1"
    os.environ["PATH"] = (
        f"/opt/intel/dlstreamer/gstreamer/bin:/opt/intel/dlstreamer/bin:{os.environ['PATH']}"
    )
    os.environ["GST_PLUGIN_FEATURE_RANK"] = (
        os.environ.get("GST_PLUGIN_FEATURE_RANK", "") + ",ximagesink:MAX"
    )
    os.environ["GI_TYPELIB_PATH"] = (
        "/opt/intel/dlstreamer/gstreamer/lib/girepository-1.0:/usr/lib/x86_64-linux-gnu/girepository-1.0"
    )
elif IS_WINDOWS:
    # Windows DLStreamer environment setup
    # Logging/verification
    gstreamer_path = os.environ.get(
        "GSTREAMER_1_0_ROOT_MSVC_X86_64", "C:\\gstreamer\\1.0\\msvc_x86_64"
    )
    openvino_path = os.environ.get("OPENVINO_DIR", "C:\\openvino")

    logging.info(f"Windows DLStreamer environment:")
    logging.info(f"  GStreamer: {gstreamer_path}")
    logging.info(f"  OpenVINO: {openvino_path}")
    logging.info(f"  DLStreamer plugins are installed as GStreamer plugins")
    logging.info(f"  Relying on system PATH configured by setup_dls_env.ps1")

env = os.environ.copy()
venv_path = os.path.dirname(sys.executable)
venv_bin = str(Path(sys.executable).parent)
path_separator = ";" if IS_WINDOWS else ":"
env["PATH"] = f"{venv_path}:{env['PATH']}"

VIDEO_DIR = Path("../assets/media")
MODEL_DIR = Path("./models")
CUSTOM_MODELS_DIR = Path("../custom_models/instance-segmentation-(DLStreamer)")
RSTP_SERVER_URL = "rtsp://localhost:8554"

pipeline_process = None
ffmpeg_process = None

app = FastAPI()


def is_valid_id(workload_id):
    """
    Validate the workload ID to prevent URL manipulation and ensure it is a positive integer
    """
    if isinstance(workload_id, int) and workload_id >= 0:
        return True
    return False


def update_payload_status(workload_id: int, status):
    """Update the workload status in a safe way, allow-listing scheme, authority,
    and preventing unsafe path traversal."""
    if not is_valid_id(workload_id):
        logging.error(f"Invalid workload ID: {workload_id}. Refusing to update status.")
        return

    # Hardcode scheme & authority (safe allow-list)
    allowed_scheme = "http"
    allowed_netloc = "127.0.0.1:8080"

    # Build the path carefully. Rejet characters such as "../"
    path = f"/api/workloads/{workload_id}"

    # Use urllib.parse to verify
    composed_url = f"{allowed_scheme}://{allowed_netloc}{path}"
    parsed_url = urllib.parse.urlparse(composed_url)

    # enforce scheme & authoriy are what we expect
    if parsed_url.scheme != allowed_scheme or parsed_url.netloc != allowed_netloc:
        logging.error(f"URL scheme or authority not allowed: {parsed_url.geturl()}")

    # basic check for path traversl attempts (../, //, whitespace, etc.)
    if ".." in path or "//" in path or " " in path:
        logging.error(f"Invalid characters in URL path: {path}")
        return

    # now safe to use
    url = parsed_url.geturl()
    data = {"status": status, "port": args.port}
    try:
        response = requests.patch(url, json=data)
        response.raise_for_status()
        logging.info(f"Successfully updated to {status} for {workload_id}.")
    except requests.exceptions.RequestException as e:
        logging.info(f"Failed to update status: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("--- Initializing instance segmentation worker ---")
    app.state.pipeline_metrics = {
        "total_fps": None,
        "number_streams": None,
        "average_fps_per_streams": None,
        "fps_streams": None,
        "timestamp": None,
    }
    thread = threading.Thread(target=main, daemon=True)
    thread.start()
    yield
    logging.info("--- Shutting down instance segmentation worker ---")


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
        description="FastAPI server for Intel® DLStreamer instance segmentation model"
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
        "--model",
        type=str,
        default="mask_rcnn_inception_resnet_v2_atrous_coco",
        help="Model name (default: mask_rcnn_inception_resnet_v2_atrous_coco)",
    )
    parser.add_argument(
        "--model_parent_dir",
        type=str,
        default=MODEL_DIR,
        help=f"Path to the model directory (Default: {MODEL_DIR})",
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
        help="Device to run inference on (default:CPU)",
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
        default=5001,
        help="Port to spawn the DLStreamer pipeline (default: 5001)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5998,
        help="Port to run the FastAPI server on (default: 5998)",
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
        help="Height is limit for the video stream (default: 480)",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=None,
        help="Number of rows for the compositor grid (default: None)",
    )
    parser.add_argument(
        "--cols",
        type=int,
        default=None,
        help="Number of columns for the compositor grid (default: None)",
    )
    return parser.parse_args()


args = parse_arguments()


def build_compositor_props(
    num_streams, final_width, final_height, rows=None, cols=None
):
    """
    Method to dynamically split a single final_width * final_height compositor output window into a grid of N sub-windows.
    """
    if not rows or not cols:
        # Determine how many columns and rows a square/grid grid would need
        cols = math.ceil(math.sqrt(num_streams))
        rows = math.ceil(num_streams / cols)

    # Calculate width and height for each sub-window
    sub_width = final_width // cols
    sub_height = final_height // rows

    comp_props = []
    for i in range(num_streams):
        row = i // cols
        col = i % cols

        x_pos = col * sub_width
        y_pos = row * sub_height

        comp_props.append(
            f"sink_{i}::xpos={x_pos} sink_{i}::ypos={y_pos} sink_{i}::width={sub_width} sink_{i}::height={sub_height}"
        )

    return " ".join(comp_props)


def build_pipeline(
    model_full_path,
    inference_mode,
    input,
    device,
    decode_device,
    tcp_port,
    number_of_streams=1,
    batch_size=1,
    model_proc_path=None,
    model_label_path=None,
    rows=None,
    cols=None,
):
    """Build the DLStreamer pipeline for MJPEG streaming"""
    # Determine source element based on input
    if input.endswith((".mp4", ".avi", ".mov")):
        source_command = ["filesrc", f"location={input}", "loop=true"]
    elif input.startswith("rtsp://"):
        source_command = ["rtspsrc", f"location={input}", "protocols=tcp"]
    elif input.startswith("/dev/video") or input.isdigit():
        if IS_WINDOWS:
            if number_of_streams > 1:
                source_command = [
                    "mfvideosrc",
                    f"device-index={input if input.isdigit() else 0}",
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
                source_command = [
                    "mfvideosrc",
                    f"device-index={input if input.isdigit() else 0}",
                ]
        else:
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
    else:
        logging.error(f"Unsupported input source: {input}")
        return None

    # Configure decode element
    if "CPU" in decode_device:
        if (not IS_WINDOWS and input.startswith("/dev/video")) or (
            IS_WINDOWS and input.isdigit()
        ):
            decode_element = [
                "videoconvert",
            ]
            caps_element = ["video/x-raw,format=BGR"]
        elif IS_WINDOWS:
            # Windows - all inputs use QSV decoder for RTSP/files
            decode_element = [
                "rtph264depay",
                "!",
                "h264parse",
                "!",
                "qsvh264dec",
                "!",
                "videoconvert",
            ]
            caps_element = ["video/x-raw,format=BGR"]
        else:
            # Linux - RTSP/file inputs
            decode_element = [
                "rtph264depay",
                "!",
                "h264parse",
                "!",
                "avdec_h264",
                "!",
                "videoconvert",
            ]
            caps_element = ["video/x-raw,format=BGR"]

    elif "GPU" in decode_device or "NPU" in decode_device:
        if not IS_WINDOWS and input.startswith("/dev/video"):
            decode_element = [
                "videoconvert",
                "!",
                "vapostproc",
            ]
            caps_element = ["video/x-raw(memory:VAMemory)"]
        else:
            decode_element = [
                "rtph264depay",
                "!",
                "h264parse",
                "!",
                "vaapih264dec",
                "!",
                "vapostproc",
            ]
            caps_element = ["video/x-raw(memory:VAMemory),format=NV12"]

    else:
        logging.error(f"Unsupported device: {decode_device}")
        return None

    # Convert Windows paths to forward slashes for GStreamer
    # GStreamer on Windows accepts forward slashes and this avoids escaping issues
    gst_model_path = (
        model_full_path.replace("\\", "/") if IS_WINDOWS else model_full_path
    )
    gst_model_proc_path = (
        model_proc_path.replace("\\", "/")
        if IS_WINDOWS and model_proc_path
        else model_proc_path
    )
    gst_model_label_path = (
        model_label_path.replace("\\", "/")
        if IS_WINDOWS and model_label_path
        else model_label_path
    )

    inference_command = [
        f"{inference_mode}",
        f"model={gst_model_path}",
        f"device={device}",
    ]

    # if dont have model proc file then we make it use it without
    # Add model proc file if available
    if gst_model_proc_path is not None and os.path.exists(model_proc_path):
        logging.info(f"Using model proc file: {model_proc_path}")
        inference_command.append(f"model-proc={gst_model_proc_path}")
    else:
        logging.warning("No model proc file found. Proceeding without one.")

    if gst_model_label_path is not None and os.path.exists(model_label_path):
        logging.info(f"Using model label file: {model_label_path}")
        inference_command.append(f"labels-file={gst_model_label_path}")
    else:
        logging.warning("No model label file found. Proceeding without one.")

    # pre-processing
    if ("GPU" in decode_device and "GPU" in device) or (
        "NPU" in decode_device and "NPU" in device
    ):
        inference_command.append(f"batch-size={batch_size}")
        inference_command.append("nireq=4")
        inference_command.append("pre-process-backend=va-surface-sharing")
    elif "GPU" in decode_device and "CPU" in device:
        inference_command.append("pre-process-backend=va")
    else:
        inference_command.append("pre-process-backend=ie")

    # beginning of piepline
    gst_launch_cmd = (
        "gst-launch-1.0.exe" if platform.system() == "Windows" else "gst-launch-1.0"
    )
    pipeline = [gst_launch_cmd]

    comp_props_str = build_compositor_props(
        args.number_of_streams,
        args.width_limit,
        args.height_limit,
        args.rows,
        args.cols,
    )
    comp_props = comp_props_str.split()
    logging.info(f"Compositor properties: {comp_props}")

    pipeline += ["compositor", "name=comp"] + comp_props
    pipeline += ["!", "queue"]
    pipeline += ["!", "jpegenc"]
    pipeline += ["!", "multipartmux", "boundary=frame"]
    pipeline += [
        "!",
        "tcpserversink",
        f"host=127.0.0.1",
        f"port={tcp_port}",
    ]

    if input.startswith("/dev/video") and number_of_streams > 1:
        # for multiple webcam streams, use tee to split the source
        pipeline.append("sync=false")
        pipeline += source_command
        for i in range(number_of_streams):
            pipeline += [
                f"camtee.",
                "!",
                "queue",
                "max-size-buffers=10",
                "leaky=downstream",
            ]
            pipeline += ["!", *decode_element]
            pipeline += ["!", *caps_element]
            pipeline += ["!", *inference_command]
            pipeline += [
                "!",
                "queue",
                "!",
                "gvafpscounter",
                "!" "videoconvert",
                "!",
                "gvawatermark",
                "!",
                "videoconvert",
                "!",
                "video/x-raw",
                "!",
                f"comp.sink_{i}",
            ]
    else:
        for i in range(number_of_streams):
            pipeline += source_command
            pipeline += ["!", *decode_element]
            pipeline += ["!", *caps_element]
            pipeline += ["!", *inference_command]
            pipeline += [
                "!",
                "queue",
                "!",
                "gvafpscounter",
                "!",
                "videoconvert",
                "!",
                "gvawatermark",
                "!",
                "videoconvert",
                "!",
                "video/x-raw",
                "!",
                f"comp.sink_{i}",
            ]

    # log the pipepline
    logging.info(f"Full pipeling: {' '.join(pipeline)}\n")
    return pipeline


def run_pipeline(pipeline):
    """
    Run the GStreamer pipeline and process its output in real-time.
    Handles EOS for looping and updates pipeline metrics.
    """
    logging.info("Starting GStreamer pipeline...")
    try:
        process = sp.Popen(
            pipeline, stdout=sp.PIPE, stderr=sp.PIPE, text=True, startupinfo=STARTUPINFO
        )
        # Monitor the pipeline's stdout
        for line in process.stdout:
            logging.info(line.strip())
            # Process each line of output using filter_result
            metrics = filter_result_fps(line.strip())
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


def stop_signal_handler(sig, frame):
    """
    Signal handler for SIGINT to terminate worker gracefully.
    """
    logging.info("SIGINT received. Stopping the application...")
    global pipeline_process, ffmpeg_process
    if pipeline_process and pipeline_process.poll():
        pipeline_process.terminate()
        pipeline_process.wait()
    if ffmpeg_process and ffmpeg_process.poll() is None:
        ffmpeg_process.terminate()
        ffmpeg_process.wait()

    sys.exit(0)


signal.signal(signal.SIGINT, stop_signal_handler)


def filter_result_fps(output):
    """
    Extract the FPS metrics from the command output
    """
    fps_pattern = re.compile(
        r"FpsCounter\(.*\): total=(\d+\.\d+) fps, number-streams=(\d+), per-stream=(\d+\.\d+) fps(?: \((.*?)\))?"
    )
    match = fps_pattern.search(output)
    if match:
        total_fps = float(match.group(1))
        number_streams = int(match.group(2))
        average_fps_per_stream = float(match.group(3))
        all_streams_fps_str = match.group(4)

        if all_streams_fps_str:
            all_streams_fps = [float(x.strip()) for x in all_streams_fps_str.split(",")]
        else:
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
    Check if an RTSP stream is running by attempting to connect to it.
    """
    for attempt in range(retries):
        try:
            cap = cv2.VideoCapture(rtsp_url)
            if cap.isOpened():
                ret, _ = cap.read()
                cap.release()
                return True
            else:
                logging.warning(
                    f"RTSP stream not ready at {rtsp_url}, attempt {attempt+1}/{retries}"
                )
        except Exception as e:
            logging.error(
                f"Error checking RTSP stream: {e}. Retrying ... ({attempt + 1}/{retries})"
            )
        time.sleep(delay)
    return False


def is_valid_video_file(filepath):
    """
    Check if a file exists and is a valid video file.
    """
    if not os.path.exists(filepath):
        return False

    try:
        cap = cv2.VideoCapture(filepath)
        opened = cap.isOpened()
        cap.release()
        return opened
    except:
        return False


def mjpeg_stream(
    host: str = "127.0.0.1", port: int = 5001, retries: int = 5, delay: int = 1
):
    """
    Connect to the GStreamer TCP server and yield MJPEG frames.
    """
    for attempt in range(retries):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client_socket:
                client_socket.settimeout(5)
                client_socket.connect((host, port))
                logging.info(f"Connected to MJPEG stream on port {port}")
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

                            _, jpeg_frame = cv2.imencode(".jpg", image)

                            # Yield the encoded JPEG frame
                            yield (
                                b"--frame\r\n"
                                b"Content-Type: image/jpeg\r\n\r\n"
                                + jpeg_frame.tobytes()
                                + b"\r\n"
                            )
                        except Exception as e:
                            logging.error(f"Error processing frame: {e}")

        except ConnectionRefusedError:
            logging.warning(
                f"Connection refused. Retrying in {delay}s... ({attempt + 1}/{retries})"
            )
            time.sleep(delay)
        except (socket.timeout, BrokenPipeError, ConnectionResetError) as e:
            logging.error(
                f"Socket error: {e}. Retrying in {delay}s... ({attempt + 1}/{retries})"
            )
            time.sleep(delay)
        except Exception as e:
            logging.error(f"An unexpected error occurred in MJPEG stream: {e}")
            break
    logging.error(
        f"Failed to connect to MJPEG stream on port {port} after {retries} attempts."
    )
    update_payload_status(args.id, status="failed")
    yield b"--frame\r\nContent-Type: text/plain\r\n\r\nStream not available. Check worker logs.\r\n"


def main():
    """
    Main function to start the GStreamer pipeline.
    """

    model_proc_path = None
    model_label_path = None

    logging.info(
        f"View stream at url: http://localhost:{args.port}/result/{args.tcp_port}"
    )

    if os.path.realpath(args.input) != os.path.abspath(args.input):
        logging.info(
            f"Error: Input file {args.input} is a symlink or contains in its path"
        )
        update_payload_status(args.id, status="failed")
        sys.exit(0)

    # ensure the video file exists or handle URLs/webcam
    if not os.path.exists(args.input) and not args.input.startswith(
        ("rtsp://", "/dev/video")
    ):
        if args.input.isdigit():
            if not IS_WINDOWS:
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
    elif os.path.exists(args.input):
        if not is_valid_video_file(args.input):
            logging.error(
                f"Input file '{args.input}' is not a valid video file. Please provide a valid video file."
            )
            update_payload_status(args.id, status="failed")
            exit(1)
        filename = os.path.splitext(os.path.basename(args.input))[0]
        rtsp_url = f"{RSTP_SERVER_URL}/{filename}-{args.id}"
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
            ffmpeg_process = sp.Popen(
                ffmpeg_command,
                stdout=sp.DEVNULL,
                stderr=sp.DEVNULL,
                startupinfo=STARTUPINFO,
            )
            logging.info(f"Started RTSP streaming with PID: {ffmpeg_process.pid}")
        except sp.CalledProcessError as e:
            logging.error(f"Failed to host RTSP stream: {e}")

    # Check if the RTSP stream is running (skip for webcam devices)
    # Webcam detection: /dev/videoN on Linux or numeric device index on Windows
    is_webcam_input = (not IS_WINDOWS and args.input.startswith("/dev/video")) or (
        IS_WINDOWS and args.input.isdigit()
    )

    if not is_webcam_input:
        if not is_rtsp_stream_running(args.input, retries=5, delay=1):
            logging.error(
                "RTSP stream is not running after multiple attempts. Exiting..."
            )
            update_payload_status(args.id, status="failed")
            exit(1)
        else:
            time.sleep(5)

    if args.model in SEGMENTATION_MODELS:
        model_status = export_model(
            model_name=args.model, model_parent_dir=args.model_parent_dir
        )
        if not model_status:
            update_payload_status(args.id, status="failed")
            exit(1)

        model_dir = Path(args.model_parent_dir) / args.model

        xml_files = list((model_dir / args.model_precision).glob("*.xml"))
        if xml_files:
            model_full_path = xml_files[0]
        else:
            logging.error(f"No model files found in {model_dir / args.model_precision}")
            update_payload_status(args.id, status="failed")
            exit(1)

        proc_files = list(model_dir.glob("*.json"))
        if proc_files:
            model_proc_path = proc_files[0]
            logging.info(f"Found model proc file: {model_proc_path}")
        else:
            logging.warning(f"No model proc file found in {model_dir}")

        label_files = list(model_dir.glob("*.txt"))
        if label_files:
            model_label_path = label_files[0]
            logging.info(f"Found model label file: {model_label_path}")
        else:
            logging.warning(f"No model label file found in {model_dir}")

    elif args.model.endswith(".zip"):
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
        xml_files = list((model_extract_dir).glob("*.xml"))
        if not xml_files:
            logging.error(f"No model XML files found in {model_extract_dir}.")
            update_payload_status(args.id, status="failed")
            exit(1)
        model_full_path = xml_files[0]

        # Find model proc file
        proc_files = list(model_extract_dir.glob("*.json"))
        if proc_files:
            model_proc_path = proc_files[0]
        else:
            logging.warning(f"No model processing file found in {model_extract_dir}")

        # find model label file
        label_files = list(model_extract_dir.glob("*.txt"))
        if label_files:
            model_label_path = proc_files[0]
        else:
            logging.warning(f"No model processing file found in {model_extract_dir}")
    else:
        # Handle custom model uploaded to directory
        custom_model_path = CUSTOM_MODELS_DIR / args.model
        if not custom_model_path.exists():
            # Predefined model - construct path following shell script pattern
            model_status = export_model(
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
            proc_files = list(custom_model_path.glob("*.json"))
            if proc_files:
                model_proc_path = proc_files[0]

            label_files = list(custom_model_path.glob("*.txt"))
            if label_files:
                model_label_path = proc_files[0]

    # Build the pipeline
    pipeline = build_pipeline(
        tcp_port=args.tcp_port,
        inference_mode=args.inference_mode,
        input=args.input,
        model_full_path=str(model_full_path),
        model_proc_path=str(model_proc_path) if model_proc_path else None,
        model_label_path=str(model_label_path) if model_label_path else None,
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


@app.get("/result")
def get_mjpeg_stream():
    """
    Serve the MJPEG stream as an HTTP response
    """
    try:
        return StreamingResponse(
            mjpeg_stream(port=args.tcp_port),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as e:
        logging.error(f"Failed to serve MJPEG stream: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to serve MJPEG stream: {str(e)}"},
        )


@app.get("/api/metrics")
def get_pipeline_metrics():
    """
    Return the current pipeline metrics
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
