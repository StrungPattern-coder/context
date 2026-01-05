/**
 * RAL Dashboard Type Definitions
 */

// Context types
export type ContextType = 'temporal' | 'spatial' | 'situational' | 'preference' | 'identity';
export type MemoryTier = 'long_term' | 'short_term' | 'ephemeral';
export type DriftStatus = 'stable' | 'drifting' | 'conflicting' | 'stale';

// Core context interface
export interface Context {
  id: string;
  user_id: string;
  tenant_id: string;
  context_type: ContextType;
  key: string;
  value: unknown;
  confidence: number;
  memory_tier: MemoryTier;
  drift_status: DriftStatus;
  source: string;
  verified: boolean;
  explicit: boolean;
  version: number;
  ttl_seconds?: number;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  access_count: number;
}

// Context version for history
export interface ContextVersion {
  id: string;
  context_id: string;
  version: number;
  value: unknown;
  confidence: number;
  source: string;
  change_reason?: string;
  created_at: string;
}

// Dashboard summary
export interface DashboardSummary {
  total_contexts: number;
  by_type: Record<ContextType, number>;
  by_tier: Record<MemoryTier, number>;
  drift_status: Record<DriftStatus, number>;
  avg_confidence: number;
  recent_updates: number;
  low_confidence_count: number;
  stale_count: number;
}

// Drift report item
export interface DriftItem {
  context_id: string;
  key: string;
  context_type: ContextType;
  drift_status: DriftStatus;
  confidence: number;
  last_verified?: string;
  days_since_update: number;
  recommendation: string;
}

// Drift report
export interface DriftReport {
  user_id: string;
  generated_at: string;
  total_contexts: number;
  healthy_count: number;
  drifting_count: number;
  conflicting_count: number;
  stale_count: number;
  items: DriftItem[];
  recommendations: string[];
}

// Assumption for confirmation
export interface Assumption {
  id: string;
  key: string;
  assumed_value: unknown;
  alternatives?: unknown[];
  confidence: number;
  basis: string;
  context_type: ContextType;
}

// Resolution response
export interface ResolutionResponse {
  resolved: Record<string, unknown>;
  assumptions: Assumption[];
  confidence_summary: {
    high: number;
    medium: number;
    low: number;
    critical: number;
  };
}

// User type
export interface User {
  id: string;
  external_id: string;
  email?: string;
  display_name?: string;
  preferences: Record<string, unknown>;
  created_at: string;
  last_active_at?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  tenant_id: string;
  is_admin: boolean;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Filter options
export interface ContextFilters {
  type?: ContextType;
  tier?: MemoryTier;
  drift_status?: DriftStatus;
  min_confidence?: number;
  verified?: boolean;
  search?: string;
}
