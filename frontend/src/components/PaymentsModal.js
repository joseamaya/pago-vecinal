import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { paymentsAPI } from '../services/api';
import ResponsiveTable from './common/ResponsiveTable';
import StatusChip from './common/StatusChip';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import { formatCurrency, formatDate, formatPropertyLabel } from '../utils/formatters';

const PaymentsModal = ({ open, onClose, fee }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await paymentsAPI.getPayments(1, 100, { fee_id: fee.id });
      setPayments(response.data.data);
    } catch (err) {
      setError('No pudimos cargar los pagos.');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [fee]);

  useEffect(() => {
    if (open && fee) fetchPayments();
  }, [open, fee, fetchPayments]);

  const handleDownload = async (payment) => {
    try {
      const response = await paymentsAPI.downloadGeneratedReceipt(payment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const correlative =
        payment.receipt_correlative_number || `REC-${new Date().getFullYear()}-${payment.id.slice(-5).toUpperCase()}`;
      link.setAttribute('download', `recibo_${correlative}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('No pudimos descargar el recibo.');
      console.error('Error downloading receipt:', err);
    }
  };

  const columns = [
    { key: 'payment_date', label: 'Fecha', render: (payment) => formatDate(payment.payment_date) },
    {
      key: 'amount',
      label: 'Monto',
      render: (payment) => <MoneyText value={payment.amount} variant="body2" />,
    },
    { key: 'status', label: 'Estado', render: (payment) => <StatusChip status={payment.status} /> },
    { key: 'notes', label: 'Notas', render: (payment) => payment.notes || '—' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle component="div">
        <Typography variant="h5" component="h2">
          Pagos de la cuota
        </Typography>
        {fee && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {formatPropertyLabel({
              villa: fee.property_villa,
              row_letter: fee.property_row_letter,
              number: fee.property_number,
            })}{' '}
            · {fee.month}/{fee.year}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers={isMobile}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {fee && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 2, sm: 4 },
              mb: 2.5,
              p: 2,
              borderRadius: 3,
              bgcolor: 'action.hover',
            }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Propietario
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {fee.property_owner_name || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Monto total
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCurrency(fee.amount)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Pagado
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCurrency(fee.paid_amount || 0)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Pendiente
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCurrency(fee.remaining_amount ?? Math.max((fee.amount || 0) - (fee.paid_amount || 0), 0))}
              </Typography>
            </Box>
          </Box>
        )}

        <ResponsiveTable
          columns={columns}
          rows={payments}
          loading={loading}
          getRowId={(payment) => payment.id}
          mobileTitle={(payment) => formatCurrency(payment.amount)}
          mobileSubtitle={(payment) => formatDate(payment.payment_date)}
          emptyState={
            <EmptyState
              title="No hay pagos registrados"
              description="Los pagos aprobados o completados aparecerán aquí."
            />
          }
          renderActions={(payment) =>
            (payment.status === 'approved' || payment.status === 'completed') && (
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownload(payment)}>
                Recibo
              </Button>
            )
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentsModal;
