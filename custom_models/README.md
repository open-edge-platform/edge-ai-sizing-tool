# Custom Model Directory

This directory is intended for users to upload their own AI models for use with the Edge AI Sizing Tool.

## Usage

- Place your custom model files in this directory if you prefer to upload them manually, especially for large models that may be difficult to upload through the web interface.
- Organize your model files by use case. Create a subdirectory for the use case, then place your model folder inside it. For example:

```
custom_model/
├── automatic-speech-recognition/
│   └── my-asr-model/
│       ├── asr-model.xml
│       └── asr-model.bin
├── text-generation/
│   └── my-textgen-model/
│       ├── textgen-model.xml
│       └── textgen-model.bin
├── text-to-image/
│   └── my-text2img-model/
│       ├── text2img-model.xml
│       └── text2img-model.bin
├── object-detection-(DLStreamer)/
│   └── my-objdet-model/
│       ├── objdet-model.xml
│       ├── objdet-model.bin
│       └── labels.txt (optional)
└── ...
```

- Supported use case folders include:
  - `automatic-speech-recognition`
  - `text-generation`
  - `text-to-image`
  - `object-detection-(DLStreamer)`

- For the object detection use case, you may optionally include a `labels.txt` file within your model directory to provide class labels for detected objects.

## Notes

- This method is recommended for large model files that may exceed upload limits in the web UI.
- Additionally, if you have models that are intended for frequent or permanent use, uploading them directly to this directory ensures they are always accessible and immediately available to the Edge AI Sizing Tool.
- After uploading, ensure the application is restarted or refreshed to detect new models.
