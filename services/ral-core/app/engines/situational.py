"""
Situational Context Engine

Manages ongoing tasks, conversation continuity, and implicit assumptions
built over time. This engine tracks the "what" of user interactions.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import uuid
import hashlib

import structlog

from app.schemas.context import (
    ContextConfidence,
    ContextSource,
)

logger = structlog.get_logger()


class TaskStatus(str, Enum):
    """Status of a tracked task."""
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ReferenceType(str, Enum):
    """Types of references that can be tracked."""
    ENTITY = "entity"          # Named entities (people, places, things)
    TOPIC = "topic"            # Discussion topics
    ACTION = "action"          # Actions/verbs being discussed
    ARTIFACT = "artifact"      # Files, documents, code
    TEMPORAL = "temporal"      # Time references
    QUANTITATIVE = "quantitative"  # Numbers, amounts


@dataclass
class TrackedTask:
    """
    Represents an ongoing task being tracked.
    
    Attributes:
        task_id: Unique identifier
        description: Task description
        status: Current task status
        started_at: When task was started
        context: Associated context
        confidence: Confidence this is an active task
    """
    task_id: str
    description: str
    status: TaskStatus = TaskStatus.ACTIVE
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_referenced_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    context: dict = field(default_factory=dict)
    confidence: float = 0.7
    mentions: int = 1
    
    def reference(self) -> None:
        """Record a reference to this task."""
        self.last_referenced_at = datetime.now(timezone.utc)
        self.mentions += 1
        self.confidence = min(1.0, self.confidence + 0.05)
    
    def decay(self, hours_inactive: float) -> None:
        """Apply decay based on inactivity."""
        decay_factor = max(0.5, 1.0 - (hours_inactive * 0.02))
        self.confidence *= decay_factor
    
    @property
    def is_stale(self) -> bool:
        """Check if task hasn't been referenced recently."""
        hours_since = (datetime.now(timezone.utc) - self.last_referenced_at).total_seconds() / 3600
        return hours_since > 24
    
    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "description": self.description,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "last_referenced_at": self.last_referenced_at.isoformat(),
            "context": self.context,
            "confidence": self.confidence,
            "mentions": self.mentions,
        }


@dataclass
class TrackedReference:
    """
    A reference tracked within conversation.
    
    Attributes:
        reference_id: Unique identifier
        reference_type: Type of reference
        value: The referenced value
        aliases: Alternative names/references
        first_mentioned_at: When first seen
        confidence: Confidence in this reference
    """
    reference_id: str
    reference_type: ReferenceType
    value: str
    normalized_value: str
    aliases: list[str] = field(default_factory=list)
    first_mentioned_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_mentioned_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    mention_count: int = 1
    confidence: float = 0.6
    context: dict = field(default_factory=dict)
    
    def mention(self, alias: Optional[str] = None) -> None:
        """Record a mention of this reference."""
        self.last_mentioned_at = datetime.now(timezone.utc)
        self.mention_count += 1
        self.confidence = min(1.0, self.confidence + 0.1)
        if alias and alias not in self.aliases:
            self.aliases.append(alias)
    
    def to_dict(self) -> dict:
        return {
            "reference_id": self.reference_id,
            "reference_type": self.reference_type.value,
            "value": self.value,
            "normalized_value": self.normalized_value,
            "aliases": self.aliases,
            "first_mentioned_at": self.first_mentioned_at.isoformat(),
            "last_mentioned_at": self.last_mentioned_at.isoformat(),
            "mention_count": self.mention_count,
            "confidence": self.confidence,
        }


@dataclass
class ConversationThread:
    """
    Represents a conversation thread with continuity.
    
    Attributes:
        thread_id: Unique identifier
        topic: Main topic of conversation
        messages: Message history summary
        active_tasks: Tasks mentioned in thread
        references: References tracked in thread
    """
    thread_id: str
    topic: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    message_count: int = 0
    active_tasks: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    summary: Optional[str] = None
    context: dict = field(default_factory=dict)
    
    def add_message(self) -> None:
        """Record a new message in thread."""
        self.last_message_at = datetime.now(timezone.utc)
        self.message_count += 1
    
    @property
    def duration_minutes(self) -> float:
        """Get thread duration in minutes."""
        return (self.last_message_at - self.started_at).total_seconds() / 60
    
    def to_dict(self) -> dict:
        return {
            "thread_id": self.thread_id,
            "topic": self.topic,
            "started_at": self.started_at.isoformat(),
            "last_message_at": self.last_message_at.isoformat(),
            "message_count": self.message_count,
            "active_tasks": self.active_tasks,
            "references": self.references,
            "summary": self.summary,
            "duration_minutes": self.duration_minutes,
        }


@dataclass
class SituationalInterpretation:
    """
    Complete situational context interpretation.
    
    Combines all situational elements into a coherent view.
    """
    active_tasks: list[TrackedTask]
    references: list[TrackedReference]
    current_thread: Optional[ConversationThread]
    implicit_assumptions: dict[str, Any]
    confidence: ContextConfidence
    interpretation_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> dict:
        return {
            "active_tasks": [t.to_dict() for t in self.active_tasks],
            "references": [r.to_dict() for r in self.references],
            "current_thread": self.current_thread.to_dict() if self.current_thread else None,
            "implicit_assumptions": self.implicit_assumptions,
            "confidence": {
                "score": self.confidence.score,
                "level": self.confidence.level.value,
                "factors": self.confidence.factors,
            },
            "interpretation_time": self.interpretation_time.isoformat(),
        }
    
    @property
    def primary_task(self) -> Optional[TrackedTask]:
        """Get the most relevant active task."""
        active = [t for t in self.active_tasks if t.status == TaskStatus.ACTIVE]
        if not active:
            return None
        return max(active, key=lambda t: t.confidence * t.mentions)
    
    @property
    def recent_references(self) -> list[TrackedReference]:
        """Get references from the last hour."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        return [r for r in self.references if r.last_mentioned_at > cutoff]


class SituationalEngine:
    """
    Engine for processing and interpreting situational context.
    
    Tracks ongoing tasks, conversation continuity, and implicit
    assumptions built over time.
    """
    
    # Task detection patterns
    TASK_INDICATORS = [
        "working on", "doing", "creating", "building", "writing",
        "fixing", "debugging", "implementing", "designing", "planning",
        "researching", "reviewing", "testing", "deploying", "setting up",
        "help me", "i need to", "i want to", "let's", "can you",
    ]
    
    # Reference patterns by type
    REFERENCE_PATTERNS = {
        ReferenceType.ARTIFACT: ["file", "document", "code", "script", "function", "class", "module"],
        ReferenceType.ENTITY: ["the", "this", "that", "it", "they", "he", "she"],
        ReferenceType.TOPIC: ["about", "regarding", "concerning", "related to"],
    }
    
    def __init__(self):
        """Initialize the Situational Engine."""
        self._tasks: dict[str, TrackedTask] = {}
        self._references: dict[str, TrackedReference] = {}
        self._threads: dict[str, ConversationThread] = {}
        self._user_assumptions: dict[str, dict[str, Any]] = {}
    
    def interpret(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        previous_context: Optional[dict] = None,
    ) -> SituationalInterpretation:
        """
        Interpret situational context from a message.
        
        Args:
            user_id: User identifier
            message: Current message text
            session_id: Optional session identifier
            previous_context: Previously stored context
            
        Returns:
            Complete situational interpretation
        """
        logger.debug(
            "Interpreting situational context",
            user_id=user_id,
            message_length=len(message),
            session_id=session_id,
        )
        
        # Load previous context if available
        if previous_context:
            self._load_context(user_id, previous_context)
        
        # Process message for tasks
        detected_tasks = self._detect_tasks(user_id, message)
        
        # Process message for references
        detected_refs = self._detect_references(user_id, message)
        
        # Update or create conversation thread
        thread = self._update_thread(user_id, session_id, message)
        
        # Build implicit assumptions
        assumptions = self._build_assumptions(user_id, detected_tasks, detected_refs)
        
        # Calculate overall confidence
        confidence = self._calculate_confidence(detected_tasks, detected_refs, thread)
        
        # Get active tasks for this user
        user_tasks = [
            t for t in self._tasks.values()
            if t.task_id.startswith(user_id) and t.status == TaskStatus.ACTIVE
        ]
        
        # Get recent references for this user
        user_refs = [
            r for r in self._references.values()
            if r.reference_id.startswith(user_id)
        ]
        
        interpretation = SituationalInterpretation(
            active_tasks=user_tasks,
            references=user_refs,
            current_thread=thread,
            implicit_assumptions=assumptions,
            confidence=confidence,
        )
        
        logger.info(
            "Situational interpretation complete",
            user_id=user_id,
            active_tasks=len(user_tasks),
            references=len(user_refs),
            confidence=confidence.score,
        )
        
        return interpretation
    
    def _detect_tasks(self, user_id: str, message: str) -> list[TrackedTask]:
        """Detect tasks mentioned in message."""
        message_lower = message.lower()
        detected = []
        
        for indicator in self.TASK_INDICATORS:
            if indicator in message_lower:
                # Extract task description
                idx = message_lower.find(indicator)
                # Get text after the indicator (simplified extraction)
                task_text = message[idx:].split('.')[0].split('?')[0][:100]
                
                # Generate task ID
                task_hash = hashlib.md5(task_text.lower().encode()).hexdigest()[:8]
                task_id = f"{user_id}:{task_hash}"
                
                if task_id in self._tasks:
                    # Update existing task
                    self._tasks[task_id].reference()
                    detected.append(self._tasks[task_id])
                else:
                    # Create new task
                    task = TrackedTask(
                        task_id=task_id,
                        description=task_text.strip(),
                        context={"indicator": indicator},
                    )
                    self._tasks[task_id] = task
                    detected.append(task)
                
                break  # Only detect one task per message
        
        return detected
    
    def _detect_references(self, user_id: str, message: str) -> list[TrackedReference]:
        """Detect references in message."""
        detected = []
        words = message.split()
        
        # Simple reference detection (would be more sophisticated in production)
        for i, word in enumerate(words):
            word_lower = word.lower().strip('.,!?')
            
            # Check for pronouns and demonstratives
            if word_lower in ["it", "this", "that", "they", "them"]:
                # Look for what it might refer to
                ref_id = f"{user_id}:pronoun:{word_lower}"
                
                if ref_id in self._references:
                    self._references[ref_id].mention()
                else:
                    ref = TrackedReference(
                        reference_id=ref_id,
                        reference_type=ReferenceType.ENTITY,
                        value=word_lower,
                        normalized_value=word_lower,
                        confidence=0.4,  # Low confidence for unresolved pronouns
                    )
                    self._references[ref_id] = ref
                    detected.append(ref)
            
            # Check for quoted strings (likely artifacts)
            if word.startswith('"') or word.startswith("'"):
                # Find the closing quote
                quoted = self._extract_quoted(message, i)
                if quoted:
                    ref_id = f"{user_id}:artifact:{hashlib.md5(quoted.encode()).hexdigest()[:8]}"
                    ref = TrackedReference(
                        reference_id=ref_id,
                        reference_type=ReferenceType.ARTIFACT,
                        value=quoted,
                        normalized_value=quoted.lower(),
                        confidence=0.8,
                    )
                    self._references[ref_id] = ref
                    detected.append(ref)
        
        return detected
    
    def _extract_quoted(self, message: str, start_word_idx: int) -> Optional[str]:
        """Extract quoted string from message."""
        # Simple extraction - find matching quote
        for quote_char in ['"', "'"]:
            if quote_char in message:
                parts = message.split(quote_char)
                if len(parts) >= 3:
                    return parts[1]
        return None
    
    def _update_thread(
        self,
        user_id: str,
        session_id: Optional[str],
        message: str,
    ) -> Optional[ConversationThread]:
        """Update or create conversation thread."""
        if not session_id:
            session_id = "default"
        
        thread_id = f"{user_id}:{session_id}"
        
        if thread_id in self._threads:
            thread = self._threads[thread_id]
            thread.add_message()
        else:
            thread = ConversationThread(
                thread_id=thread_id,
                message_count=1,
            )
            self._threads[thread_id] = thread
        
        return thread
    
    def _build_assumptions(
        self,
        user_id: str,
        tasks: list[TrackedTask],
        refs: list[TrackedReference],
    ) -> dict[str, Any]:
        """Build implicit assumptions from context."""
        assumptions = {}
        
        # Assumption: User is working on the most recent task
        if tasks:
            primary = max(tasks, key=lambda t: t.confidence)
            assumptions["current_work"] = {
                "task": primary.description,
                "confidence": primary.confidence,
            }
        
        # Assumption: High-confidence references are in scope
        high_conf_refs = [r for r in refs if r.confidence >= 0.7]
        if high_conf_refs:
            assumptions["in_scope_references"] = [
                {"type": r.reference_type.value, "value": r.value}
                for r in high_conf_refs[:5]  # Limit to top 5
            ]
        
        # Store user assumptions
        if user_id not in self._user_assumptions:
            self._user_assumptions[user_id] = {}
        self._user_assumptions[user_id].update(assumptions)
        
        return assumptions
    
    def _calculate_confidence(
        self,
        tasks: list[TrackedTask],
        refs: list[TrackedReference],
        thread: Optional[ConversationThread],
    ) -> ContextConfidence:
        """Calculate overall situational confidence."""
        factors = {}
        scores = []
        
        # Task confidence
        if tasks:
            task_conf = sum(t.confidence for t in tasks) / len(tasks)
            factors["task_tracking"] = task_conf
            scores.append(task_conf)
        
        # Reference confidence
        if refs:
            ref_conf = sum(r.confidence for r in refs) / len(refs)
            factors["reference_tracking"] = ref_conf
            scores.append(ref_conf)
        
        # Thread continuity
        if thread and thread.message_count > 1:
            thread_conf = min(1.0, thread.message_count * 0.1)
            factors["conversation_continuity"] = thread_conf
            scores.append(thread_conf)
        
        # Calculate overall score
        if scores:
            overall = sum(scores) / len(scores)
        else:
            overall = 0.3  # Low default confidence
        
        return ContextConfidence(
            score=overall,
            factors=factors,
            source=ContextSource.INFERRED,
        )
    
    def _load_context(self, user_id: str, context: dict) -> None:
        """Load previously stored context."""
        # Load tasks
        for task_data in context.get("tasks", []):
            task_id = task_data.get("task_id", f"{user_id}:{uuid.uuid4().hex[:8]}")
            if task_id not in self._tasks:
                self._tasks[task_id] = TrackedTask(
                    task_id=task_id,
                    description=task_data.get("description", ""),
                    status=TaskStatus(task_data.get("status", "active")),
                    confidence=task_data.get("confidence", 0.5),
                )
        
        # Load references
        for ref_data in context.get("references", []):
            ref_id = ref_data.get("reference_id", f"{user_id}:{uuid.uuid4().hex[:8]}")
            if ref_id not in self._references:
                self._references[ref_id] = TrackedReference(
                    reference_id=ref_id,
                    reference_type=ReferenceType(ref_data.get("reference_type", "entity")),
                    value=ref_data.get("value", ""),
                    normalized_value=ref_data.get("normalized_value", ""),
                    confidence=ref_data.get("confidence", 0.5),
                )
    
    def get_active_tasks(self, user_id: str) -> list[TrackedTask]:
        """Get all active tasks for a user."""
        return [
            t for t in self._tasks.values()
            if t.task_id.startswith(user_id) and t.status == TaskStatus.ACTIVE
        ]
    
    def complete_task(self, task_id: str) -> bool:
        """Mark a task as completed."""
        if task_id in self._tasks:
            self._tasks[task_id].status = TaskStatus.COMPLETED
            return True
        return False
    
    def abandon_task(self, task_id: str) -> bool:
        """Mark a task as abandoned."""
        if task_id in self._tasks:
            self._tasks[task_id].status = TaskStatus.ABANDONED
            return True
        return False
    
    def resolve_reference(
        self,
        reference_id: str,
        resolved_value: str,
        resolved_type: Optional[ReferenceType] = None,
    ) -> bool:
        """Resolve an ambiguous reference."""
        if reference_id in self._references:
            ref = self._references[reference_id]
            ref.value = resolved_value
            ref.normalized_value = resolved_value.lower()
            if resolved_type:
                ref.reference_type = resolved_type
            ref.confidence = min(1.0, ref.confidence + 0.3)
            return True
        return False
    
    def export_context(self, user_id: str) -> dict:
        """Export situational context for storage."""
        return {
            "tasks": [
                t.to_dict() for t in self._tasks.values()
                if t.task_id.startswith(user_id)
            ],
            "references": [
                r.to_dict() for r in self._references.values()
                if r.reference_id.startswith(user_id)
            ],
            "threads": [
                t.to_dict() for t in self._threads.values()
                if t.thread_id.startswith(user_id)
            ],
            "assumptions": self._user_assumptions.get(user_id, {}),
        }
    
    def clear_user_context(self, user_id: str) -> None:
        """Clear all situational context for a user."""
        self._tasks = {
            k: v for k, v in self._tasks.items()
            if not k.startswith(user_id)
        }
        self._references = {
            k: v for k, v in self._references.items()
            if not k.startswith(user_id)
        }
        self._threads = {
            k: v for k, v in self._threads.items()
            if not k.startswith(user_id)
        }
        if user_id in self._user_assumptions:
            del self._user_assumptions[user_id]
