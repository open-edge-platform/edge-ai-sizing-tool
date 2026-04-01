#!/usr/bin/env python3

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""
Bottleneck Analyzer - Performance Bottleneck Detection
=======================================================

Analyzes application profiling data to automatically detect and diagnose
performance bottlenecks across CPU, Memory, GPU, NPU, and Thermal resources.

Features:
- Automatic bottleneck detection with severity classification
- Intelligent workload type classification
- Actionable optimization recommendations

Usage:
    from bottleneck_analyzer import BottleneckAnalyzer

    analyzer = BottleneckAnalyzer()
    analysis = analyzer.analyze(profile, baseline)
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class Bottleneck:
    """Detected bottleneck with severity and recommendations"""

    resource: str  # CPU, Memory, GPU, NPU, Thermal, I/O
    severity: str  # none, minor, moderate, severe, critical
    description: str
    metrics: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class BottleneckAnalysis:
    """Complete bottleneck analysis results"""

    bottlenecks: List[Bottleneck] = field(default_factory=list)
    primary_bottleneck: Optional[str] = None
    workload_type: str = ""  # cpu_bound, memory_bound, gpu_bound, npu_bound, balanced
    overall_health: str = ""  # healthy, warning, critical
    summary: str = ""


# ============================================================================
# Bottleneck Analyzer
# ============================================================================


class BottleneckAnalyzer:
    """Analyzes profiling data to identify performance bottlenecks"""

    # Thresholds for bottleneck detection
    THRESHOLDS = {
        "cpu_high": 70.0,  # % normalized CPU usage
        "cpu_critical": 90.0,
        "memory_high": 60.0,  # % memory usage
        "memory_critical": 80.0,
        "gpu_high": 70.0,  # % GPU compute
        "gpu_critical": 90.0,
        "npu_high": 70.0,  # % NPU usage
        "npu_critical": 90.0,
        "thermal_warning": 75.0,  # °C
        "thermal_critical": 85.0,
        "thermal_throttle": 90.0,
        "baseline_high": 80.0,  # % threshold for high baseline
        "significant_delta": 5.0,  # % minimum delta to report when baseline is high
    }

    def analyze(self, profile, baseline) -> BottleneckAnalysis:
        """Perform comprehensive bottleneck analysis

        Args:
            profile: ApplicationProfile with resource usage metrics
            baseline: PlatformBaseline with idle system state

        Returns:
            BottleneckAnalysis with detected bottlenecks and recommendations
        """
        bottlenecks = []

        # Check each resource type
        cpu_bottleneck = self._check_cpu_bottleneck(profile, baseline)
        if cpu_bottleneck:
            bottlenecks.append(cpu_bottleneck)

        memory_bottleneck = self._check_memory_bottleneck(profile, baseline)
        if memory_bottleneck:
            bottlenecks.append(memory_bottleneck)

        gpu_bottleneck = self._check_gpu_bottleneck(profile, baseline)
        if gpu_bottleneck:
            bottlenecks.append(gpu_bottleneck)

        npu_bottleneck = self._check_npu_bottleneck(profile, baseline)
        if npu_bottleneck:
            bottlenecks.append(npu_bottleneck)

        thermal_bottleneck = self._check_thermal_bottleneck(profile, baseline)
        if thermal_bottleneck:
            bottlenecks.append(thermal_bottleneck)

        disk_bottleneck = self._check_disk_bottleneck(profile, baseline)
        if disk_bottleneck:
            bottlenecks.append(disk_bottleneck)

        # Determine workload type and primary bottleneck
        workload_type = self._determine_workload_type(profile)
        primary = self._get_primary_bottleneck(bottlenecks)
        health = self._assess_overall_health(bottlenecks)
        summary = self._generate_summary(bottlenecks, workload_type)

        # If no bottlenecks detected and system is healthy, add a healthy bottleneck entry
        if not bottlenecks and health == "healthy":
            healthy_bottleneck = Bottleneck(
                resource="System",
                severity="healthy",
                description=summary,
                metrics={},
                recommendations=[],
            )
            bottlenecks.append(healthy_bottleneck)

        return BottleneckAnalysis(
            bottlenecks=bottlenecks,
            primary_bottleneck=primary,
            workload_type=workload_type,
            overall_health=health,
            summary=summary,
        )

    def _check_cpu_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect CPU bottlenecks"""
        avg = profile.cpu_percent_normalized
        peak = profile.peak_cpu_percent_normalized

        # Normalize baseline to match per-core normalized values
        logical_cores = profile.logical_cores if profile.logical_cores > 0 else 1
        baseline_normalized = baseline.cpu_percent / logical_cores

        # Check if baseline is high (>80%)
        has_high_baseline = baseline_normalized > self.THRESHOLDS["baseline_high"]

        if avg < 50.0 and not has_high_baseline:
            return None

        severity = "none"
        recommendations = []

        # If baseline is high, this is a critical issue - report it prominently
        if has_high_baseline:
            # If delta is too small, skip reporting
            if avg < self.THRESHOLDS["significant_delta"]:
                return None

            # Calculate current utilization (capped at 100%)
            current_utilization = min(100.0, baseline_normalized + avg)

            severity = "severe"
            recommendations = [
                "CPU baseline >80% - other processes consuming CPU before profiling",
                "Stop unnecessary background processes and rerun profiling",
                f"Application usage: average={avg:.1f}%, peak={peak:.1f}%",
                "Results may be unreliable due to high baseline",
            ]

            description = f"CPU: baseline={baseline_normalized:.1f}% (>80%), application avg={avg:.1f}% peak={peak:.1f}%, total={current_utilization:.1f}%"

            return Bottleneck(
                resource="CPU",
                severity=severity,
                description=description,
                metrics={
                    "avg_percent": avg,
                    "peak_percent": peak,
                    "baseline_percent": baseline_normalized,
                    "current_utilization": current_utilization,
                    "baseline_warning": True,
                },
                recommendations=recommendations,
            )

        if avg >= self.THRESHOLDS["cpu_critical"] or peak >= 95.0:
            severity = "critical"
            recommendations = [
                "CPU is heavily saturated - consider optimizing algorithms",
                "Profile hot code paths with profilers (py-spy, cProfile)",
                "Consider parallelization or multi-threading optimizations",
                "Look for opportunities to offload to GPU/NPU",
            ]
        elif avg >= self.THRESHOLDS["cpu_high"]:
            severity = "severe"
            recommendations = [
                "High CPU usage detected - review computational efficiency",
                "Consider vectorization (NumPy, Intel oneAPI) for numeric operations",
                "Check for unnecessary loops or redundant computations",
            ]
        else:
            severity = "moderate"
            recommendations = [
                "Moderate CPU usage - generally acceptable",
                "Monitor for sustained high CPU during production loads",
            ]

        description = f"CPU usage: {avg:.1f}% avg, {peak:.1f}% peak (across {profile.logical_cores} cores)"

        return Bottleneck(
            resource="CPU",
            severity=severity,
            description=description,
            metrics={
                "avg_percent": avg,
                "peak_percent": peak,
                "cores": profile.logical_cores,
            },
            recommendations=recommendations,
        )

    def _check_memory_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect memory bottlenecks"""
        avg_percent = profile.memory_percent
        avg_mb = profile.memory_mb
        peak_mb = profile.peak_memory_mb
        total_mb = baseline.memory_total_mb

        if avg_percent < 30.0:
            return None

        severity = "none"
        recommendations = []

        if avg_percent >= self.THRESHOLDS["memory_critical"]:
            severity = "critical"
            recommendations = [
                f"High memory consumption: {avg_mb:.0f} MB ({avg_percent:.1f}% of app usage)",
                "Risk of memory pressure or OOM - investigate memory leaks",
                "Use memory profilers (memory_profiler, tracemalloc)",
                "Consider batch size reduction or data streaming approaches",
            ]
        elif avg_percent >= self.THRESHOLDS["memory_high"]:
            severity = "severe"
            recommendations = [
                "Elevated memory usage detected",
                "Review data structures for memory efficiency",
                "Consider using memory-mapped files for large datasets",
            ]
        else:
            severity = "moderate"
            recommendations = [
                "Memory usage is within acceptable range",
                "Monitor for memory growth over longer runs",
            ]

        description = f"Memory: {avg_mb:.0f} MB avg, {peak_mb:.0f} MB peak ({avg_percent:.1f}% app usage)"

        return Bottleneck(
            resource="Memory",
            severity=severity,
            description=description,
            metrics={"avg_mb": avg_mb, "peak_mb": peak_mb, "percent": avg_percent},
            recommendations=recommendations,
        )

    def _check_gpu_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect GPU bottleneck"""
        avg_compute = profile.gpu_compute_percent
        peak_compute = profile.peak_gpu_compute_percent
        avg_memory_mb = profile.gpu_memory_mb
        peak_memory_mb = profile.peak_gpu_memory_mb
        avg_memory_percent = profile.gpu_memory_percent

        # Check if baseline is high (>80%) - this invalidates delta measurements
        has_high_baseline = False
        if baseline.gpu_devices and baseline.gpu_devices[0].compute_percent > 80.0:
            has_high_baseline = True

        # If GPU is not being used significantly, no bottleneck
        if avg_compute < 10.0 and avg_memory_percent < 10.0:
            # But if baseline is high, we should still report it
            if not has_high_baseline:
                return None

        severity = "none"
        recommendations = []

        # If baseline is high, this is a critical issue - report it prominently
        if has_high_baseline:
            baseline_value = baseline.gpu_devices[0].compute_percent
            current_utilization = baseline_value + avg_compute
            severity = "severe"
            recommendations = [
                "GPU baseline >80% - other processes using GPU before profiling",
                "Stop GPU workloads (check with intel_gpu_top) and rerun",
                f"Application usage: average={avg_compute:.1f}%, peak={peak_compute:.1f}%",
                "Cannot accurately measure application's GPU impact due to high baseline",
            ]

            description = f"GPU: baseline={baseline_value:.1f}% (>80%), application avg={avg_compute:.1f}% peak={peak_compute:.1f}%, total={current_utilization:.1f}%"

            return Bottleneck(
                resource="GPU",
                severity=severity,
                description=description,
                metrics={
                    "compute_avg": avg_compute,
                    "compute_peak": peak_compute,
                    "baseline_percent": baseline_value,
                    "current_utilization": current_utilization,
                    "baseline_warning": True,
                },
                recommendations=recommendations,
            )

        # Check peak GPU saturation (100% indicates bottleneck)
        if peak_compute >= 95.0:
            severity = "critical"
            recommendations = [
                f"GPU peaked at {peak_compute:.1f}% - fully saturated",
                "GPU is a performance bottleneck",
                "Optimize GPU kernels or reduce workload complexity",
                "Check for GPU memory bandwidth limitations",
                "Consider model optimization (quantization, pruning)",
            ]
        elif avg_compute >= self.THRESHOLDS["gpu_critical"]:
            severity = "critical"
            recommendations = [
                "GPU compute is saturated - may be bottleneck",
                "Optimize GPU kernels or reduce workload complexity",
                "Check for GPU memory bandwidth limitations",
                "Consider model optimization (quantization, pruning)",
            ]
        elif peak_compute >= 85.0 or avg_compute >= self.THRESHOLDS["gpu_high"]:
            # Elevated severity if peak is high even if average is moderate
            if peak_compute >= 85.0:
                severity = "severe"
                recommendations = [
                    f"GPU peaked at {peak_compute:.1f}% (avg {avg_compute:.1f}%)",
                    "GPU experiencing intermittent saturation",
                    "Consider workload balancing or batch size adjustments",
                    "Monitor for sustained high utilization",
                ]
            else:
                severity = "moderate"
                recommendations = [
                    "High GPU utilization - generally good for GPU workloads",
                    "Monitor for sustained saturation",
                ]
        elif avg_memory_percent > 80.0:
            severity = "severe"
            recommendations = [
                f"High GPU memory usage: {avg_memory_mb:.0f} MB ({avg_memory_percent:.1f}%)",
                "Reduce batch size or model size to fit in GPU memory",
                "Consider using gradient checkpointing or mixed precision",
            ]
        else:
            severity = "minor"
            recommendations = [
                "GPU usage is moderate - check if workload is GPU-accelerated",
            ]

        description = f"GPU: {avg_compute:.1f}% avg, {peak_compute:.1f}% peak compute, {avg_memory_mb:.0f} MB memory ({avg_memory_percent:.1f}%)"

        return Bottleneck(
            resource="GPU",
            severity=severity,
            description=description,
            metrics={
                "compute_avg": avg_compute,
                "compute_peak": peak_compute,
                "memory_mb": avg_memory_mb,
                "memory_percent": avg_memory_percent,
            },
            recommendations=recommendations,
        )

    def _check_npu_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect NPU bottlenecks"""
        if not baseline.npu_available:
            return None

        avg = profile.npu_percent
        peak = profile.peak_npu_percent

        # Check if baseline is high (>80%)
        has_high_baseline = baseline.npu_percent > 80.0

        if avg < 10.0 and not has_high_baseline:
            return None

        severity = "none"
        recommendations = []

        # If baseline is high, this is a critical issue - report it prominently
        if has_high_baseline:
            current_utilization = baseline.npu_percent + avg
            severity = "severe"
            recommendations = [
                "NPU baseline >80% - other processes using NPU before profiling",
                "Stop NPU workloads and rerun profiling",
                f"Application usage: average={avg:.1f}%, peak={peak:.1f}%",
                "Cannot accurately measure application's NPU impact due to high baseline",
            ]

            description = f"NPU: baseline={baseline.npu_percent:.1f}% (>80%), application avg={avg:.1f}% peak={peak:.1f}%, total={current_utilization:.1f}%"

            return Bottleneck(
                resource="NPU",
                severity=severity,
                description=description,
                metrics={
                    "avg_percent": avg,
                    "peak_percent": peak,
                    "baseline_percent": baseline.npu_percent,
                    "current_utilization": current_utilization,
                    "baseline_warning": True,
                },
                recommendations=recommendations,
            )

        if avg >= self.THRESHOLDS["npu_critical"] or peak >= 95.0:
            severity = "critical"
            recommendations = [
                "NPU is saturated - may be performance bottleneck",
                "Optimize model for NPU (quantization, operator fusion)",
                "Consider model partitioning across NPU/GPU/CPU",
                "Check if NPU is thermal throttling",
            ]
        elif avg >= self.THRESHOLDS["npu_high"]:
            severity = "moderate"
            recommendations = [
                "High NPU utilization - good for NPU-accelerated workloads",
                "Ensure NPU is running at optimal frequency",
            ]
        else:
            severity = "minor"
            recommendations = [
                "NPU is being utilized effectively",
            ]

        description = f"NPU: {avg:.1f}% avg, {peak:.1f}% peak utilization"

        return Bottleneck(
            resource="NPU",
            severity=severity,
            description=description,
            metrics={"avg_percent": avg, "peak_percent": peak},
            recommendations=recommendations,
        )

    def _check_thermal_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect thermal throttling issues"""
        # Check if thermal data is available
        if not hasattr(profile, "thermal_max_temp") or not hasattr(
            profile, "peak_thermal_temp"
        ):
            return None

        avg_temp = (
            profile.thermal_cpu_temp if hasattr(profile, "thermal_cpu_temp") else 0.0
        )
        max_temp = (
            profile.thermal_max_temp if hasattr(profile, "thermal_max_temp") else 0.0
        )
        peak_temp = (
            profile.peak_thermal_temp if hasattr(profile, "peak_thermal_temp") else 0.0
        )

        if max_temp == 0.0:
            return None

        severity = "none"
        recommendations = []

        if peak_temp >= self.THRESHOLDS["thermal_throttle"]:
            severity = "critical"
            recommendations = [
                f"⚠️  CRITICAL: System reached {peak_temp:.1f}°C - thermal throttling likely!",
                "Performance is being limited by temperature",
                "Improve cooling: clean fans, better airflow, thermal paste",
                "Reduce workload intensity or ambient temperature",
                "Check for dust buildup in cooling system",
            ]
        elif max_temp >= self.THRESHOLDS["thermal_critical"]:
            severity = "severe"
            recommendations = [
                f"High temperatures detected: {max_temp:.1f}°C average max",
                "Risk of thermal throttling - monitor closely",
                "Consider improving cooling solution",
            ]
        elif max_temp >= self.THRESHOLDS["thermal_warning"]:
            severity = "moderate"
            recommendations = [
                "Elevated temperatures - generally acceptable for sustained workloads",
                "Monitor for thermal trends over longer runs",
            ]
        else:
            return None

        description = f"Thermal: {avg_temp:.1f}°C CPU avg, {max_temp:.1f}°C max, {peak_temp:.1f}°C peak"

        return Bottleneck(
            resource="Thermal",
            severity=severity,
            description=description,
            metrics={"cpu_avg": avg_temp, "max_avg": max_temp, "peak": peak_temp},
            recommendations=recommendations,
        )

    def _check_disk_bottleneck(self, profile, baseline) -> Optional[Bottleneck]:
        """Detect disk I/O bottlenecks"""
        if not hasattr(profile, "disk_read_mb_per_sec"):
            return None

        avg_read = profile.disk_read_mb_per_sec
        avg_write = profile.disk_write_mb_per_sec
        peak_read = (
            profile.peak_disk_read_mb_per_sec
            if hasattr(profile, "peak_disk_read_mb_per_sec")
            else avg_read
        )
        peak_write = (
            profile.peak_disk_write_mb_per_sec
            if hasattr(profile, "peak_disk_write_mb_per_sec")
            else avg_write
        )
        avg_io_percent = (
            profile.disk_io_percent if hasattr(profile, "disk_io_percent") else 0.0
        )

        total_avg_io = avg_read + avg_write
        total_peak_io = peak_read + peak_write

        # If disk I/O is minimal, no bottleneck
        if total_avg_io < 10.0:  # Less than 10 MB/s combined
            return None

        severity = "none"
        recommendations = []

        # High I/O thresholds (typical SSD: 500+ MB/s, HDD: 100-150 MB/s)
        # We'll use conservative thresholds assuming SSD
        if total_peak_io >= 400.0 or avg_io_percent >= 80.0:
            severity = "critical"
            recommendations = [
                f"Very high disk I/O: {total_peak_io:.0f} MB/s peak",
                "Disk I/O may be a performance bottleneck",
                "Consider faster storage (NVMe SSD)",
                "Optimize data access patterns (sequential vs random)",
                "Use caching strategies to reduce disk access",
            ]
        elif total_peak_io >= 250.0 or avg_io_percent >= 50.0:
            severity = "severe"
            recommendations = [
                f"High disk I/O detected: {avg_read:.1f} MB/s read, {avg_write:.1f} MB/s write",
                "Monitor for sustained I/O saturation",
                "Consider data streaming or buffering optimizations",
            ]
        elif total_avg_io >= 100.0 or avg_io_percent >= 20.0:
            severity = "moderate"
            recommendations = [
                "Moderate disk I/O activity",
                "Disk performance appears adequate for workload",
            ]
        else:
            severity = "minor"
            recommendations = [
                "Low disk I/O - not a bottleneck",
            ]

        description = f"Disk I/O: {avg_read:.1f} MB/s read, {avg_write:.1f} MB/s write (avg), {peak_read:.1f}/{peak_write:.1f} MB/s (peak)"

        return Bottleneck(
            resource="Disk",
            severity=severity,
            description=description,
            metrics={
                "read_avg": avg_read,
                "write_avg": avg_write,
                "read_peak": peak_read,
                "write_peak": peak_write,
                "io_percent": avg_io_percent,
            },
            recommendations=recommendations,
        )

    def _determine_workload_type(self, profile) -> str:
        """Classify workload type based on resource usage patterns"""
        cpu_norm = profile.cpu_percent_normalized
        mem_pct = profile.memory_percent
        gpu_compute = profile.gpu_compute_percent
        npu_pct = profile.npu_percent

        # NPU-accelerated
        if npu_pct > 50.0:
            return "npu_accelerated"

        # GPU-accelerated
        if gpu_compute > 50.0:
            return "gpu_accelerated"

        # CPU-bound
        if cpu_norm > 70.0 and mem_pct < 50.0:
            return "cpu_bound"

        # Memory-bound
        if mem_pct > 60.0:
            return "memory_bound"

        # Balanced
        if cpu_norm > 30.0 and cpu_norm < 70.0:
            return "balanced"

        # Light workload
        if cpu_norm < 20.0 and mem_pct < 20.0:
            return "light_workload"

        return "mixed_workload"

    def _get_primary_bottleneck(self, bottlenecks: List[Bottleneck]) -> Optional[str]:
        """Identify the most critical bottleneck"""
        if not bottlenecks:
            return None

        severity_order = {
            "critical": 5,
            "severe": 4,
            "moderate": 3,
            "minor": 2,
            "none": 1,
        }

        # Sort by severity only
        sorted_bottlenecks = sorted(
            bottlenecks,
            key=lambda b: severity_order.get(b.severity, 0),
            reverse=True,
        )

        if sorted_bottlenecks and sorted_bottlenecks[0].severity != "none":
            return sorted_bottlenecks[0].resource

        return None

    def _assess_overall_health(self, bottlenecks: List[Bottleneck]) -> str:
        """Assess overall system health"""
        if not bottlenecks:
            return "healthy"

        has_critical = any(b.severity == "critical" for b in bottlenecks)
        has_severe = any(b.severity == "severe" for b in bottlenecks)

        if has_critical:
            return "critical"
        elif has_severe:
            return "warning"
        else:
            return "healthy"

    def _generate_summary(
        self, bottlenecks: List[Bottleneck], workload_type: str
    ) -> str:
        """Generate human-readable summary"""
        if not bottlenecks:
            return (
                f"Workload type: {workload_type}. No significant bottlenecks detected."
            )

        critical = [b for b in bottlenecks if b.severity == "critical"]
        severe = [b for b in bottlenecks if b.severity == "severe"]

        summary_parts = [f"Workload type: {workload_type}"]

        if critical:
            resources = ", ".join(b.resource for b in critical)
            summary_parts.append(f"CRITICAL bottlenecks: {resources}")

        if severe:
            resources = ", ".join(b.resource for b in severe)
            summary_parts.append(f"Severe bottlenecks: {resources}")

        if not critical and not severe:
            summary_parts.append("Performance is within acceptable ranges")

        return ". ".join(summary_parts) + "."

    def print_analysis(self, analysis: BottleneckAnalysis):
        """Print formatted bottleneck analysis to console"""
        print("\n" + "=" * 80)
        print("BOTTLENECK ANALYSIS")
        print("=" * 80)
        print(f"\nWorkload Type: {analysis.workload_type}")
        print(f"Overall Health: {analysis.overall_health.upper()}")
        print(f"Summary: {analysis.summary}")

        if analysis.bottlenecks:
            print("\nDetected Bottlenecks:")
            print("-" * 80)

            # Group by severity
            severity_order = ["critical", "severe", "moderate", "minor"]
            for severity_level in severity_order:
                severity_bottlenecks = [
                    b for b in analysis.bottlenecks if b.severity == severity_level
                ]

                if severity_bottlenecks:
                    for bottleneck in severity_bottlenecks:
                        print(
                            f"\n[{bottleneck.severity.upper()}] {bottleneck.resource} Bottleneck"
                        )
                        print(f"   {bottleneck.description}")

                        if bottleneck.recommendations:
                            print(f"\n   Recommendations:")
                            for i, rec in enumerate(bottleneck.recommendations, 1):
                                print(f"   {i}. {rec}")
        else:
            print("\n✅ No significant bottlenecks detected - performance looks good!")
