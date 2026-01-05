import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  cn,
  getConfidenceColor,
  getDriftStatusColor,
  getContextTypeIcon,
  formatRelativeTime,
  formatValue,
} from '@/lib/utils';
import type { Context, ContextFilters, ContextType, MemoryTier, DriftStatus } from '@/types';

// Mock data
const mockContexts: Context[] = [
  {
    id: '1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    context_type: 'temporal',
    key: 'current_timezone',
    value: 'America/New_York',
    confidence: 0.95,
    memory_tier: 'long_term',
    drift_status: 'stable',
    source: 'explicit',
    verified: true,
    explicit: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    access_count: 42,
  },
  {
    id: '2',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    context_type: 'spatial',
    key: 'home_location',
    value: { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.006 },
    confidence: 0.88,
    memory_tier: 'long_term',
    drift_status: 'stable',
    source: 'inferred',
    verified: true,
    explicit: false,
    version: 3,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    access_count: 156,
  },
  {
    id: '3',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    context_type: 'situational',
    key: 'current_task',
    value: 'Writing quarterly report',
    confidence: 0.72,
    memory_tier: 'short_term',
    drift_status: 'drifting',
    source: 'inferred',
    verified: false,
    explicit: false,
    version: 5,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    access_count: 8,
  },
  {
    id: '4',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    context_type: 'preference',
    key: 'communication_style',
    value: 'concise',
    confidence: 0.82,
    memory_tier: 'long_term',
    drift_status: 'stable',
    source: 'explicit',
    verified: true,
    explicit: true,
    version: 2,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    access_count: 234,
  },
  {
    id: '5',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    context_type: 'temporal',
    key: 'work_hours',
    value: { start: '09:00', end: '17:00' },
    confidence: 0.65,
    memory_tier: 'long_term',
    drift_status: 'conflicting',
    source: 'inferred',
    verified: false,
    explicit: false,
    version: 4,
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
    access_count: 89,
  },
];

const contextTypes: ContextType[] = ['temporal', 'spatial', 'situational', 'preference', 'identity'];
const memoryTiers: MemoryTier[] = ['long_term', 'short_term', 'ephemeral'];
const driftStatuses: DriftStatus[] = ['stable', 'drifting', 'conflicting', 'stale'];

export default function ContextsPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ContextFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const { data: contexts, isLoading } = useQuery({
    queryKey: ['contexts', filters],
    queryFn: async () => {
      try {
        const response = await api.get<Context[]>('/dashboard/contexts', {
          params: filters,
        });
        return response.data;
      } catch {
        return mockContexts;
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/context/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      toast.success('Context deleted');
    },
    onError: () => {
      toast.error('Failed to delete context');
    },
  });

  const filteredContexts = (contexts || mockContexts).filter((ctx) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const keyMatch = ctx.key.toLowerCase().includes(searchLower);
      const valueMatch = formatValue(ctx.value).toLowerCase().includes(searchLower);
      if (!keyMatch && !valueMatch) return false;
    }
    return true;
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this context?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contexts</h1>
          <p className="text-slate-400 mt-1">
            Manage all stored context data
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span>Add Context</span>
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contexts..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors',
            showFilters
              ? 'bg-sky-600 border-sky-600 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          )}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg animate-slide-up">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Type</label>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as ContextType || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">All types</option>
              {contextTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Memory Tier</label>
            <select
              value={filters.tier || ''}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value as MemoryTier || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">All tiers</option>
              {memoryTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier.replace('_', ' ').charAt(0).toUpperCase() + tier.replace('_', ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Status</label>
            <select
              value={filters.drift_status || ''}
              onChange={(e) => setFilters({ ...filters, drift_status: e.target.value as DriftStatus || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">All statuses</option>
              {driftStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Min Confidence</label>
            <select
              value={filters.min_confidence || ''}
              onChange={(e) => setFilters({ ...filters, min_confidence: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Any confidence</option>
              <option value="0.8">High (80%+)</option>
              <option value="0.6">Medium (60%+)</option>
              <option value="0.4">Low (40%+)</option>
            </select>
          </div>
        </div>
      )}

      {/* Contexts list */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Context</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Value</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Confidence</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Updated</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredContexts.map((context) => (
                <ContextRow
                  key={context.id}
                  context={context}
                  onDelete={() => handleDelete(context.id)}
                />
              ))}
              {filteredContexts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No contexts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

interface ContextRowProps {
  context: Context;
  onDelete: () => void;
}

function ContextRow({ context, onDelete }: ContextRowProps) {
  const statusIcons = {
    stable: CheckCircle,
    drifting: AlertTriangle,
    conflicting: XCircle,
    stale: Clock,
  };
  const StatusIcon = statusIcons[context.drift_status];

  return (
    <tr className="hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{getContextTypeIcon(context.context_type)}</span>
          <div>
            <Link
              to={`/contexts/${context.id}`}
              className="font-medium text-white hover:text-sky-400 transition-colors"
            >
              {context.key}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 capitalize">{context.context_type}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-500">{context.memory_tier.replace('_', ' ')}</span>
              {context.verified && (
                <>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-green-500">Verified</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-300 truncate max-w-xs block">
          {formatValue(context.value)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                context.confidence >= 0.8 ? 'bg-green-500' :
                context.confidence >= 0.6 ? 'bg-yellow-500' :
                context.confidence >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
              )}
              style={{ width: `${context.confidence * 100}%` }}
            />
          </div>
          <span className={cn('text-sm font-medium', getConfidenceColor(context.confidence))}>
            {(context.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', getDriftStatusColor(context.drift_status))}>
          <StatusIcon className="w-3 h-3" />
          {context.drift_status}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-400">{formatRelativeTime(context.updated_at)}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/contexts/${context.id}`}
            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-700 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
