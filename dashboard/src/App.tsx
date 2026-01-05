import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ContextsPage from '@/pages/ContextsPage';
import ContextDetailPage from '@/pages/ContextDetailPage';
import DriftReportPage from '@/pages/DriftReportPage';
import SettingsPage from '@/pages/SettingsPage';

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/contexts" element={<ContextsPage />} />
        <Route path="/contexts/:id" element={<ContextDetailPage />} />
        <Route path="/drift" element={<DriftReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
