// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

// Type Definitions for Metadata Structure
export interface ModelDetail {
    devicesFiltered: string[],
    allowMultipleDevices: boolean
}

export interface UsecaseOptions {
    model: Record<string, ModelDetail>
}

export interface TaskOptions {
    usecase: Record<string, UsecaseOptions>
}

export interface MetadataStructure {
    tasks: Record<string, TaskOptions>
}

export const metadata: MetadataStructure = {
    tasks: {
        'computer vision': {
            usecase: {
                'object detection (DLStreamer)': {
                    model: {
                        "yolov8n": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8s": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8m": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8l": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8x": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8n-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8s-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8m-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8l-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov8x-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov9t": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov9s": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov9m": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov9c": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov9e": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10n": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10s": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10m": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10b": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10l": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolov10x": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11n": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11s": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11m": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11l": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11x": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11n-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11s-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11ms-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11l-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11x-obb": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11n-pose": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11s-pose": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11m-pose": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11l-pose": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        },
                        "yolo11x-pose": {
                            "devicesFiltered": [],
                            "allowMultipleDevices": false
                        }
                    },
                },
                'text-to-image': {
                    model: {
                        'dreamlike-art/dreamlike-anime-1.0': {
                            devicesFiltered: ['NPU'],
                            allowMultipleDevices: true
                        },
                        'stabilityai/stable-diffusion-2': {
                            devicesFiltered: ['NPU'],
                            allowMultipleDevices: true
                        },
                    },
                },
            },
        },
        'natural language processing': {
            usecase: {
                'text generation': {
                    model: {
                        'TinyLlama/TinyLlama-1.1B-Chat-v1.0': {
                            devicesFiltered: [],
                            allowMultipleDevices: true
                        },
                        'Qwen/Qwen1.5-7B-Chat': {
                            devicesFiltered: [],
                            allowMultipleDevices: true
                        },
                        'OpenVINO/Mistral-7B-Instruct-v0.2-int4-ov': {
                            devicesFiltered: ['NPU'],
                            allowMultipleDevices: true
                        },
                        'OpenVINO/Phi-3-mini-4k-instruct-int4-ov': {
                            devicesFiltered: ['NPU'],
                            allowMultipleDevices: true
                        }
                    },
                },
            },
        },
        audio: {
            usecase: {
                'automatic speech recognition': {
                    model: {
                        'openai/whisper-tiny': {
                            devicesFiltered: [],
                            allowMultipleDevices: false
                        },
                        'openai/whisper-base': {
                            devicesFiltered: [],
                            allowMultipleDevices: false
                        },
                    },
                },
            },
        },
    },
}
