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
  Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  cn,
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
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" style={{ color: 'var(--volt)' }} />
            <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--volt)' }}>
              CONTEXT DATABASE
            </h1>
          </div>
          <p className="mt-1 text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>
            MANAGE ALL STORED CONTEXT DATA // {filteredContexts.length} RECORDS
          </p>
        </div>
        <button className="cyber-btn flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>NEW CONTEXT</span>
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-dim)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH CONTEXTS..."
            style={{ paddingLeft: '40px' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'cyber-btn flex items-center gap-2',
            showFilters ? '' : 'secondary'
          )}
        >
          <Filter className="w-4 h-4" />
          <span>FILTERS</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border animate-fade-in"
          style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
        >
          <div>
            <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>TYPE</label>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as ContextType || undefined })}
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
            <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>MEMORY TIER</label>
            <select
              value={filters.tier || ''}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value as MemoryTier || undefined })}
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
            <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>STATUS</label>
            <select
              value={filters.drift_status || ''}
              onChange={(e) => setFilters({ ...filters, drift_status: e.target.value as DriftStatus || undefined })}
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
            <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>MIN CONFIDENCE</label>
            <select
              value={filters.min_confidence || ''}
              onChange={(e) => setFilters({ ...filters, min_confidence: e.target.value ? parseFloat(e.target.value) : undefined })}
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
      <div className="cyber-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>CONTEXT</th>
                <th>VALUE</th>
                <th>CONFIDENCE</th>
                <th>STATUS</th>
                <th>UPDATED</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredContexts.map((context) => (
                <ContextRow
                  key={context.id}
                  context={context}
                  onDelete={() => handleDelete(context.id)}
                />
              ))}
              {filteredContexts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
                    NO CONTEXTS FOUND
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div 
            className="animate-spin w-8 h-8 border-2 border-t-transparent"
            style={{ borderColor: 'var(--volt)', borderTopColor: 'transparent' }}
          />
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
  const statusConfig = {
    stable: { icon: CheckCircle, color: 'var(--volt)' },
    drifting: { icon: AlertTriangle, color: 'var(--data)' },
    conflicting: { icon: XCircle, color: 'var(--rage)' },
    stale: { icon: Clock, color: 'var(--text-dim)' },
  };
  const config = statusConfig[context.drift_status] || { icon: Clock, color: 'var(--text-dim)' };
  const StatusIcon = config.icon;

  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <span className="text-xl">{getContextTypeIcon(context.context_type)}</span>
          <div>
            <Link
              to={`/contexts/${context.id}`}
              className="font-bold text-xs tracking-wider transition-colors"
              style={{ color: 'var(--text-main)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--volt)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            >
              {context.key}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{context.context_type}</span>
              <span className="text-xs" style={{ color: 'var(--grid-color)' }}>•</span>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{context.memory_tier.replace('_', ' ')}</span>
              {context.verified && (
                <>
                  <span className="text-xs" style={{ color: 'var(--grid-color)' }}>•</span>
                  <span className="text-xs" style={{ color: 'var(--volt)' }}>⚡ VERIFIED</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className="text-xs truncate max-w-xs block normal-case" style={{ color: 'var(--text-main)' }}>
          {formatValue(context.value)}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="progress-bar w-16">
            <div
              className="progress-bar-fill"
              style={{ 
                width: `${context.confidence * 100}%`,
                background: context.confidence >= 0.8 ? 'var(--volt)' : 
                           context.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)'
              }}
            />
          </div>
          <span 
            className="text-xs font-bold"
            style={{ 
              color: context.confidence >= 0.8 ? 'var(--volt)' : 
                     context.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)'
            }}
          >
            {(context.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </td>
      <td>
        <span 
          className="badge inline-flex items-center gap-1.5"
          style={{ 
            background: `${config.color}20`,
            borderColor: config.color,
            color: config.color
          }}
        >
          <StatusIcon className="w-3 h-3" />
          {context.drift_status}
        </span>
      </td>
      <td>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatRelativeTime(context.updated_at)}</span>
      </td>
      <td>
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/contexts/${context.id}`}
            className="p-1.5 transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--data)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <Edit2 className="w-4 h-4" />
          </Link>
          <button
            onClick={onDelete}
            className="p-1.5 transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--rage)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
