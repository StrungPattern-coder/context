/**
 * Context Service
 * 
 * Handles context CRUD operations and queries
 */

import { api } from './api';
import type { 
  Context, 
  ContextVersion, 
  DashboardSummary, 
  DriftReport,
  ContextFilters,
  PaginatedResponse,
} from '@/types';

interface CreateContextData {
  key: string;
  value: unknown;
  context_type: string;
  memory_tier?: string;
  confidence?: number;
  source?: string;
  ttl_seconds?: number;
  explicit?: boolean;
}

interface UpdateContextData {
  value?: unknown;
  confidence?: number;
  memory_tier?: string;
  ttl_seconds?: number;
}

export const contextService = {
  /**
   * Get paginated list of contexts for a user
   */
  async getContexts(
    userId: string,
    filters?: ContextFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Context>> {
    const params = new URLSearchParams({
      user_id: userId,
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (filters?.type) params.append('type', filters.type);
    if (filters?.tier) params.append('tier', filters.tier);
    if (filters?.drift_status) params.append('drift_status', filters.drift_status);
    if (filters?.min_confidence) params.append('min_confidence', filters.min_confidence.toString());
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get<PaginatedResponse<Context>>(`/context?${params}`);
    return response.data;
  },

  /**
   * Get a specific context by ID
   */
  async getContext(contextId: string): Promise<Context> {
    const response = await api.get<Context>(`/context/${contextId}`);
    return response.data;
  },

  /**
   * Create a new context
   */
  async createContext(userId: string, data: CreateContextData): Promise<Context> {
    const response = await api.post<Context>('/context', {
      user_id: userId,
      ...data,
    });
    return response.data;
  },

  /**
   * Update an existing context
   */
  async updateContext(contextId: string, data: UpdateContextData): Promise<Context> {
    const response = await api.patch<Context>(`/context/${contextId}`, data);
    return response.data;
  },

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<void> {
    await api.delete(`/context/${contextId}`);
  },

  /**
   * Get context version history
   */
  async getContextHistory(contextId: string): Promise<ContextVersion[]> {
    const response = await api.get<ContextVersion[]>(`/context/${contextId}/history`);
    return response.data;
  },

  /**
   * Verify a context (confirm it's still accurate)
   */
  async verifyContext(contextId: string): Promise<Context> {
    const response = await api.post<Context>(`/context/${contextId}/verify`);
    return response.data;
  },

  /**
   * Get dashboard summary for a user
   */
  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const response = await api.get<DashboardSummary>(`/dashboard/summary?user_id=${userId}`);
    return response.data;
  },

  /**
   * Get drift report for a user
   */
  async getDriftReport(userId: string): Promise<DriftReport> {
    const response = await api.get<DriftReport>(`/dashboard/drift-report?user_id=${userId}`);
    return response.data;
  },

  /**
   * Bulk update contexts
   */
  async bulkUpdate(contextIds: string[], data: UpdateContextData): Promise<Context[]> {
    const response = await api.post<Context[]>('/context/bulk-update', {
      context_ids: contextIds,
      ...data,
    });
    return response.data;
  },

  /**
   * Search contexts
   */
  async searchContexts(
    userId: string,
    query: string,
    limit = 10
  ): Promise<Context[]> {
    const response = await api.get<Context[]>('/context/search', {
      params: { user_id: userId, q: query, limit },
    });
    return response.data;
  },
};

export default contextService;
