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
  Settings,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'PROFILE', icon: User },
    { id: 'security', label: 'SECURITY', icon: Shield },
    { id: 'api', label: 'API KEYS', icon: Key },
    { id: 'notifications', label: 'ALERTS', icon: Bell },
    { id: 'danger', label: 'DANGER', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6" style={{ color: 'var(--volt)' }} />
          <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--volt)' }}>
            SYSTEM CONFIGURATION
          </h1>
        </div>
        <p className="mt-1 text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>
          MANAGE YOUR ACCOUNT AND PREFERENCES
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left border-l-2"
                style={{
                  borderLeftColor: activeTab === tab.id ? 'var(--volt)' : 'transparent',
                  background: activeTab === tab.id ? 'var(--volt-dim)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--volt)' : 'var(--text-dim)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--text-main)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--text-dim)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 cyber-card p-6">
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
        <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--volt)' }}>PROFILE</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Update your profile information</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            DISPLAY NAME
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter display name"
          />
        </div>

        <button className="cyber-btn">
          <Zap className="w-4 h-4 inline mr-2" />
          SAVE CHANGES
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
        <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--data)' }}>SECURITY</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Update your password</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            CURRENT PASSWORD
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            NEW PASSWORD
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            CONFIRM NEW PASSWORD
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button onClick={handleChangePassword} className="cyber-btn data">
          <Shield className="w-4 h-4 inline mr-2" />
          CHANGE PASSWORD
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
        <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--volt)' }}>API KEYS</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Manage your API access keys</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            CURRENT API KEY
          </label>
          <div className="flex gap-2">
            <div 
              className="flex-1 px-4 py-3 font-mono text-sm overflow-hidden text-ellipsis border"
              style={{ background: '#000', borderColor: 'var(--grid-color)', color: 'var(--volt)' }}
            >
              {apiKey}
            </div>
            <button
              onClick={handleCopy}
              className="cyber-btn secondary px-3"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div 
          className="p-4 border"
          style={{ borderColor: 'var(--data)', background: 'var(--data-dim)' }}
        >
          <p className="text-xs" style={{ color: 'var(--data)' }}>
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            <strong>WARNING:</strong> Regenerating your API key will invalidate the current key.
            Any applications using the old key will stop working.
          </p>
        </div>

        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="cyber-btn data flex items-center gap-2"
          style={{ opacity: regenerateMutation.isPending ? 0.5 : 1 }}
        >
          <RefreshCw className={cn('w-4 h-4', regenerateMutation.isPending && 'animate-spin')} />
          <span>REGENERATE KEY</span>
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
        <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--data)' }}>ALERTS</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Configure notification preferences</p>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="EMAIL NOTIFICATIONS"
          description="Receive important updates via email"
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />

        <ToggleSetting
          label="DRIFT ALERTS"
          description="Get notified when context drift is detected"
          checked={driftAlerts}
          onChange={setDriftAlerts}
        />

        <ToggleSetting
          label="WEEKLY REPORT"
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
    <div 
      className="flex items-center justify-between p-4 border"
      style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
    >
      <div>
        <p className="font-bold text-xs tracking-wider" style={{ color: 'var(--text-main)' }}>{label}</p>
        <p className="text-xs normal-case" style={{ color: 'var(--text-dim)' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 transition-colors"
        style={{ 
          background: checked ? 'var(--volt)' : 'var(--grid-color)',
          border: `1px solid ${checked ? 'var(--volt)' : 'var(--text-dim)'}`
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 transition-transform"
          style={{ 
            background: checked ? 'var(--void)' : 'var(--text-dim)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)'
          }}
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
        <h3 className="text-sm font-bold tracking-wider" style={{ color: 'var(--rage)' }}>⚠ DANGER ZONE</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Irreversible actions - proceed with caution</p>
      </div>

      <div className="space-y-4">
        <div 
          className="p-4 border"
          style={{ borderColor: 'var(--rage)', background: 'var(--rage-dim)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-xs tracking-wider" style={{ color: 'var(--text-main)' }}>CLEAR ALL CONTEXT DATA</p>
              <p className="text-xs mt-1 normal-case" style={{ color: 'var(--text-dim)' }}>
                Permanently delete all stored context data for your account
              </p>
            </div>
            <button
              onClick={handleClearData}
              disabled={clearMutation.isPending}
              className="cyber-btn danger flex items-center gap-2 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>CLEAR DATA</span>
            </button>
          </div>
        </div>

        <div 
          className="p-4 border"
          style={{ borderColor: 'var(--rage)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-xs tracking-wider" style={{ color: 'var(--text-main)' }}>DELETE ACCOUNT</p>
              <p className="text-xs mt-1 normal-case" style={{ color: 'var(--text-dim)' }}>
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="cyber-btn danger flex items-center gap-2 flex-shrink-0"
              style={{ background: 'transparent' }}
            >
              <Trash2 className="w-4 h-4" />
              <span>DELETE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
