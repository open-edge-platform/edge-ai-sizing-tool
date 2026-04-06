# Custom Application Profiling

Monitor and analyze the performance of your applications on Intel hardware platform with CPU, GPU, NPU, memory, and disk I/O metrics.

> **Note:** This feature is currently supported on Linux OS only.

## Table of Contents

- [What It Does](#what-it-does)
- [Quick Start](#quick-start)
- [Understanding Results](#understanding-results)
- [Troubleshooting](#troubleshooting)

---

## What It Does

This tool helps you:
- **Monitor resource usage** - See CPU, GPU, NPU, memory, and disk utilization
- **Find bottlenecks** - Automatically identifies performance issues
- **Get recommendations** - Receive specific optimization suggestions
- **Compare performance** - Baseline comparison shows your app's actual impact

---

## Quick Start

### Step 1: Find Your Process ID (PID)

If your application is already running, find its PID:

```bash
ps aux | grep your_application_name
```

The second column is your PID (e.g., `10054`).

### Step 2: Set Up Profiling

1. Open the Edge AI Sizing Tool dashboard
2. Click **"Add Workload"** or the **+** icon
3. Select **Task**: `Custom Application Monitoring`
4. Choose **Process Selection**:
   - **PID** (recommended): Enter your process ID (e.g., `10054`)
   - **Application Path**: Enter application/process name
     - Python application: `python3 /path/to/your_script.py`
     - Node.js application: `node /path/to/your_script.js`
     - Custom binary: `/path/to/your_program`
5. Set **Duration**: 30-300 seconds (60 seconds recommended)
6. Click **"Add Workload"**

**Using Custom Python Environments:**

If your application requires a specific Python environment (virtual environment, conda, or specific Python version), specify the full path to the Python executable:

- Virtual environment: `/home/user/myproject/venv/bin/python /home/user/myproject/app.py`
- Conda environment: `/home/user/miniconda3/envs/myenv/bin/python /path/to/script.py`
- Specific Python version: `/usr/bin/python3.11 /path/to/your_script.py`
- With arguments: `/path/to/venv/bin/python script.py --config prod.json`

### Step 3: Wait for Results

The profiling takes your specified duration plus 15-20 seconds for processing. You'll see a progress bar with countdown.

**Don't close your browser during profiling.**

## Understanding Results

The dashboard shows comprehensive performance metrics:

### Performance Status

Shows overall health of your application with severity level (HEALTHY, WARNING, or CRITICAL) and identifies the primary bottleneck resource if any issues are detected.

### Key Metrics

**Baseline**: Shows system resource usage before your app started (should be < 20%)

**CPU Usage** (0-100% per core)
- < 30%: Light usage
- 30-70%: Moderate usage
- 70-90%: High usage
- \> 90%: Bottleneck

**GPU Usage** (0-100%)
- Shows how much of GPU capacity is being used
- High usage (>80%) may indicate GPU bottleneck

**NPU Usage** (Intel® Core™ Ultra processors only)
- Neural Processing Unit utilization
- Only used by AI models targeting NPU

**Memory**
- Shows RAM and GPU memory consumption
- Peak values show maximum usage

**Disk I/O**
- Read/Write throughput in MB/s
- High values indicate data-intensive operations

---

## Troubleshooting

### "Please provide a valid PID"
- Enter a numeric PID (e.g., `10054`)
- Verify process is running: `ps -p 10054`

### "Process not found"
- Check if process is still running: `ps -p <PID>`
- Ensure you have permission to monitor it
- For short-lived processes, profile the parent process

### High baseline warning
- Close unnecessary applications
- Wait for system to stabilize
- Background usage affects measurement accuracy

### All metrics show 0%
- Verify PID is correct: `ps -p <PID>`
- Check if you have permission to monitor the process
- Ensure application is active during profiling

### GPU shows 0% despite using GPU
- Verify GPU drivers: `xpumcli discovery`
- Check if application actually uses GPU
- See main README for driver installation


---

## Tips

**Best Duration Settings:**
- Quick check: 30 seconds
- Standard profiling: 60 seconds
- Comprehensive: 120-300 seconds
- Long service: 300-600 seconds

**For Accurate Results:**
- Close background applications before profiling
- Use consistent baseline (< 20% CPU/memory)
- Profile long enough to capture typical behavior
- Run multiple times and compare results

**Optimization Workflow:**
1. Profile to identify bottleneck
2. Apply recommended optimizations
3. Re-profile to measure improvement
4. Repeat for next bottleneck

---

## CLI Alternative

For automation or advanced usage:

```bash
cd workers/custom-application-profiling

# Check platform status
python3 main.py status

# Profile by PID
python3 main.py profile --pid 10054 --name "my_app" --duration 60

# Save results to JSON
python3 main.py profile --pid 10054 --name "my_app" --duration 60 --output results.json
```

### Using Custom Python Environments (CLI)

When using the CLI, run `main.py` with the profiler's Python environment (which has dependencies installed), while your application can use a different Python environment:

```bash
cd workers/custom-application-profiling

# Use profiler's venv - application uses same venv
venv/bin/python main.py profile --app "venv/bin/python your_app.py" --duration 30

# Profile app in conda environment
venv/bin/python main.py profile \
    --app "/home/user/miniconda3/envs/myenv/bin/python app.py" \
    --name "my_app" \
    --duration 60 \
    --output results.json
```

**Note:** If you see `ERROR: psutil module not found`, use the profiler's venv: `venv/bin/python main.py` instead of `python3 main.py`

---

## More Information

- **Intel® VTune™ Profiler**: [software.intel.com/vtune](https://software.intel.com/vtune)
- **Intel® OpenVINO™**: [docs.openvino.ai](https://docs.openvino.ai)
- **Main README**: [README.md](../README.md)

---

## License

Copyright (C) 2025 Intel Corporation  
SPDX-License-Identifier: Apache-2.0

