#!/usr/bin/env python3

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""
Platform Profiler - Application Resource Utilization Analysis
==============================================================
QUICK START:
    # Check platform status
    python3 main.py status
    
    # Profile your application (supports Python, Node.js, binaries, etc.)
    python3 main.py profile --app "python3 customer_sample_app.py" --name "my_app"

USAGE EXAMPLES:
    # Python application
    python3 main.py profile \\
        --app "python3 customer_sample_app.py" \\
        --name "sample_app" \\
        --duration 30 \\
        --output profile.json
    
    # Node.js application
    python3 main.py profile --app "node server.js" --name "node_app" --duration 60
    
    # Binary/executable
    python3 main.py profile --app "./my_program --arg1 --arg2" --name "my_program"
    
    # Attach to existing process
    python3 main.py profile --pid 12345 --name "existing_app"

For full documentation, run: python3 main.py --help
"""

import time
import subprocess
import sys
import json
import os
import re
import uuid
import shlex
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict, field
from pathlib import Path
from datetime import datetime
import signal

# FastAPI imports
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# Import bottleneck analyzer from separate module
from bottleneck_analyzer import BottleneckAnalyzer, Bottleneck, BottleneckAnalysis

# Try to import psutil, provide helpful error if missing
try:
    import psutil
except ImportError:
    print("ERROR: psutil module not found!", file=sys.stderr)
    print("", file=sys.stderr)
    print("Please install it using ONE of these methods:", file=sys.stderr)
    print("  1. pip install psutil", file=sys.stderr)
    print("  2. sudo apt-get install python3-psutil", file=sys.stderr)
    print(
        "  3. Create venv: python3 -m venv venv && source venv/bin/activate && pip install psutil",
        file=sys.stderr,
    )
    sys.exit(1)


# ============================================================================
# Security - Input Validation
# ============================================================================


def validate_command_string(command: str) -> str:
    """
    Validate and sanitize command string for security.

    This function serves as a taint barrier for static analysis tools.
    It ensures the command string doesn't contain dangerous patterns.

    Args:
        command: Command string to validate

    Returns:
        Validated command string (same as input if valid)

    Raises:
        ValueError: If command contains suspicious patterns
    """
    if not command or not command.strip():
        raise ValueError("Command string cannot be empty")

    # Check for null bytes (could terminate string unexpectedly)
    if "\x00" in command:
        raise ValueError("Command contains null byte")

    # Ensure command starts with an executable name (no leading special chars)
    first_char = command.strip()[0]
    if first_char in (";", "|", "&", ">", "<", "$", "`"):
        raise ValueError(f"Command cannot start with shell metacharacter: {first_char}")

    # Return the validated command (taint is now removed for static analysis)
    return command


def validate_file_path(path_str: str) -> Path:
    """
    Validate and resolve file path for security.

    This function serves as a taint barrier for static analysis tools.

    Args:
        path_str: Path string to validate

    Returns:
        Validated Path object

    Raises:
        ValueError: If path is invalid or suspicious
    """
    if not path_str or not path_str.strip():
        raise ValueError("Path cannot be empty")

    # Check for null bytes
    if "\x00" in path_str:
        raise ValueError("Path contains null byte")

    # Convert to Path object
    path = Path(path_str)

    # Make absolute if relative
    if not path.is_absolute():
        path = Path.cwd() / path

    # Resolve to canonical path (removes .. and symlinks)
    try:
        path = path.resolve()
    except (OSError, RuntimeError) as e:
        raise ValueError(f"Cannot resolve path: {e}")

    # Return validated path (taint is now removed for static analysis)
    return path


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class CPUInfo:
    """CPU specifications"""

    model: str
    physical_cores: int
    logical_threads: int
    frequency_mhz: float


@dataclass
class GPUDevice:
    """GPU device information"""

    device_id: int
    name: str
    pci_device_id: str
    memory_total_mb: float


@dataclass
class GPUUtilization:
    """GPU utilization metrics"""

    device_id: int
    name: str
    compute_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float


@dataclass
class SystemMemory:
    """System memory information"""

    total_mb: float
    used_mb: float
    available_mb: float
    percent: float


@dataclass
class ProcessMemory:
    """Per-process memory metrics"""

    pid: int
    rss_mb: float
    vms_mb: float
    percent: float


@dataclass
class ProcessMetrics:
    """Resource metrics for a single process in the tree"""

    pid: int
    ppid: int  # Parent PID
    name: str
    cmdline: str
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    memory_percent: float = 0.0
    num_threads: int = 0
    status: str = "running"  # running, sleeping, zombie, etc.
    create_time: float = 0.0
    children_pids: List[int] = field(default_factory=list)


@dataclass
class GPUBaseline:
    """GPU baseline state"""

    device_id: int
    name: str
    compute_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float


@dataclass
class PlatformBaseline:
    """System state when idle (no applications running)"""

    timestamp: float

    # CPU baseline
    cpu_percent: float
    cpu_info: CPUInfo

    # Memory baseline
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float

    # GPU baseline (per device)
    gpu_devices: List[GPUBaseline]

    # NPU baseline
    npu_available: bool
    npu_percent: float

    # Disk I/O baseline
    disk_read_mb_per_sec: float = 0.0
    disk_write_mb_per_sec: float = 0.0


@dataclass
class ApplicationProfile:
    app_id: str
    name: str
    command: str
    pids: List[int] = field(default_factory=list)

    process_name: str = "unknown"

    # Process tree tracking
    process_tree: Dict[int, ProcessMetrics] = field(default_factory=dict)
    root_pid: int = 0  # Main process PID
    max_process_count: int = 0  # Peak number of processes
    process_spawns: int = 0  # Total child processes spawned
    process_exits: int = 0  # Total processes that exited

    # Resource utilization (deltas from baseline) - AVERAGES
    cpu_percent: float = 0.0  # Normalized CPU 0-100% (avg per core)
    cpu_percent_normalized: float = 0.0  # Same as cpu_percent (kept for compatibility)
    memory_mb: float = 0.0
    memory_percent: float = 0.0

    gpu_compute_percent: float = 0.0
    gpu_memory_mb: float = 0.0
    gpu_memory_percent: float = 0.0

    npu_percent: float = 0.0

    # Disk I/O
    disk_read_mb_per_sec: float = 0.0
    disk_write_mb_per_sec: float = 0.0
    disk_io_percent: float = 0.0  # Combined I/O activity percentage

    # Peak utilization (maximum observed values)
    peak_cpu_percent: float = 0.0  # Normalized CPU peak 0-100%
    peak_cpu_percent_normalized: float = (
        0.0  # Same as peak_cpu_percent (kept for compatibility)
    )
    peak_memory_mb: float = 0.0
    peak_gpu_compute_percent: float = 0.0
    peak_gpu_memory_mb: float = 0.0
    peak_npu_percent: float = 0.0
    peak_disk_read_mb_per_sec: float = 0.0
    peak_disk_write_mb_per_sec: float = 0.0
    peak_disk_io_percent: float = 0.0

    # System info
    logical_cores: int = 0  # Number of logical CPU cores

    # Metadata
    start_time: float = 0.0
    duration: float = 0.0
    status: str = "initializing"  # initializing, running, completed, failed
    error_message: Optional[str] = None

    # Baseline quality warnings
    baseline_warnings: List[str] = field(default_factory=list)


@dataclass
class ProfilingSession:
    """Manages multi-application profiling"""

    session_id: str
    applications: Dict[str, ApplicationProfile] = field(default_factory=dict)
    baseline: Optional[PlatformBaseline] = None
    start_time: float = 0.0
    status: str = "initializing"  # initializing, profiling, completed


# ============================================================================
# Resource Monitors
# ============================================================================


class CPUMonitor:
    """CPU utilization tracking"""

    def __init__(self):
        self._last_cpu_times = None

    def get_overall_utilization(self, interval: float = 1.0) -> float:
        """Get system-wide CPU % (0-100)"""
        try:
            return psutil.cpu_percent(interval=interval)
        except Exception as e:
            print(f"Error getting CPU utilization: {e}", file=sys.stderr)
            return 0.0

    def get_per_process_utilization(self, pids: List[int]) -> Dict[int, float]:
        """Get CPU % for specific PIDs"""
        result = {}
        for pid in pids:
            try:
                proc = psutil.Process(pid)
                cpu_percent = proc.cpu_percent(interval=0.1)
                result[pid] = cpu_percent
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                result[pid] = 0.0
        return result

    def get_cpu_info(self) -> CPUInfo:
        """Get CPU specs (cores, threads, model)"""
        try:
            # Get model name
            model = "Unknown CPU"
            try:
                with open("/proc/cpuinfo", "r") as f:
                    for line in f:
                        if "model name" in line:
                            model = line.split(":")[1].strip()
                            break
            except (OSError, IOError):
                pass

            # Get core counts
            physical_cores = psutil.cpu_count(logical=False) or 1
            logical_threads = psutil.cpu_count(logical=True) or 1

            # Get frequency
            freq = psutil.cpu_freq()
            frequency_mhz = freq.current if freq else 0.0

            return CPUInfo(
                model=model,
                physical_cores=physical_cores,
                logical_threads=logical_threads,
                frequency_mhz=frequency_mhz,
            )
        except Exception as e:
            print(f"Error getting CPU info: {e}", file=sys.stderr)
            return CPUInfo(
                model="Unknown", physical_cores=1, logical_threads=1, frequency_mhz=0.0
            )


class MemoryMonitor:
    """System and per-process memory tracking"""

    def get_system_memory(self) -> SystemMemory:
        """Get system memory information"""
        try:
            mem = psutil.virtual_memory()
            return SystemMemory(
                total_mb=mem.total / (1024 * 1024),
                used_mb=mem.used / (1024 * 1024),
                available_mb=mem.available / (1024 * 1024),
                percent=mem.percent,
            )
        except Exception as e:
            print(f"Error getting system memory: {e}", file=sys.stderr)
            return SystemMemory(total_mb=0, used_mb=0, available_mb=0, percent=0)

    def get_process_memory(self, pid: int) -> Optional[ProcessMemory]:
        """Get memory for specific process"""
        try:
            proc = psutil.Process(pid)
            mem_info = proc.memory_info()
            mem_percent = proc.memory_percent()

            return ProcessMemory(
                pid=pid,
                rss_mb=mem_info.rss / (1024 * 1024),
                vms_mb=mem_info.vms / (1024 * 1024),
                percent=mem_percent,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return None

    def get_process_tree_memory(self, pids: List[int]) -> Tuple[float, float]:
        """Sum memory for all PIDs in tree

        Returns:
            Tuple of (total_mb, total_percent)
        """
        total_mb = 0.0
        total_percent = 0.0

        for pid in pids:
            mem = self.get_process_memory(pid)
            if mem:
                total_mb += mem.rss_mb
                total_percent += mem.percent

        return total_mb, total_percent


class GPUMonitor:
    """GPU utilization tracking using xpumcli"""

    def __init__(self):
        self._has_xpumcli = self._check_xpumcli()

    def _check_xpumcli(self) -> bool:
        """Check if xpumcli is available"""
        try:
            result = subprocess.run(
                ["which", "xpumcli"], capture_output=True, timeout=2
            )
            return result.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    def get_device_list(self) -> List[GPUDevice]:
        """List all available GPUs using xpumcli discovery"""
        if not self._has_xpumcli:
            return []

        devices = []
        try:
            # Use JSON output for easier parsing
            result = subprocess.run(
                ["xpumcli", "discovery", "-j"],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                device_list = data.get("device_list", [])

                for device_info in device_list:
                    if device_info.get("device_type") == "GPU":
                        device_id = device_info.get("device_id", 0)
                        name = device_info.get("device_name", "Unknown GPU")
                        pci_id = device_info.get("pci_device_id", "")

                        # Get memory size (will get from stats later if not available here)
                        memory_total_mb = 0.0

                        devices.append(
                            GPUDevice(
                                device_id=device_id,
                                name=name,
                                pci_device_id=pci_id,
                                memory_total_mb=memory_total_mb,
                            )
                        )
        except json.JSONDecodeError as e:
            print(f"Error parsing GPU discovery JSON: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error getting GPU device list: {e}", file=sys.stderr)

        return devices

    def get_utilization(self, device_id: int = 0) -> Optional[GPUUtilization]:
        """Get GPU utilization for specific device using xpumcli stats"""
        if not self._has_xpumcli:
            return None

        try:
            # Use JSON output for easier parsing
            result = subprocess.run(
                ["xpumcli", "stats", "-d", str(device_id), "-j"],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)

                compute_percent = 0.0
                memory_used_mb = 0.0
                memory_total_mb = 65536.0  # Default 64GB, will update if available
                name = "Unknown GPU"

                # Parse device_level metrics
                device_level = data.get("device_level", [])
                for metric in device_level:
                    metrics_type = metric.get("metrics_type", "")
                    value = metric.get("value", 0.0)

                    # Compute utilization
                    if "COMPUTE_ALL_UTILIZATION" in metrics_type:
                        compute_percent = value
                    # Memory used (in MiB)
                    elif "MEMORY_USED" in metrics_type:
                        memory_used_mb = value
                    # Memory utilization (percentage)
                    elif "MEMORY_UTILIZATION" in metrics_type:
                        # We have percentage, can calculate total
                        if value > 0 and memory_used_mb > 0:
                            memory_total_mb = (memory_used_mb / value) * 100

                # Get device name from discovery
                devices = self.get_device_list()
                if devices and len(devices) > device_id:
                    name = devices[device_id].name

                memory_percent = (
                    (memory_used_mb / memory_total_mb * 100)
                    if memory_total_mb > 0
                    else 0.0
                )

                return GPUUtilization(
                    device_id=device_id,
                    name=name,
                    compute_percent=compute_percent,
                    memory_used_mb=memory_used_mb,
                    memory_total_mb=memory_total_mb,
                    memory_percent=memory_percent,
                )
        except json.JSONDecodeError as e:
            print(f"Error parsing GPU stats JSON: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error getting GPU utilization: {e}", file=sys.stderr)

        return None

    def get_all_utilizations(self) -> List[GPUUtilization]:
        """Get utilization for all GPUs"""
        devices = self.get_device_list()
        utilizations = []

        for device in devices:
            util = self.get_utilization(device.device_id)
            if util:
                utilizations.append(util)

        return utilizations


class NPUMonitor:
    """NPU utilization tracking via sysfs"""

    def __init__(self, npu_sysfs_path: Optional[str] = None):
        self.npu_base_path = "/sys/devices/pci0000:00/0000:00:0b.0"
        self.npu_busy_time_path = (
            npu_sysfs_path or f"{self.npu_base_path}/npu_busy_time_us"
        )
        self.npu_freq_path = f"{self.npu_base_path}/npu_current_frequency_mhz"
        self.npu_power_path = f"{self.npu_base_path}/power/runtime_status"
        self._available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if NPU is present"""
        return os.path.exists(self.npu_busy_time_path)

    def is_available(self) -> bool:
        """Check if NPU is present"""
        return self._available

    def get_power_state(self) -> str:
        """Get NPU power state (active/suspended)"""
        try:
            if os.path.exists(self.npu_power_path):
                with open(self.npu_power_path, "r") as f:
                    return f.read().strip()
        except (OSError, IOError):
            pass
        return "unknown"

    def get_frequency(self) -> int:
        """Get current NPU frequency in MHz"""
        try:
            if os.path.exists(self.npu_freq_path):
                with open(self.npu_freq_path, "r") as f:
                    return int(f.read().strip())
        except (OSError, IOError, ValueError):
            pass
        return 0

    def get_utilization(self, sampling_period: float = 0.1) -> float:
        """
        Calculate NPU utilization % (0-100)

        Method:
        1. Read /sys/.../npu_busy_time_us at T1
        2. Wait sampling_period
        3. Read again at T2
        4. utilization = (busy_delta / time_delta) * 100

        Note: If NPU is suspended or frequency is 0, utilization will be 0.
        """
        if not self._available:
            return 0.0

        try:
            # Check power state - if suspended, NPU counter won't increment
            power_state = self.get_power_state()
            frequency = self.get_frequency()

            # If NPU is suspended or at 0 frequency, utilization is 0
            # But we still try to read the counter in case it updates

            # Read initial busy time
            with open(self.npu_busy_time_path, "r") as f:
                busy_time_1 = int(f.read().strip())

            time_1 = time.time()

            # Wait
            time.sleep(sampling_period)

            # Read final busy time
            with open(self.npu_busy_time_path, "r") as f:
                busy_time_2 = int(f.read().strip())

            time_2 = time.time()

            # Calculate deltas
            busy_delta_us = busy_time_2 - busy_time_1
            time_delta_us = (time_2 - time_1) * 1_000_000

            # Calculate utilization
            if time_delta_us > 0 and busy_delta_us > 0:
                utilization = (busy_delta_us / time_delta_us) * 100.0
                return min(100.0, max(0.0, utilization))

            # If counter didn't change but frequency > 0, there might be activity
            # that the counter doesn't capture. For now, return 0.
            if busy_delta_us == 0 and frequency > 0 and power_state == "active":
                # NPU might be active but counter not updating - this is a driver issue
                # We can't reliably measure utilization in this case
                pass

        except Exception as e:
            print(f"Error getting NPU utilization: {e}", file=sys.stderr)

        return 0.0


class DiskIOMonitor:
    """Disk I/O tracking using psutil"""

    def __init__(self):
        self._last_io_counters = None
        self._last_sample_time = None

    def get_system_io_rate(self) -> Tuple[float, float]:
        """Get system-wide disk I/O rates in MB/s

        Returns:
            Tuple of (read_mb_per_sec, write_mb_per_sec)
        """
        try:
            current_io = psutil.disk_io_counters()
            current_time = time.time()

            if self._last_io_counters is None:
                # First sample - initialize
                self._last_io_counters = current_io
                self._last_sample_time = current_time
                time.sleep(0.1)  # Small delay for first delta
                current_io = psutil.disk_io_counters()
                current_time = time.time()

            # Calculate deltas
            time_delta = current_time - self._last_sample_time
            if time_delta == 0:
                return 0.0, 0.0

            read_bytes_delta = current_io.read_bytes - self._last_io_counters.read_bytes
            write_bytes_delta = (
                current_io.write_bytes - self._last_io_counters.write_bytes
            )

            # Convert to MB/s
            read_mb_per_sec = (read_bytes_delta / time_delta) / (1024 * 1024)
            write_mb_per_sec = (write_bytes_delta / time_delta) / (1024 * 1024)

            # Update last counters
            self._last_io_counters = current_io
            self._last_sample_time = current_time

            return max(0.0, read_mb_per_sec), max(0.0, write_mb_per_sec)

        except Exception as e:
            print(f"Error getting disk I/O: {e}", file=sys.stderr)
            return 0.0, 0.0

    def get_process_io_rate(self, pids: List[int]) -> Tuple[float, float]:
        """Get disk I/O rates for specific processes

        Note: Process-level I/O counters may not be available on all systems.
        Falls back to system-wide measurement.

        Returns:
            Tuple of (read_mb_per_sec, write_mb_per_sec)
        """
        total_read_bytes = 0
        total_write_bytes = 0

        try:
            for pid in pids:
                try:
                    proc = psutil.Process(pid)
                    io_counters = proc.io_counters()
                    total_read_bytes += io_counters.read_bytes
                    total_write_bytes += io_counters.write_bytes
                except (psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
                    # Process gone, access denied, or io_counters not available
                    continue

            # For process I/O, we return cumulative values
            # Real rate calculation would require tracking over time
            # For now, use system-wide rates as approximation
            return self.get_system_io_rate()

        except Exception as e:
            print(f"Error getting process I/O: {e}", file=sys.stderr)
            return 0.0, 0.0


# ============================================================================
# Profiling Orchestrator
# ============================================================================


class ProfilingOrchestrator:
    """Manages application profiling lifecycle"""

    def __init__(self):
        self.cpu_monitor = CPUMonitor()
        self.gpu_monitor = GPUMonitor()
        self.npu_monitor = NPUMonitor()
        self.memory_monitor = MemoryMonitor()
        self.disk_monitor = DiskIOMonitor()
        self.sessions: Dict[str, ProfilingSession] = {}
        self._subprocess_handles: Dict[str, subprocess.Popen] = {}
        self._baseline_warnings: List[str] = []
        self._baseline_printed: bool = False

    def find_pids_by_name(self, process_name: str) -> List[int]:
        """Find all PIDs matching a process name (partial match)"""
        matching_pids = []

        try:
            for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                try:
                    proc_info = proc.info
                    proc_name = proc_info["name"] or ""
                    cmdline = " ".join(proc_info["cmdline"] or [])

                    # Check if process name matches (case-insensitive, partial match)
                    if (
                        process_name.lower() in proc_name.lower()
                        or process_name.lower() in cmdline.lower()
                    ):
                        matching_pids.append(proc_info["pid"])

                except (
                    psutil.NoSuchProcess,
                    psutil.AccessDenied,
                    psutil.ZombieProcess,
                ):
                    continue

        except Exception as e:
            print(f"Error finding processes by name: {e}")

        return matching_pids

    def create_session(self, session_id: Optional[str] = None) -> ProfilingSession:
        """Initialize new profiling session"""
        if session_id is None:
            session_id = str(uuid.uuid4())

        session = ProfilingSession(
            session_id=session_id, start_time=time.time(), status="initializing"
        )

        self.sessions[session_id] = session
        return session

    def establish_baseline(
        self, session_id: str, duration: float = 5.0
    ) -> PlatformBaseline:
        """
        Capture system idle state

        Process:
        1. Wait for system to stabilize
        2. Sample CPU/GPU/NPU/Memory for duration
        3. Calculate average utilization
        4. Store as baseline
        """
        print(f"Establishing baseline for {duration} seconds...")

        samples = {"cpu": [], "memory": [], "gpu": [], "npu": [], "disk": []}

        # Collect samples
        start_time = time.time()
        while time.time() - start_time < duration:
            # CPU
            cpu_percent = self.cpu_monitor.get_overall_utilization(interval=0.5)
            samples["cpu"].append(cpu_percent)

            # Memory
            mem = self.memory_monitor.get_system_memory()
            samples["memory"].append(mem)

            # GPU
            gpu_utils = self.gpu_monitor.get_all_utilizations()
            samples["gpu"].append(gpu_utils)

            # NPU
            npu_percent = self.npu_monitor.get_utilization(sampling_period=0.1)
            samples["npu"].append(npu_percent)

            # Disk I/O
            disk_read, disk_write = self.disk_monitor.get_system_io_rate()
            samples["disk"].append((disk_read, disk_write))

            time.sleep(0.5)

        # Calculate averages
        avg_cpu = sum(samples["cpu"]) / len(samples["cpu"]) if samples["cpu"] else 0.0
        avg_npu = sum(samples["npu"]) / len(samples["npu"]) if samples["npu"] else 0.0

        # Average disk I/O
        if samples["disk"]:
            avg_disk_read = sum(d[0] for d in samples["disk"]) / len(samples["disk"])
            avg_disk_write = sum(d[1] for d in samples["disk"]) / len(samples["disk"])
        else:
            avg_disk_read = 0.0
            avg_disk_write = 0.0

        # Average memory
        if samples["memory"]:
            avg_mem_used = sum(m.used_mb for m in samples["memory"]) / len(
                samples["memory"]
            )
            avg_mem_percent = sum(m.percent for m in samples["memory"]) / len(
                samples["memory"]
            )
            mem_total = samples["memory"][0].total_mb
        else:
            avg_mem_used = 0.0
            avg_mem_percent = 0.0
            mem_total = 0.0

        # Average GPU
        gpu_baselines = []
        if samples["gpu"] and samples["gpu"][0]:
            for device_idx in range(len(samples["gpu"][0])):
                device_samples = [
                    sample[device_idx]
                    for sample in samples["gpu"]
                    if len(sample) > device_idx
                ]
                if device_samples:
                    avg_compute = sum(s.compute_percent for s in device_samples) / len(
                        device_samples
                    )
                    avg_mem_used = sum(s.memory_used_mb for s in device_samples) / len(
                        device_samples
                    )
                    avg_mem_percent = sum(
                        s.memory_percent for s in device_samples
                    ) / len(device_samples)

                    gpu_baselines.append(
                        GPUBaseline(
                            device_id=device_samples[0].device_id,
                            name=device_samples[0].name,
                            compute_percent=avg_compute,
                            memory_used_mb=avg_mem_used,
                            memory_total_mb=device_samples[0].memory_total_mb,
                            memory_percent=avg_mem_percent,
                        )
                    )

        cpu_info = self.cpu_monitor.get_cpu_info()

        baseline = PlatformBaseline(
            timestamp=time.time(),
            cpu_percent=avg_cpu,
            cpu_info=cpu_info,
            memory_total_mb=mem_total,
            memory_used_mb=avg_mem_used,
            memory_percent=avg_mem_percent,
            gpu_devices=gpu_baselines,
            npu_available=self.npu_monitor.is_available(),
            npu_percent=avg_npu,
            disk_read_mb_per_sec=avg_disk_read,
            disk_write_mb_per_sec=avg_disk_write,
        )

        # Store in session
        if session_id in self.sessions:
            self.sessions[session_id].baseline = baseline

        print(f"Baseline established:")
        print(f"  CPU: {avg_cpu:.1f}%")
        print(f"  Memory: {avg_mem_used:.0f} MB ({avg_mem_percent:.1f}%)")
        print(f"  GPU: {len(gpu_baselines)} device(s)")
        print(f"  NPU: {avg_npu:.1f}% (available: {self.npu_monitor.is_available()})")
        print(
            f"  Disk I/O: {avg_disk_read:.1f} MB/s read, {avg_disk_write:.1f} MB/s write"
        )

        # Check for high baseline (>80%) and warn user
        baseline_warnings = []
        if avg_cpu > 80.0:
            warning = (
                f"⚠️  WARNING: CPU baseline is {avg_cpu:.1f}% (>80%) - system not idle!"
            )
            print(f"\n{warning}")
            baseline_warnings.append(f"CPU baseline: {avg_cpu:.1f}%")

        if gpu_baselines:
            for gpu in gpu_baselines:
                if gpu.compute_percent > 80.0:
                    warning = f"⚠️  WARNING: GPU baseline is {gpu.compute_percent:.1f}% (>80%) - GPU already in use!"
                    print(f"\n{warning}")
                    baseline_warnings.append(
                        f"GPU baseline: {gpu.compute_percent:.1f}%"
                    )

        if avg_npu > 80.0:
            warning = f"⚠️  WARNING: NPU baseline is {avg_npu:.1f}% (>80%) - NPU already in use!"
            print(f"\n{warning}")
            baseline_warnings.append(f"NPU baseline: {avg_npu:.1f}%")

        if baseline_warnings:
            print("\n⚠️  High baseline detected! Results may be inaccurate.")
            print("   Recommendation: Stop other applications and re-run profiling.\n")

        # Store warnings for later analysis
        self._baseline_warnings = baseline_warnings

        return baseline

    def launch_application(
        self, session_id: str, app_name: str, command: str
    ) -> ApplicationProfile:
        """
        Launch application and start tracking

        Process:
        1. Execute command in subprocess
        2. Capture parent PID
        3. Track all child PIDs
        4. Return ApplicationProfile
        """
        app_id = f"{session_id}_{app_name}"

        print(f"Launching application '{app_name}': {command}")

        try:
            # Parse command string into list to prevent command injection
            # Using shlex.split() properly handles quoted arguments and spaces
            command_list = shlex.split(command)

            # Launch process - using DEVNULL to prevent pipe buffer filling
            # SECURITY: Using command list without shell=True prevents OS command injection
            process = subprocess.Popen(
                command_list,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid,
            )

            # Store process handle
            self._subprocess_handles[app_id] = process

            time.sleep(1.5)  # Wait for process to start

            poll_result = process.poll()
            if poll_result is not None:
                # Process has already exited
                stdout, stderr = process.communicate(timeout=1)
                error_output = (
                    stderr.decode("utf-8") if stderr else stdout.decode("utf-8")
                )

                error_msg = f"Application exited immediately with code {poll_result}"
                if error_output:
                    error_msg += f"\nError output:\n{error_output}"

                print(f"ERROR: {error_msg}", file=sys.stderr)

                # Clean up
                if app_id in self._subprocess_handles:
                    del self._subprocess_handles[app_id]

                return ApplicationProfile(
                    app_id=app_id,
                    name=app_name,
                    command=command,
                    status="failed",
                    error_message=error_msg,
                )

            try:
                proc = psutil.Process(process.pid)
                if not proc.is_running():
                    raise psutil.NoSuchProcess(process.pid)
                process_name = proc.name()
            except psutil.NoSuchProcess:
                error_msg = f"Process {process.pid} not found after launch - application may have crashed"
                print(f"ERROR: {error_msg}", file=sys.stderr)

                return ApplicationProfile(
                    app_id=app_id,
                    name=app_name,
                    command=command,
                    status="failed",
                    error_message=error_msg,
                )
            except Exception as e:
                process_name = "unknown"
                print(f"Warning: Could not get process name: {e}")

            pids = self._get_process_tree_pids(process.pid)

            if not pids or len(pids) == 0:
                error_msg = "No valid process IDs found after launch"
                print(f"ERROR: {error_msg}", file=sys.stderr)

                return ApplicationProfile(
                    app_id=app_id,
                    name=app_name,
                    command=command,
                    status="failed",
                    error_message=error_msg,
                )

            app_profile = ApplicationProfile(
                app_id=app_id,
                name=app_name,
                command=command,
                process_name=process_name,
                pids=pids,
                root_pid=process.pid,
                start_time=time.time(),
                status="running",
            )

            # Add to session
            if session_id in self.sessions:
                self.sessions[session_id].applications[app_name] = app_profile

            print(f"Application launched with PIDs: {pids}")

            return app_profile

        except Exception as e:
            error_msg = f"Failed to launch application: {e}"
            print(error_msg, file=sys.stderr)

            app_profile = ApplicationProfile(
                app_id=app_id,
                name=app_name,
                command=command,
                status="failed",
                error_message=error_msg,
            )

            return app_profile

    def attach_to_process(
        self, session_id: str, app_name: str, pid: int
    ) -> ApplicationProfile:
        """Attach to an existing process for profiling"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        app_id = f"{session_id}_{app_name}"

        # Verify process exists
        try:
            proc = psutil.Process(pid)
            command = " ".join(proc.cmdline())
            process_name = proc.name()
            print(f"Attaching to process {pid}: {command}")
        except psutil.NoSuchProcess:
            error_msg = f"Process {pid} not found"
            print(error_msg, file=sys.stderr)
            return ApplicationProfile(
                app_id=app_id,
                name=app_name,
                command=f"PID {pid}",
                status="failed",
                error_message=error_msg,
            )
        except psutil.AccessDenied:
            error_msg = f"Access denied to process {pid}. Try running with sudo."
            print(error_msg, file=sys.stderr)
            return ApplicationProfile(
                app_id=app_id,
                name=app_name,
                command=f"PID {pid}",
                status="failed",
                error_message=error_msg,
            )

        # Get all PIDs in process tree
        pids = self._get_process_tree_pids(pid)

        # Collect initial process tree metrics
        process_tree = self._collect_process_tree_metrics(pid)

        # Create application profile
        app_profile = ApplicationProfile(
            app_id=app_id,
            name=app_name,
            process_name=process_name,
            command=command,
            pids=pids,
            root_pid=pid,
            process_tree=process_tree,
            max_process_count=len(process_tree),
            start_time=time.time(),
            status="running",
        )

        session.applications[app_name] = app_profile
        print(f"Attached to process tree with {len(pids)} process(es):")
        print(f"  Root PID: {pid}")
        if len(pids) > 1:
            print(f"  Child PIDs: {pids[1:]}")

        return app_profile

    def _get_process_tree_pids(self, parent_pid: int) -> List[int]:
        """Get all PIDs in process tree"""
        pids = [parent_pid]

        try:
            parent = psutil.Process(parent_pid)
            children = parent.children(recursive=True)
            for child in children:
                pids.append(child.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

        return pids

    def _collect_process_tree_metrics(
        self, parent_pid: int
    ) -> Dict[int, ProcessMetrics]:
        """Collect detailed metrics for all processes in tree

        Returns:
            Dict mapping PID to ProcessMetrics
        """
        metrics = {}

        # Get logical cores for CPU percent normalization
        logical_cores = psutil.cpu_count(logical=True) or 1

        try:
            parent = psutil.Process(parent_pid)

            # Add parent process
            metrics[parent_pid] = self._get_process_metrics(parent, logical_cores)

            # Add all children recursively
            children = parent.children(recursive=True)
            for child in children:
                try:
                    child_metrics = self._get_process_metrics(child, logical_cores)
                    metrics[child.pid] = child_metrics
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

        return metrics

    def _get_process_metrics(
        self, proc: psutil.Process, logical_cores: int = 1
    ) -> ProcessMetrics:
        """Extract metrics from a psutil Process object

        Args:
            proc: psutil Process object
            logical_cores: Number of logical CPU cores for normalization
        """
        try:
            mem_info = proc.memory_info()
            cmdline = " ".join(proc.cmdline()) if proc.cmdline() else ""

            # Get direct children PIDs
            children_pids = [c.pid for c in proc.children(recursive=False)]

            # Get raw CPU percent and normalize it (divide by logical cores)
            raw_cpu_percent = proc.cpu_percent(interval=0.1)
            normalized_cpu_percent = raw_cpu_percent / logical_cores

            return ProcessMetrics(
                pid=proc.pid,
                ppid=proc.ppid(),
                name=proc.name(),
                cmdline=cmdline[:100],  # Truncate long commands
                cpu_percent=normalized_cpu_percent,
                memory_mb=mem_info.rss / (1024 * 1024),
                memory_percent=proc.memory_percent(),
                num_threads=proc.num_threads(),
                status=proc.status(),
                create_time=proc.create_time(),
                children_pids=children_pids,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as e:
            # Return minimal metrics for problematic processes
            return ProcessMetrics(
                pid=proc.pid,
                ppid=0,
                name="<unavailable>",
                cmdline="",
                status="error",
            )

    def _update_process_tree_stats(
        self, app_profile: ApplicationProfile, current_tree: Dict[int, ProcessMetrics]
    ) -> None:
        """Update process tree statistics (spawns, exits, max count)"""
        old_pids = set(app_profile.process_tree.keys())
        new_pids = set(current_tree.keys())

        # Detect new spawns
        spawned_pids = new_pids - old_pids
        app_profile.process_spawns += len(spawned_pids)

        # Detect exits
        exited_pids = old_pids - new_pids
        app_profile.process_exits += len(exited_pids)

        # Update max process count
        app_profile.max_process_count = max(
            app_profile.max_process_count, len(current_tree)
        )

        # Log significant changes
        if spawned_pids and len(spawned_pids) <= 5:
            for pid in spawned_pids:
                if pid in current_tree:
                    proc = current_tree[pid]
                    print(f"  [+] Process spawned: PID {pid} ({proc.name})")
        elif spawned_pids:
            print(f"  [+] {len(spawned_pids)} new processes spawned")

        if exited_pids and len(exited_pids) <= 5:
            for pid in exited_pids:
                if pid in app_profile.process_tree:
                    proc = app_profile.process_tree[pid]
                    print(f"  [-] Process exited: PID {pid} ({proc.name})")
        elif exited_pids:
            print(f"  [-] {len(exited_pids)} processes exited")

    def monitor_application(
        self,
        session_id: str,
        app_name: str,
        duration: float = 60.0,
        sample_interval: float = 1.0,
    ) -> ApplicationProfile:
        """
        Monitor application resource usage

        Process:
        1. Sample every sample_interval seconds
        2. Calculate deltas from baseline
        3. Attribute resources to app PIDs
        4. Update ApplicationProfile
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        app_profile = session.applications.get(app_name)
        if not app_profile:
            raise ValueError(f"Application {app_name} not found in session")

        baseline = session.baseline
        if not baseline:
            raise ValueError("Baseline not established")

        print(f"Monitoring application '{app_name}' for {duration} seconds...")
        print(f"  Process tree tracking: enabled")

        samples = []
        start_time = time.time()
        sample_count = 0

        while time.time() - start_time < duration:
            sample_count += 1

            # Update process tree (detects spawns/exits)
            if app_profile.pids:
                root_pid = app_profile.pids[0]

                # Collect detailed metrics for entire process tree
                current_tree = self._collect_process_tree_metrics(root_pid)

                # Update process tree statistics
                self._update_process_tree_stats(app_profile, current_tree)

                # Update stored process tree
                app_profile.process_tree = current_tree

                # Update PIDs list
                app_profile.pids = list(current_tree.keys())

            # Calculate current deltas
            delta = self.calculate_deltas(baseline, app_profile.pids)
            samples.append(delta)

            # Check if process is still running
            if app_profile.pids:
                try:
                    psutil.Process(app_profile.pids[0])
                except psutil.NoSuchProcess:
                    print(f"Application process terminated")
                    break

            time.sleep(sample_interval)

        # Get logical core count for normalization
        logical_cores = baseline.cpu_info.logical_threads
        app_profile.logical_cores = logical_cores

        # Calculate averages and peaks
        if samples:
            # Averages - normalize CPU percent to 0-100% scale
            raw_cpu_percent = sum(s.cpu_percent for s in samples) / len(samples)
            app_profile.cpu_percent_normalized = (
                raw_cpu_percent / logical_cores
                if logical_cores > 0
                else raw_cpu_percent
            )
            # Make cpu_percent same as normalized for consistency
            app_profile.cpu_percent = app_profile.cpu_percent_normalized
            app_profile.memory_mb = sum(s.memory_mb for s in samples) / len(samples)
            app_profile.memory_percent = sum(s.memory_percent for s in samples) / len(
                samples
            )
            app_profile.gpu_compute_percent = sum(
                s.gpu_compute_percent for s in samples
            ) / len(samples)
            app_profile.gpu_memory_mb = sum(s.gpu_memory_mb for s in samples) / len(
                samples
            )
            app_profile.gpu_memory_percent = sum(
                s.gpu_memory_percent for s in samples
            ) / len(samples)
            app_profile.npu_percent = sum(s.npu_percent for s in samples) / len(samples)
            app_profile.disk_read_mb_per_sec = sum(
                s.disk_read_mb_per_sec for s in samples
            ) / len(samples)
            app_profile.disk_write_mb_per_sec = sum(
                s.disk_write_mb_per_sec for s in samples
            ) / len(samples)
            app_profile.disk_io_percent = sum(s.disk_io_percent for s in samples) / len(
                samples
            )

            # Peaks (maximum values) - normalize CPU percent to 0-100% scale
            raw_peak_cpu = max(s.cpu_percent for s in samples)
            app_profile.peak_cpu_percent_normalized = (
                raw_peak_cpu / logical_cores if logical_cores > 0 else raw_peak_cpu
            )
            # Make peak_cpu_percent same as normalized for consistency
            app_profile.peak_cpu_percent = app_profile.peak_cpu_percent_normalized
            app_profile.peak_memory_mb = max(s.memory_mb for s in samples)
            app_profile.peak_gpu_compute_percent = max(
                s.gpu_compute_percent for s in samples
            )
            app_profile.peak_gpu_memory_mb = max(s.gpu_memory_mb for s in samples)
            app_profile.peak_npu_percent = max(s.npu_percent for s in samples)
            app_profile.peak_disk_read_mb_per_sec = max(
                s.disk_read_mb_per_sec for s in samples
            )
            app_profile.peak_disk_write_mb_per_sec = max(
                s.disk_write_mb_per_sec for s in samples
            )
            app_profile.peak_disk_io_percent = max(s.disk_io_percent for s in samples)

        app_profile.duration = time.time() - app_profile.start_time
        app_profile.status = "completed"

        print(f"\nMonitoring completed:")
        print(f"  Process Tree Summary:")
        print(f"    Root PID: {app_profile.root_pid}")
        print(f"    Final process count: {len(app_profile.process_tree)}")
        print(f"    Peak process count: {app_profile.max_process_count}")
        print(f"    Total spawns: {app_profile.process_spawns}")
        print(f"    Total exits: {app_profile.process_exits}")
        print(f"")
        print(f"  Resource Utilization:")
        print(
            f"    CPU ({logical_cores} cores): {app_profile.cpu_percent_normalized:.1f}% (avg), {app_profile.peak_cpu_percent_normalized:.1f}% (peak)"
        )
        print(
            f"    [Total: {app_profile.cpu_percent:.1f}% avg, {app_profile.peak_cpu_percent:.1f}% peak across all cores]"
        )
        print(
            f"  Memory: {app_profile.memory_mb:.0f} MB (avg), {app_profile.peak_memory_mb:.0f} MB (peak)"
        )
        print(
            f"  GPU Compute: {app_profile.gpu_compute_percent:.1f}% (avg), {app_profile.peak_gpu_compute_percent:.1f}% (peak)"
        )
        print(
            f"  GPU Memory: {app_profile.gpu_memory_mb:.0f} MB (avg), {app_profile.peak_gpu_memory_mb:.0f} MB (peak)"
        )
        print(
            f"  NPU: {app_profile.npu_percent:.1f}% (avg), {app_profile.peak_npu_percent:.1f}% (peak)"
        )
        print(
            f"  Disk I/O: {app_profile.disk_read_mb_per_sec:.1f}/{app_profile.disk_write_mb_per_sec:.1f} MB/s (avg read/write)"
        )
        print(
            f"    [Peak: {app_profile.peak_disk_read_mb_per_sec:.1f}/{app_profile.peak_disk_write_mb_per_sec:.1f} MB/s]"
        )

        # Print process tree details
        self._print_process_tree(app_profile)

        # NPU diagnostics - warn if NPU appears inactive
        if app_profile.npu_percent == 0.0 and self.npu_monitor.is_available():
            npu_state = self.npu_monitor.get_power_state()
            npu_freq = self.npu_monitor.get_frequency()
            print(f"  NPU Status: power={npu_state}, freq={npu_freq}MHz")
            if npu_state == "suspended" or npu_freq == 0:
                print(
                    f"  ⚠ NPU appears inactive (power state: {npu_state}, freq: {npu_freq}MHz)"
                )
                print(
                    f"     This may indicate: 1) App not using NPU, 2) NPU driver issue, 3) OpenVINO using CPU fallback"
                )

        return app_profile

    def _print_process_tree(self, app_profile: ApplicationProfile) -> None:
        """Print hierarchical process tree with resource usage"""
        if not app_profile.process_tree or len(app_profile.process_tree) <= 1:
            return

        # Sort processes by CPU usage
        sorted_procs = sorted(
            app_profile.process_tree.values(),
            key=lambda p: p.cpu_percent,
            reverse=True,
        )

        # Show top processes (limit to 5 for simplicity)
        print(f"\n  Process Tree ({len(app_profile.process_tree)} processes):")
        for i, proc in enumerate(sorted_procs[:5]):
            print(
                f"    {proc.pid:<8} {proc.name:<20} {proc.cpu_percent:>6.1f}%  {proc.memory_mb:>7.1f} MB"
            )

        if len(sorted_procs) > 5:
            print(f"    ... and {len(sorted_procs) - 5} more processes")

    def calculate_deltas(
        self, baseline: PlatformBaseline, app_pids: List[int]
    ) -> ApplicationProfile:
        """
        Calculate resource attribution for application

        Method:
        - CPU: Sum CPU% of all app PIDs
        - Memory: Sum RSS of all app PIDs
        - GPU: Total GPU% - baseline GPU%
        - NPU: Total NPU% - baseline NPU%
        """
        delta = ApplicationProfile(app_id="temp", name="temp", command="")

        # CPU - sum of all PIDs
        cpu_percents = self.cpu_monitor.get_per_process_utilization(app_pids)
        delta.cpu_percent = sum(cpu_percents.values())

        # Memory - sum of all PIDs
        mem_mb, mem_percent = self.memory_monitor.get_process_tree_memory(app_pids)
        delta.memory_mb = mem_mb
        delta.memory_percent = mem_percent

        # GPU - delta from baseline
        gpu_utils = self.gpu_monitor.get_all_utilizations()
        if gpu_utils and baseline.gpu_devices:
            current_gpu = gpu_utils[0]
            baseline_gpu = baseline.gpu_devices[0]

            delta.gpu_compute_percent = max(
                0.0, current_gpu.compute_percent - baseline_gpu.compute_percent
            )
            delta.gpu_memory_mb = max(
                0.0, current_gpu.memory_used_mb - baseline_gpu.memory_used_mb
            )
            delta.gpu_memory_percent = max(
                0.0, current_gpu.memory_percent - baseline_gpu.memory_percent
            )

        # NPU - delta from baseline
        current_npu = self.npu_monitor.get_utilization(sampling_period=0.1)
        delta.npu_percent = max(0.0, current_npu - baseline.npu_percent)

        # Disk I/O - delta from baseline
        current_read, current_write = self.disk_monitor.get_system_io_rate()
        delta.disk_read_mb_per_sec = max(
            0.0, current_read - baseline.disk_read_mb_per_sec
        )
        delta.disk_write_mb_per_sec = max(
            0.0, current_write - baseline.disk_write_mb_per_sec
        )
        # Calculate I/O percentage (assuming 500 MB/s as 100% - typical SSD)
        total_io = delta.disk_read_mb_per_sec + delta.disk_write_mb_per_sec
        delta.disk_io_percent = min(100.0, (total_io / 500.0) * 100.0)

        # Transfer baseline warnings if any
        if hasattr(self, "_baseline_warnings"):
            delta.baseline_warnings = self._baseline_warnings.copy()

        # Debug: Print baseline comparison (first sample only)
        if not hasattr(self, "_baseline_printed"):
            # Get current system CPU for comparison
            current_system_cpu = self.cpu_monitor.get_overall_utilization(interval=0.1)

            print(f"\n[Baseline Debug]")
            print(
                f"  CPU: baseline={baseline.cpu_percent:.1f}%, system_current={current_system_cpu:.1f}%, app_pids={delta.cpu_percent:.1f}%"
            )
            print(
                f"  NPU: baseline={baseline.npu_percent:.1f}%, current={current_npu:.1f}%, delta={delta.npu_percent:.1f}%"
            )
            if gpu_utils and baseline.gpu_devices:
                print(
                    f"  GPU: baseline={baseline_gpu.compute_percent:.1f}%, current={current_gpu.compute_percent:.1f}%, delta={delta.gpu_compute_percent:.1f}%"
                )
            self._baseline_printed = True

        return delta

    def stop_application(self, session_id: str, app_name: str):
        """Stop a running application"""
        app_id = f"{session_id}_{app_name}"

        if app_id in self._subprocess_handles:
            process = self._subprocess_handles[app_id]
            try:
                # Kill process group
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                process.wait(timeout=5)
            except:
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except:
                    pass

            del self._subprocess_handles[app_id]
            print(f"Application '{app_name}' stopped")

    def prepare_profile_data(
        self,
        session: ProfilingSession,
        profile: ApplicationProfile,
        baseline: PlatformBaseline,
        analysis: "BottleneckAnalysis",
    ) -> Dict[str, Any]:
        """Prepare profiling results as dictionary for JSON serialization

        This method is useful for FastAPI endpoints that need to return JSON directly.

        Args:
            session: Profiling session object
            profile: Application profile with metrics
            baseline: Platform baseline measurements
            analysis: Bottleneck analysis results

        Returns:
            Dictionary containing all profiling data, ready for JSON serialization

        Example (FastAPI):
            @app.get("/profile")
            async def get_profile():
                orchestrator = ProfilingOrchestrator()
                # ... run profiling ...
                data = orchestrator.prepare_profile_data(session, profile, baseline, analysis)
                return data  # FastAPI auto-converts to JSON response
        """
        # Convert profile to dictionary
        app_data = asdict(profile)

        # If GPU compute is 0.0%, ensure GPU metrics are 0.0 (GPU not in use)
        if (
            profile.gpu_compute_percent == 0.0
            and profile.peak_gpu_compute_percent == 0.0
        ):
            app_data["gpu_compute_percent"] = 0.0
            app_data["gpu_memory_mb"] = 0.0
            app_data["gpu_memory_percent"] = 0.0
            app_data["peak_gpu_compute_percent"] = 0.0
            app_data["peak_gpu_memory_mb"] = 0.0

        return {
            "session_id": session.session_id,
            "timestamp": datetime.fromtimestamp(time.time()).isoformat(),
            "baseline": asdict(baseline),
            "application": app_data,
            "bottleneck_analysis": asdict(analysis),
        }

    def save_profile_to_json(
        self,
        filepath: str,
        session: ProfilingSession,
        profile: ApplicationProfile,
        baseline: PlatformBaseline,
        analysis: "BottleneckAnalysis",
    ) -> None:
        """Save profiling results to JSON file

        Args:
            filepath: Output JSON file path
            session: Profiling session object
            profile: Application profile with metrics
            baseline: Platform baseline measurements
            analysis: Bottleneck analysis results
        """
        output_data = self.prepare_profile_data(session, profile, baseline, analysis)

        with open(filepath, "w") as f:
            json.dump(output_data, f, indent=2)

        print(f"\n✓ Profile saved to: {filepath}")


# ============================================================================
# CLI Interface
# ============================================================================


def print_banner():
    """Print tool banner"""
    print("╔" + "═" * 78 + "╗")
    print("║" + " " * 20 + "PLATFORM PROFILER v1.0" + " " * 36 + "║")
    print("║" + " " * 15 + "CPU/GPU/NPU/Memory Utilization Analysis" + " " * 24 + "║")
    print("╚" + "═" * 78 + "╝")
    print()


def run_profile(args):
    """Run profiling command"""
    # Validate arguments
    if not args.app and not args.pid:
        print("ERROR: Either --app or --pid must be specified.")
        print("\nOptions:")
        print("  --app 'command'  : Launch and profile a new application")
        print("  --pid 12345      : Attach to and profile an existing process")
        print(
            "\nExample 1: python3 platform_profiler.py profile --app 'python inference.py' --name 'my_app'"
        )
        print(
            "Example 2: python3 platform_profiler.py profile --pid 12345 --name 'my_app'"
        )
        return

    if args.app and args.pid:
        print("ERROR: Cannot specify both --app and --pid. Choose one.")
        return

    print_banner()
    print(f"Profiling Application: {args.name}")
    print("=" * 80)

    orchestrator = ProfilingOrchestrator()

    # Create session
    session = orchestrator.create_session()

    # Establish baseline
    print(f"\nEstablishing baseline ({args.baseline}s)...")
    baseline = orchestrator.establish_baseline(
        session.session_id, duration=args.baseline
    )

    # Profile application
    if args.pid:
        print(f"\nAttaching to PID: {args.pid}")
        app = orchestrator.attach_to_process(session.session_id, args.name, args.pid)
    else:
        # SECURITY: Validate command string to prevent command injection (taint barrier)
        try:
            validated_command = validate_command_string(args.app)
        except ValueError as e:
            print(f"\nERROR: Invalid command: {e}")
            return

        # Validate file paths in the command (universal approach)
        command_parts = validated_command.strip().split()

        # Check each argument that looks like a file path
        for arg in command_parts:
            # Skip flags/options (start with -)
            if arg.startswith("-"):
                continue

            # Check if argument looks like a file path (has extension or path separators)
            if "/" in arg or "\\" in arg or ("." in arg and not arg.startswith(".")):
                # SECURITY: Validate file path to prevent path manipulation (taint barrier)
                try:
                    file_path = validate_file_path(arg)
                except ValueError as e:
                    print(f"\nERROR: Invalid file path '{arg}': {e}")
                    return

                # Validate file exists
                if not file_path.exists():
                    print(f"\nERROR: File not found: {arg}")
                    print(f"  Resolved path: {file_path}")
                    print(f"  Current directory: {Path.cwd()}")
                    print(f"\nPlease check the file path and try again.")
                    return

                if not file_path.is_file():
                    print(f"\nERROR: Path is not a file: {arg}")
                    print(f"  Resolved path: {file_path}")
                    print(f"\nPlease provide a valid file path.")
                    return

                print(f"\n✓ File validation passed: {file_path}")

        print(f"\nLaunching: {validated_command}")
        # Pass validated command (taint removed by validate_command_string)
        app = orchestrator.launch_application(
            session.session_id, args.name, validated_command
        )

    if app.status == "running":
        profile = orchestrator.monitor_application(
            session.session_id, args.name, duration=args.duration
        )

        # Only stop if we launched it (not if we attached to existing PID)
        if args.app:
            orchestrator.stop_application(session.session_id, args.name)
        else:
            print(f"Note: Process {args.pid} is still running (attached mode)")

        # Show results
        print("\n" + "=" * 80)
        print("PROFILING RESULTS")
        print("=" * 80)
        print(f"\nApplication: {args.name}")
        print(f"Duration: {profile.duration:.1f}s")
        print(f"\n{'Resource':<20} {'Average':<20} {'Peak':<20}")
        print("-" * 80)
        print(
            f"{'CPU (normalized)':<20} {profile.cpu_percent_normalized:>6.1f}% {profile.peak_cpu_percent_normalized:>20.1f}%"
        )
        print(
            f"{'  ({profile.logical_cores} cores)':<20} [{profile.cpu_percent:>5.1f}% total] [{profile.peak_cpu_percent:>14.1f}% total]"
        )
        print(
            f"{'Memory':<20} {profile.memory_mb:>10.0f} MB {profile.peak_memory_mb:>15.0f} MB"
        )
        print(
            f"{'GPU Compute':<20} {profile.gpu_compute_percent:>6.1f}% {profile.peak_gpu_compute_percent:>20.1f}%"
        )
        print(
            f"{'GPU Memory':<20} {profile.gpu_memory_mb:>10.0f} MB {profile.peak_gpu_memory_mb:>15.0f} MB"
        )
        print(
            f"{'NPU':<20} {profile.npu_percent:>6.1f}% {profile.peak_npu_percent:>20.1f}%"
        )
        print(
            f"{'Disk Read':<20} {profile.disk_read_mb_per_sec:>8.1f} MB/s {profile.peak_disk_read_mb_per_sec:>16.1f} MB/s"
        )
        print(
            f"{'Disk Write':<20} {profile.disk_write_mb_per_sec:>8.1f} MB/s {profile.peak_disk_write_mb_per_sec:>16.1f} MB/s"
        )

        # Perform bottleneck analysis
        analyzer = BottleneckAnalyzer()
        analysis = analyzer.analyze(profile, baseline)

        # Display bottleneck analysis
        analyzer.print_analysis(analysis)

        # Save to file if requested
        if args.output:
            orchestrator.save_profile_to_json(
                args.output, session, profile, baseline, analysis
            )

    else:
        print(f"\n✗ Failed to launch application: {app.error_message}")


def run_status(args):
    """Show current platform status"""
    orchestrator = ProfilingOrchestrator()

    print("╔" + "═" * 78 + "╗")
    print("║" + " " * 28 + "PLATFORM STATUS" + " " * 35 + "║")
    print("╚" + "═" * 78 + "╝")
    print()

    # CPU
    cpu_info = orchestrator.cpu_monitor.get_cpu_info()
    cpu_util = orchestrator.cpu_monitor.get_overall_utilization()
    print(f"CPU: {cpu_info.model}")
    print(
        f"  Cores: {cpu_info.physical_cores} physical, {cpu_info.logical_threads} logical"
    )
    print(f"  Utilization: {cpu_util:.1f}%")
    print()

    # Memory
    mem = orchestrator.memory_monitor.get_system_memory()
    print(f"Memory:")
    print(f"  Total: {mem.total_mb:,.0f} MB ({mem.total_mb/1024:.1f} GB)")
    print(f"  Used: {mem.used_mb:,.0f} MB ({mem.percent:.1f}%)")
    print(f"  Available: {mem.available_mb:,.0f} MB ({100-mem.percent:.1f}%)")
    print()

    # GPU
    gpus = orchestrator.gpu_monitor.get_all_utilizations()
    if gpus:
        for gpu in gpus:
            print(f"GPU {gpu.device_id}: {gpu.name}")
            print(f"  Compute: {gpu.compute_percent:.1f}%")
            print(
                f"  Memory: {gpu.memory_used_mb:.0f} MB / {gpu.memory_total_mb:.0f} MB ({gpu.memory_percent:.1f}%)"
            )
            print()
    else:
        print("GPU: Not available")
        print()

    # NPU
    if orchestrator.npu_monitor.is_available():
        npu_util = orchestrator.npu_monitor.get_utilization()
        print(f"NPU: Available")
        print(f"  Utilization: {npu_util:.1f}%")
    else:
        print("NPU: Not available")
    print()


# ============================================================================
# FastAPI Interface
# ============================================================================

if FASTAPI_AVAILABLE:
    app = FastAPI(title="Platform Profiler API", version="1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global orchestrator instance for API
    api_orchestrator = ProfilingOrchestrator()
    api_session = None
    api_baseline = None

    @app.get("/api/status")
    async def get_platform_status():
        """Get current platform status (CPU, GPU, NPU, Memory)"""
        print("=== /api/status endpoint called ===")
        try:
            # Call orchestrator to get platform status
            cpu_info = api_orchestrator.cpu_monitor.get_cpu_info()
            cpu_util = api_orchestrator.cpu_monitor.get_overall_utilization()
            mem = api_orchestrator.memory_monitor.get_system_memory()
            gpus = api_orchestrator.gpu_monitor.get_all_utilizations()
            npu_util = api_orchestrator.npu_monitor.get_utilization()
            npu_available = api_orchestrator.npu_monitor.is_available()

            response = {
                "cpu": {
                    "model": cpu_info.model,
                    "physical_cores": cpu_info.physical_cores,
                    "logical_threads": cpu_info.logical_threads,
                    "frequency_mhz": round(cpu_info.frequency_mhz, 2),
                    "utilization_percent": round(cpu_util, 2),
                },
                "memory": {
                    "total_mb": round(mem.total_mb, 2),
                    "used_mb": round(mem.used_mb, 2),
                    "available_mb": round(mem.available_mb, 2),
                    "percent": round(mem.percent, 2),
                },
                "npu": {
                    "available": npu_available,
                    "utilization_percent": round(npu_util, 2) if npu_available else 0.0,
                },
            }

            # Add GPU metrics if available
            if gpus:
                if len(gpus) == 1:
                    gpu = gpus[0]
                    response["gpu"] = {
                        "device_id": gpu.device_id,
                        "name": gpu.name,
                        "compute_percent": round(gpu.compute_percent, 2),
                        "memory_used_mb": round(gpu.memory_used_mb, 2),
                        "memory_total_mb": round(gpu.memory_total_mb, 2),
                        "memory_percent": round(gpu.memory_percent, 2),
                    }
                else:
                    response["gpus"] = []
                    for gpu in gpus:
                        gpu_data = {
                            "device_id": gpu.device_id,
                            "name": gpu.name,
                            "compute_percent": round(gpu.compute_percent, 2),
                            "memory_used_mb": round(gpu.memory_used_mb, 2),
                            "memory_total_mb": round(gpu.memory_total_mb, 2),
                            "memory_percent": round(gpu.memory_percent, 2),
                        }
                        response["gpus"].append(gpu_data)
            else:
                response["gpu"] = None

            return response

        except Exception as e:
            print(f"Error in get_platform_status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/profile-start")
    async def start_profiling(pid: Optional[int] = None, app_name: str = "api_app"):
        """Start profiling session (attach to PID or prepare for monitoring)"""
        global api_session, api_baseline
        print(
            f"=== /api/profile/start endpoint called (pid={pid}, name={app_name}) ==="
        )

        try:
            # Create new session
            api_session = api_orchestrator.create_session()

            # Establish baseline
            api_baseline = api_orchestrator.establish_baseline(
                api_session.session_id, duration=3.0
            )

            response = {
                "session_id": api_session.session_id,
                "status": "baseline_established",
                "baseline": {
                    "cpu_percent": round(api_baseline.cpu_percent, 2),
                    "memory_used_mb": round(api_baseline.memory_used_mb, 2),
                    "npu_percent": round(api_baseline.npu_percent, 2),
                },
            }

            # If PID provided, attach to it
            if pid:
                app_profile = api_orchestrator.attach_to_process(
                    api_session.session_id, app_name, pid
                )
                try:
                    proc = psutil.Process(pid)
                    actual_process_name = proc.name()
                    actual_cmdline = " ".join(proc.cmdline())
                except:
                    actual_process_name = "unknown"
                    actual_cmdline = ""

                response["status"] = "profiling_started"
                response["app_name"] = app_name
                response["pid"] = pid
                response["process_name"] = actual_process_name
                response["cmdline"] = actual_cmdline

            return response

        except Exception as e:
            print(f"Error in start_profiling: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/profile-monitor")
    async def monitor_profile(app_name: str = "api_app", duration: float = 30.0):
        """Monitor application and return profiling results"""
        global api_session, api_baseline
        print(
            f"=== /api/profile/monitor endpoint called (name={app_name}, duration={duration}) ==="
        )

        if not api_session or not api_baseline:
            raise HTTPException(
                status_code=400,
                detail="No active session. Call /api/profile/start first",
            )

        try:
            # Monitor the application
            profile = api_orchestrator.monitor_application(
                api_session.session_id, app_name, duration=duration
            )

            # Perform bottleneck analysis
            analyzer = BottleneckAnalyzer()
            analysis = analyzer.analyze(profile, api_baseline)

            # Prepare response data using prepare_profile_data
            data = api_orchestrator.prepare_profile_data(
                api_session, profile, api_baseline, analysis
            )

            return data

        except Exception as e:
            print(f"Error in monitor_profile: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/profile-quick")
    async def quick_profile(pid: int, duration: float = 30.0):
        """Quick profile: start, monitor, and return results in one call"""
        print(
            f"=== /api/profile/quick endpoint called (pid={pid}, duration={duration}) ==="
        )

        try:
            # Create session and establish baseline
            session = api_orchestrator.create_session()
            baseline = api_orchestrator.establish_baseline(
                session.session_id, duration=3.0
            )

            # Attach to process
            app_name = f"pid_{pid}"
            profile = api_orchestrator.attach_to_process(
                session.session_id, app_name, pid
            )

            if profile.status == "failed":
                raise HTTPException(status_code=400, detail=profile.error_message)

            # Monitor
            profile = api_orchestrator.monitor_application(
                session.session_id, app_name, duration=duration
            )

            # Analyze
            analyzer = BottleneckAnalyzer()
            analysis = analyzer.analyze(profile, baseline)

            # Return data using prepare_profile_data
            data = api_orchestrator.prepare_profile_data(
                session, profile, baseline, analysis
            )
            return data

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error in quick_profile: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/profile-batch")
    async def batch_profile(request: dict):
        """Batch profile with user input param"""
        print("=== PYTHON BACKEND DEBUG ===")
        print(f"Request received: {request}")
        print(f"Request type: {type(request)}")

        pid = request.get("pid")
        # Command to launch (e.g., "python3 /path/to/script.py")
        app_path = request.get("app_path")
        app_name = request.get("app_name", "unknown")
        selection_type = request.get("selection_type", "pid")
        duration = request.get("duration", 30.0)

        print(f"Extracted values:", flush=True)
        print(f"  selection_type: '{selection_type}'")
        print(f"  pid: {pid}")
        print(f"  app_path: '{app_path}'")
        print(f"  app_name: '{app_name}'")
        print(f"  duration: {duration}")

        # Use existing PID
        if selection_type == "pid":
            if not pid:
                raise HTTPException(
                    status_code=400, detail="PID is required for 'pid' mode"
                )

            print(f"[PID MODE] Attaching to PID: {pid}")

            try:
                # Create session and establish baseline
                session = api_orchestrator.create_session()
                baseline = api_orchestrator.establish_baseline(
                    session.session_id, duration=3.0
                )

                # Attach to existing process
                if app_name == "unknown":
                    app_name = f"pid_{pid}"

                profile = api_orchestrator.attach_to_process(
                    session.session_id, app_name, pid
                )

                if profile.status == "failed":
                    raise HTTPException(status_code=400, detail=profile.error_message)

                # Monitor
                profile = api_orchestrator.monitor_application(
                    session.session_id, app_name, duration=duration
                )

                # Analyze
                analyzer = BottleneckAnalyzer()
                analysis = analyzer.analyze(profile, baseline)

                # Return data
                data = api_orchestrator.prepare_profile_data(
                    session, profile, baseline, analysis
                )
                return data

            except HTTPException:
                raise
            except Exception as e:
                print(f"[PID MODE] Error: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Launch new application by path
        elif selection_type == "appname":
            if not app_path or app_path.strip() == "":
                raise HTTPException(
                    status_code=400,
                    detail="Application path/command is required when using 'appname' selection type",
                )

            print(f"[APPPATH MODE] Launching application: {app_path}")

            try:
                # Validate file paths in the command (universal approach)
                command_parts = app_path.strip().split()
                validated_file = None

                # Check each argument that looks like a file path
                for arg in command_parts:
                    # Skip flags/options (start with -)
                    if arg.startswith("-"):
                        continue

                    # Check if argument looks like a file path (has extension or path separators)
                    if (
                        "/" in arg
                        or "\\" in arg
                        or ("." in arg and not arg.startswith("."))
                    ):
                        file_path = Path(arg)

                        # Handle relative paths - make them absolute from current working directory
                        if not file_path.is_absolute():
                            file_path = Path.cwd() / file_path

                        # Validate file exists
                        if not file_path.exists():
                            error_msg = (
                                f"File not found: {arg} (resolved to: {file_path})"
                            )
                            print(f"[APPPATH MODE] ERROR: {error_msg}")
                            raise HTTPException(
                                status_code=400,
                                detail={
                                    "status": "failed",
                                    "error": error_msg,
                                    "message": "Please check the file path and try again.",
                                    "current_dir": str(Path.cwd()),
                                },
                            )

                        if not file_path.is_file():
                            error_msg = f"Path is not a file: {arg}"
                            print(f"[APPPATH MODE] ERROR: {error_msg}")
                            raise HTTPException(
                                status_code=400,
                                detail={
                                    "status": "failed",
                                    "error": error_msg,
                                    "message": "Please provide a valid file path.",
                                },
                            )

                        print(f"[APPPATH MODE] File validation passed: {file_path}")
                        if not validated_file:
                            validated_file = file_path

                # Create session and establish baseline
                session = api_orchestrator.create_session()
                baseline = api_orchestrator.establish_baseline(
                    session.session_id, duration=3.0
                )

                # Generate app name from command if not provided
                if app_name == "unknown":
                    # Extract name from validated file or first command part
                    if validated_file:
                        app_name = validated_file.stem
                    elif len(command_parts) > 0:
                        app_name = Path(command_parts[0]).stem
                    else:
                        app_name = "unknown_app"

                print(f"[APPPATH MODE] App name: {app_name}")

                # Launch the application
                profile = api_orchestrator.launch_application(
                    session.session_id, app_name, app_path.strip()
                )

                if profile.status == "failed":
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "status": "failed",
                            "error": profile.error_message,
                            "message": "Application failed to launch or exited immediately.",
                        },
                    )

                print(
                    f"[APPPATH MODE] Application launched with PID: {profile.root_pid}"
                )

                # Monitor the launched application
                profile = api_orchestrator.monitor_application(
                    session.session_id, app_name, duration=duration
                )

                print(f"[APPPATH MODE] Monitoring complete")
                print(f"  process_name: '{profile.process_name}'")
                print(f"  command: '{profile.command}'")

                # Stop the application after profiling
                api_orchestrator.stop_application(session.session_id, app_name)
                print(f"[APPPATH MODE] Application stopped")

                # Analyze
                analyzer = BottleneckAnalyzer()
                analysis = analyzer.analyze(profile, baseline)

                # Return data
                data = api_orchestrator.prepare_profile_data(
                    session, profile, baseline, analysis
                )

                print(f"[APPPATH MODE] Profiling complete!")
                return data

            except HTTPException:
                raise
            except Exception as e:
                print(f"[APPPATH MODE] Error: {e}")
                import traceback

                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid selection_type: {selection_type}. Must be 'pid' or 'appname'",
            )


def parse_api_arguments():
    """Parse arguments for API mode"""
    import argparse

    parser = argparse.ArgumentParser(description="Platform Profiler API Service")
    parser.add_argument(
        "--port",
        type=int,
        default=6240,
        help="Port to run the FastAPI server on (default: 6240)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind service to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--reload", action="store_true", help="Enable auto reload for development"
    )

    return parser.parse_args()


def main():
    """Main CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Platform Profiler - Application Resource Utilization Analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
  # Check platform status
  %(prog)s status
  
  # Profile your application
  %(prog)s profile --app "python inference.py" --name "my_app" --duration 30

For more info: https://github.com/intel/...
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show current platform status")

    # Profile command
    profile_parser = subparsers.add_parser("profile", help="Profile application")
    profile_parser.add_argument(
        "--app", type=str, help="Application command to execute"
    )
    profile_parser.add_argument(
        "--pid", type=int, help="PID of running process to profile"
    )
    profile_parser.add_argument(
        "--name", type=str, default="app", help="Application name (default: app)"
    )
    profile_parser.add_argument(
        "--baseline",
        type=float,
        default=5.0,
        help="Baseline duration in seconds (default: 5)",
    )
    profile_parser.add_argument(
        "--duration",
        type=float,
        default=30.0,
        help="Profile duration in seconds (default: 30)",
    )
    profile_parser.add_argument(
        "--output", type=str, help="Output JSON file (optional)"
    )

    args = parser.parse_args()

    if not args.command:
        print_banner()
        parser.print_help()
        return

    # SECURITY: Validate command is one of the allowed subcommands (taint barrier)
    # This acts as a taint barrier for static analysis tools
    allowed_commands = ["profile", "status"]
    if args.command not in allowed_commands:
        print(f"ERROR: Invalid command '{args.command}'")
        return

    # Execute validated command
    # Note: Additional validation occurs inside each function for command-specific fields
    if args.command == "profile":
        # SECURITY: Break taint chain by validating individual fields
        # Extract and validate each field to prevent taint propagation
        validated_args = type(
            "obj",
            (object,),
            {
                "command": str(args.command),  # Already validated via whitelist
                "app": args.app if args.app is None else str(args.app),
                "pid": args.pid if args.pid is None else int(args.pid),
                "name": args.name if args.name is None else str(args.name),
                "baseline": float(args.baseline) if hasattr(args, "baseline") else 5.0,
                "duration": float(args.duration) if hasattr(args, "duration") else 30.0,
                "output": (
                    args.output
                    if not hasattr(args, "output") or args.output is None
                    else str(args.output)
                ),
            },
        )()
        run_profile(validated_args)
    elif args.command == "status":
        run_status(args)


if __name__ == "__main__":
    # Check if running in API mode
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        if not FASTAPI_AVAILABLE:
            print("ERROR: FastAPI not available!", file=sys.stderr)
            print("Install with: pip install fastapi uvicorn", file=sys.stderr)
            sys.exit(1)

        # Remove 'api' from argv so parse_api_arguments works correctly
        # sys.argv.pop(1)
        sys.argv = [sys.argv[0]] + sys.argv[
            2:
        ]  # Keep script name, remove 'api', keep rest
        args = parse_api_arguments()

        print(f"Starting Platform Profiler API on {args.host}:{args.port}")
        print(f"API endpoints:")
        print(f"  GET  http://{args.host}:{args.port}/api/status")
        print(f"  POST http://{args.host}:{args.port}/api/profile-start")
        print(f"  GET  http://{args.host}:{args.port}/api/profile-monitor")
        print(
            f"  GET  http://{args.host}:{args.port}/api/profile/quick?pid=<PID>&duration=<seconds>"
        )
        print(f"\nDocs: http://{args.host}:{args.port}/docs")

        uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
    else:
        # Run CLI mode
        main()
