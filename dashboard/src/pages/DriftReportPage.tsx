import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { DriftReport, DriftItem } from '@/types';

// Mock data
const mockDriftReport: DriftReport = {
  user_id: 'user-1',
  generated_at: new Date().toISOString(),
  total_contexts: 247,
  healthy_count: 198,
  drifting_count: 32,
  conflicting_count: 8,
  stale_count: 9,
  items: [
    {
      context_id: '1',
      key: 'work_hours',
      context_type: 'temporal',
      drift_status: 'conflicting',
      confidence: 0.45,
      last_verified: new Date(Date.now() - 604800000).toISOString(),
      days_since_update: 7,
      recommendation: 'Conflicting values detected. Please verify your work hours.',
    },
    {
      context_id: '2',
      key: 'preferred_language',
      context_type: 'preference',
      drift_status: 'stale',
      confidence: 0.68,
      last_verified: new Date(Date.now() - 2592000000).toISOString(),
      days_since_update: 30,
      recommendation: 'Not accessed in 30 days. Consider refreshing.',
    },
    {
      context_id: '3',
      key: 'current_project',
      context_type: 'situational',
      drift_status: 'drifting',
      confidence: 0.52,
      days_since_update: 14,
      recommendation: 'Confidence has decreased. Please confirm current project.',
    },
    {
      context_id: '4',
      key: 'meeting_preferences',
      context_type: 'preference',
      drift_status: 'drifting',
      confidence: 0.61,
      last_verified: new Date(Date.now() - 1209600000).toISOString(),
      days_since_update: 21,
      recommendation: 'Value may be outdated. Review and update if needed.',
    },
    {
      context_id: '5',
      key: 'team_members',
      context_type: 'situational',
      drift_status: 'conflicting',
      confidence: 0.38,
      days_since_update: 5,
      recommendation: 'Multiple conflicting values. Requires immediate attention.',
    },
  ],
  recommendations: [
    'Review and verify 8 conflicting contexts',
    'Update 9 stale contexts that haven\'t been accessed recently',
    'Confirm 12 low-confidence assumptions',
    'Consider setting explicit values for frequently accessed inferred contexts',
  ],
};

export default function DriftReportPage() {
  const { data: report, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['drift-report'],
    queryFn: async () => {
      try {
        const response = await api.get<DriftReport>('/dashboard/drift-report');
        return response.data;
      } catch {
        return mockDriftReport;
      }
    },
  });

  const data = report || mockDriftReport;
  const healthPercent = data.total_contexts > 0
    ? ((data.healthy_count / data.total_contexts) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" style={{ color: 'var(--data)' }} />
            <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--data)' }}>
              DRIFT REPORT
            </h1>
          </div>
          <p className="mt-1 text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>
            CONTEXT HEALTH ANALYSIS // {data.items.length} ISSUES DETECTED
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="cyber-btn secondary flex items-center gap-2"
            style={{ opacity: isRefetching ? 0.5 : 1 }}
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
            <span>REFRESH</span>
          </button>
          <button className="cyber-btn flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>EXPORT</span>
          </button>
        </div>
      </div>

      {/* Health overview */}
      <div className="cyber-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Health score */}
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="var(--grid-color)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="var(--volt)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${parseFloat(healthPercent) * 2.51} 251`}
                  style={{ filter: 'drop-shadow(0 0 8px var(--volt-dim))' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: 'var(--volt)' }}>{healthPercent}%</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--volt)' }}>SYSTEM HEALTH</h3>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {data.healthy_count} of {data.total_contexts} contexts healthy
              </p>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              icon={CheckCircle}
              label="HEALTHY"
              count={data.healthy_count}
              color="volt"
            />
            <StatusCard
              icon={AlertTriangle}
              label="DRIFTING"
              count={data.drifting_count}
              color="data"
            />
            <StatusCard
              icon={XCircle}
              label="CONFLICT"
              count={data.conflicting_count}
              color="rage"
            />
            <StatusCard
              icon={Clock}
              label="STALE"
              count={data.stale_count}
              color="dim"
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div 
          className="p-5 border"
          style={{ borderColor: 'var(--data)', background: 'var(--data-dim)' }}
        >
          <h3 className="font-bold text-xs tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--data)' }}>
            <Activity className="w-5 h-5" />
            RECOMMENDATIONS
          </h3>
          <ul className="space-y-2">
            {data.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-main)' }}>
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--data)' }} />
                <span className="normal-case">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues list */}
      <div className="cyber-card overflow-hidden">
        <div 
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--grid-color)' }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--rage)' }} />
          <h3 className="font-bold text-xs tracking-wider" style={{ color: 'var(--rage)' }}>
            CONTEXTS NEEDING ATTENTION
          </h3>
        </div>
        <div>
          {data.items.map((item) => (
            <DriftItemRow key={item.context_id} item={item} />
          ))}
          {data.items.length === 0 && (
            <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
              NO ISSUES FOUND. ALL CONTEXTS ARE HEALTHY!
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div 
            className="animate-spin w-8 h-8 border-2 border-t-transparent"
            style={{ borderColor: 'var(--data)', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </div>
  );
}

interface StatusCardProps {
  icon: React.ElementType;
  label: string;
  count: number;
  color: 'volt' | 'data' | 'rage' | 'dim';
}

function StatusCard({ icon: Icon, label, count, color }: StatusCardProps) {
  const colorStyles = {
    volt: { border: 'var(--volt)', bg: 'var(--volt-dim)', text: 'var(--volt)' },
    data: { border: 'var(--data)', bg: 'var(--data-dim)', text: 'var(--data)' },
    rage: { border: 'var(--rage)', bg: 'var(--rage-dim)', text: 'var(--rage)' },
    dim: { border: 'var(--text-dim)', bg: 'rgba(100,100,100,0.2)', text: 'var(--text-dim)' },
  };
  const style = colorStyles[color];

  return (
    <div 
      className="p-4 border"
      style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div 
          className="p-1.5"
          style={{ background: style.bg, border: `1px solid ${style.border}` }}
        >
          <Icon className="w-4 h-4" style={{ color: style.text }} />
        </div>
        <span className="text-xs tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color: style.text }}>{count}</span>
    </div>
  );
}

interface DriftItemRowProps {
  item: DriftItem;
}

function DriftItemRow({ item }: DriftItemRowProps) {
  const statusConfig = {
    stable: { icon: CheckCircle, color: 'var(--volt)' },
    drifting: { icon: AlertTriangle, color: 'var(--data)' },
    conflicting: { icon: XCircle, color: 'var(--rage)' },
    stale: { icon: Clock, color: 'var(--text-dim)' },
  };
  const config = statusConfig[item.drift_status] || statusConfig.stale;
  const StatusIcon = config.icon;

  return (
    <div 
      className="px-5 py-4 border-b transition-colors"
      style={{ borderColor: 'var(--grid-color)' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(252, 238, 10, 0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div 
            className="p-2 mt-0.5"
            style={{ background: `${config.color}20`, border: `1px solid ${config.color}` }}
          >
            <StatusIcon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <Link
              to={`/contexts/${item.context_id}`}
              className="font-bold text-xs tracking-wider transition-colors"
              style={{ color: 'var(--text-main)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--volt)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            >
              {item.key}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.context_type}</span>
              <span className="text-xs" style={{ color: 'var(--grid-color)' }}>•</span>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.days_since_update}d since update</span>
              {item.last_verified && (
                <>
                  <span className="text-xs" style={{ color: 'var(--grid-color)' }}>•</span>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    Verified {formatRelativeTime(item.last_verified)}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs mt-2 normal-case" style={{ color: 'var(--text-dim)' }}>{item.recommendation}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span 
            className="text-sm font-bold"
            style={{ color: item.confidence >= 0.6 ? 'var(--data)' : 'var(--rage)' }}
          >
            {(item.confidence * 100).toFixed(0)}%
          </span>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>confidence</p>
        </div>
      </div>
    </div>
  );
}
