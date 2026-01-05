"""
Assumption Resolver Engine

Resolves ambiguous references with confidence scoring.
The intelligence layer that decides when to ask vs. assume.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import re

import structlog

from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine
from app.schemas.temporal import (
    TemporalContext,
    TimeReference,
    ResolvedTimeReference,
)
from app.schemas.spatial import SpatialContext, LocationReference

logger = structlog.get_logger()


class ReferenceType(str, Enum):
    """Types of references that can be resolved."""
    
    TEMPORAL = "temporal"
    SPATIAL = "spatial"
    ENTITY = "entity"
    TASK = "task"
    UNKNOWN = "unknown"


@dataclass
class ResolutionCandidate:
    """A possible resolution for an ambiguous reference."""
    
    value: Any
    confidence: float
    method: str
    reasoning: str


@dataclass
class ResolutionResult:
    """Result of resolving an ambiguous reference."""
    
    original_reference: str
    reference_type: ReferenceType
    resolved_value: Any
    confidence: float
    method: str
    reasoning: str
    needs_clarification: bool
    clarification_prompt: Optional[str]
    alternative_candidates: list[ResolutionCandidate]


class AssumptionResolver:
    """
    Assumption Resolver Engine
    
    Responsible for:
    - Detecting ambiguous references in user input
    - Resolving references using available context
    - Scoring confidence in resolutions
    - Deciding when to ask for clarification
    
    Core principle: Never silently assume when confidence is low.
    """
    
    # Confidence thresholds
    HIGH_CONFIDENCE_THRESHOLD = 0.8
    CLARIFICATION_THRESHOLD = 0.5
    REJECT_THRESHOLD = 0.2
    
    # Patterns for detecting references
    TEMPORAL_PATTERNS = [
        r"\btoday\b",
        r"\byesterday\b",
        r"\btomorrow\b",
        r"\bnow\b",
        r"\bearlier\b",
        r"\blater\b",
        r"\bthis morning\b",
        r"\bthis afternoon\b",
        r"\bthis evening\b",
        r"\btonight\b",
        r"\blast night\b",
        r"\bthis week\b",
        r"\blast week\b",
        r"\bnext week\b",
    ]
    
    SPATIAL_PATTERNS = [
        r"\bhere\b",
        r"\bthis place\b",
        r"\bnearby\b",
        r"\blocal\b",
        r"\baround here\b",
    ]
    
    PRONOUN_PATTERNS = [
        r"\bit\b",
        r"\bthis\b",
        r"\bthat\b",
        r"\bthese\b",
        r"\bthose\b",
        r"\bthe same\b",
    ]
    
    def __init__(
        self,
        temporal_engine: TemporalEngine,
        spatial_engine: SpatialEngine,
        confidence_threshold: float = 0.5,
    ):
        """
        Initialize the Assumption Resolver.
        
        Args:
            temporal_engine: Engine for temporal resolution
            spatial_engine: Engine for spatial resolution
            confidence_threshold: Threshold for clarification
        """
        self.temporal_engine = temporal_engine
        self.spatial_engine = spatial_engine
        self.confidence_threshold = confidence_threshold
        
        logger.info(
            "Assumption resolver initialized",
            confidence_threshold=confidence_threshold
        )
    
    def detect_references(self, text: str) -> list[tuple[str, ReferenceType, int, int]]:
        """
        Detect ambiguous references in text.
        
        Args:
            text: User input text
            
        Returns:
            List of (reference_text, type, start_pos, end_pos)
        """
        references = []
        
        # Check temporal patterns
        for pattern in self.TEMPORAL_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                references.append((
                    match.group(),
                    ReferenceType.TEMPORAL,
                    match.start(),
                    match.end(),
                ))
        
        # Check spatial patterns
        for pattern in self.SPATIAL_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                references.append((
                    match.group(),
                    ReferenceType.SPATIAL,
                    match.start(),
                    match.end(),
                ))
        
        # Check pronoun patterns (potential entity references)
        for pattern in self.PRONOUN_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                # Only flag if not at start of sentence (likely referring to something)
                if match.start() > 0 and text[match.start() - 1] not in ".!?":
                    references.append((
                        match.group(),
                        ReferenceType.ENTITY,
                        match.start(),
                        match.end(),
                    ))
        
        # Sort by position
        references.sort(key=lambda x: x[2])
        
        return references
    
    def resolve(
        self,
        reference: str,
        reference_type: ReferenceType,
        temporal_context: Optional[TemporalContext] = None,
        spatial_context: Optional[SpatialContext] = None,
        conversation_history: Optional[list[dict]] = None,
    ) -> ResolutionResult:
        """
        Resolve an ambiguous reference.
        
        Args:
            reference: The reference text to resolve
            reference_type: Type of reference
            temporal_context: Current temporal context
            spatial_context: Current spatial context
            conversation_history: Previous messages for entity resolution
            
        Returns:
            Resolution result with confidence
        """
        if reference_type == ReferenceType.TEMPORAL:
            return self._resolve_temporal(reference, temporal_context)
        
        if reference_type == ReferenceType.SPATIAL:
            return self._resolve_spatial(reference, spatial_context)
        
        if reference_type == ReferenceType.ENTITY:
            return self._resolve_entity(reference, conversation_history)
        
        # Unknown type
        return ResolutionResult(
            original_reference=reference,
            reference_type=ReferenceType.UNKNOWN,
            resolved_value=None,
            confidence=0.1,
            method="unknown_type",
            reasoning="Reference type not recognized",
            needs_clarification=True,
            clarification_prompt=f"I'm not sure what '{reference}' refers to. Can you clarify?",
            alternative_candidates=[],
        )
    
    def resolve_all(
        self,
        text: str,
        temporal_context: Optional[TemporalContext] = None,
        spatial_context: Optional[SpatialContext] = None,
        conversation_history: Optional[list[dict]] = None,
    ) -> list[ResolutionResult]:
        """
        Detect and resolve all references in text.
        
        Args:
            text: User input text
            temporal_context: Current temporal context
            spatial_context: Current spatial context
            conversation_history: Previous messages
            
        Returns:
            List of resolution results
        """
        references = self.detect_references(text)
        
        results = []
        for ref_text, ref_type, _, _ in references:
            result = self.resolve(
                reference=ref_text,
                reference_type=ref_type,
                temporal_context=temporal_context,
                spatial_context=spatial_context,
                conversation_history=conversation_history,
            )
            results.append(result)
        
        return results
    
    def get_clarifications_needed(
        self,
        results: list[ResolutionResult],
    ) -> list[str]:
        """
        Get list of clarification prompts for low-confidence resolutions.
        
        Args:
            results: Resolution results
            
        Returns:
            List of clarification prompts
        """
        return [
            r.clarification_prompt
            for r in results
            if r.needs_clarification and r.clarification_prompt
        ]
    
    def _resolve_temporal(
        self,
        reference: str,
        context: Optional[TemporalContext],
    ) -> ResolutionResult:
        """Resolve a temporal reference."""
        
        if not context:
            return ResolutionResult(
                original_reference=reference,
                reference_type=ReferenceType.TEMPORAL,
                resolved_value=None,
                confidence=0.2,
                method="no_context",
                reasoning="No temporal context available",
                needs_clarification=True,
                clarification_prompt=f"What time or date does '{reference}' refer to?",
                alternative_candidates=[],
            )
        
        # Use temporal engine to resolve
        time_ref = TimeReference(reference_text=reference)
        resolved = self.temporal_engine.resolve_reference(time_ref, context)
        
        # Build result
        needs_clarification = resolved.confidence < self.confidence_threshold
        clarification_prompt = None
        
        if needs_clarification:
            if resolved.is_ambiguous and resolved.alternative_resolutions:
                options = [alt.get("human_readable", str(alt)) for alt in resolved.alternative_resolutions[:3]]
                clarification_prompt = f"'{reference}' could mean: {', '.join(options)}. Which did you mean?"
            else:
                clarification_prompt = f"I interpreted '{reference}' as {resolved.human_readable}. Is that correct?"
        
        # Build alternative candidates
        alternatives = [
            ResolutionCandidate(
                value=alt,
                confidence=alt.get("confidence", 0.5),
                method="alternative",
                reasoning=f"Alternative interpretation: {alt.get('human_readable', str(alt))}",
            )
            for alt in resolved.alternative_resolutions
        ]
        
        return ResolutionResult(
            original_reference=reference,
            reference_type=ReferenceType.TEMPORAL,
            resolved_value={
                "start": resolved.resolved_start.isoformat(),
                "end": resolved.resolved_end.isoformat() if resolved.resolved_end else None,
                "human_readable": resolved.human_readable,
            },
            confidence=resolved.confidence,
            method=resolved.resolution_method,
            reasoning=f"Resolved '{reference}' to {resolved.human_readable}",
            needs_clarification=needs_clarification,
            clarification_prompt=clarification_prompt,
            alternative_candidates=alternatives,
        )
    
    def _resolve_spatial(
        self,
        reference: str,
        context: Optional[SpatialContext],
    ) -> ResolutionResult:
        """Resolve a spatial reference."""
        
        if not context:
            return ResolutionResult(
                original_reference=reference,
                reference_type=ReferenceType.SPATIAL,
                resolved_value=None,
                confidence=0.2,
                method="no_context",
                reasoning="No spatial context available",
                needs_clarification=True,
                clarification_prompt=f"What location does '{reference}' refer to?",
                alternative_candidates=[],
            )
        
        # Use spatial engine to resolve
        loc_ref = LocationReference(reference_text=reference)
        resolved = self.spatial_engine.resolve_location_reference(loc_ref, context)
        
        needs_clarification = resolved.confidence < self.confidence_threshold
        clarification_prompt = None
        
        if needs_clarification:
            if resolved.fell_back_to_default:
                clarification_prompt = f"I couldn't determine '{reference}'. {resolved.default_reason}"
            else:
                clarification_prompt = f"Did you mean {resolved.resolved_location}?"
        
        return ResolutionResult(
            original_reference=reference,
            reference_type=ReferenceType.SPATIAL,
            resolved_value=resolved.resolved_location,
            confidence=resolved.confidence,
            method=resolved.resolution_method,
            reasoning=f"Resolved '{reference}' using {resolved.resolution_method}",
            needs_clarification=needs_clarification,
            clarification_prompt=clarification_prompt,
            alternative_candidates=[],
        )
    
    def _resolve_entity(
        self,
        reference: str,
        conversation_history: Optional[list[dict]],
    ) -> ResolutionResult:
        """Resolve an entity reference (it, this, that, etc.)."""
        
        if not conversation_history:
            return ResolutionResult(
                original_reference=reference,
                reference_type=ReferenceType.ENTITY,
                resolved_value=None,
                confidence=0.3,
                method="no_history",
                reasoning="No conversation history to resolve reference",
                needs_clarification=True,
                clarification_prompt=f"What does '{reference}' refer to?",
                alternative_candidates=[],
            )
        
        # Simple entity resolution: Look for recent nouns/topics
        # In production, this would use more sophisticated NLP
        candidates = self._extract_entity_candidates(conversation_history)
        
        if not candidates:
            return ResolutionResult(
                original_reference=reference,
                reference_type=ReferenceType.ENTITY,
                resolved_value=None,
                confidence=0.3,
                method="no_candidates",
                reasoning="Could not find entity candidates in history",
                needs_clarification=True,
                clarification_prompt=f"I'm not sure what '{reference}' refers to. Can you be more specific?",
                alternative_candidates=[],
            )
        
        # Take the most recent candidate as primary
        primary = candidates[0]
        confidence = 0.6 if len(candidates) == 1 else 0.4
        
        alternative_candidates = [
            ResolutionCandidate(
                value=c,
                confidence=0.4,
                method="history_search",
                reasoning=f"Found '{c}' in recent conversation",
            )
            for c in candidates[1:3]
        ]
        
        needs_clarification = confidence < self.confidence_threshold or len(candidates) > 1
        clarification_prompt = None
        
        if needs_clarification and len(candidates) > 1:
            clarification_prompt = f"Does '{reference}' refer to: {', '.join(candidates[:3])}?"
        
        return ResolutionResult(
            original_reference=reference,
            reference_type=ReferenceType.ENTITY,
            resolved_value=primary,
            confidence=confidence,
            method="history_most_recent",
            reasoning=f"Assuming '{reference}' refers to '{primary}' from recent context",
            needs_clarification=needs_clarification,
            clarification_prompt=clarification_prompt,
            alternative_candidates=alternative_candidates,
        )
    
    def _extract_entity_candidates(
        self,
        conversation_history: list[dict],
    ) -> list[str]:
        """
        Extract potential entity references from conversation history.
        
        This is a simplified implementation. Production would use NER.
        """
        candidates = []
        
        # Look at recent messages (last 5)
        recent = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
        
        # Simple pattern: Look for quoted items, capitalized words, etc.
        for msg in reversed(recent):
            content = msg.get("content", "")
            
            # Find quoted strings
            quoted = re.findall(r'"([^"]+)"', content)
            candidates.extend(quoted)
            
            # Find capitalized multi-word phrases (potential proper nouns)
            proper = re.findall(r'\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b', content)
            candidates.extend(proper)
        
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for c in candidates:
            if c.lower() not in seen:
                seen.add(c.lower())
                unique.append(c)
        
        return unique[:5]  # Return top 5
    
    def calculate_overall_confidence(
        self,
        results: list[ResolutionResult],
    ) -> float:
        """
        Calculate overall confidence from multiple resolutions.
        
        Uses minimum confidence as the bottleneck.
        
        Args:
            results: List of resolution results
            
        Returns:
            Overall confidence score
        """
        if not results:
            return 1.0
        
        # Overall confidence is limited by lowest individual confidence
        return min(r.confidence for r in results)
    
    def format_for_prompt(
        self,
        results: list[ResolutionResult],
    ) -> str:
        """
        Format resolved references for prompt injection.
        
        Args:
            results: Resolution results
            
        Returns:
            Formatted string for injection
        """
        if not results:
            return ""
        
        parts = []
        
        for result in results:
            if result.confidence >= self.HIGH_CONFIDENCE_THRESHOLD:
                # High confidence - state as fact
                if result.reference_type == ReferenceType.TEMPORAL:
                    val = result.resolved_value
                    parts.append(f"'{result.original_reference}' = {val.get('human_readable', val)}")
                elif result.reference_type == ReferenceType.SPATIAL:
                    parts.append(f"'{result.original_reference}' = {result.resolved_value}")
            elif result.confidence >= self.confidence_threshold:
                # Medium confidence - note the assumption
                if result.reference_type == ReferenceType.TEMPORAL:
                    val = result.resolved_value
                    parts.append(f"'{result.original_reference}' likely refers to {val.get('human_readable', val)}")
        
        if parts:
            return "Reference resolutions: " + "; ".join(parts)
        
        return ""
