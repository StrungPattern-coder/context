import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'critical' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence >= 0.4) return 'low';
  return 'critical';
}

export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high': return 'text-green-500';
    case 'medium': return 'text-yellow-500';
    case 'low': return 'text-orange-500';
    case 'critical': return 'text-red-500';
  }
}

export function getDriftStatusColor(status: string): string {
  switch (status) {
    case 'stable': return 'text-green-500 bg-green-500/10';
    case 'drifting': return 'text-yellow-500 bg-yellow-500/10';
    case 'conflicting': return 'text-red-500 bg-red-500/10';
    case 'stale': return 'text-gray-400 bg-gray-500/10';
    default: return 'text-gray-500 bg-gray-500/10';
  }
}

export function getContextTypeIcon(type: string): string {
  switch (type) {
    case 'temporal': return '⏱️';
    case 'spatial': return '📍';
    case 'situational': return '🎯';
    case 'preference': return '⚙️';
    case 'identity': return '👤';
    default: return '📄';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
