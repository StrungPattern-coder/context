"""
Hardware-Aware Ingress Module

Implements:
- Device telemetry schema (battery, network, kinetic state)
- Adaptive prompt composition based on device state
- System instruction generation for device constraints
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import structlog

logger = structlog.get_logger()


class ConnectionType(str, Enum):
    """Network connection types."""
    WIFI = "wifi"
    CELLULAR_5G = "5g"
    CELLULAR_4G = "4g"
    CELLULAR_3G = "3g"
    ETHERNET = "ethernet"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class BatteryState(str, Enum):
    """Battery charging states."""
    CHARGING = "charging"
    DISCHARGING = "discharging"
    FULL = "full"
    NOT_CHARGING = "not_charging"
    UNKNOWN = "unknown"


class KineticState(str, Enum):
    """User's kinetic/motion state."""
    STATIONARY = "stationary"
    WALKING = "walking"
    RUNNING = "running"
    CYCLING = "cycling"
    DRIVING = "driving"
    IN_TRANSIT = "in_transit"
    UNKNOWN = "unknown"


class DeviceType(str, Enum):
    """Types of devices."""
    SMARTPHONE = "smartphone"
    TABLET = "tablet"
    LAPTOP = "laptop"
    DESKTOP = "desktop"
    WEARABLE = "wearable"
    IOT = "iot"
    UNKNOWN = "unknown"


class ResourceConstraint(str, Enum):
    """Resource constraint levels."""
    NONE = "none"                   # Full resources available
    LOW = "low"                     # Minor constraints
    MEDIUM = "medium"               # Moderate constraints
    HIGH = "high"                   # Significant constraints
    CRITICAL = "critical"           # Severe constraints


@dataclass
class BatteryTelemetry:
    """Battery status telemetry."""
    level: float                    # 0.0 to 1.0
    state: BatteryState = BatteryState.UNKNOWN
    is_charging: bool = False
    time_to_empty_minutes: Optional[int] = None
    time_to_full_minutes: Optional[int] = None
    temperature_celsius: Optional[float] = None
    
    @property
    def is_low(self) -> bool:
        """Check if battery is low (<20%)."""
        return self.level < 0.2
    
    @property
    def is_critical(self) -> bool:
        """Check if battery is critical (<10%)."""
        return self.level < 0.1
    
    def to_dict(self) -> dict:
        return {
            "level": self.level,
            "state": self.state.value,
            "is_charging": self.is_charging,
            "time_to_empty_minutes": self.time_to_empty_minutes,
            "time_to_full_minutes": self.time_to_full_minutes,
            "temperature_celsius": self.temperature_celsius,
        }


@dataclass
class NetworkTelemetry:
    """Network status telemetry."""
    connection_type: ConnectionType = ConnectionType.UNKNOWN
    is_metered: bool = False        # Data caps apply
    signal_strength: Optional[float] = None  # 0.0 to 1.0
    bandwidth_mbps: Optional[float] = None
    latency_ms: Optional[float] = None
    is_roaming: bool = False
    
    @property
    def is_constrained(self) -> bool:
        """Check if network is constrained."""
        return (
            self.connection_type in (ConnectionType.CELLULAR_3G, ConnectionType.OFFLINE) or
            self.is_metered or
            (self.bandwidth_mbps is not None and self.bandwidth_mbps < 1.0)
        )
    
    @property
    def is_offline(self) -> bool:
        """Check if offline."""
        return self.connection_type == ConnectionType.OFFLINE
    
    def to_dict(self) -> dict:
        return {
            "connection_type": self.connection_type.value,
            "is_metered": self.is_metered,
            "signal_strength": self.signal_strength,
            "bandwidth_mbps": self.bandwidth_mbps,
            "latency_ms": self.latency_ms,
            "is_roaming": self.is_roaming,
        }


@dataclass
class KineticTelemetry:
    """Kinetic/motion state telemetry."""
    state: KineticState = KineticState.UNKNOWN
    confidence: float = 0.0         # 0.0 to 1.0
    speed_mps: Optional[float] = None  # meters per second
    acceleration: Optional[float] = None
    heading: Optional[float] = None  # degrees
    altitude_meters: Optional[float] = None
    
    @property
    def is_moving(self) -> bool:
        """Check if user is in motion."""
        return self.state not in (KineticState.STATIONARY, KineticState.UNKNOWN)
    
    @property
    def is_high_speed(self) -> bool:
        """Check if moving at high speed (likely in vehicle)."""
        return self.speed_mps is not None and self.speed_mps > 10
    
    def to_dict(self) -> dict:
        return {
            "state": self.state.value,
            "confidence": self.confidence,
            "speed_mps": self.speed_mps,
            "acceleration": self.acceleration,
            "heading": self.heading,
            "altitude_meters": self.altitude_meters,
        }


@dataclass
class DeviceInfo:
    """Device information."""
    device_type: DeviceType = DeviceType.UNKNOWN
    os: str = "unknown"
    os_version: str = ""
    model: str = ""
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    supports_haptics: bool = False
    has_gps: bool = True
    has_accelerometer: bool = True
    
    def to_dict(self) -> dict:
        return {
            "device_type": self.device_type.value,
            "os": self.os,
            "os_version": self.os_version,
            "model": self.model,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "supports_haptics": self.supports_haptics,
            "has_gps": self.has_gps,
            "has_accelerometer": self.has_accelerometer,
        }


@dataclass
class DeviceTelemetry:
    """Complete device telemetry."""
    battery: BatteryTelemetry
    network: NetworkTelemetry
    kinetic: KineticTelemetry
    device: DeviceInfo
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def overall_constraint(self) -> ResourceConstraint:
        """Calculate overall resource constraint level."""
        constraints = []
        
        # Battery constraints
        if self.battery.is_critical:
            constraints.append(ResourceConstraint.CRITICAL)
        elif self.battery.is_low and not self.battery.is_charging:
            constraints.append(ResourceConstraint.HIGH)
        
        # Network constraints
        if self.network.is_offline:
            constraints.append(ResourceConstraint.CRITICAL)
        elif self.network.is_constrained:
            constraints.append(ResourceConstraint.MEDIUM)
        
        # Kinetic constraints (moving user = less screen time)
        if self.kinetic.is_high_speed:
            constraints.append(ResourceConstraint.MEDIUM)
        elif self.kinetic.is_moving:
            constraints.append(ResourceConstraint.LOW)
        
        if not constraints:
            return ResourceConstraint.NONE
        
        # Return most severe constraint
        constraint_order = [
            ResourceConstraint.CRITICAL,
            ResourceConstraint.HIGH,
            ResourceConstraint.MEDIUM,
            ResourceConstraint.LOW,
            ResourceConstraint.NONE,
        ]
        for c in constraint_order:
            if c in constraints:
                return c
        return ResourceConstraint.NONE
    
    def to_dict(self) -> dict:
        return {
            "battery": self.battery.to_dict(),
            "network": self.network.to_dict(),
            "kinetic": self.kinetic.to_dict(),
            "device": self.device.to_dict(),
            "timestamp": self.timestamp.isoformat(),
            "overall_constraint": self.overall_constraint.value,
        }


@dataclass
class HardwareAwareInstructions:
    """System instructions based on hardware state."""
    base_instructions: str = ""
    constraint_instructions: list[str] = field(default_factory=list)
    response_format_hints: list[str] = field(default_factory=list)
    priority_level: str = "normal"
    max_response_tokens: Optional[int] = None
    
    def to_system_prompt(self) -> str:
        """Generate system prompt with hardware awareness."""
        parts = []
        
        if self.base_instructions:
            parts.append(self.base_instructions)
        
        if self.constraint_instructions:
            parts.append("\nDevice constraints to consider:")
            for instruction in self.constraint_instructions:
                parts.append(f"- {instruction}")
        
        if self.response_format_hints:
            parts.append("\nResponse format guidance:")
            for hint in self.response_format_hints:
                parts.append(f"- {hint}")
        
        if self.max_response_tokens:
            parts.append(f"\nKeep response under {self.max_response_tokens} tokens.")
        
        return "\n".join(parts)


class HardwareAwareIngress:
    """
    Hardware-Aware Ingress processor.
    
    Adapts prompt composition based on device telemetry.
    """
    
    # Response token limits by constraint level
    TOKEN_LIMITS = {
        ResourceConstraint.NONE: 2000,
        ResourceConstraint.LOW: 1500,
        ResourceConstraint.MEDIUM: 1000,
        ResourceConstraint.HIGH: 500,
        ResourceConstraint.CRITICAL: 250,
    }
    
    def __init__(self):
        """Initialize the ingress processor."""
        self._last_telemetry: Optional[DeviceTelemetry] = None
    
    def process_telemetry(
        self,
        telemetry: DeviceTelemetry,
    ) -> HardwareAwareInstructions:
        """
        Process device telemetry and generate instructions.
        
        Args:
            telemetry: Device telemetry data
            
        Returns:
            Hardware-aware instructions for prompt composition
        """
        self._last_telemetry = telemetry
        
        constraint_instructions = []
        response_hints = []
        
        # Battery-based instructions
        if telemetry.battery.is_critical:
            constraint_instructions.append(
                "User's device battery is critical (<10%). "
                "Prioritize essential information only."
            )
            response_hints.append("Use extremely concise responses")
            response_hints.append("Avoid code blocks or long lists")
        elif telemetry.battery.is_low and not telemetry.battery.is_charging:
            constraint_instructions.append(
                "User's device battery is low. "
                "Optimize for efficiency."
            )
            response_hints.append("Keep responses concise")
        
        # Network-based instructions
        if telemetry.network.is_offline:
            constraint_instructions.append(
                "User is offline. Any external resources or links "
                "should be noted as unavailable."
            )
        elif telemetry.network.is_metered:
            constraint_instructions.append(
                "User is on metered connection. "
                "Minimize data-heavy responses."
            )
            response_hints.append("Avoid embedding large images or files")
        elif telemetry.network.connection_type == ConnectionType.CELLULAR_3G:
            constraint_instructions.append(
                "User has slow network connection. "
                "Keep responses lightweight."
            )
        
        # Kinetic state instructions
        if telemetry.kinetic.state == KineticState.DRIVING:
            constraint_instructions.append(
                "User appears to be driving. Keep responses very brief "
                "and avoid anything requiring visual attention."
            )
            response_hints.append("Audio-friendly format preferred")
            response_hints.append("No code blocks or complex formatting")
        elif telemetry.kinetic.state in (KineticState.WALKING, KineticState.CYCLING):
            constraint_instructions.append(
                "User is on the move. Prefer quick, scannable responses."
            )
            response_hints.append("Use bullet points for easy scanning")
        elif telemetry.kinetic.state == KineticState.IN_TRANSIT:
            constraint_instructions.append(
                "User is in transit. Responses may be read in brief intervals."
            )
        
        # Device-specific instructions
        if telemetry.device.device_type == DeviceType.WEARABLE:
            constraint_instructions.append(
                "User is on a wearable device with limited screen. "
                "Extreme brevity required."
            )
            response_hints.append("Ultra-short responses only")
        elif telemetry.device.device_type == DeviceType.SMARTPHONE:
            if telemetry.device.screen_width and telemetry.device.screen_width < 400:
                response_hints.append("Optimize for small screen width")
        
        # Determine max tokens based on constraints
        max_tokens = self.TOKEN_LIMITS.get(
            telemetry.overall_constraint,
            self.TOKEN_LIMITS[ResourceConstraint.NONE]
        )
        
        # Determine priority level
        if telemetry.overall_constraint == ResourceConstraint.CRITICAL:
            priority = "critical"
        elif telemetry.overall_constraint == ResourceConstraint.HIGH:
            priority = "high"
        else:
            priority = "normal"
        
        return HardwareAwareInstructions(
            base_instructions="Adapt response based on user's device state.",
            constraint_instructions=constraint_instructions,
            response_format_hints=response_hints,
            priority_level=priority,
            max_response_tokens=max_tokens,
        )
    
    def create_telemetry_from_dict(self, data: dict) -> DeviceTelemetry:
        """
        Create DeviceTelemetry from dictionary input.
        
        Args:
            data: Dictionary with telemetry data
            
        Returns:
            DeviceTelemetry object
        """
        battery_data = data.get("battery", {})
        battery = BatteryTelemetry(
            level=battery_data.get("level", 1.0),
            state=BatteryState(battery_data.get("state", "unknown")),
            is_charging=battery_data.get("is_charging", False),
            time_to_empty_minutes=battery_data.get("time_to_empty_minutes"),
            time_to_full_minutes=battery_data.get("time_to_full_minutes"),
            temperature_celsius=battery_data.get("temperature_celsius"),
        )
        
        network_data = data.get("network", {})
        network = NetworkTelemetry(
            connection_type=ConnectionType(network_data.get("connection_type", "unknown")),
            is_metered=network_data.get("is_metered", False),
            signal_strength=network_data.get("signal_strength"),
            bandwidth_mbps=network_data.get("bandwidth_mbps"),
            latency_ms=network_data.get("latency_ms"),
            is_roaming=network_data.get("is_roaming", False),
        )
        
        kinetic_data = data.get("kinetic", {})
        kinetic = KineticTelemetry(
            state=KineticState(kinetic_data.get("state", "unknown")),
            confidence=kinetic_data.get("confidence", 0.0),
            speed_mps=kinetic_data.get("speed_mps"),
            acceleration=kinetic_data.get("acceleration"),
            heading=kinetic_data.get("heading"),
            altitude_meters=kinetic_data.get("altitude_meters"),
        )
        
        device_data = data.get("device", {})
        device = DeviceInfo(
            device_type=DeviceType(device_data.get("device_type", "unknown")),
            os=device_data.get("os", "unknown"),
            os_version=device_data.get("os_version", ""),
            model=device_data.get("model", ""),
            screen_width=device_data.get("screen_width"),
            screen_height=device_data.get("screen_height"),
            supports_haptics=device_data.get("supports_haptics", False),
            has_gps=device_data.get("has_gps", True),
            has_accelerometer=device_data.get("has_accelerometer", True),
        )
        
        timestamp_str = data.get("timestamp")
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str)
        else:
            timestamp = datetime.now(timezone.utc)
        
        return DeviceTelemetry(
            battery=battery,
            network=network,
            kinetic=kinetic,
            device=device,
            timestamp=timestamp,
        )
    
    def get_context_adjustments(
        self,
        telemetry: DeviceTelemetry,
    ) -> dict[str, Any]:
        """
        Get context adjustments based on telemetry.
        
        Returns adjustments that should be applied to context resolution.
        """
        adjustments = {
            "reduce_context_depth": False,
            "skip_web_grounding": False,
            "prefer_cached_results": False,
            "max_context_elements": 10,
            "context_timeout_ms": 150,
        }
        
        constraint = telemetry.overall_constraint
        
        if constraint == ResourceConstraint.CRITICAL:
            adjustments.update({
                "reduce_context_depth": True,
                "skip_web_grounding": True,
                "prefer_cached_results": True,
                "max_context_elements": 3,
                "context_timeout_ms": 50,
            })
        elif constraint == ResourceConstraint.HIGH:
            adjustments.update({
                "reduce_context_depth": True,
                "skip_web_grounding": True,
                "prefer_cached_results": True,
                "max_context_elements": 5,
                "context_timeout_ms": 75,
            })
        elif constraint == ResourceConstraint.MEDIUM:
            adjustments.update({
                "skip_web_grounding": True,
                "prefer_cached_results": True,
                "max_context_elements": 7,
                "context_timeout_ms": 100,
            })
        
        return adjustments


# Global instance
hardware_ingress = HardwareAwareIngress()


# JSON Schema for device telemetry ingestion
DEVICE_TELEMETRY_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "DeviceTelemetry",
    "description": "Schema for device telemetry input",
    "type": "object",
    "properties": {
        "battery": {
            "type": "object",
            "properties": {
                "level": {"type": "number", "minimum": 0, "maximum": 1},
                "state": {
                    "type": "string",
                    "enum": ["charging", "discharging", "full", "not_charging", "unknown"]
                },
                "is_charging": {"type": "boolean"},
                "time_to_empty_minutes": {"type": "integer", "minimum": 0},
                "time_to_full_minutes": {"type": "integer", "minimum": 0},
                "temperature_celsius": {"type": "number"}
            },
            "required": ["level"]
        },
        "network": {
            "type": "object",
            "properties": {
                "connection_type": {
                    "type": "string",
                    "enum": ["wifi", "5g", "4g", "3g", "ethernet", "offline", "unknown"]
                },
                "is_metered": {"type": "boolean"},
                "signal_strength": {"type": "number", "minimum": 0, "maximum": 1},
                "bandwidth_mbps": {"type": "number", "minimum": 0},
                "latency_ms": {"type": "number", "minimum": 0},
                "is_roaming": {"type": "boolean"}
            }
        },
        "kinetic": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string",
                    "enum": ["stationary", "walking", "running", "cycling", "driving", "in_transit", "unknown"]
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "speed_mps": {"type": "number", "minimum": 0},
                "acceleration": {"type": "number"},
                "heading": {"type": "number", "minimum": 0, "maximum": 360},
                "altitude_meters": {"type": "number"}
            }
        },
        "device": {
            "type": "object",
            "properties": {
                "device_type": {
                    "type": "string",
                    "enum": ["smartphone", "tablet", "laptop", "desktop", "wearable", "iot", "unknown"]
                },
                "os": {"type": "string"},
                "os_version": {"type": "string"},
                "model": {"type": "string"},
                "screen_width": {"type": "integer", "minimum": 0},
                "screen_height": {"type": "integer", "minimum": 0},
                "supports_haptics": {"type": "boolean"},
                "has_gps": {"type": "boolean"},
                "has_accelerometer": {"type": "boolean"}
            }
        },
        "timestamp": {
            "type": "string",
            "format": "date-time"
        }
    }
}
