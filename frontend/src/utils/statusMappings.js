import { PAYMENT_STATUS, MISC_PAYMENT_STATUS, FEE_STATUS, AGREEMENT_STATUS } from './constants';

const STATUS_COLORS = {
  [PAYMENT_STATUS.PENDING]: 'warning',
  [PAYMENT_STATUS.APPROVED]: 'success',
  [PAYMENT_STATUS.REJECTED]: 'error',
  [PAYMENT_STATUS.COMPLETED]: 'success',
  [PAYMENT_STATUS.FAILED]: 'error',
  [PAYMENT_STATUS.CANCELLED]: 'default',
  [MISC_PAYMENT_STATUS.PENDING]: 'warning',
  [MISC_PAYMENT_STATUS.APPROVED]: 'success',
  [MISC_PAYMENT_STATUS.REJECTED]: 'error',
  [MISC_PAYMENT_STATUS.COMPLETED]: 'success',
  [MISC_PAYMENT_STATUS.FAILED]: 'error',
  [MISC_PAYMENT_STATUS.CANCELLED]: 'default',
  [FEE_STATUS.PENDING]: 'warning',
  [FEE_STATUS.COMPLETED]: 'success',
  [FEE_STATUS.FAILED]: 'error',
  [FEE_STATUS.CANCELLED]: 'default',
  [FEE_STATUS.PARTIALLY_PAID]: 'info',
  [FEE_STATUS.AGREEMENT]: 'secondary',
  [AGREEMENT_STATUS.ACTIVE]: 'success',
  [AGREEMENT_STATUS.COMPLETED]: 'success',
  [AGREEMENT_STATUS.CANCELLED]: 'default',
  [AGREEMENT_STATUS.DEFAULTED]: 'error',
};

const STATUS_LABELS = {
  [PAYMENT_STATUS.PENDING]: 'Pendiente',
  [PAYMENT_STATUS.APPROVED]: 'Aprobado',
  [PAYMENT_STATUS.REJECTED]: 'Rechazado',
  [PAYMENT_STATUS.COMPLETED]: 'Completado',
  [PAYMENT_STATUS.FAILED]: 'Fallido',
  [PAYMENT_STATUS.CANCELLED]: 'Cancelado',
  [MISC_PAYMENT_STATUS.PENDING]: 'Pendiente',
  [MISC_PAYMENT_STATUS.APPROVED]: 'Aprobado',
  [MISC_PAYMENT_STATUS.REJECTED]: 'Rechazado',
  [MISC_PAYMENT_STATUS.COMPLETED]: 'Completado',
  [MISC_PAYMENT_STATUS.FAILED]: 'Fallido',
  [MISC_PAYMENT_STATUS.CANCELLED]: 'Cancelado',
  [FEE_STATUS.PENDING]: 'Pendiente',
  [FEE_STATUS.COMPLETED]: 'Completado',
  [FEE_STATUS.FAILED]: 'Fallido',
  [FEE_STATUS.CANCELLED]: 'Cancelado',
  [FEE_STATUS.PARTIALLY_PAID]: 'Parcialmente pagado',
  [FEE_STATUS.AGREEMENT]: 'En convenio',
  [AGREEMENT_STATUS.ACTIVE]: 'Activo',
  [AGREEMENT_STATUS.COMPLETED]: 'Completado',
  [AGREEMENT_STATUS.CANCELLED]: 'Cancelado',
  [AGREEMENT_STATUS.DEFAULTED]: 'Incumplido',
};

const STATUS_TONES = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  secondary: 'secondary',
  default: 'default',
};

export const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

export const getStatusTone = (status) => STATUS_TONES[getStatusColor(status)] || 'default';

export const getStatusLabel = (status) => STATUS_LABELS[status] || status || 'Desconocido';
