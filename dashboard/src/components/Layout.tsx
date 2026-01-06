import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  AlertTriangle, 
  Settings, 
  LogOut,
  Menu,
  X,
  Zap
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contexts', icon: Database, label: 'Contexts' },
  { to: '/drift', icon: AlertTriangle, label: 'Drift Report' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Scanline effect */}
      <div className="scanline" />
      {/* Noise effect */}
      <div className="noise" />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-grid transform transition-transform lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ borderColor: 'var(--grid-color)' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--grid-color)' }}>
            <div 
              className="w-10 h-10 flex items-center justify-center border-2"
              style={{ 
                borderColor: 'var(--volt)', 
                background: 'var(--volt-dim)',
                boxShadow: '0 0 15px var(--volt-dim)'
              }}
            >
              <span className="text-volt font-bold text-lg">[R]</span>
            </div>
            <div>
              <h1 className="font-bold text-lg text-volt tracking-wider">RAL</h1>
              <p className="text-xs text-dim tracking-widest">VOLTAGE.v3</p>
            </div>
            <button
              className="ml-auto lg:hidden text-dim hover:text-volt transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status indicator */}
          <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--grid-color)' }}>
            <div className="flex items-center gap-2">
              <div className="status-dot online" />
              <span className="text-xs text-dim">SYSTEM ONLINE</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 transition-all border-l-2',
                    isActive
                      ? 'bg-volt-dim border-volt text-volt'
                      : 'border-transparent text-dim hover:text-main hover:border-grid hover:bg-black/30'
                  )
                }
                style={({ isActive }) => isActive ? { 
                  background: 'var(--volt-dim)',
                  borderLeftColor: 'var(--volt)',
                  color: 'var(--volt)'
                } : {}}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-semibold tracking-wider">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--grid-color)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-9 h-9 flex items-center justify-center border"
                style={{ borderColor: 'var(--data)', background: 'var(--data-dim)' }}
              >
                <span className="text-sm font-bold" style={{ color: 'var(--data)' }}>
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-main truncate normal-case">
                  {user?.email || 'User'}
                </p>
                <p className="text-xs" style={{ color: user?.is_admin ? 'var(--volt)' : 'var(--text-dim)' }}>
                  {user?.is_admin ? '⚡ Admin' : 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all border"
              style={{ 
                borderColor: 'var(--rage)', 
                color: 'var(--rage)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--rage)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--rage)';
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-semibold tracking-wider">DISCONNECT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10">
        {/* Mobile header */}
        <header 
          className="lg:hidden flex items-center gap-4 p-4 border-b bg-surface"
          style={{ borderColor: 'var(--grid-color)' }}
        >
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-dim hover:text-volt transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-volt" />
            <h1 className="font-bold text-volt tracking-wider">RAL CONSOLE</h1>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
