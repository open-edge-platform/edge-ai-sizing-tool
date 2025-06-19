# Edge AI Sizing Tool

The Edge AI Sizing Tool showcases the scalability and performance of AI use cases on Intel-based edge devices. With zero-code configuration, users can effortlessly set up AI applications by selecting inputs, accelerators, performance modes, and AI models. The tool provides real-time monitoring of system performance metrics, such as CPU and GPU usage, memory consumption, and inference speed, enabling users to optimize AI workflows and make informed decisions.

> **Disclaimer:** This software is designed to run exclusively in a trusted, single-machine environment. It is **not designed, tested, or supported for use in production systems**. Deploying or running this software in production or untrusted environments may lead to unexpected behavior, security vulnerabilities, or performance issues. Use outside of controlled, secure settings is strongly discouraged.

## Requirements

### Validated Hardware

- CPU: Intel® Core™ Ultra Processor (Products formerly Meteor Lake-UH) and above
- GPU:
  - Intel® Arc™ Graphics (iGPU)
  - Intel® Arc™ A770 Graphics (dGPU)
- RAM: 64GB
- DISK: 256GB+

### Validated Software

- Operating system:
  - Linux: Ubuntu\* 24.04 LTS Desktop
  - Linux: Ubuntu\* 22.04 LTS Desktop
- Python version: 3.10+
- Node.js version: 22+
- Intel GPU drivers version: 25.09.32961.5
- Intel NPU drivers version: v1.13.0
- Ubuntu intel-gpu-tools package version: 1.28-1ubuntu2

### Application Ports

Please ensure that these ports are available before running the application.

| Services        | Port      |
| --------------- | --------- |
| Frontend        | 8080      |
| Worker services | 5000-6000 |

### Supported AI Models

The Edge AI Sizing Tool supports the following AI models:

| Model Name                                   | Task Type                     | Source / License Information                                               |
|----------------------------------------------|-------------------------------|----------------------------------------------------------------------------|
| YOLOv8                                       | Object Detection              | [Ultralytics Docs](https://docs.ultralytics.com/)                          |
| YOLOv11                                      | Object Detection              | [Ultralytics Docs](https://docs.ultralytics.com/)                          |
| dreamlike-art/dreamlike-anime-1.0            | Text-To-Image                 | [Hugging Face](https://huggingface.co/dreamlike-art/dreamlike-anime-1.0)   |
| stabilityai/stable-diffusion-2               | Text-To-Image                 | [Hugging Face](https://huggingface.co/stabilityai/stable-diffusion-2)      |
| TinyLlama/TinyLlama-1.1B-Chat-v1.0           | Text Generation               | [Hugging Face](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)  |
| Qwen/Qwen1.5-7B-Chat                         | Text Generation               | [Hugging Face](https://huggingface.co/Qwen/Qwen1.5-7B-Chat)                |
| OpenVINO/Mistral-7B-Instruct-v0.2-int4-ov    | Text Generation               | [Hugging Face](https://huggingface.co/OpenVINO/Mistral-7B-Instruct-v0.2-int4-ov) |
| OpenVINO/Phi-3-mini-4k-instruct-int4-ov      | Text Generation               | [Hugging Face](https://huggingface.co/OpenVINO/Phi-3-mini-4k-instruct-int4-ov)   |
| openai/whisper-tiny                          | Automatic Speech Recognition  | [Hugging Face](https://huggingface.co/openai/whisper-tiny)                 |
| openai/whisper-base                          | Automatic Speech Recognition  | [Hugging Face](https://huggingface.co/openai/whisper-base)                 |

> **Disclaimer:** Before proceeding to set up and start the application, please review the license terms for each model listed above. By continuing with the setup and starting the application, you acknowledge and agree to comply with the terms and conditions of the respective model licenses.

## Quick Start

This section provides a streamlined process for setting up and running the Edge AI Sizing Tool on your local or isolated system. Follow these steps to quickly configure the environment and launch the application, allowing you to explore its features and capabilities with minimal setup.

#### 1. Setup Platform

Follow the [Edge Developer Kit Reference Scripts](https://github.com/intel/edge-developer-kit-reference-scripts) to install drivers and configure your system.

#### 2. Install Dependencies

```bash
./install.sh
```

This installs all required packages, sets up Python and Node.js environments.

#### 3. Run the Application

> **Note:** When you execute `start.sh`, the setup process will automatically generate a random secret key for the `PAYLOAD_SECRET` variable in the `.env` file. By running this script, you acknowledge and accept the use of this automatically generated secret.  
>  
> If you prefer to specify your own secret key, manually copy `.env.example` to `.env` and set the `PAYLOAD_SECRET` value in the `.env` file before running this script.

```bash
./start.sh
```

Once started, open http://localhost:8080 in your browser.

#### 4. Stop the Application

To stop the application gracefully:

```bash
./stop.sh
```

This script ensures that all services are properly shut down, including background workers.

## Deployment

Please refer to [DEPLOYMENT.md](DEPLOYMENT.md) for detailed steps on preparing and deploying the application.

## Development

Please refer to [DEVELOPMENT.md](DEVELOPMENT.md) for detailed steps on setting up a development environment.

## Troubleshooting

### 1. GPU Utilization Not Showing Up

Follow the steps below to enable the functionality of perf_events for non-root users.

> **Note:** Only relevant for Linux systems.

> **Disclaimer:** Setting `kernel.perf_event_paranoid=0` allows all users to access performance monitoring features, which can expose sensitive system information and increase security risks. Ensure this change is necessary, and implement additional access controls and monitoring to mitigate potential vulnerabilities.

#### Temporary Enablement

To temporarily enable the available functionality of perf_events for non-root users, execute the following command:

```bash
sudo sysctl kernel.perf_event_paranoid=0
```

This command will adjust the kernel parameter for the current session. Note that this change will be reverted upon system reboot.

#### Permanent Enablement

To permanently enable perf_events for non-root users, you need to modify the system configuration file. Follow these steps:

#### 1. Open the /etc/sysctl.conf file in a text editor with root privileges. You can use nano, vim, or any other editor of your choice:

```bash
sudo nano /etc/sysctl.conf
```

#### 2. Add the following line to the file:

`kernel.perf_event_paranoid=0`

#### 3. Save the changes and exit the editor.

Apply the changes by running:

```bash
sudo sysctl -p
```

This will ensure that the perf_events functionality remains enabled across system reboots.

## Limitations

1. The Ubuntu intel-gpu-tools package does not support Intel Arc B-Series Graphics Cards, resulting in the inability to display GPU utilization metrics.

2. iGPU utilization and device name may not be displayed on Intel® Core™ Ultra 9 288V processors.

3. Object Detection Inferencing Windows may not show results after running for extended periods.

4. System Overview and System Monitor may only show the PCI ID (e.g., e20b) for certain GPU models instead of the actual descriptive name.

5. Text generation may produce gibberish and illogical output for some LLM models when using Intel® Arc™ Ultra 7 Processor 155H iGPUs.

## Disclaimer
GStreamer* is an open source framework licensed under LGPL. See https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html. You are solely responsible for determining if your use of GStreamer requires any additional licenses.  Intel is not responsible for obtaining any such licenses, nor liable for any licensing fees due, in connection with your use of GStreamer.

This application has been validated and tested on the hardware listed in the documentation. While we strive to ensure compatibility and performance, the application may not function as expected on other hardware configurations. Users may encounter issues or unexpected behavior when running the application on untested hardware. If you encounter any issues or have suggestions for improvements, we welcome you to open an issue.
