import { useQuery } from '@tanstack/react-query';
import { 
  Database, 
  Clock, 
  MapPin, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Activity,
  Shield,
  Layers
} from 'lucide-react';
import api from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import type { DashboardSummary, Context } from '@/types';

// Mock data for demo
const mockSummary: DashboardSummary = {
  total_contexts: 247,
  by_type: {
    temporal: 45,
    spatial: 38,
    situational: 89,
    preference: 52,
    identity: 23,
  },
  by_tier: {
    long_term: 156,
    short_term: 64,
    ephemeral: 27,
  },
  drift_status: {
    stable: 198,
    drifting: 32,
    conflicting: 8,
    stale: 9,
  },
  avg_confidence: 0.847,
  recent_updates: 15,
  low_confidence_count: 12,
  stale_count: 9,
};

const mockRecentContexts: Context[] = [
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
    value: { city: 'New York', country: 'USA' },
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
];

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      try {
        const response = await api.get<DashboardSummary>('/dashboard/summary');
        return response.data;
      } catch {
        return mockSummary; // Fallback to mock data
      }
    },
  });

  const { data: recentContexts } = useQuery({
    queryKey: ['recent-contexts'],
    queryFn: async () => {
      try {
        const response = await api.get<Context[]>('/dashboard/contexts', {
          params: { limit: 5 },
        });
        return response.data;
      } catch {
        return mockRecentContexts;
      }
    },
  });

  const stats = summary || mockSummary;
  const contexts = recentContexts || mockRecentContexts;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-volt" style={{ color: 'var(--volt)' }} />
            <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--volt)' }}>
              COMMAND CENTER
            </h1>
          </div>
          <p className="text-dim mt-1 text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>
            CONTEXT INTELLIGENCE OVERVIEW // SYSTEM STATUS: NOMINAL
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="status-dot online" />
          <span className="text-xs" style={{ color: 'var(--volt)' }}>LIVE</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contexts"
          value={stats.total_contexts}
          icon={Database}
          color="volt"
        />
        <StatCard
          title="Avg Confidence"
          value={`${(stats.avg_confidence * 100).toFixed(1)}%`}
          icon={TrendingUp}
          color="data"
        />
        <StatCard
          title="Recent Updates"
          value={stats.recent_updates}
          icon={Activity}
          color="volt"
        />
        <StatCard
          title="Needs Attention"
          value={stats.low_confidence_count + stats.stale_count}
          icon={AlertTriangle}
          color="rage"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Context types breakdown */}
        <div className="cyber-card p-5">
          <h3 className="font-bold mb-4 text-xs tracking-widest flex items-center gap-2" style={{ color: 'var(--volt)' }}>
            <Target className="w-4 h-4" />
            CONTEXT TYPES
          </h3>
          <div className="space-y-3">
            <ContextTypeBar
              type="TEMPORAL"
              count={stats.by_type.temporal}
              total={stats.total_contexts}
              icon={Clock}
            />
            <ContextTypeBar
              type="SPATIAL"
              count={stats.by_type.spatial}
              total={stats.total_contexts}
              icon={MapPin}
            />
            <ContextTypeBar
              type="SITUATIONAL"
              count={stats.by_type.situational}
              total={stats.total_contexts}
              icon={Target}
            />
            <ContextTypeBar
              type="PREFERENCE"
              count={stats.by_type.preference}
              total={stats.total_contexts}
              icon={CheckCircle}
            />
            <ContextTypeBar
              type="IDENTITY"
              count={stats.by_type.identity}
              total={stats.total_contexts}
              icon={Database}
            />
          </div>
        </div>

        {/* Drift status */}
        <div className="cyber-card p-5">
          <h3 className="font-bold mb-4 text-xs tracking-widest flex items-center gap-2" style={{ color: 'var(--data)' }}>
            <Shield className="w-4 h-4" />
            CONTEXT HEALTH
          </h3>
          <div className="space-y-3">
            <DriftStatusRow
              status="STABLE"
              count={stats.drift_status.stable}
              total={stats.total_contexts}
              color="volt"
            />
            <DriftStatusRow
              status="DRIFTING"
              count={stats.drift_status.drifting}
              total={stats.total_contexts}
              color="data"
            />
            <DriftStatusRow
              status="CONFLICTING"
              count={stats.drift_status.conflicting}
              total={stats.total_contexts}
              color="rage"
            />
            <DriftStatusRow
              status="STALE"
              count={stats.drift_status.stale}
              total={stats.total_contexts}
              color="dim"
            />
          </div>
        </div>

        {/* Memory tiers */}
        <div className="cyber-card p-5">
          <h3 className="font-bold mb-4 text-xs tracking-widest flex items-center gap-2" style={{ color: 'var(--volt)' }}>
            <Layers className="w-4 h-4" />
            MEMORY TIERS
          </h3>
          <div className="space-y-4">
            <TierCard
              tier="LONG-TERM"
              count={stats.by_tier.long_term}
              description="Persistent context"
              color="volt"
            />
            <TierCard
              tier="SHORT-TERM"
              count={stats.by_tier.short_term}
              description="Session context"
              color="data"
            />
            <TierCard
              tier="EPHEMERAL"
              count={stats.by_tier.ephemeral}
              description="Temporary context"
              color="dim"
            />
          </div>
        </div>
      </div>

      {/* Recent contexts */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xs tracking-widest flex items-center gap-2" style={{ color: 'var(--volt)' }}>
            <Activity className="w-4 h-4" />
            RECENT CONTEXT UPDATES
          </h3>
          <a 
            href="/contexts" 
            className="text-xs font-bold tracking-wider hover:underline transition-colors"
            style={{ color: 'var(--data)' }}
          >
            VIEW ALL →
          </a>
        </div>
        <div className="space-y-3">
          {contexts.map((context) => (
            <ContextRow key={context.id} context={context} />
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div 
              className="animate-spin w-8 h-8 border-2 border-t-transparent"
              style={{ borderColor: 'var(--volt)', borderTopColor: 'transparent' }}
            />
            <span className="text-xs tracking-widest" style={{ color: 'var(--volt)' }}>LOADING...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'volt' | 'data' | 'rage';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorStyles = {
    volt: { border: 'var(--volt)', bg: 'var(--volt-dim)', text: 'var(--volt)' },
    data: { border: 'var(--data)', bg: 'var(--data-dim)', text: 'var(--data)' },
    rage: { border: 'var(--rage)', bg: 'var(--rage-dim)', text: 'var(--rage)' },
  };
  const style = colorStyles[color];

  return (
    <div 
      className="cyber-card p-5"
      style={{ borderColor: style.border }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: style.text }}>{value}</p>
        </div>
        <div 
          className="p-2"
          style={{ background: style.bg, border: `1px solid ${style.border}` }}
        >
          <Icon className="w-5 h-5" style={{ color: style.text }} />
        </div>
      </div>
    </div>
  );
}

interface ContextTypeBarProps {
  type: string;
  count: number;
  total: number;
  icon: React.ElementType;
}

function ContextTypeBar({ type, count, total, icon: Icon }: ContextTypeBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
          <span className="text-xs tracking-wider" style={{ color: 'var(--text-main)' }}>{type}</span>
        </div>
        <span className="text-xs font-bold" style={{ color: 'var(--volt)' }}>{count}</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface DriftStatusRowProps {
  status: string;
  count: number;
  total: number;
  color: 'volt' | 'data' | 'rage' | 'dim';
}

function DriftStatusRow({ status, count, total, color }: DriftStatusRowProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorStyles = {
    volt: 'var(--volt)',
    data: 'var(--data)',
    rage: 'var(--rage)',
    dim: 'var(--text-dim)',
  };

  return (
    <div className="flex items-center gap-3">
      <div 
        className="w-2 h-2"
        style={{ background: colorStyles[color], boxShadow: `0 0 8px ${colorStyles[color]}` }}
      />
      <span className="text-xs tracking-wider flex-1" style={{ color: 'var(--text-main)' }}>{status}</span>
      <span className="text-xs font-bold" style={{ color: colorStyles[color] }}>{count}</span>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>({percentage.toFixed(1)}%)</span>
    </div>
  );
}

interface TierCardProps {
  tier: string;
  count: number;
  description: string;
  color: 'volt' | 'data' | 'dim';
}

function TierCard({ tier, count, description, color }: TierCardProps) {
  const colorStyles = {
    volt: { border: 'var(--volt)', text: 'var(--volt)' },
    data: { border: 'var(--data)', text: 'var(--data)' },
    dim: { border: 'var(--text-dim)', text: 'var(--text-dim)' },
  };
  const style = colorStyles[color];

  return (
    <div 
      className="flex items-center justify-between p-3 border"
      style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
    >
      <div>
        <p className="font-bold text-xs tracking-wider" style={{ color: style.text }}>{tier}</p>
        <p className="text-xs normal-case" style={{ color: 'var(--text-dim)' }}>{description}</p>
      </div>
      <span className="text-xl font-bold" style={{ color: style.text }}>{count}</span>
    </div>
  );
}

interface ContextRowProps {
  context: Context;
}

function ContextRow({ context }: ContextRowProps) {
  const statusConfig = {
    stable: { icon: CheckCircle, color: 'var(--volt)' },
    drifting: { icon: AlertTriangle, color: 'var(--data)' },
    conflicting: { icon: XCircle, color: 'var(--rage)' },
    stale: { icon: Clock, color: 'var(--text-dim)' },
  };
  const config = statusConfig[context.drift_status] || { icon: Database, color: 'var(--text-dim)' };
  const StatusIcon = config.icon;

  return (
    <div 
      className="flex items-center gap-4 p-3 border transition-all hover:border-volt-dim"
      style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
    >
      <div 
        className="p-2"
        style={{ border: `1px solid ${config.color}`, background: `${config.color}20` }}
      >
        <StatusIcon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs tracking-wider truncate" style={{ color: 'var(--text-main)' }}>
          {context.key}
        </p>
        <p className="text-xs truncate normal-case" style={{ color: 'var(--text-dim)' }}>
          {typeof context.value === 'string' ? context.value : JSON.stringify(context.value)}
        </p>
      </div>
      <div className="text-right">
        <p 
          className="text-sm font-bold"
          style={{ color: context.confidence >= 0.8 ? 'var(--volt)' : context.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)' }}
        >
          {(context.confidence * 100).toFixed(0)}%
        </p>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatRelativeTime(context.updated_at)}</p>
      </div>
    </div>
  );
}
