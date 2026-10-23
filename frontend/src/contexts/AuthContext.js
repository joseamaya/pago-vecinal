import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || item.message || 'Dato inválido').join('. ');
  }
  return fallback;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      // Create form data for OAuth2PasswordRequestForm
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);

      // Get user info from the /users/me endpoint
      const userResponse = await api.get('/users/me');
      const userData = userResponse.data;

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, 'No pudimos iniciar sesión. Inténtalo nuevamente.')
      };
    }
  };

  const register = async (userData) => {
    try {
      const payload = {
        email: userData.email,
        password: userData.password,
        role: 'owner',
        full_name: userData.fullName,
        phone: userData.phone,
      };
      const response = await api.post('/auth/register', payload);
      const { access_token } = response.data;

      localStorage.setItem('token', access_token);
      const userResponse = await api.get('/users/me');
      setUser(userResponse.data);
      localStorage.setItem('user', JSON.stringify(userResponse.data));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, 'No pudimos crear la cuenta. Inténtalo nuevamente.')
      };
    }
  };

  const refreshUser = async () => {
    const response = await api.get('/users/me');
    setUser(response.data);
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    refreshUser,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isOwner: user?.role === 'owner',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};