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
  Database,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  cn,
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
        <div 
          className="animate-spin w-8 h-8 border-2 border-t-transparent"
          style={{ borderColor: 'var(--volt)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const ctx = context || mockContext;
  const history = versions || mockVersions;

  const statusConfig = {
    stable: { icon: CheckCircle, color: 'var(--volt)' },
    drifting: { icon: AlertTriangle, color: 'var(--data)' },
    conflicting: { icon: XCircle, color: 'var(--rage)' },
    stale: { icon: Clock, color: 'var(--text-dim)' },
  };
  const config = statusConfig[ctx.drift_status] || statusConfig.stable;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/contexts"
            className="p-2 transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--volt)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getContextTypeIcon(ctx.context_type)}</span>
              <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--volt)' }}>{ctx.key}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>{ctx.context_type}</span>
              <span style={{ color: 'var(--grid-color)' }}>•</span>
              <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>{ctx.memory_tier.replace('_', ' ')}</span>
              <span style={{ color: 'var(--grid-color)' }}>•</span>
              <span className="text-xs tracking-wider" style={{ color: 'var(--data)' }}>v{ctx.version}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn('cyber-btn flex items-center gap-2', showHistory ? '' : 'secondary')}
          >
            <History className="w-4 h-4" />
            <span>HISTORY</span>
          </button>
          <button
            onClick={handleDelete}
            className="cyber-btn danger p-2"
            style={{ background: 'transparent' }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Value card */}
          <div className="cyber-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs tracking-wider flex items-center gap-2" style={{ color: 'var(--volt)' }}>
                <Database className="w-4 h-4" />
                VALUE
              </h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 text-xs tracking-wider transition-colors"
                  style={{ color: 'var(--data)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--volt)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--data)'}
                >
                  <Edit2 className="w-4 h-4" />
                  <span>EDIT</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full h-32"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="cyber-btn flex items-center gap-2"
                    style={{ opacity: updateMutation.isPending ? 0.5 : 1 }}
                  >
                    <Save className="w-4 h-4" />
                    <span>SAVE</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="cyber-btn secondary flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>CANCEL</span>
                  </button>
                </div>
              </div>
            ) : (
              <pre 
                className="p-4 text-sm font-mono overflow-auto border"
                style={{ 
                  background: '#000', 
                  borderColor: 'var(--grid-color)',
                  color: 'var(--text-main)'
                }}
              >
                {formatValue(ctx.value)}
              </pre>
            )}
          </div>

          {/* Verification card */}
          <div className="cyber-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs tracking-wider flex items-center gap-2" style={{ color: ctx.verified ? 'var(--volt)' : 'var(--data)' }}>
                  <CheckCircle className="w-4 h-4" />
                  VERIFICATION STATUS
                </h3>
                <p className="text-xs mt-1 normal-case" style={{ color: 'var(--text-dim)' }}>
                  {ctx.verified
                    ? 'This context has been verified by the user'
                    : 'This context has not been verified'}
                </p>
              </div>
              {!ctx.verified && (
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="cyber-btn flex items-center gap-2"
                  style={{ opacity: verifyMutation.isPending ? 0.5 : 1 }}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>VERIFY</span>
                </button>
              )}
              {ctx.verified && (
                <div className="flex items-center gap-2 badge badge-volt">
                  <CheckCircle className="w-4 h-4" />
                  <span>VERIFIED</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="cyber-card p-5 space-y-4">
            <h3 className="font-bold text-xs tracking-wider flex items-center gap-2" style={{ color: 'var(--data)' }}>
              <Activity className="w-4 h-4" />
              STATUS
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>DRIFT STATUS</span>
                <span 
                  className="badge inline-flex items-center gap-1.5"
                  style={{ 
                    background: `${config.color}20`,
                    borderColor: config.color,
                    color: config.color
                  }}
                >
                  <StatusIcon className="w-3 h-3" />
                  {ctx.drift_status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>CONFIDENCE</span>
                <span 
                  className="text-sm font-bold"
                  style={{ color: ctx.confidence >= 0.8 ? 'var(--volt)' : ctx.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)' }}
                >
                  {(ctx.confidence * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>SOURCE</span>
                <span className="text-xs" style={{ color: 'var(--text-main)' }}>{ctx.source}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>EXPLICIT</span>
                <span className="text-xs" style={{ color: ctx.explicit ? 'var(--volt)' : 'var(--text-dim)' }}>
                  {ctx.explicit ? '⚡ YES' : 'NO'}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata card */}
          <div className="cyber-card p-5 space-y-4">
            <h3 className="font-bold text-xs tracking-wider" style={{ color: 'var(--volt)' }}>METADATA</h3>

            <div className="space-y-3">
              <div>
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>CREATED</span>
                <p className="text-xs normal-case" style={{ color: 'var(--text-main)' }}>{formatDateTime(ctx.created_at)}</p>
              </div>

              <div>
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>LAST UPDATED</span>
                <p className="text-xs normal-case" style={{ color: 'var(--text-main)' }}>{formatDateTime(ctx.updated_at)}</p>
              </div>

              {ctx.last_accessed_at && (
                <div>
                  <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>LAST ACCESSED</span>
                  <p className="text-xs normal-case" style={{ color: 'var(--text-main)' }}>{formatDateTime(ctx.last_accessed_at)}</p>
                </div>
              )}

              <div>
                <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>ACCESS COUNT</span>
                <p className="text-sm font-bold" style={{ color: 'var(--data)' }}>{ctx.access_count}</p>
              </div>

              {ctx.ttl_seconds && (
                <div>
                  <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>TTL</span>
                  <p className="text-xs" style={{ color: 'var(--text-main)' }}>{ctx.ttl_seconds}s</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="cyber-card p-5 animate-fade-in">
          <h3 className="font-bold text-xs tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--data)' }}>
            <History className="w-4 h-4" />
            VERSION HISTORY
          </h3>
          <div className="space-y-4">
            {history.map((version, index) => (
              <div
                key={version.id}
                className="p-4 border"
                style={{ 
                  borderColor: index === 0 ? 'var(--data)' : 'var(--grid-color)',
                  background: index === 0 ? 'var(--data-dim)' : 'rgba(0,0,0,0.3)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs tracking-wider" style={{ color: 'var(--text-main)' }}>
                      VERSION {version.version}
                    </span>
                    {index === 0 && (
                      <span className="badge badge-data">CURRENT</span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDateTime(version.created_at)}</span>
                </div>
                <pre 
                  className="p-2 text-sm font-mono mb-2 border"
                  style={{ background: '#000', borderColor: 'var(--grid-color)', color: 'var(--text-main)' }}
                >
                  {formatValue(version.value)}
                </pre>
                <div className="flex items-center justify-between text-xs">
                  <span className="normal-case" style={{ color: 'var(--text-dim)' }}>
                    {version.change_reason || 'No reason provided'}
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: version.confidence >= 0.8 ? 'var(--volt)' : version.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)' }}
                  >
                    {(version.confidence * 100).toFixed(0)}% CONFIDENCE
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
