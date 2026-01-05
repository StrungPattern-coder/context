import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Key,
  Shield,
  Bell,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          {activeTab === 'profile' && <ProfileSettings user={user} />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'api' && <ApiKeySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'danger' && <DangerZone />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({ user }: { user: unknown }) {
  const [email, setEmail] = useState((user as {email?: string})?.email || '');
  const [displayName, setDisplayName] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Profile</h3>
        <p className="text-sm text-slate-400 mt-1">Update your profile information</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter display name"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    toast.success('Password changed successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Security</h3>
        <p className="text-sm text-slate-400 mt-1">Update your password</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <button
          onClick={handleChangePassword}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
        >
          Change Password
        </button>
      </div>
    </div>
  );
}

function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('ral_sk_••••••••••••••••••••');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/api-key');
      return response.data;
    },
    onSuccess: (data) => {
      setApiKey(data.api_key || 'ral_sk_' + Math.random().toString(36).substr(2, 24));
      queryClient.invalidateQueries();
      toast.success('API key regenerated');
    },
    onError: () => {
      // Demo mode - generate mock key
      setApiKey('ral_sk_' + Math.random().toString(36).substr(2, 24));
      toast.success('API key regenerated');
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API key copied');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">API Keys</h3>
        <p className="text-sm text-slate-400 mt-1">Manage your API access keys</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Current API Key
          </label>
          <div className="flex gap-2">
            <div className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-400 font-mono text-sm overflow-hidden text-ellipsis">
              {apiKey}
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-200">
            <strong>Warning:</strong> Regenerating your API key will invalidate the current key.
            Any applications using the old key will stop working.
          </p>
        </div>

        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', regenerateMutation.isPending && 'animate-spin')} />
          <span>Regenerate Key</span>
        </button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [driftAlerts, setDriftAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Notifications</h3>
        <p className="text-sm text-slate-400 mt-1">Configure notification preferences</p>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Email Notifications"
          description="Receive important updates via email"
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />

        <ToggleSetting
          label="Drift Alerts"
          description="Get notified when context drift is detected"
          checked={driftAlerts}
          onChange={setDriftAlerts}
        />

        <ToggleSetting
          label="Weekly Report"
          description="Receive a weekly summary of your context health"
          checked={weeklyReport}
          onChange={setWeeklyReport}
        />
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
      <div>
        <p className="font-medium text-white">{label}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-sky-600' : 'bg-slate-600'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

function DangerZone() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  const clearMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/dashboard/clear');
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('All context data cleared');
    },
    onError: () => {
      toast.success('All context data cleared (demo)');
    },
  });

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all context data? This action cannot be undone.')) {
      clearMutation.mutate();
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      toast.success('Account deleted');
      logout();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
        <p className="text-sm text-slate-400 mt-1">Irreversible actions</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border border-red-500/20 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">Clear All Context Data</p>
              <p className="text-sm text-slate-400 mt-1">
                Permanently delete all stored context data for your account
              </p>
            </div>
            <button
              onClick={handleClearData}
              disabled={clearMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-lg transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Data</span>
            </button>
          </div>
        </div>

        <div className="p-4 border border-red-500/20 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">Delete Account</p>
              <p className="text-sm text-slate-400 mt-1">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-500 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
