import React from 'react';
import {
  Alert,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import FormDialog from '../common/FormDialog';
import MoneyField from '../common/MoneyField';
import { formatCurrency, formatDate, formatPeriod } from '../../utils/formatters';

const readOnlyInput = { htmlInput: { readOnly: true } };

const PaymentFormDialog = ({ dialog, isAdmin = false }) => {
  const {
    open,
    editingPayment,
    formData,
    setFormData,
    approveDirectly,
    setApproveDirectly,
    saving,
    selectedVilla,
    selectedRow,
    selectedHouse,
    availableRows,
    availableHouses,
    availableFees,
    selectedFeeId,
    selectedFeeAmount,
    selectedFeeInfo,
    availableVillas,
    handleCloseDialog,
    handleVillaChange,
    handleRowChange,
    handleHouseChange,
    handleFeeChange,
    handleSubmit,
  } = dialog;

  const amountNumber = Number(formData.amount);
  const amountError = !formData.amount
    ? 'Ingresa el monto.'
    : !Number.isFinite(amountNumber) || amountNumber <= 0
      ? 'Ingresa un monto mayor a 0.'
      : !editingPayment && selectedFeeAmount > 0 && amountNumber > selectedFeeAmount
        ? `El monto no puede superar ${formatCurrency(selectedFeeAmount)}.`
        : '';
  const dateError = !formData.payment_date ? 'Selecciona la fecha de pago.' : '';
  const submitDisabled = !selectedFeeId || Boolean(amountError || dateError);

  return (
    <FormDialog
      open={open}
      onClose={handleCloseDialog}
      onSubmit={handleSubmit}
      title={editingPayment ? 'Editar pago' : 'Nuevo pago'}
      subtitle="Selecciona la propiedad, la cuota y el monto del pago."
      submitLabel={editingPayment ? 'Guardar cambios' : 'Registrar pago'}
      saving={saving}
      submitDisabled={submitDisabled}
      maxWidth="md"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <FormControl fullWidth>
            <InputLabel>Villa</InputLabel>
            <Select
              value={selectedVilla}
              onChange={(event) => handleVillaChange(event.target.value)}
              label="Villa"
              required
            >
              <MenuItem value="">
                <em>Seleccionar villa</em>
              </MenuItem>
              {availableVillas.map((villa) => (
                <MenuItem key={villa} value={villa}>
                  {villa}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={!selectedVilla}>
            <InputLabel>Fila</InputLabel>
            <Select
              value={selectedRow}
              onChange={(event) => handleRowChange(event.target.value)}
              label="Fila"
              required
            >
              <MenuItem value="">
                <em>Seleccionar fila</em>
              </MenuItem>
              {availableRows.map((row) => (
                <MenuItem key={row} value={row}>
                  {row}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={!selectedRow}>
            <InputLabel>Casa</InputLabel>
            <Select
              value={selectedHouse}
              onChange={(event) => handleHouseChange(event.target.value)}
              label="Casa"
              required
            >
              <MenuItem value="">
                <em>Seleccionar casa</em>
              </MenuItem>
              {availableHouses.map((house) => (
                <MenuItem key={house.id} value={house.id}>
                  {house.number}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {availableFees.length > 0 && (
          <FormControl fullWidth>
            <InputLabel>Cuota pendiente o parcial</InputLabel>
            <Select
              value={selectedFeeId}
              onChange={(event) => handleFeeChange(event.target.value)}
              label="Cuota pendiente o parcial"
              required
            >
              <MenuItem value="">
                <em>Seleccionar cuota</em>
              </MenuItem>
              {availableFees.map((fee) => (
                <MenuItem key={fee.id} value={fee.id}>
                  {fee.status === 'partially_paid'
                    ? `${formatPeriod(fee.month, fee.year)} · Pagado ${formatCurrency(
                        fee.paid_amount
                      )} · Resta ${formatCurrency(fee.remaining_amount)}`
                    : `${formatPeriod(fee.month, fee.year)} · ${formatCurrency(fee.amount)}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {availableFees.length === 0 && selectedHouse && (
          <Alert severity="info">
            No hay cuotas pendientes o parcialmente pagadas para esta propiedad.
          </Alert>
        )}

        {selectedFeeId && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <TextField
                label="Propietario"
                fullWidth
                value={selectedFeeInfo.ownerName}
                slotProps={readOnlyInput}
              />
              <TextField
                label="Fecha de vencimiento"
                fullWidth
                value={selectedFeeInfo.dueDate ? formatDate(selectedFeeInfo.dueDate) : '—'}
                slotProps={readOnlyInput}
              />
              {selectedFeeInfo.status === 'partially_paid' && (
                <>
                  <TextField
                    label="Monto total"
                    fullWidth
                    value={formatCurrency(selectedFeeInfo.totalAmount)}
                    slotProps={readOnlyInput}
                  />
                  <TextField
                    label="Monto pagado"
                    fullWidth
                    value={formatCurrency(selectedFeeInfo.paidAmount)}
                    slotProps={readOnlyInput}
                  />
                </>
              )}
            </Box>
            <MoneyField
              name="amount"
              label={
                selectedFeeInfo.status === 'partially_paid'
                  ? 'Monto restante'
                  : 'Monto'
              }
              fullWidth
              value={formData.amount}
              onChange={(event) =>
                setFormData((previous) => ({ ...previous, amount: event.target.value }))
              }
              error={Boolean(amountError)}
              helperText={
                amountError ||
                (editingPayment
                  ? 'Edita el monto del pago'
                  : `Máximo ${formatCurrency(selectedFeeAmount)}`)
              }
              required
            />
          </>
        )}

        <TextField
          name="payment_date"
          label="Fecha de pago"
          type="date"
          fullWidth
          value={formData.payment_date}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, payment_date: event.target.value }))
          }
          error={Boolean(dateError)}
          helperText={dateError}
          slotProps={{ inputLabel: { shrink: true } }}
          required
        />
        <TextField
          label="Notas"
          fullWidth
          multiline
          rows={3}
          value={formData.notes}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, notes: event.target.value }))
          }
        />
        {isAdmin && !editingPayment && (
          <FormControlLabel
            control={
              <Checkbox
                checked={approveDirectly}
                onChange={(event) => setApproveDirectly(event.target.checked)}
                color="primary"
              />
            }
            label="Marcar como aprobado directamente"
          />
        )}
      </Box>
    </FormDialog>
  );
};

export default PaymentFormDialog;
