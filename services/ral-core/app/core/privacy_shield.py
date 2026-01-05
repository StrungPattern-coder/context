"""
Privacy Shield Hybrid Architecture

Implements:
- Edge RAL components (WASM/Swift/Kotlin schemas)
- Anonymization Proxy (PII fuzzing)
- Zero-Knowledge Storage patterns
- Secure context transmission
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional
import hashlib
import hmac
import json
import re
import secrets

import structlog

from app.core.config import settings

logger = structlog.get_logger()


class PrivacyLevel(str, Enum):
    """Privacy levels for context data."""
    PUBLIC = "public"           # Can be sent to cloud
    PRIVATE = "private"         # Must be anonymized before cloud
    SENSITIVE = "sensitive"     # Edge-only, never sent
    PII = "pii"                 # Requires strong anonymization


class DataCategory(str, Enum):
    """Categories of data for privacy processing."""
    LOCATION = "location"
    PERSONAL = "personal"
    FINANCIAL = "financial"
    HEALTH = "health"
    BEHAVIORAL = "behavioral"
    TEMPORAL = "temporal"
    DEVICE = "device"


@dataclass
class AnonymizationRule:
    """Rule for anonymizing specific data types."""
    category: DataCategory
    pattern: Optional[str] = None       # Regex pattern to match
    replacement_strategy: str = "fuzz"  # fuzz, hash, generalize, suppress
    granularity: str = "medium"         # fine, medium, coarse
    
    def apply(self, value: Any, salt: str = "") -> Any:
        """Apply the anonymization rule to a value."""
        if value is None:
            return None
            
        if self.replacement_strategy == "suppress":
            return "[REDACTED]"
        elif self.replacement_strategy == "hash":
            return self._hash_value(str(value), salt)
        elif self.replacement_strategy == "generalize":
            return self._generalize_value(value)
        else:  # fuzz
            return self._fuzz_value(value)
    
    def _hash_value(self, value: str, salt: str) -> str:
        """Hash a value with optional salt."""
        key = (salt or secrets.token_hex(8)).encode()
        return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()[:16]
    
    def _generalize_value(self, value: Any) -> Any:
        """Generalize value to less specific form."""
        if self.category == DataCategory.LOCATION:
            return self._generalize_location(value)
        elif self.category == DataCategory.TEMPORAL:
            return self._generalize_temporal(value)
        elif self.category == DataCategory.PERSONAL:
            return "[PERSONAL DATA]"
        return str(value)[:10] + "..."
    
    def _fuzz_value(self, value: Any) -> Any:
        """Fuzz value while preserving utility."""
        if self.category == DataCategory.LOCATION:
            return self._fuzz_location(value)
        elif self.category == DataCategory.TEMPORAL:
            return self._fuzz_temporal(value)
        elif self.category == DataCategory.PERSONAL:
            return self._fuzz_personal(value)
        return value
    
    def _generalize_location(self, value: Any) -> str:
        """Generalize location to region level."""
        if isinstance(value, dict):
            # Return only region/country
            parts = []
            if value.get("region"):
                parts.append(f"Region: {value['region']}")
            if value.get("country"):
                parts.append(value["country"])
            return ", ".join(parts) if parts else "Unknown Region"
        elif isinstance(value, str):
            # Extract region keywords
            regions = ["Manhattan", "Brooklyn", "Downtown", "Midtown", 
                      "North", "South", "East", "West", "Central"]
            for region in regions:
                if region.lower() in value.lower():
                    return f"Region: {region}"
            return "Region: Unspecified"
        return "Unknown Region"
    
    def _generalize_temporal(self, value: Any) -> str:
        """Generalize time to period level."""
        if isinstance(value, datetime):
            hour = value.hour
            if 6 <= hour < 12:
                return "Morning"
            elif 12 <= hour < 17:
                return "Afternoon"
            elif 17 <= hour < 21:
                return "Evening"
            else:
                return "Night"
        return "Unspecified time"
    
    def _fuzz_location(self, value: Any) -> Any:
        """Fuzz location - e.g., '123 Main St' -> 'Region: Manhattan'."""
        if isinstance(value, dict):
            fuzzed = {}
            # Keep region/city/country, remove street-level
            if value.get("region"):
                fuzzed["region"] = value["region"]
            if value.get("city"):
                fuzzed["city"] = value["city"]
            if value.get("country"):
                fuzzed["country"] = value["country"]
            # Fuzz coordinates
            if value.get("latitude"):
                fuzzed["latitude_approx"] = round(value["latitude"], 1)
            if value.get("longitude"):
                fuzzed["longitude_approx"] = round(value["longitude"], 1)
            return fuzzed
        elif isinstance(value, str):
            # Remove specific addresses
            address_pattern = r'\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive)'
            if re.search(address_pattern, value, re.IGNORECASE):
                return re.sub(address_pattern, "[Address Redacted]", value)
            return value
        return value
    
    def _fuzz_temporal(self, value: Any) -> Any:
        """Fuzz time - reduce precision."""
        if isinstance(value, datetime):
            return value.replace(minute=0, second=0, microsecond=0)
        return value
    
    def _fuzz_personal(self, value: Any) -> str:
        """Fuzz personal data."""
        if isinstance(value, str):
            # Email fuzzing
            if "@" in value:
                local, domain = value.split("@", 1)
                return f"{local[:2]}***@{domain}"
            # Phone fuzzing
            if re.match(r'[\d\-\+\(\)\s]{10,}', value):
                return value[:3] + "****" + value[-2:]
            # Name fuzzing
            words = value.split()
            if len(words) >= 2:
                return f"{words[0][0]}. {words[-1][0]}."
        return "[PERSONAL]"


@dataclass
class EdgeContext:
    """
    Context prepared for Edge RAL processing.
    
    Schema compatible with WASM/Swift/Kotlin implementations.
    """
    context_id: str
    user_id_hash: str               # Hashed, never raw
    timestamp_epoch: int            # Unix timestamp
    context_type: str
    
    # Anonymized payload
    payload: dict = field(default_factory=dict)
    
    # Privacy metadata
    privacy_level: PrivacyLevel = PrivacyLevel.PRIVATE
    anonymization_applied: list[str] = field(default_factory=list)
    
    # Transmission control
    can_sync_to_cloud: bool = True
    requires_encryption: bool = True
    ttl_seconds: int = 3600
    
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "context_id": self.context_id,
            "user_id_hash": self.user_id_hash,
            "timestamp_epoch": self.timestamp_epoch,
            "context_type": self.context_type,
            "payload": self.payload,
            "privacy_level": self.privacy_level.value,
            "anonymization_applied": self.anonymization_applied,
            "can_sync_to_cloud": self.can_sync_to_cloud,
            "requires_encryption": self.requires_encryption,
            "ttl_seconds": self.ttl_seconds,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "EdgeContext":
        """Create from dictionary."""
        return cls(
            context_id=data["context_id"],
            user_id_hash=data["user_id_hash"],
            timestamp_epoch=data["timestamp_epoch"],
            context_type=data["context_type"],
            payload=data.get("payload", {}),
            privacy_level=PrivacyLevel(data.get("privacy_level", "private")),
            anonymization_applied=data.get("anonymization_applied", []),
            can_sync_to_cloud=data.get("can_sync_to_cloud", True),
            requires_encryption=data.get("requires_encryption", True),
            ttl_seconds=data.get("ttl_seconds", 3600),
        )


@dataclass
class ZeroKnowledgeToken:
    """
    Zero-knowledge proof token for context verification.
    
    Allows verification without revealing actual content.
    """
    token_id: str
    commitment: str                 # Hash commitment
    timestamp: int
    expiry: int
    proof_type: str = "hmac"        # hmac, zkp
    
    def verify(self, secret: str, value: str) -> bool:
        """Verify that value matches commitment."""
        expected = hmac.new(
            secret.encode(),
            value.encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, self.commitment)


class AnonymizationProxy:
    """
    Proxy that anonymizes context before cloud transmission.
    
    Applies privacy rules based on data category and user settings.
    """
    
    # Default anonymization rules
    DEFAULT_RULES = [
        AnonymizationRule(
            category=DataCategory.LOCATION,
            replacement_strategy="fuzz",
            granularity="medium",
        ),
        AnonymizationRule(
            category=DataCategory.PERSONAL,
            pattern=r'[\w\.-]+@[\w\.-]+\.\w+',  # Email
            replacement_strategy="fuzz",
        ),
        AnonymizationRule(
            category=DataCategory.PERSONAL,
            pattern=r'[\d\-\+\(\)]{10,}',  # Phone
            replacement_strategy="fuzz",
        ),
        AnonymizationRule(
            category=DataCategory.FINANCIAL,
            replacement_strategy="suppress",
        ),
        AnonymizationRule(
            category=DataCategory.HEALTH,
            replacement_strategy="suppress",
        ),
    ]
    
    def __init__(
        self,
        rules: Optional[list[AnonymizationRule]] = None,
        salt: Optional[str] = None,
    ):
        """
        Initialize the proxy.
        
        Args:
            rules: Anonymization rules to apply
            salt: Salt for hashing operations
        """
        self.rules = rules or self.DEFAULT_RULES
        self.salt = salt or secrets.token_hex(16)
        self._rule_map: dict[DataCategory, list[AnonymizationRule]] = {}
        
        for rule in self.rules:
            if rule.category not in self._rule_map:
                self._rule_map[rule.category] = []
            self._rule_map[rule.category].append(rule)
    
    def anonymize_context(
        self,
        raw_context: dict,
        user_id: str,
        context_type: str,
    ) -> EdgeContext:
        """
        Anonymize raw context for edge/cloud processing.
        
        Args:
            raw_context: Raw context data
            user_id: User identifier
            context_type: Type of context
            
        Returns:
            Anonymized EdgeContext
        """
        # Hash user ID
        user_id_hash = self._hash_user_id(user_id)
        
        # Categorize and anonymize fields
        payload = {}
        anonymization_applied = []
        
        for key, value in raw_context.items():
            category = self._categorize_field(key, value)
            rules = self._rule_map.get(category, [])
            
            if rules:
                for rule in rules:
                    value = rule.apply(value, self.salt)
                    if rule.replacement_strategy != "none":
                        anonymization_applied.append(
                            f"{key}:{rule.replacement_strategy}"
                        )
            
            payload[key] = value
        
        # Determine privacy level
        privacy_level = self._determine_privacy_level(raw_context)
        
        # Create edge context
        return EdgeContext(
            context_id=secrets.token_hex(16),
            user_id_hash=user_id_hash,
            timestamp_epoch=int(datetime.now(timezone.utc).timestamp()),
            context_type=context_type,
            payload=payload,
            privacy_level=privacy_level,
            anonymization_applied=anonymization_applied,
            can_sync_to_cloud=privacy_level != PrivacyLevel.SENSITIVE,
            requires_encryption=privacy_level in (
                PrivacyLevel.PRIVATE, 
                PrivacyLevel.SENSITIVE,
                PrivacyLevel.PII,
            ),
        )
    
    def _hash_user_id(self, user_id: str) -> str:
        """Create a hashed user identifier."""
        return hmac.new(
            self.salt.encode(),
            user_id.encode(),
            hashlib.sha256
        ).hexdigest()[:32]
    
    def _categorize_field(self, key: str, value: Any) -> DataCategory:
        """Categorize a field based on key and value patterns."""
        key_lower = key.lower()
        
        # Location indicators
        if any(kw in key_lower for kw in 
               ["location", "address", "city", "country", "lat", "lon", "geo"]):
            return DataCategory.LOCATION
        
        # Personal indicators
        if any(kw in key_lower for kw in 
               ["name", "email", "phone", "user", "profile"]):
            return DataCategory.PERSONAL
        
        # Financial indicators
        if any(kw in key_lower for kw in 
               ["payment", "card", "bank", "account", "balance"]):
            return DataCategory.FINANCIAL
        
        # Health indicators
        if any(kw in key_lower for kw in 
               ["health", "medical", "heart", "fitness", "sleep"]):
            return DataCategory.HEALTH
        
        # Temporal indicators
        if any(kw in key_lower for kw in 
               ["time", "date", "schedule", "calendar"]):
            return DataCategory.TEMPORAL
        
        # Device indicators
        if any(kw in key_lower for kw in 
               ["device", "battery", "network", "sensor"]):
            return DataCategory.DEVICE
        
        # Default to behavioral
        return DataCategory.BEHAVIORAL
    
    def _determine_privacy_level(self, context: dict) -> PrivacyLevel:
        """Determine overall privacy level for context."""
        has_pii = False
        has_sensitive = False
        
        for key, value in context.items():
            category = self._categorize_field(key, value)
            
            if category in (DataCategory.FINANCIAL, DataCategory.HEALTH):
                has_sensitive = True
            elif category == DataCategory.PERSONAL:
                has_pii = True
        
        if has_sensitive:
            return PrivacyLevel.SENSITIVE
        elif has_pii:
            return PrivacyLevel.PII
        else:
            return PrivacyLevel.PRIVATE


class ZeroKnowledgeStorage:
    """
    Zero-Knowledge Storage for sensitive context.
    
    Stores commitments rather than actual values,
    allowing verification without exposure.
    """
    
    def __init__(self, secret_key: Optional[str] = None):
        """
        Initialize ZK storage.
        
        Args:
            secret_key: Secret key for commitments
        """
        self.secret_key = secret_key or secrets.token_hex(32)
        self._commitments: dict[str, ZeroKnowledgeToken] = {}
    
    def store_commitment(
        self,
        context_id: str,
        value: str,
        ttl_seconds: int = 3600,
    ) -> ZeroKnowledgeToken:
        """
        Store a zero-knowledge commitment.
        
        Args:
            context_id: Identifier for the context
            value: Value to commit (not stored)
            ttl_seconds: Time-to-live
            
        Returns:
            ZK token for verification
        """
        now = int(datetime.now(timezone.utc).timestamp())
        
        # Create commitment (hash of value)
        commitment = hmac.new(
            self.secret_key.encode(),
            value.encode(),
            hashlib.sha256
        ).hexdigest()
        
        token = ZeroKnowledgeToken(
            token_id=context_id,
            commitment=commitment,
            timestamp=now,
            expiry=now + ttl_seconds,
        )
        
        self._commitments[context_id] = token
        return token
    
    def verify_value(self, context_id: str, claimed_value: str) -> bool:
        """
        Verify a claimed value against stored commitment.
        
        Args:
            context_id: Identifier for the context
            claimed_value: Value to verify
            
        Returns:
            True if value matches commitment
        """
        token = self._commitments.get(context_id)
        if not token:
            return False
        
        # Check expiry
        now = int(datetime.now(timezone.utc).timestamp())
        if now > token.expiry:
            del self._commitments[context_id]
            return False
        
        return token.verify(self.secret_key, claimed_value)
    
    def get_token(self, context_id: str) -> Optional[ZeroKnowledgeToken]:
        """Get a stored token."""
        return self._commitments.get(context_id)
    
    def cleanup_expired(self) -> int:
        """Remove expired commitments."""
        now = int(datetime.now(timezone.utc).timestamp())
        expired = [
            cid for cid, token in self._commitments.items()
            if now > token.expiry
        ]
        for cid in expired:
            del self._commitments[cid]
        return len(expired)


class PrivacyShield:
    """
    Main Privacy Shield coordinator.
    
    Orchestrates anonymization, edge processing, and ZK storage.
    """
    
    def __init__(
        self,
        anonymization_proxy: Optional[AnonymizationProxy] = None,
        zk_storage: Optional[ZeroKnowledgeStorage] = None,
    ):
        """
        Initialize Privacy Shield.
        
        Args:
            anonymization_proxy: Proxy for anonymization
            zk_storage: Zero-knowledge storage
        """
        self.proxy = anonymization_proxy or AnonymizationProxy()
        self.zk_storage = zk_storage or ZeroKnowledgeStorage()
    
    def process_for_cloud(
        self,
        raw_context: dict,
        user_id: str,
        context_type: str,
    ) -> tuple[EdgeContext, Optional[ZeroKnowledgeToken]]:
        """
        Process context for cloud transmission.
        
        Args:
            raw_context: Raw context data
            user_id: User identifier
            context_type: Type of context
            
        Returns:
            Tuple of (anonymized context, optional ZK token)
        """
        # Anonymize context
        edge_context = self.proxy.anonymize_context(
            raw_context, user_id, context_type
        )
        
        # Create ZK commitment for sensitive data
        zk_token = None
        if edge_context.privacy_level in (PrivacyLevel.SENSITIVE, PrivacyLevel.PII):
            # Store commitment for original data
            original_json = json.dumps(raw_context, sort_keys=True, default=str)
            zk_token = self.zk_storage.store_commitment(
                edge_context.context_id,
                original_json,
                ttl_seconds=edge_context.ttl_seconds,
            )
        
        logger.info(
            "Context processed for cloud",
            context_id=edge_context.context_id,
            privacy_level=edge_context.privacy_level.value,
            anonymizations=len(edge_context.anonymization_applied),
            has_zk_token=zk_token is not None,
        )
        
        return edge_context, zk_token
    
    def verify_context_integrity(
        self,
        context_id: str,
        claimed_original: dict,
    ) -> bool:
        """
        Verify that claimed original data matches stored commitment.
        
        Args:
            context_id: Context identifier
            claimed_original: Claimed original data
            
        Returns:
            True if verified
        """
        claimed_json = json.dumps(claimed_original, sort_keys=True, default=str)
        return self.zk_storage.verify_value(context_id, claimed_json)


# Edge RAL Schema (for WASM/Swift/Kotlin implementations)
EDGE_RAL_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "EdgeRALContext",
    "description": "Schema for Edge RAL context compatible with WASM/Swift/Kotlin",
    "type": "object",
    "required": ["context_id", "user_id_hash", "timestamp_epoch", "context_type"],
    "properties": {
        "context_id": {
            "type": "string",
            "pattern": "^[a-f0-9]{32}$",
            "description": "Unique context identifier (hex)"
        },
        "user_id_hash": {
            "type": "string",
            "pattern": "^[a-f0-9]{32}$",
            "description": "Hashed user identifier"
        },
        "timestamp_epoch": {
            "type": "integer",
            "minimum": 0,
            "description": "Unix timestamp in seconds"
        },
        "context_type": {
            "type": "string",
            "enum": ["temporal", "spatial", "situational", "meta"],
            "description": "Type of context"
        },
        "payload": {
            "type": "object",
            "description": "Anonymized context payload"
        },
        "privacy_level": {
            "type": "string",
            "enum": ["public", "private", "sensitive", "pii"],
            "default": "private"
        },
        "anonymization_applied": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of anonymizations applied"
        },
        "can_sync_to_cloud": {
            "type": "boolean",
            "default": True
        },
        "requires_encryption": {
            "type": "boolean", 
            "default": True
        },
        "ttl_seconds": {
            "type": "integer",
            "minimum": 0,
            "default": 3600
        }
    }
}


# Global instances
anonymization_proxy = AnonymizationProxy()
zk_storage = ZeroKnowledgeStorage()
privacy_shield = PrivacyShield(anonymization_proxy, zk_storage)
