import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import PropertyManagement from './components/PropertyManagement';
import PaymentManagement from './components/PaymentManagement';
import MiscellaneousPaymentManagement from './components/MiscellaneousPaymentManagement';
import ExpenseManagement from './components/ExpenseManagement';
import AgreementPayments from './components/AgreementPayments';
import ReceiptManagement from './components/ReceiptManagement';
import FeeManagement from './components/FeeManagement';
import AgreementManagement from './components/AgreementManagement';
import FeeScheduleManagement from './components/FeeScheduleManagement';
import ReportsManagement from './components/ReportsManagement';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// App Router component
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
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/properties" element={<PropertyManagement />} />
                  <Route path="/payments" element={<PaymentManagement />} />
                  <Route path="/miscellaneous-payments" element={<MiscellaneousPaymentManagement />} />
                  <Route path="/expenses" element={<ExpenseManagement />} />
                  <Route path="/agreement-payments" element={<AgreementPayments />} />
                  <Route path="/receipts" element={<ReceiptManagement />} />
                  <Route path="/fees" element={<FeeManagement />} />
                  <Route path="/agreements" element={<AgreementManagement />} />
                  <Route path="/fee-schedules" element={<FeeScheduleManagement />} />
                  <Route path="/reports" element={<ReportsManagement />} />
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

// Theme wrapper component
const ThemeWrapper = ({ children }) => {
  const { theme } = useThemeContext();
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

// Main App component
function App() {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeWrapper>
    </ThemeProvider>
  );
}

export default App;
