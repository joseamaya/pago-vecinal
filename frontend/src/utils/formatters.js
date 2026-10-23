const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-PE');

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const toNumber = (value) => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value) => currencyFormatter.format(toNumber(value));

export const formatNumber = (value) => numberFormatter.format(toNumber(value));

export const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value, fallback = '—') => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : fallback;
};

export const formatLongDate = (value, fallback = '—') => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    : fallback;
};

export const formatDateTime = (value, fallback = '—') => {
  const date = toDate(value);
  return date
    ? date.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : fallback;
};

export const toInputDate = (value) => {
  const date = toDate(value);
  if (!date) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatMonth = (month) => {
  const index = Number(month);
  if (!index || index < 1 || index > 12) return '—';
  return MONTH_NAMES[index - 1];
};

export const formatPeriod = (month, year) => {
  if (!month) return year ? String(year) : '—';
  const label = formatMonth(month);
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return year ? `${capitalized} ${year}` : capitalized;
};

export const formatPropertyLabel = (property, fallback = '—') => {
  if (!property) return fallback;
  const parts = [property.villa, `${property.row_letter || ''}${property.number ?? ''}`]
    .filter(Boolean)
    .join(' ');
  return parts || fallback;
};

export const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'PV';
