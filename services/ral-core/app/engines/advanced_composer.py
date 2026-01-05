"""
Advanced Prompt Composition with Context Summarization

Implements:
- Bi-Encoder relevance scoring
- Context summarization/distillation
- Situation Brief generation
- Sliding token budget based on prompt length
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import json
import re

import structlog

from app.core.config import settings
from app.engines.composer import (
    ContextElement,
    ContextRelevance,
    ComposedPrompt,
    InjectionStyle,
)

logger = structlog.get_logger()


class SummarizationStrategy(str, Enum):
    """Strategies for context summarization."""
    NONE = "none"               # No summarization
    TRUNCATE = "truncate"       # Simple truncation
    DISTILL = "distill"         # LLM-based distillation
    RANK_SELECT = "rank_select" # Bi-encoder ranking + selection


@dataclass
class RelevanceScore:
    """Relevance score for a context element."""
    element_key: str
    query_similarity: float      # Cosine similarity to query
    recency_score: float         # How recent the context is
    frequency_score: float       # How often accessed
    confidence_score: float      # Context confidence
    combined_score: float        # Weighted combination
    
    def to_dict(self) -> dict:
        return {
            "element_key": self.element_key,
            "query_similarity": self.query_similarity,
            "recency_score": self.recency_score,
            "frequency_score": self.frequency_score,
            "confidence_score": self.confidence_score,
            "combined_score": self.combined_score,
        }


@dataclass
class SituationBrief:
    """
    Structured 2-sentence meta-prompt for context injection.
    
    Format: "User is currently [Activity] in [Location] at [Time]. 
             Previous context indicates [Constraint]."
    """
    activity: str = "working"
    location: str = "an unspecified location"
    time_description: str = "the current time"
    constraint: str = "no specific constraints"
    full_brief: str = ""
    token_count: int = 0
    
    def __post_init__(self):
        """Generate the full brief if not provided."""
        if not self.full_brief:
            self.full_brief = (
                f"User is currently {self.activity} in {self.location} at {self.time_description}. "
                f"Previous context indicates {self.constraint}."
            )
        # Estimate tokens (rough: ~4 chars per token)
        self.token_count = len(self.full_brief) // 4


@dataclass
class TokenBudget:
    """
    Sliding token budget based on prompt characteristics.
    
    Short prompts get more context allowance.
    Long prompts get compressed context.
    """
    user_prompt_tokens: int
    max_total_tokens: int = 4096
    min_context_tokens: int = 100
    max_context_tokens: int = 1000
    allocated_context_tokens: int = 0
    
    def __post_init__(self):
        """Calculate allocated context tokens using sliding scale."""
        # Base allocation: inverse relationship with prompt length
        # Short prompt (< 50 tokens) -> up to max_context_tokens
        # Long prompt (> 500 tokens) -> min_context_tokens
        
        if self.user_prompt_tokens < 50:
            ratio = 1.0
        elif self.user_prompt_tokens > 500:
            ratio = 0.1
        else:
            # Linear interpolation
            ratio = 1.0 - ((self.user_prompt_tokens - 50) / 450) * 0.9
        
        self.allocated_context_tokens = int(
            self.min_context_tokens + 
            (self.max_context_tokens - self.min_context_tokens) * ratio
        )
        
        # Ensure we don't exceed total budget
        remaining = self.max_total_tokens - self.user_prompt_tokens - 500  # Reserve for response
        self.allocated_context_tokens = min(
            self.allocated_context_tokens,
            max(self.min_context_tokens, remaining)
        )


@dataclass
class AdvancedComposedPrompt:
    """Extended composed prompt with summarization metadata."""
    system_context: str
    user_message: str
    situation_brief: SituationBrief
    token_budget: TokenBudget
    relevance_scores: list[RelevanceScore]
    summarization_strategy: SummarizationStrategy
    original_context_tokens: int
    final_context_tokens: int
    compression_ratio: float
    included_elements: list[str]
    excluded_elements: list[str]
    composition_time_ms: float = 0.0


class BiEncoderRanker:
    """
    Bi-Encoder model for scoring context relevance against queries.
    
    Uses lightweight embedding comparison for fast ranking.
    Falls back to keyword matching if no model available.
    """
    
    # Keywords for different context types
    TEMPORAL_SIGNALS = {
        "when", "time", "date", "today", "tomorrow", "yesterday",
        "schedule", "meeting", "deadline", "morning", "afternoon",
        "evening", "night", "week", "month", "year", "hour", "minute",
    }
    
    SPATIAL_SIGNALS = {
        "where", "location", "here", "there", "near", "nearby",
        "city", "country", "region", "place", "address", "weather",
        "local", "distance", "directions", "map",
    }
    
    SITUATIONAL_SIGNALS = {
        "what", "which", "this", "that", "it", "they", "working",
        "project", "task", "doing", "continue", "previous", "last",
        "current", "ongoing", "same", "similar",
    }
    
    def __init__(self, use_embeddings: bool = False):
        """
        Initialize the ranker.
        
        Args:
            use_embeddings: Whether to use embedding-based similarity
                           (requires sentence-transformers)
        """
        self.use_embeddings = use_embeddings
        self._model = None
        
        if use_embeddings:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer('all-MiniLM-L6-v2')
                logger.info("Bi-encoder model loaded")
            except ImportError:
                logger.warning("sentence-transformers not available, using keyword matching")
                self.use_embeddings = False
    
    def score_elements(
        self,
        query: str,
        elements: list[ContextElement],
    ) -> list[RelevanceScore]:
        """
        Score context elements against the query.
        
        Args:
            query: User's query
            elements: Context elements to score
            
        Returns:
            Sorted list of relevance scores (highest first)
        """
        query_lower = query.lower()
        query_words = set(re.findall(r'\w+', query_lower))
        
        scores = []
        
        for element in elements:
            # Query similarity
            if self.use_embeddings and self._model:
                query_similarity = self._embedding_similarity(
                    query, 
                    self._element_to_text(element)
                )
            else:
                query_similarity = self._keyword_similarity(
                    query_words,
                    element,
                )
            
            # Recency score (placeholder - would use actual timestamps)
            recency_score = 0.8  # Default recent
            
            # Frequency score (placeholder - would use access counts)
            frequency_score = 0.5  # Default moderate
            
            # Confidence from element
            confidence_score = element.confidence
            
            # Combined score with weights
            combined = (
                query_similarity * 0.4 +
                recency_score * 0.2 +
                frequency_score * 0.1 +
                confidence_score * 0.3
            )
            
            scores.append(RelevanceScore(
                element_key=element.key,
                query_similarity=query_similarity,
                recency_score=recency_score,
                frequency_score=frequency_score,
                confidence_score=confidence_score,
                combined_score=combined,
            ))
        
        # Sort by combined score descending
        scores.sort(key=lambda s: s.combined_score, reverse=True)
        return scores
    
    def _keyword_similarity(
        self,
        query_words: set[str],
        element: ContextElement,
    ) -> float:
        """Calculate keyword-based similarity."""
        # Determine context type signals
        if element.context_type == "temporal":
            type_signals = self.TEMPORAL_SIGNALS
        elif element.context_type == "spatial":
            type_signals = self.SPATIAL_SIGNALS
        else:
            type_signals = self.SITUATIONAL_SIGNALS
        
        # Check for signal overlap
        signal_overlap = len(query_words & type_signals)
        
        # Check for key/value overlap
        element_words = set(re.findall(r'\w+', str(element.value).lower()))
        element_words.add(element.key.lower())
        value_overlap = len(query_words & element_words)
        
        # Combined score
        if signal_overlap > 0 and value_overlap > 0:
            return min(1.0, 0.5 + signal_overlap * 0.2 + value_overlap * 0.1)
        elif signal_overlap > 0:
            return min(0.7, 0.3 + signal_overlap * 0.2)
        elif value_overlap > 0:
            return min(0.6, 0.2 + value_overlap * 0.1)
        else:
            return 0.1
    
    def _embedding_similarity(self, query: str, text: str) -> float:
        """Calculate embedding-based cosine similarity."""
        if not self._model:
            return 0.5
        
        try:
            embeddings = self._model.encode([query, text])
            from numpy import dot
            from numpy.linalg import norm
            similarity = dot(embeddings[0], embeddings[1]) / (
                norm(embeddings[0]) * norm(embeddings[1])
            )
            return float(similarity)
        except Exception:
            return 0.5
    
    def _element_to_text(self, element: ContextElement) -> str:
        """Convert element to searchable text."""
        parts = [element.key]
        if isinstance(element.value, dict):
            parts.extend(str(v) for v in element.value.values() if v)
        else:
            parts.append(str(element.value))
        if element.interpretation:
            parts.append(element.interpretation)
        return " ".join(parts)


class ContextDistiller:
    """
    Context summarization/distillation engine.
    
    When context exceeds token budget, distills it to a compact
    "Situation Brief" format.
    """
    
    DEFAULT_TOKEN_THRESHOLD = 500
    
    def __init__(
        self,
        token_threshold: int = DEFAULT_TOKEN_THRESHOLD,
        use_llm: bool = False,
    ):
        """
        Initialize the distiller.
        
        Args:
            token_threshold: Tokens above which to summarize
            use_llm: Whether to use LLM for summarization
        """
        self.token_threshold = token_threshold
        self.use_llm = use_llm
    
    def should_summarize(self, elements: list[ContextElement]) -> bool:
        """Check if context should be summarized."""
        total_tokens = sum(e.token_estimate for e in elements)
        return total_tokens > self.token_threshold
    
    def distill(
        self,
        elements: list[ContextElement],
        token_budget: TokenBudget,
    ) -> SituationBrief:
        """
        Distill context elements into a Situation Brief.
        
        Args:
            elements: Context elements to distill
            token_budget: Available token budget
            
        Returns:
            Compact situation brief
        """
        # Extract key information from elements
        activity = self._extract_activity(elements)
        location = self._extract_location(elements)
        time_desc = self._extract_time(elements)
        constraint = self._extract_constraint(elements)
        
        brief = SituationBrief(
            activity=activity,
            location=location,
            time_description=time_desc,
            constraint=constraint,
        )
        
        logger.debug(
            "Context distilled to situation brief",
            original_elements=len(elements),
            brief_tokens=brief.token_count,
        )
        
        return brief
    
    def _extract_activity(self, elements: list[ContextElement]) -> str:
        """Extract current activity from situational context."""
        for elem in elements:
            if elem.context_type == "situational":
                if elem.key in ("current_task", "active_task", "activity"):
                    return str(elem.value) if elem.value else "working"
                if "task" in elem.key.lower():
                    return str(elem.value) if elem.value else "working"
        return "working"
    
    def _extract_location(self, elements: list[ContextElement]) -> str:
        """Extract location from spatial context."""
        for elem in elements:
            if elem.context_type == "spatial":
                if isinstance(elem.value, dict):
                    parts = []
                    if elem.value.get("city"):
                        parts.append(elem.value["city"])
                    if elem.value.get("region"):
                        parts.append(elem.value["region"])
                    if elem.value.get("country"):
                        parts.append(elem.value["country"])
                    if parts:
                        return ", ".join(parts)
                elif elem.value:
                    return str(elem.value)
        return "an unspecified location"
    
    def _extract_time(self, elements: list[ContextElement]) -> str:
        """Extract time description from temporal context."""
        for elem in elements:
            if elem.context_type == "temporal":
                if isinstance(elem.value, dict):
                    parts = []
                    if elem.value.get("time_of_day"):
                        parts.append(elem.value["time_of_day"])
                    if elem.value.get("day_of_week"):
                        parts.append(elem.value["day_of_week"])
                    if parts:
                        return " ".join(parts)
                elif elem.interpretation:
                    return elem.interpretation
        return "the current time"
    
    def _extract_constraint(self, elements: list[ContextElement]) -> str:
        """Extract constraints from context."""
        constraints = []
        
        for elem in elements:
            # Look for preferences, deadlines, etc.
            if "deadline" in elem.key.lower():
                constraints.append(f"deadline: {elem.value}")
            elif "preference" in elem.key.lower():
                constraints.append(f"prefers {elem.value}")
            elif elem.key == "communication_style":
                constraints.append(f"prefers {elem.value} communication")
        
        if constraints:
            return "; ".join(constraints[:2])  # Limit to 2 constraints
        return "no specific constraints"


class AdvancedPromptComposer:
    """
    Advanced Prompt Composer with summarization and relevance ranking.
    
    Features:
    - Bi-encoder relevance scoring
    - Context summarization/distillation
    - Sliding token budget
    - Situation Brief generation
    """
    
    def __init__(
        self,
        max_context_tokens: int = settings.MAX_CONTEXT_TOKENS,
        summarization_threshold: int = 500,
        use_embeddings: bool = False,
    ):
        """
        Initialize the advanced composer.
        
        Args:
            max_context_tokens: Maximum tokens for context
            summarization_threshold: Tokens above which to summarize
            use_embeddings: Whether to use embedding-based ranking
        """
        self.max_context_tokens = max_context_tokens
        self.summarization_threshold = summarization_threshold
        self.ranker = BiEncoderRanker(use_embeddings=use_embeddings)
        self.distiller = ContextDistiller(
            token_threshold=summarization_threshold,
        )
    
    def compose(
        self,
        user_message: str,
        elements: list[ContextElement],
        max_total_tokens: int = 4096,
        injection_style: InjectionStyle = InjectionStyle.SYSTEM_PROMPT,
    ) -> AdvancedComposedPrompt:
        """
        Compose prompt with advanced relevance ranking and summarization.
        
        Args:
            user_message: User's query
            elements: Available context elements
            max_total_tokens: Maximum total tokens (prompt + context + response)
            injection_style: How to inject context
            
        Returns:
            Advanced composed prompt with metadata
        """
        import time
        start = time.perf_counter()
        
        # Estimate user prompt tokens
        user_prompt_tokens = len(user_message) // 4
        
        # Calculate token budget
        token_budget = TokenBudget(
            user_prompt_tokens=user_prompt_tokens,
            max_total_tokens=max_total_tokens,
            max_context_tokens=self.max_context_tokens,
        )
        
        # Score elements by relevance
        relevance_scores = self.ranker.score_elements(user_message, elements)
        
        # Create element lookup
        element_map = {e.key: e for e in elements}
        
        # Calculate original context tokens
        original_tokens = sum(e.token_estimate for e in elements)
        
        # Determine summarization strategy
        if original_tokens <= token_budget.allocated_context_tokens:
            strategy = SummarizationStrategy.NONE
        elif original_tokens <= token_budget.allocated_context_tokens * 2:
            strategy = SummarizationStrategy.RANK_SELECT
        else:
            strategy = SummarizationStrategy.DISTILL
        
        # Apply strategy
        included_elements = []
        excluded_elements = []
        situation_brief = None
        
        if strategy == SummarizationStrategy.NONE:
            # Include all elements
            included_elements = [e.key for e in elements]
            system_context = self._format_elements(elements, injection_style)
            final_tokens = original_tokens
            
        elif strategy == SummarizationStrategy.RANK_SELECT:
            # Select top elements by relevance within budget
            current_tokens = 0
            selected = []
            
            for score in relevance_scores:
                elem = element_map.get(score.element_key)
                if elem and current_tokens + elem.token_estimate <= token_budget.allocated_context_tokens:
                    selected.append(elem)
                    included_elements.append(elem.key)
                    current_tokens += elem.token_estimate
                else:
                    excluded_elements.append(score.element_key)
            
            system_context = self._format_elements(selected, injection_style)
            final_tokens = current_tokens
            
        else:  # DISTILL
            # Distill to situation brief
            situation_brief = self.distiller.distill(elements, token_budget)
            system_context = situation_brief.full_brief
            final_tokens = situation_brief.token_count
            included_elements = ["situation_brief"]
            excluded_elements = [e.key for e in elements]
        
        # If no situation brief was created, create a default
        if not situation_brief:
            situation_brief = self._create_default_brief(elements)
        
        # Calculate compression ratio
        compression_ratio = (
            final_tokens / original_tokens if original_tokens > 0 else 1.0
        )
        
        elapsed_ms = (time.perf_counter() - start) * 1000
        
        return AdvancedComposedPrompt(
            system_context=system_context,
            user_message=user_message,
            situation_brief=situation_brief,
            token_budget=token_budget,
            relevance_scores=relevance_scores,
            summarization_strategy=strategy,
            original_context_tokens=original_tokens,
            final_context_tokens=final_tokens,
            compression_ratio=compression_ratio,
            included_elements=included_elements,
            excluded_elements=excluded_elements,
            composition_time_ms=elapsed_ms,
        )
    
    def _format_elements(
        self,
        elements: list[ContextElement],
        style: InjectionStyle,
    ) -> str:
        """Format elements based on injection style."""
        if style == InjectionStyle.SYSTEM_PROMPT:
            return self._format_as_system_prompt(elements)
        elif style == InjectionStyle.CONTEXT_BLOCK:
            return self._format_as_context_block(elements)
        else:
            return self._format_as_inline(elements)
    
    def _format_as_system_prompt(self, elements: list[ContextElement]) -> str:
        """Format as system prompt instructions."""
        lines = ["Current user context:"]
        
        for elem in elements:
            if elem.interpretation:
                lines.append(f"- {elem.interpretation}")
            else:
                lines.append(f"- {elem.key}: {self._value_to_str(elem.value)}")
        
        return "\n".join(lines)
    
    def _format_as_context_block(self, elements: list[ContextElement]) -> str:
        """Format as structured context block."""
        data = {}
        for elem in elements:
            data[elem.key] = {
                "value": elem.value,
                "type": elem.context_type,
                "confidence": elem.confidence,
            }
        return f"<context>\n{json.dumps(data, indent=2, default=str)}\n</context>"
    
    def _format_as_inline(self, elements: list[ContextElement]) -> str:
        """Format for inline injection."""
        parts = []
        for elem in elements:
            if elem.interpretation:
                parts.append(elem.interpretation)
            else:
                parts.append(f"{elem.key}: {self._value_to_str(elem.value)}")
        return f"[Context: {'; '.join(parts)}]"
    
    def _value_to_str(self, value: Any) -> str:
        """Convert value to readable string."""
        if isinstance(value, dict):
            return ", ".join(f"{k}={v}" for k, v in value.items() if v)
        elif isinstance(value, list):
            return ", ".join(str(v) for v in value)
        return str(value)
    
    def _create_default_brief(self, elements: list[ContextElement]) -> SituationBrief:
        """Create a default situation brief from elements."""
        return self.distiller.distill(elements, TokenBudget(
            user_prompt_tokens=0,
            max_context_tokens=self.max_context_tokens,
        ))


# Global instance
advanced_composer = AdvancedPromptComposer()
