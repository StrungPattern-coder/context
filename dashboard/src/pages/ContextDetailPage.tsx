import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Save,
  X,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  cn,
  getConfidenceColor,
  getDriftStatusColor,
  getContextTypeIcon,
  formatDateTime,
  formatValue,
} from '@/lib/utils';
import type { Context, ContextVersion } from '@/types';

// Mock data
const mockContext: Context = {
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
  version: 3,
  created_at: new Date(Date.now() - 604800000).toISOString(),
  updated_at: new Date().toISOString(),
  last_accessed_at: new Date().toISOString(),
  access_count: 42,
};

const mockVersions: ContextVersion[] = [
  {
    id: 'v3',
    context_id: '1',
    version: 3,
    value: 'America/New_York',
    confidence: 0.95,
    source: 'explicit',
    change_reason: 'User confirmed timezone',
    created_at: new Date().toISOString(),
  },
  {
    id: 'v2',
    context_id: '1',
    version: 2,
    value: 'America/Chicago',
    confidence: 0.72,
    source: 'inferred',
    change_reason: 'Detected from IP address',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'v1',
    context_id: '1',
    version: 1,
    value: 'UTC',
    confidence: 0.5,
    source: 'default',
    change_reason: 'Initial value',
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
];

export default function ContextDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: context, isLoading } = useQuery({
    queryKey: ['context', id],
    queryFn: async () => {
      try {
        const response = await api.get<Context>(`/dashboard/context/${id}`);
        return response.data;
      } catch {
        return mockContext;
      }
    },
  });

  const { data: versions } = useQuery({
    queryKey: ['context-history', id],
    queryFn: async () => {
      try {
        const response = await api.get<ContextVersion[]>(`/dashboard/history/${id}`);
        return response.data;
      } catch {
        return mockVersions;
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newValue: unknown) => {
      await api.put(`/context/update`, {
        user_id: context?.user_id,
        key: context?.key,
        value: newValue,
        source: 'manual',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context', id] });
      queryClient.invalidateQueries({ queryKey: ['context-history', id] });
      setIsEditing(false);
      toast.success('Context updated');
    },
    onError: () => {
      toast.error('Failed to update context');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/context/${id}`);
    },
    onSuccess: () => {
      toast.success('Context deleted');
      navigate('/contexts');
    },
    onError: () => {
      toast.error('Failed to delete context');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/context/confirm/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context', id] });
      toast.success('Context verified');
    },
    onError: () => {
      toast.error('Failed to verify context');
    },
  });

  const handleEdit = () => {
    setEditValue(typeof context?.value === 'string' ? context.value : JSON.stringify(context?.value, null, 2));
    setIsEditing(true);
  };

  const handleSave = () => {
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(editValue);
    } catch {
      parsedValue = editValue;
    }
    updateMutation.mutate(parsedValue);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this context?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const ctx = context || mockContext;
  const history = versions || mockVersions;

  const statusIcons = {
    stable: CheckCircle,
    drifting: AlertTriangle,
    conflicting: XCircle,
    stale: Clock,
  };
  const StatusIcon = statusIcons[ctx.drift_status];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/contexts"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getContextTypeIcon(ctx.context_type)}</span>
              <h1 className="text-2xl font-bold text-white">{ctx.key}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-400 capitalize">{ctx.context_type}</span>
              <span className="text-slate-600">•</span>
              <span className="text-sm text-slate-400">{ctx.memory_tier.replace('_', ' ')}</span>
              <span className="text-slate-600">•</span>
              <span className="text-sm text-slate-400">v{ctx.version}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
              showHistory
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Value card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Value</h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-600/50 text-white rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <pre className="p-4 bg-slate-900 rounded-lg text-sm text-slate-300 font-mono overflow-auto">
                {formatValue(ctx.value)}
              </pre>
            )}
          </div>

          {/* Verification card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Verification Status</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {ctx.verified
                    ? 'This context has been verified by the user'
                    : 'This context has not been verified'}
                </p>
              </div>
              {!ctx.verified && (
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Verify</span>
                </button>
              )}
              {ctx.verified && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Verified</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white">Status</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Drift Status</span>
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', getDriftStatusColor(ctx.drift_status))}>
                  <StatusIcon className="w-3 h-3" />
                  {ctx.drift_status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Confidence</span>
                <span className={cn('text-sm font-medium', getConfidenceColor(ctx.confidence))}>
                  {(ctx.confidence * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Source</span>
                <span className="text-sm text-slate-300 capitalize">{ctx.source}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Explicit</span>
                <span className="text-sm text-slate-300">{ctx.explicit ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Metadata card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white">Metadata</h3>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500">Created</span>
                <p className="text-sm text-slate-300">{formatDateTime(ctx.created_at)}</p>
              </div>

              <div>
                <span className="text-xs text-slate-500">Last Updated</span>
                <p className="text-sm text-slate-300">{formatDateTime(ctx.updated_at)}</p>
              </div>

              {ctx.last_accessed_at && (
                <div>
                  <span className="text-xs text-slate-500">Last Accessed</span>
                  <p className="text-sm text-slate-300">{formatDateTime(ctx.last_accessed_at)}</p>
                </div>
              )}

              <div>
                <span className="text-xs text-slate-500">Access Count</span>
                <p className="text-sm text-slate-300">{ctx.access_count}</p>
              </div>

              {ctx.ttl_seconds && (
                <div>
                  <span className="text-xs text-slate-500">TTL</span>
                  <p className="text-sm text-slate-300">{ctx.ttl_seconds}s</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 animate-slide-up">
          <h3 className="font-semibold text-white mb-4">Version History</h3>
          <div className="space-y-4">
            {history.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  'p-4 rounded-lg border',
                  index === 0
                    ? 'bg-sky-500/5 border-sky-500/20'
                    : 'bg-slate-900/50 border-slate-700'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Version {version.version}</span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-xs rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-500">{formatDateTime(version.created_at)}</span>
                </div>
                <pre className="p-2 bg-slate-900 rounded text-sm text-slate-300 font-mono mb-2">
                  {formatValue(version.value)}
                </pre>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {version.change_reason || 'No reason provided'}
                  </span>
                  <span className={cn('font-medium', getConfidenceColor(version.confidence))}>
                    {(version.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
