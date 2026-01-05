import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { cn, getDriftStatusColor, formatRelativeTime } from '@/lib/utils';
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
          <h1 className="text-2xl font-bold text-white">Drift Report</h1>
          <p className="text-slate-400 mt-1">
            Context health analysis and recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Health overview */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Health score */}
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-slate-700"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${parseFloat(healthPercent) * 2.51} 251`}
                  className="text-green-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{healthPercent}%</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Overall Health</h3>
              <p className="text-sm text-slate-400">
                {data.healthy_count} of {data.total_contexts} contexts healthy
              </p>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              icon={CheckCircle}
              label="Healthy"
              count={data.healthy_count}
              color="green"
            />
            <StatusCard
              icon={AlertTriangle}
              label="Drifting"
              count={data.drifting_count}
              color="yellow"
            />
            <StatusCard
              icon={XCircle}
              label="Conflicting"
              count={data.conflicting_count}
              color="red"
            />
            <StatusCard
              icon={Clock}
              label="Stale"
              count={data.stale_count}
              color="gray"
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {data.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-amber-200">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues list */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Contexts Needing Attention</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {data.items.map((item) => (
            <DriftItemRow key={item.context_id} item={item} />
          ))}
          {data.items.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-500">
              No issues found. All contexts are healthy!
            </div>
          )}
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

interface StatusCardProps {
  icon: React.ElementType;
  label: string;
  count: number;
  color: 'green' | 'yellow' | 'red' | 'gray';
}

function StatusCard({ icon: Icon, label, count, color }: StatusCardProps) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    red: 'text-red-400 bg-red-500/10',
    gray: 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="p-4 bg-slate-900/50 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('p-1.5 rounded', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{count}</span>
    </div>
  );
}

interface DriftItemRowProps {
  item: DriftItem;
}

function DriftItemRow({ item }: DriftItemRowProps) {
  const statusIcons = {
    stable: CheckCircle,
    drifting: AlertTriangle,
    conflicting: XCircle,
    stale: Clock,
  };
  const StatusIcon = statusIcons[item.drift_status];

  return (
    <div className="px-5 py-4 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg mt-0.5', getDriftStatusColor(item.drift_status))}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div>
            <Link
              to={`/contexts/${item.context_id}`}
              className="font-medium text-white hover:text-sky-400 transition-colors"
            >
              {item.key}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 capitalize">{item.context_type}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-500">{item.days_since_update}d since update</span>
              {item.last_verified && (
                <>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-slate-500">
                    Verified {formatRelativeTime(item.last_verified)}
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-2">{item.recommendation}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={cn(
            'text-sm font-medium',
            item.confidence >= 0.6 ? 'text-yellow-400' : 'text-red-400'
          )}>
            {(item.confidence * 100).toFixed(0)}%
          </span>
          <p className="text-xs text-slate-500">confidence</p>
        </div>
      </div>
    </div>
  );
}
