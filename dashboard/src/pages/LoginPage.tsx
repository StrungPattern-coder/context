import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Zap, Shield, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/lib/authService';
import type { AuthUser } from '@/types';

// Backend returns user in this format
interface UserResponse {
  id: string;
  email: string | null;
  display_name: string | null;
  tenant_id: string;
  external_id: string;
  created_at: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);

    try {
      // Login request
      const tokens = await authService.login({ email, password });

      // Get user info
      const userResponse = await authService.getCurrentUser() as unknown as UserResponse;
      
      const user: AuthUser = {
        id: userResponse.id,
        email: userResponse.email || email,
        tenant_id: userResponse.tenant_id,
        is_admin: false,
      };

      setAuth(user, tokens);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('dev@ral.local');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Scanline effect */}
      <div className="scanline" />
      {/* Noise effect */}
      <div className="noise" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 mb-4 border-2"
            style={{ 
              borderColor: 'var(--volt)', 
              background: 'var(--volt-dim)',
              boxShadow: '0 0 30px var(--volt-dim)'
            }}
          >
            <span className="font-bold text-3xl" style={{ color: 'var(--volt)' }}>[R]</span>
          </div>
          <h1 className="text-xl font-bold tracking-widest" style={{ color: 'var(--volt)' }}>
            REALITY ANCHORING LAYER
          </h1>
          <p className="mt-2 text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>
            VOLTAGE.v3 // AUTHENTICATION REQUIRED
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="cyber-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid var(--grid-color)' }}>
            <Shield className="w-4 h-4" style={{ color: 'var(--data)' }} />
            <span className="text-xs tracking-widest" style={{ color: 'var(--data)' }}>SECURE LOGIN</span>
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
              PASSWORD
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-dim)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--volt)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cyber-btn w-full flex items-center justify-center gap-2"
            style={{ opacity: isLoading ? 0.5 : 1 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>CONNECT</span>
              </>
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div 
          className="mt-4 p-4 border"
          style={{ borderColor: 'var(--grid-color)', background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4" style={{ color: 'var(--data)' }} />
            <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--data)' }}>
              DEMO CREDENTIALS
            </span>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>
            Email: <code style={{ color: 'var(--volt)' }}>dev@ral.local</code>
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            Password: <code style={{ color: 'var(--volt)' }}>password123</code>
          </p>
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="cyber-btn secondary w-full text-xs"
          >
            AUTOFILL CREDENTIALS
          </button>
        </div>

        {/* Version info */}
        <div className="mt-6 text-center">
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            RAL CONSOLE v3.0.0 // BUILD 2024.01
          </p>
        </div>
      </div>
    </div>
  );
}
