"""
Prompt Composition Engine

The core intelligence that decides what context to inject into prompts.
Implements minimal inclusion logic, relevance scoring, and provider-agnostic
context formatting.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json

import structlog

from app.core.config import settings
from app.schemas.context import ContextConfidence, ContextSource

logger = structlog.get_logger()


class ContextRelevance(str, Enum):
    """Relevance levels for context inclusion decisions."""
    CRITICAL = "critical"      # Must include (e.g., current time for time-sensitive query)
    HIGH = "high"              # Should include (e.g., timezone for scheduling)
    MEDIUM = "medium"          # May include if space permits
    LOW = "low"                # Include only if explicitly relevant
    IRRELEVANT = "irrelevant"  # Do not include


class InjectionStyle(str, Enum):
    """Styles for context injection."""
    SYSTEM_PROMPT = "system_prompt"    # Inject as system instructions
    CONTEXT_BLOCK = "context_block"    # Inject as structured context block
    INLINE = "inline"                  # Inject inline with user message
    METADATA = "metadata"              # Pass as API metadata (if supported)


@dataclass
class ContextElement:
    """
    A single context element for injection consideration.
    
    Attributes:
        key: Context identifier
        value: Context value
        context_type: Category (temporal, spatial, etc.)
        relevance: Calculated relevance
        confidence: Confidence in this context
        token_estimate: Estimated tokens when serialized
    """
    key: str
    value: Any
    context_type: str
    relevance: ContextRelevance
    confidence: float
    token_estimate: int
    source: str = "inferred"
    interpretation: Optional[str] = None
    
    @property
    def should_include(self) -> bool:
        """Determine if element should be included."""
        return (
            self.relevance in [ContextRelevance.CRITICAL, ContextRelevance.HIGH] and
            self.confidence >= settings.DEFAULT_CONFIDENCE_THRESHOLD
        )
    
    @property
    def inclusion_score(self) -> float:
        """Calculate inclusion priority score."""
        relevance_weights = {
            ContextRelevance.CRITICAL: 1.0,
            ContextRelevance.HIGH: 0.8,
            ContextRelevance.MEDIUM: 0.5,
            ContextRelevance.LOW: 0.2,
            ContextRelevance.IRRELEVANT: 0.0,
        }
        return relevance_weights[self.relevance] * self.confidence


@dataclass
class ComposedPrompt:
    """
    The final composed prompt with context injected.
    
    Attributes:
        system_context: Context for system prompt
        user_message: Original or augmented user message
        metadata: Additional metadata for API calls
        included_context: List of included context elements
        excluded_context: List of excluded context elements
        total_tokens: Estimated total context tokens
    """
    system_context: str
    user_message: str
    metadata: dict = field(default_factory=dict)
    included_context: list[ContextElement] = field(default_factory=list)
    excluded_context: list[ContextElement] = field(default_factory=list)
    total_tokens: int = 0
    composition_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> dict:
        return {
            "system_context": self.system_context,
            "user_message": self.user_message,
            "metadata": self.metadata,
            "included_context_count": len(self.included_context),
            "excluded_context_count": len(self.excluded_context),
            "total_tokens": self.total_tokens,
            "composition_time": self.composition_time.isoformat(),
        }
    
    def get_full_system_prompt(self, base_prompt: Optional[str] = None) -> str:
        """Get complete system prompt with context."""
        parts = []
        if base_prompt:
            parts.append(base_prompt)
        if self.system_context:
            parts.append(self.system_context)
        return "\n\n".join(parts)


@dataclass
class CompositionDecision:
    """
    Explanation of why context was included or excluded.
    """
    element_key: str
    included: bool
    reason: str
    relevance: ContextRelevance
    confidence: float


class PromptComposer:
    """
    Engine for composing prompts with minimal, relevant context injection.
    
    The composer analyzes the user's message and available context to
    determine what context is relevant, then formats it for injection
    while respecting token budgets.
    """
    
    # Keywords that indicate temporal relevance
    TEMPORAL_KEYWORDS = [
        "today", "tomorrow", "yesterday", "now", "later", "soon",
        "morning", "afternoon", "evening", "night", "week", "month",
        "schedule", "meeting", "deadline", "when", "time", "date",
        "remind", "appointment", "calendar", "o'clock", "am", "pm",
    ]
    
    # Keywords that indicate spatial relevance
    SPATIAL_KEYWORDS = [
        "here", "there", "near", "nearby", "local", "location",
        "weather", "timezone", "country", "city", "region",
        "restaurant", "store", "place", "address", "directions",
    ]
    
    # Keywords that indicate situational relevance
    SITUATIONAL_KEYWORDS = [
        "this", "that", "it", "they", "continue", "again",
        "same", "previous", "earlier", "before", "last time",
        "as i said", "mentioned", "working on", "project",
    ]
    
    def __init__(
        self,
        max_tokens: int = settings.MAX_CONTEXT_TOKENS,
        min_relevance: float = settings.MIN_RELEVANCE_SCORE,
    ):
        """
        Initialize the Prompt Composer.
        
        Args:
            max_tokens: Maximum tokens for context injection
            min_relevance: Minimum relevance score for inclusion
        """
        self.max_tokens = max_tokens
        self.min_relevance = min_relevance
    
    def compose(
        self,
        user_message: str,
        temporal_context: Optional[dict] = None,
        spatial_context: Optional[dict] = None,
        situational_context: Optional[dict] = None,
        user_preferences: Optional[dict] = None,
        injection_style: InjectionStyle = InjectionStyle.SYSTEM_PROMPT,
    ) -> ComposedPrompt:
        """
        Compose a prompt with appropriate context injection.
        
        Args:
            user_message: The user's original message
            temporal_context: Temporal context interpretation
            spatial_context: Spatial context interpretation  
            situational_context: Situational context interpretation
            user_preferences: User's context preferences
            injection_style: How to inject context
            
        Returns:
            Composed prompt with context
        """
        logger.debug(
            "Composing prompt",
            message_length=len(user_message),
            has_temporal=temporal_context is not None,
            has_spatial=spatial_context is not None,
            has_situational=situational_context is not None,
        )
        
        # Analyze message for relevance signals
        relevance_signals = self._analyze_message(user_message)
        
        # Build context elements with relevance scores
        elements = []
        
        if temporal_context:
            elements.extend(
                self._build_temporal_elements(temporal_context, relevance_signals)
            )
        
        if spatial_context:
            elements.extend(
                self._build_spatial_elements(spatial_context, relevance_signals)
            )
        
        if situational_context:
            elements.extend(
                self._build_situational_elements(situational_context, relevance_signals)
            )
        
        # Sort by inclusion score
        elements.sort(key=lambda e: e.inclusion_score, reverse=True)
        
        # Select elements within token budget
        included, excluded = self._select_elements(elements)
        
        # Format context based on injection style
        system_context = self._format_context(included, injection_style)
        
        # Build metadata
        metadata = self._build_metadata(included, user_preferences)
        
        # Calculate total tokens
        total_tokens = sum(e.token_estimate for e in included)
        
        composed = ComposedPrompt(
            system_context=system_context,
            user_message=user_message,
            metadata=metadata,
            included_context=included,
            excluded_context=excluded,
            total_tokens=total_tokens,
        )
        
        logger.info(
            "Prompt composed",
            included_count=len(included),
            excluded_count=len(excluded),
            total_tokens=total_tokens,
        )
        
        return composed
    
    def _analyze_message(self, message: str) -> dict[str, float]:
        """
        Analyze message for relevance signals.
        
        Returns scores indicating how relevant each context type is.
        """
        message_lower = message.lower()
        
        # Count keyword matches
        temporal_matches = sum(
            1 for kw in self.TEMPORAL_KEYWORDS if kw in message_lower
        )
        spatial_matches = sum(
            1 for kw in self.SPATIAL_KEYWORDS if kw in message_lower
        )
        situational_matches = sum(
            1 for kw in self.SITUATIONAL_KEYWORDS if kw in message_lower
        )
        
        # Normalize to 0-1 scores
        max_keywords = 5  # Normalize factor
        
        return {
            "temporal": min(1.0, temporal_matches / max_keywords),
            "spatial": min(1.0, spatial_matches / max_keywords),
            "situational": min(1.0, situational_matches / max_keywords),
        }
    
    def _build_temporal_elements(
        self,
        context: dict,
        signals: dict[str, float],
    ) -> list[ContextElement]:
        """Build context elements from temporal context."""
        elements = []
        base_relevance = signals.get("temporal", 0.0)
        
        # Current time - always somewhat relevant
        if "current_time" in context or "formatted" in context:
            time_info = context.get("formatted", {})
            elements.append(ContextElement(
                key="current_time",
                value={
                    "time": time_info.get("time", context.get("current_time")),
                    "date": time_info.get("date"),
                    "day": time_info.get("day_of_week"),
                    "timezone": context.get("timezone"),
                },
                context_type="temporal",
                relevance=self._score_to_relevance(0.3 + base_relevance * 0.7),
                confidence=context.get("confidence", {}).get("score", 0.8),
                token_estimate=30,
                interpretation=f"It is currently {time_info.get('time_of_day', 'unknown time')} on {time_info.get('day_of_week', 'a day')}",
            ))
        
        # Time semantics - relevant for scheduling/planning
        if "semantics" in context:
            semantics = context["semantics"]
            elements.append(ContextElement(
                key="time_semantics",
                value={
                    "time_of_day": semantics.get("time_of_day"),
                    "is_weekend": semantics.get("is_weekend"),
                    "is_business_hours": semantics.get("is_business_hours"),
                },
                context_type="temporal",
                relevance=self._score_to_relevance(base_relevance * 0.8),
                confidence=context.get("confidence", {}).get("score", 0.7),
                token_estimate=25,
            ))
        
        return elements
    
    def _build_spatial_elements(
        self,
        context: dict,
        signals: dict[str, float],
    ) -> list[ContextElement]:
        """Build context elements from spatial context."""
        elements = []
        base_relevance = signals.get("spatial", 0.0)
        
        # Location
        if "country" in context or "region" in context:
            elements.append(ContextElement(
                key="location",
                value={
                    "country": context.get("country"),
                    "region": context.get("region"),
                    "city": context.get("city"),
                },
                context_type="spatial",
                relevance=self._score_to_relevance(0.2 + base_relevance * 0.6),
                confidence=context.get("confidence", {}).get("score", 0.6),
                token_estimate=20,
            ))
        
        # Locale/cultural context
        if "locale" in context:
            elements.append(ContextElement(
                key="locale",
                value={
                    "locale": context.get("locale"),
                    "language": context.get("language"),
                    "currency": context.get("currency"),
                    "units": context.get("units"),
                },
                context_type="spatial",
                relevance=self._score_to_relevance(base_relevance * 0.5),
                confidence=context.get("confidence", {}).get("score", 0.7),
                token_estimate=25,
            ))
        
        return elements
    
    def _build_situational_elements(
        self,
        context: dict,
        signals: dict[str, float],
    ) -> list[ContextElement]:
        """Build context elements from situational context."""
        elements = []
        base_relevance = signals.get("situational", 0.0)
        
        # Active tasks
        active_tasks = context.get("active_tasks", [])
        if active_tasks:
            primary_task = active_tasks[0] if active_tasks else None
            if primary_task:
                elements.append(ContextElement(
                    key="current_task",
                    value={
                        "description": primary_task.get("description"),
                        "status": primary_task.get("status"),
                    },
                    context_type="situational",
                    relevance=self._score_to_relevance(0.4 + base_relevance * 0.6),
                    confidence=primary_task.get("confidence", 0.6),
                    token_estimate=35,
                    interpretation=f"User is working on: {primary_task.get('description', 'unknown task')}",
                ))
        
        # Conversation thread
        thread = context.get("current_thread")
        if thread and thread.get("message_count", 0) > 1:
            elements.append(ContextElement(
                key="conversation_context",
                value={
                    "topic": thread.get("topic"),
                    "message_count": thread.get("message_count"),
                    "duration_minutes": thread.get("duration_minutes"),
                },
                context_type="situational",
                relevance=self._score_to_relevance(base_relevance * 0.7),
                confidence=0.7,
                token_estimate=20,
            ))
        
        # Implicit assumptions
        assumptions = context.get("implicit_assumptions", {})
        if assumptions:
            elements.append(ContextElement(
                key="assumptions",
                value=assumptions,
                context_type="situational",
                relevance=self._score_to_relevance(base_relevance * 0.5),
                confidence=0.5,
                token_estimate=40,
            ))
        
        return elements
    
    def _score_to_relevance(self, score: float) -> ContextRelevance:
        """Convert numeric score to relevance level."""
        if score >= 0.8:
            return ContextRelevance.CRITICAL
        elif score >= 0.6:
            return ContextRelevance.HIGH
        elif score >= 0.4:
            return ContextRelevance.MEDIUM
        elif score >= 0.2:
            return ContextRelevance.LOW
        else:
            return ContextRelevance.IRRELEVANT
    
    def _select_elements(
        self,
        elements: list[ContextElement],
    ) -> tuple[list[ContextElement], list[ContextElement]]:
        """Select elements within token budget."""
        included = []
        excluded = []
        current_tokens = 0
        
        for element in elements:
            # Skip low-relevance elements
            if element.relevance == ContextRelevance.IRRELEVANT:
                excluded.append(element)
                continue
            
            # Skip low-confidence elements
            if element.confidence < self.min_relevance:
                excluded.append(element)
                continue
            
            # Check token budget
            if current_tokens + element.token_estimate <= self.max_tokens:
                included.append(element)
                current_tokens += element.token_estimate
            else:
                # Only include critical elements over budget
                if element.relevance == ContextRelevance.CRITICAL:
                    included.append(element)
                    current_tokens += element.token_estimate
                else:
                    excluded.append(element)
        
        return included, excluded
    
    def _format_context(
        self,
        elements: list[ContextElement],
        style: InjectionStyle,
    ) -> str:
        """Format selected elements for injection."""
        if not elements:
            return ""
        
        if style == InjectionStyle.SYSTEM_PROMPT:
            return self._format_as_system_prompt(elements)
        elif style == InjectionStyle.CONTEXT_BLOCK:
            return self._format_as_context_block(elements)
        elif style == InjectionStyle.INLINE:
            return self._format_as_inline(elements)
        else:
            return self._format_as_system_prompt(elements)
    
    def _format_as_system_prompt(self, elements: list[ContextElement]) -> str:
        """Format elements as system prompt instructions."""
        lines = ["## Current Context"]
        
        # Group by context type
        by_type: dict[str, list[ContextElement]] = {}
        for elem in elements:
            if elem.context_type not in by_type:
                by_type[elem.context_type] = []
            by_type[elem.context_type].append(elem)
        
        # Format each type
        if "temporal" in by_type:
            lines.append("\n### Time & Date")
            for elem in by_type["temporal"]:
                if elem.interpretation:
                    lines.append(f"- {elem.interpretation}")
                else:
                    lines.append(f"- {elem.key}: {self._value_to_string(elem.value)}")
        
        if "spatial" in by_type:
            lines.append("\n### Location")
            for elem in by_type["spatial"]:
                lines.append(f"- {elem.key}: {self._value_to_string(elem.value)}")
        
        if "situational" in by_type:
            lines.append("\n### Context")
            for elem in by_type["situational"]:
                if elem.interpretation:
                    lines.append(f"- {elem.interpretation}")
                else:
                    lines.append(f"- {elem.key}: {self._value_to_string(elem.value)}")
        
        lines.append("\n---")
        lines.append("Use this context to ground your responses in the user's reality.")
        lines.append("Do not mention this context unless directly relevant to the user's query.")
        
        return "\n".join(lines)
    
    def _format_as_context_block(self, elements: list[ContextElement]) -> str:
        """Format elements as structured context block."""
        context_data = {}
        
        for elem in elements:
            context_data[elem.key] = {
                "value": elem.value,
                "type": elem.context_type,
                "confidence": elem.confidence,
            }
        
        return f"<context>\n{json.dumps(context_data, indent=2, default=str)}\n</context>"
    
    def _format_as_inline(self, elements: list[ContextElement]) -> str:
        """Format elements for inline injection."""
        parts = []
        
        for elem in elements:
            if elem.interpretation:
                parts.append(elem.interpretation)
            else:
                parts.append(f"{elem.key}: {self._value_to_string(elem.value)}")
        
        return f"[Context: {'; '.join(parts)}]"
    
    def _value_to_string(self, value: Any) -> str:
        """Convert value to readable string."""
        if isinstance(value, dict):
            parts = [f"{k}={v}" for k, v in value.items() if v is not None]
            return ", ".join(parts)
        elif isinstance(value, list):
            return ", ".join(str(v) for v in value)
        else:
            return str(value)
    
    def _build_metadata(
        self,
        elements: list[ContextElement],
        preferences: Optional[dict],
    ) -> dict:
        """Build metadata for API calls."""
        return {
            "context_version": "1.0",
            "elements_included": len(elements),
            "context_types": list(set(e.context_type for e in elements)),
            "total_confidence": (
                sum(e.confidence for e in elements) / len(elements)
                if elements else 0.0
            ),
            "user_preferences_applied": preferences is not None,
        }
    
    def explain_decisions(
        self,
        composed: ComposedPrompt,
    ) -> list[CompositionDecision]:
        """
        Explain why each context element was included or excluded.
        
        Useful for debugging and user transparency.
        """
        decisions = []
        
        for elem in composed.included_context:
            decisions.append(CompositionDecision(
                element_key=elem.key,
                included=True,
                reason=f"Relevance: {elem.relevance.value}, Confidence: {elem.confidence:.2f}, Score: {elem.inclusion_score:.2f}",
                relevance=elem.relevance,
                confidence=elem.confidence,
            ))
        
        for elem in composed.excluded_context:
            if elem.relevance == ContextRelevance.IRRELEVANT:
                reason = "Not relevant to the query"
            elif elem.confidence < self.min_relevance:
                reason = f"Confidence too low ({elem.confidence:.2f} < {self.min_relevance})"
            else:
                reason = "Token budget exceeded"
            
            decisions.append(CompositionDecision(
                element_key=elem.key,
                included=False,
                reason=reason,
                relevance=elem.relevance,
                confidence=elem.confidence,
            ))
        
        return decisions
