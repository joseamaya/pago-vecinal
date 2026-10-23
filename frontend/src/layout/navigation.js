import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import PaymentIcon from '@mui/icons-material/PaymentsOutlined';
import MiscPaymentIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ExpenseIcon from '@mui/icons-material/RequestQuoteOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import FeeIcon from '@mui/icons-material/MonetizationOnOutlined';
import ScheduleIcon from '@mui/icons-material/EventRepeatOutlined';
import ReportsIcon from '@mui/icons-material/AssessmentOutlined';
import SettingsIcon from '@mui/icons-material/TuneOutlined';

export const navigationGroups = [
  {
    label: 'Resumen',
    items: [
      { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard', roles: ['admin', 'owner'] },
    ],
  },
  {
    label: 'Cobranzas',
    items: [
      { text: 'Cuotas', icon: FeeIcon, path: '/fees', roles: ['admin', 'owner'] },
      { text: 'Pagos', icon: PaymentIcon, path: '/payments', roles: ['admin', 'owner'] },
      { text: 'Pagos varios', icon: MiscPaymentIcon, path: '/miscellaneous-payments', roles: ['admin', 'owner'] },
      { text: 'Recibos', icon: ReceiptIcon, path: '/receipts', roles: ['admin', 'owner'] },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { text: 'Gastos', icon: ExpenseIcon, path: '/expenses', roles: ['admin'] },
      { text: 'Reportes', icon: ReportsIcon, path: '/reports', roles: ['admin', 'owner'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { text: 'Propiedades', icon: HomeIcon, path: '/properties', roles: ['admin'] },
      { text: 'Usuarios', icon: PeopleIcon, path: '/users', roles: ['admin'] },
      { text: 'Planes de cuotas', icon: ScheduleIcon, path: '/fee-schedules', roles: ['admin'] },
      { text: 'Configuración', icon: SettingsIcon, path: '/configuration', roles: ['admin'] },
    ],
  },
];

export const getNavigationForRole = (role) =>
  navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);

export const getFlatNavigation = (role) =>
  getNavigationForRole(role).flatMap((group) => group.items);
