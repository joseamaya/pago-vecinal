import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import Login from './components/Login';
import Layout from './components/Layout';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const UserManagement = React.lazy(() => import('./components/UserManagement'));
const OwnerManagement = React.lazy(() => import('./components/OwnerManagement'));
const PropertyManagement = React.lazy(() => import('./components/PropertyManagement'));
const PaymentManagement = React.lazy(() => import('./components/PaymentManagement'));
const MiscellaneousPaymentManagement = React.lazy(() => import('./components/MiscellaneousPaymentManagement'));
const ExpenseManagement = React.lazy(() => import('./components/ExpenseManagement'));
const ReceiptManagement = React.lazy(() => import('./components/ReceiptManagement'));
const FeeManagement = React.lazy(() => import('./components/FeeManagement'));
const FeeScheduleManagement = React.lazy(() => import('./components/FeeScheduleManagement'));
const ReportsManagement = React.lazy(() => import('./components/ReportsManagement'));
const TreasurerConfiguration = React.lazy(() => import('./components/TreasurerConfiguration'));
const Profile = React.lazy(() => import('./components/Profile'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Verificando sesión..." />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRouter = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LoadingSpinner fullScreen />}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/users" element={<UserManagement />} />
                    <Route path="/owners" element={<OwnerManagement />} />
                    <Route path="/properties" element={<PropertyManagement />} />
                    <Route path="/payments" element={<PaymentManagement />} />
                    <Route path="/miscellaneous-payments" element={<MiscellaneousPaymentManagement />} />
                    <Route path="/expenses" element={<ExpenseManagement />} />
                    <Route path="/receipts" element={<ReceiptManagement />} />
                    <Route path="/fees" element={<FeeManagement />} />
                    <Route path="/fee-schedules" element={<FeeScheduleManagement />} />
                    <Route path="/reports" element={<ReportsManagement />} />
                    <Route path="/configuration" element={<TreasurerConfiguration />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

const ThemeWrapper = ({ children }) => {
  const { theme } = useThemeContext();
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <ErrorBoundary>
                <AppRouter />
              </ErrorBoundary>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeWrapper>
    </ThemeProvider>
  );
}

export default App;
