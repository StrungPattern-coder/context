import { useQuery } from '@tanstack/react-query';
import { 
  Database, 
  Clock, 
  MapPin, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import api from '@/lib/api';
import { cn, getConfidenceColor, formatRelativeTime } from '@/lib/utils';
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
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of your context intelligence</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contexts"
          value={stats.total_contexts}
          icon={Database}
          color="sky"
        />
        <StatCard
          title="Avg Confidence"
          value={`${(stats.avg_confidence * 100).toFixed(1)}%`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Recent Updates"
          value={stats.recent_updates}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Needs Attention"
          value={stats.low_confidence_count + stats.stale_count}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Context types breakdown */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Context Types</h3>
          <div className="space-y-3">
            <ContextTypeBar
              type="Temporal"
              count={stats.by_type.temporal}
              total={stats.total_contexts}
              icon={Clock}
            />
            <ContextTypeBar
              type="Spatial"
              count={stats.by_type.spatial}
              total={stats.total_contexts}
              icon={MapPin}
            />
            <ContextTypeBar
              type="Situational"
              count={stats.by_type.situational}
              total={stats.total_contexts}
              icon={Target}
            />
            <ContextTypeBar
              type="Preference"
              count={stats.by_type.preference}
              total={stats.total_contexts}
              icon={CheckCircle}
            />
            <ContextTypeBar
              type="Identity"
              count={stats.by_type.identity}
              total={stats.total_contexts}
              icon={Database}
            />
          </div>
        </div>

        {/* Drift status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Context Health</h3>
          <div className="space-y-3">
            <DriftStatusRow
              status="Stable"
              count={stats.drift_status.stable}
              total={stats.total_contexts}
              color="green"
            />
            <DriftStatusRow
              status="Drifting"
              count={stats.drift_status.drifting}
              total={stats.total_contexts}
              color="yellow"
            />
            <DriftStatusRow
              status="Conflicting"
              count={stats.drift_status.conflicting}
              total={stats.total_contexts}
              color="red"
            />
            <DriftStatusRow
              status="Stale"
              count={stats.drift_status.stale}
              total={stats.total_contexts}
              color="gray"
            />
          </div>
        </div>

        {/* Memory tiers */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Memory Tiers</h3>
          <div className="space-y-4">
            <TierCard
              tier="Long-term"
              count={stats.by_tier.long_term}
              description="Persistent context"
            />
            <TierCard
              tier="Short-term"
              count={stats.by_tier.short_term}
              description="Session context"
            />
            <TierCard
              tier="Ephemeral"
              count={stats.by_tier.ephemeral}
              description="Temporary context"
            />
          </div>
        </div>
      </div>

      {/* Recent contexts */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Recent Context Updates</h3>
          <a href="/contexts" className="text-sm text-sky-400 hover:text-sky-300">
            View all →
          </a>
        </div>
        <div className="space-y-3">
          {contexts.map((context) => (
            <ContextRow key={context.id} context={context} />
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
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
  color: 'sky' | 'green' | 'amber' | 'red';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    sky: 'bg-sky-500/10 text-sky-400',
    green: 'bg-green-500/10 text-green-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
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
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">{type}</span>
        </div>
        <span className="text-sm text-slate-400">{count}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 rounded-full transition-all"
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
  color: 'green' | 'yellow' | 'red' | 'gray';
}

function DriftStatusRow({ status, count, total, color }: DriftStatusRowProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-3 h-3 rounded-full', colorClasses[color])} />
      <span className="text-sm text-slate-300 flex-1">{status}</span>
      <span className="text-sm text-slate-400">{count}</span>
      <span className="text-xs text-slate-500">({percentage.toFixed(1)}%)</span>
    </div>
  );
}

interface TierCardProps {
  tier: string;
  count: number;
  description: string;
}

function TierCard({ tier, count, description }: TierCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
      <div>
        <p className="font-medium text-slate-200">{tier}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <span className="text-xl font-bold text-white">{count}</span>
    </div>
  );
}

interface ContextRowProps {
  context: Context;
}

function ContextRow({ context }: ContextRowProps) {
  const statusIcons = {
    stable: CheckCircle,
    drifting: AlertTriangle,
    conflicting: XCircle,
    stale: Clock,
  };
  const StatusIcon = statusIcons[context.drift_status] || Database;

  return (
    <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg">
      <div className="p-2 bg-slate-800 rounded-lg">
        <StatusIcon className={cn('w-4 h-4', getDriftStatusIconColor(context.drift_status))} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-200 truncate">{context.key}</p>
        <p className="text-sm text-slate-500 truncate">
          {typeof context.value === 'string' ? context.value : JSON.stringify(context.value)}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('text-sm font-medium', getConfidenceColor(context.confidence))}>
          {(context.confidence * 100).toFixed(0)}%
        </p>
        <p className="text-xs text-slate-500">{formatRelativeTime(context.updated_at)}</p>
      </div>
    </div>
  );
}

function getDriftStatusIconColor(status: string): string {
  switch (status) {
    case 'stable': return 'text-green-400';
    case 'drifting': return 'text-yellow-400';
    case 'conflicting': return 'text-red-400';
    case 'stale': return 'text-gray-400';
    default: return 'text-slate-400';
  }
}
