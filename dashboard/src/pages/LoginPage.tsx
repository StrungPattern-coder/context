import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 mb-4">
            <span className="text-white font-bold text-2xl">R</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Reality Anchoring Layer</h1>
          <p className="text-slate-400 mt-2">Sign in to your dashboard</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
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
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
          <p className="text-sm text-slate-400 text-center mb-2">
            <strong>Demo Credentials:</strong>
          </p>
          <p className="text-xs text-slate-500 text-center">
            Email: <code className="text-sky-400">dev@ral.local</code>
          </p>
          <p className="text-xs text-slate-500 text-center">
            Password: <code className="text-sky-400">password123</code>
          </p>
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="mt-2 w-full py-1.5 px-3 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Fill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
