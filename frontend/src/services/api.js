import axios from 'axios';

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
  getProperties: () => api.get('/properties/'),
  getProperty: (id) => api.get(`/properties/${id}`),
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
  bulkApproveExpenses: (expenseIds) => api.post('/expenses/bulk-approve', { expense_ids: expenseIds }),
  downloadExpenseReceipt: (id) => api.get(`/expenses/${id}/download-receipt`, { responseType: 'blob' }),
};

// Receipts API
export const receiptsAPI = {
  getReceipts: () => api.get('/receipts/'),
  getReceipt: (id) => api.get(`/receipts/${id}`),
  createReceipt: (receiptData) => api.post('/receipts/', receiptData),
  updateReceipt: (id, receiptData) => api.put(`/receipts/${id}`, receiptData),
  deleteReceipt: (id) => api.delete(`/receipts/${id}`),
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

// Agreements API
export const agreementsAPI = {
  getAgreements: (filters = {}) => {
    const params = {};
    if (filters.property_id) params.property_id = filters.property_id;
    if (filters.status) params.status = filters.status;
    return api.get('/agreements/', { params });
  },
  getAgreement: (id) => api.get(`/agreements/${id}`),
  createAgreement: (agreementData) => api.post('/agreements/', agreementData),
  updateAgreement: (id, agreementData) => api.put(`/agreements/${id}`, agreementData),
  deleteAgreement: (id) => api.delete(`/agreements/${id}`),
  downloadAgreementPDF: (id) => api.get(`/agreements/${id}/download-pdf`, { responseType: 'blob' }),
  createInstallmentPayment: (agreementId, installmentData) => api.post(`/agreements/${agreementId}/installments/`, installmentData),
  updateInstallmentPayment: (agreementId, installmentId, installmentData) => api.put(`/agreements/${agreementId}/installments/${installmentId}`, installmentData),
  getNextPendingInstallment: () => api.get('/agreements/installments/next-pending'),
  payNextInstallment: (paymentData) => {
    const config = paymentData instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    return api.post('/agreements/installments/pay-next', paymentData, config);
  },
};

// Reports API
export const reportsAPI = {
  getPropertyPaymentHistory: (propertyId, year = null, format = 'pdf') => {
    const params = { format };
    if (year) params.year = year;
    return api.get(`/reports/property/${propertyId}/payment-history`, { params, responseType: 'blob' });
  },
  getOutstandingFeesReport: (format = 'pdf') => api.get('/reports/outstanding-fees', { params: { format }, responseType: 'blob' }),
  getMonthlyPaymentSummary: (year, month, format = 'pdf') => api.get(`/reports/monthly-summary/${year}/${month}`, { params: { format }, responseType: 'blob' }),
  getMonthlyFeesReport: (startYear, startMonth, endYear, endMonth, format = 'excel') => api.get(`/reports/monthly-fees/${startYear}/${startMonth}/${endYear}/${endMonth}`, { params: { format }, responseType: 'blob' }),
  getAnnualPropertyStatement: (propertyId, year, format = 'pdf') => api.get(`/reports/property/${propertyId}/annual-statement/${year}`, { params: { format }, responseType: 'blob' }),
  getAllPaymentsReport: () => api.get('/reports/all-payments', { params: { format: 'excel' }, responseType: 'blob' }),
  getExpensesReport: (format = 'excel') => api.get('/reports/expenses', { params: { format }, responseType: 'blob' }),
  getFilteredFeesReport: (filters = {}) => {
    const params = {};
    if (filters.year) params.year = filters.year;
    if (filters.month) params.month = filters.month;
    if (filters.status) params.status = filters.status;
    if (filters.property) params.property_id = filters.property;
    return api.get('/reports/filtered-fees', { params, responseType: 'blob' });
  },
  getPaymentsOverTime: () => api.get('/reports/payments-over-time'),
  getFeesByStatus: () => api.get('/reports/fees-by-status'),
  getPropertiesByVilla: () => api.get('/reports/properties-by-villa'),
};

// Dashboard Stats API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getOwnerDebtSummary: () => api.get('/dashboard/owner/debt-summary'),
  getOwnerPropertyReport: () => api.get('/dashboard/owner/property-report'),
  getOwnerExpensesReport: () => api.get('/dashboard/owner/expenses-report'),
};

export default api;