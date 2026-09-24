import axios from 'axios';
import { notify } from './notifications';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (!error.response && !axios.isCancel(error)) {
      error.isNetworkError = true;
      notify.error('No se pudo conectar con el servidor');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
};

// Users API
export const usersAPI = {
  getUsers: () => api.get('/users/'),
  getUser: (id) => api.get(`/users/${id}`),
  getCurrentUser: () => api.get('/users/me'),
  createUser: (userData) => api.post('/users/', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
};

// Properties API
export const propertiesAPI = {
  getProperties: (page = 1, limit = 20) => api.get('/properties/', { params: { page, limit } }),
  getProperty: (id) => api.get(`/properties/${id}`),
  getDistinctLetters: () => api.get('/properties/distinct/letters'),
  getDistinctNumbers: () => api.get('/properties/distinct/numbers'),
  getPropertyByLetterNumber: (rowLetter, number) => api.get(`/properties/by-letter-number/`, { params: { row_letter: rowLetter, number: number } }),
  createProperty: (propertyData) => api.post('/properties/', propertyData),
  updateProperty: (id, propertyData) => api.put(`/properties/${id}`, propertyData),
  deleteProperty: (id) => api.delete(`/properties/${id}`),
  bulkImportProperties: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/properties/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Payments API
export const paymentsAPI = {
  getPayments: (page = 1, limit = 20, filters = {}) => {
    const params = { page, limit };
    if (filters.year !== undefined) params.year = filters.year;
    if (filters.month !== undefined) params.month = filters.month;
    if (filters.status !== undefined) params.status = filters.status;
    if (filters.fee_id !== undefined) params.fee_id = filters.fee_id;
    if (filters.property_id !== undefined) params.property_id = filters.property_id;
    return api.get('/payments/', { params });
  },
  getPayment: (id) => api.get(`/payments/${id}`),
  createPayment: (paymentData) => {
    const config = paymentData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.post('/payments/', paymentData, config);
  },
  updatePayment: (id, paymentData) => {
    const config = paymentData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.put(`/payments/${id}`, paymentData, config);
  },
  deletePayment: (id) => api.delete(`/payments/${id}`),
  bulkImportPayments: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/payments/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  bulkApprovePayments: (paymentIds) => api.post('/payments/bulk-approve', { payment_ids: paymentIds }),
  downloadGeneratedReceipt: (id) => api.get(`/payments/${id}/download-receipt`, { responseType: 'blob' }),
};

// Miscellaneous Payments API
export const miscellaneousPaymentsAPI = {
  getMiscellaneousPayments: () => api.get('/miscellaneous-payments/'),
  getMiscellaneousPayment: (id) => api.get(`/miscellaneous-payments/${id}`),
  createMiscellaneousPayment: (paymentData) => {
    const config = paymentData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.post('/miscellaneous-payments/', paymentData, config);
  },
  updateMiscellaneousPayment: (id, paymentData) => {
    const config = paymentData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.put(`/miscellaneous-payments/${id}`, paymentData, config);
  },
  deleteMiscellaneousPayment: (id) => api.delete(`/miscellaneous-payments/${id}`),
  bulkApproveMiscellaneousPayments: (paymentIds) => api.post('/miscellaneous-payments/bulk-approve', { payment_ids: paymentIds }),
  downloadMiscellaneousReceipt: (id) => api.get(`/miscellaneous-payments/${id}/download-receipt`, { responseType: 'blob' }),
};

// Expenses API
export const expensesAPI = {
  getExpenses: () => api.get('/expenses/'),
  getExpense: (id) => api.get(`/expenses/${id}`),
  createExpense: (expenseData) => {
    const config = expenseData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.post('/expenses/', expenseData, config);
  },
  updateExpense: (id, expenseData) => {
    const config = expenseData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.put(`/expenses/${id}`, expenseData, config);
  },
  deleteExpense: (id) => api.delete(`/expenses/${id}`),
  bulkImportExpenses: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/expenses/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  downloadTemplate: () => api.get('/expenses/template', { responseType: 'blob' }),
  bulkApproveExpenses: (expenseIds) => api.post('/expenses/bulk-approve', { expense_ids: expenseIds }),
  downloadExpenseReceipt: (id) => api.get(`/expenses/${id}/download-receipt`, { responseType: 'blob' }),
};

// Receipts API
export const receiptsAPI = {
  getReceipts: (page = 1, limit = 20) => api.get('/receipts/', { params: { page, limit } }),
  getReceipt: (id) => api.get(`/receipts/${id}`),
  createReceipt: (receiptData) => api.post('/receipts/', receiptData),
  updateReceipt: (id, receiptData) => api.put(`/receipts/${id}`, receiptData),
  deleteReceipt: (id) => api.delete(`/receipts/${id}`),
  downloadReceiptPDF: (id) => api.get(`/receipts/${id}/download`, { responseType: 'blob' }),
  regenerateReceiptPDF: (id) => api.post(`/receipts/${id}/regenerate-pdf`),
  regenerateAllReceiptPDFs: () => api.post('/receipts/regenerate-all-pdfs'),
};

// Fees API
export const feesAPI = {
  getFees: (filters = {}, page = 1, limit = 20) => {
    const params = { page, limit };
    if (filters.year !== undefined) params.year = filters.year;
    if (filters.month !== undefined) params.month = filters.month;
    if (filters.status !== undefined) params.status = filters.status;
    if (filters.property_id !== undefined) params.property_id = filters.property_id;
    if (filters.sort_by_period !== undefined) params.sort_by_period = filters.sort_by_period;
    return api.get('/fees/', { params });
  },
  getFee: (id) => api.get(`/fees/${id}`),
  createFee: (feeData) => api.post('/fees/', feeData),
  updateFee: (id, feeData) => api.put(`/fees/${id}`, feeData),
  deleteFee: (id) => api.delete(`/fees/${id}`),
  generateFees: (manual = false, year = null, months = null, feeScheduleIds = null) => {
    const data = { manual };
    if (year !== null) data.year = year;
    if (months !== null) data.months = months;
    if (feeScheduleIds !== null) data.fee_schedule_ids = feeScheduleIds;
    return api.post('/fees/generate', data);
  },
};

// Fee Schedules API
export const feeSchedulesAPI = {
  getFeeSchedules: () => api.get('/fee-schedules/'),
  getFeeSchedule: (id) => api.get(`/fee-schedules/${id}`),
  createFeeSchedule: (scheduleData) => api.post('/fee-schedules/', scheduleData),
  updateFeeSchedule: (id, scheduleData) => api.put(`/fee-schedules/${id}`, scheduleData),
  deleteFeeSchedule: (id) => api.delete(`/fee-schedules/${id}`),
};


export const reportsAPI = {
  getPropertyPaymentHistory: (propertyId = null, startYear = null, startMonth = null, endYear = null, endMonth = null, format = 'excel') => {
    const params = { format };
    if (propertyId) params.property_id = propertyId;
    if (startYear !== null) params.start_year = startYear;
    if (startMonth !== null) params.start_month = startMonth;
    if (endYear !== null) params.end_year = endYear;
    if (endMonth !== null) params.end_month = endMonth;
    return api.get('/reports/payment-history', { params, responseType: 'blob' });
  },
  getOutstandingFeesReport: (format = 'excel') =>
    api.get('/reports/outstanding-fees', { params: { format }, responseType: 'blob' }),
  getMonthlyPaymentSummary: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/monthly-summary/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getPaymentsSummary: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/payments-summary/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getMonthlyFeesReport: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/monthly-fees/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getPaidFeesSummary: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/paid-fees-summary/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getFeePaymentMatrix: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/fee-payment-matrix/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getFeeContributionSummary: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/fee-contribution-summary/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getAnnualPropertyStatement: (year, propertyId = null, format = 'pdf') => {
    const params = { format };
    if (propertyId) params.property_id = propertyId;
    return api.get(`/reports/annual-statement/${year}`, { params, responseType: 'blob' });
  },
  getAllPaymentsReport: () =>
    api.get('/reports/all-payments', { responseType: 'blob' }),
  getExpensesReport: () =>
    api.get('/reports/expenses', { responseType: 'blob' }),
  getExpensesByPeriodRangeReport: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/expenses/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getDetailedExpensesReport: (startYear, startMonth, endYear, endMonth) =>
    api.get(`/reports/detailed-expenses/${startYear}/${startMonth}/${endYear}/${endMonth}`, { responseType: 'blob' }),
  getFilteredFeesReport: (filters = {}) => {
    const params = {};
    if (filters.year) params.year = filters.year;
    if (filters.month) params.month = filters.month;
    if (filters.status) params.status = filters.status;
    if (filters.property_id) params.property_id = filters.property_id;
    return api.get('/reports/filtered-fees', { params, responseType: 'blob' });
  },
  getTrafficLightReport: () =>
    api.get('/reports/traffic-light', { responseType: 'blob' }),
};

// Treasurers API
export const treasurersAPI = {
  getTreasurers: () => api.get('/treasurers/'),
  getTreasurerByVilla: (villa) => api.get(`/treasurers/${villa}`),
  createTreasurer: (treasurerData) => api.post('/treasurers/', treasurerData),
  updateTreasurer: (villa, treasurerData) => api.put(`/treasurers/${villa}`, treasurerData),
  deleteTreasurer: (villa) => api.delete(`/treasurers/${villa}`),
  uploadSignature: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/treasurers/upload-signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Dashboard Stats API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getOwnerDebtSummary: () => api.get('/dashboard/owner/debt-summary'),
  getOwnerPropertyReport: () => api.get('/dashboard/owner/property-report'),
  getOwnerExpensesReport: () => api.get('/dashboard/owner/expenses-report'),
};

export default api;