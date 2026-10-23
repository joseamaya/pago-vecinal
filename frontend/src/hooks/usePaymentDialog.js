import { useState, useCallback, useMemo } from 'react';
import { paymentsAPI, feesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { toInputDate } from '../utils/formatters';
import { parseAmount } from '../utils/validators';

const createEmptyFeeInfo = () => ({
  ownerName: '',
  month: 0,
  year: 0,
  dueDate: '',
  paidAmount: 0,
  totalAmount: 0,
  status: 'pending',
});

const createEmptyFormData = () => ({
  fee_id: '',
  amount: '',
  notes: '',
  payment_date: '',
});

export function usePaymentDialog({ properties = [], isAdmin = false, onSaved } = {}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [approveDirectly, setApproveDirectly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVilla, setSelectedVilla] = useState('');
  const [selectedRow, setSelectedRow] = useState('');
  const [selectedHouse, setSelectedHouse] = useState('');
  const [availableRows, setAvailableRows] = useState([]);
  const [availableHouses, setAvailableHouses] = useState([]);
  const [availableFees, setAvailableFees] = useState([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [selectedFeeAmount, setSelectedFeeAmount] = useState(0);
  const [selectedFeeInfo, setSelectedFeeInfo] = useState(createEmptyFeeInfo);

  const availableVillas = useMemo(
    () => [...new Set(properties.map((property) => property.villa))].sort(),
    [properties]
  );

  const resetDialog = useCallback(() => {
    setEditingPayment(null);
    setFormData(createEmptyFormData());
    setSelectedVilla('');
    setSelectedRow('');
    setSelectedHouse('');
    setAvailableRows([]);
    setAvailableHouses([]);
    setAvailableFees([]);
    setSelectedFeeId('');
    setSelectedFeeAmount(0);
    setSelectedFeeInfo(createEmptyFeeInfo());
    setApproveDirectly(false);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpen(false);
    resetDialog();
  }, [resetDialog]);

  const handleOpenDialog = useCallback(
    async (payment = null) => {
      if (payment) {
        setEditingPayment(payment);
        setFormData({
          fee_id: payment.fee_id,
          amount: payment.amount.toString(),
          notes: payment.notes || '',
          payment_date: toInputDate(payment.payment_date),
        });

        try {
          const feeResponse = await feesAPI.getFee(payment.fee_id);
          const fee = feeResponse.data;
          const property = properties.find((item) => item.id === fee.property_id);

          if (property) {
            const rows = [
              ...new Set(
                properties
                  .filter((item) => item.villa === property.villa)
                  .map((item) => item.row_letter)
              ),
            ].sort();
            const houses = properties
              .filter(
                (item) =>
                  item.villa === property.villa && item.row_letter === property.row_letter
              )
              .map((item) => ({ number: item.number, id: item.id }))
              .sort((a, b) => a.number - b.number);

            setSelectedVilla(property.villa);
            setAvailableRows(rows);
            setSelectedRow(property.row_letter);
            setAvailableHouses(houses);
            setSelectedHouse(property.id);
          }

          const availableFeesResponse = await feesAPI.getFees(
            {
              property_id: fee.property_id,
              status: 'pending,partially_paid',
            },
            1,
            100
          );

          const availableFeesData = [...(availableFeesResponse.data.data || [])];
          if (!availableFeesData.find((item) => item.id === fee.id)) {
            availableFeesData.unshift(fee);
          }

          setAvailableFees(availableFeesData);
          setSelectedFeeId(fee.id);
          setSelectedFeeInfo({
            ownerName: fee.property_owner_name,
            month: fee.month,
            year: fee.year,
            dueDate: fee.due_date,
            paidAmount: fee.paid_amount,
            totalAmount: fee.amount,
            status: fee.status,
          });
          setSelectedFeeAmount(payment.amount);
        } catch (err) {
          toast.error('Error al cargar los detalles del pago para editar.');
          console.error('Error fetching details for edit:', err);
          return;
        }
      } else {
        resetDialog();
        setFormData({
          ...createEmptyFormData(),
          payment_date: toInputDate(new Date()),
        });
      }

      setOpen(true);
    },
    [properties, resetDialog, toast]
  );

  const validateAmount = (amount) => {
    const numAmount = parseAmount(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'El monto debe ser un número positivo mayor a 0';
    }
    if (!editingPayment && numAmount > selectedFeeAmount) {
      return `El monto no puede exceder el valor de la cuota (S/ ${selectedFeeAmount.toFixed(2)})`;
    }
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const amountError = validateAmount(formData.amount);
    if (amountError) {
      toast.error(amountError);
      return;
    }

    setSaving(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('fee_id', formData.fee_id);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('notes', formData.notes || '');
      formDataToSend.append('payment_date', formData.payment_date);

      const isDirectlyApproved = !editingPayment && isAdmin && approveDirectly;

      if (editingPayment) {
        await paymentsAPI.updatePayment(editingPayment.id, formDataToSend);
        toast.success('Pago actualizado correctamente');
      } else {
        if (isDirectlyApproved) {
          formDataToSend.append('status', 'approved');
        }
        await paymentsAPI.createPayment(formDataToSend);
        toast.success('Pago creado correctamente');
      }

      await onSaved?.();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(editingPayment ? 'Error al actualizar pago' : 'Error al crear pago');
      }
      console.error('Error saving payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleVillaChange = (villa) => {
    setSelectedVilla(villa);
    setSelectedRow('');
    setSelectedHouse('');
    setAvailableHouses([]);
    if (villa) {
      const rows = [
        ...new Set(
          properties.filter((item) => item.villa === villa).map((item) => item.row_letter)
        ),
      ].sort();
      setAvailableRows(rows);
    } else {
      setAvailableRows([]);
    }
  };

  const handleRowChange = (row) => {
    setSelectedRow(row);
    setSelectedHouse('');
    if (row && selectedVilla) {
      const houses = properties
        .filter((item) => item.villa === selectedVilla && item.row_letter === row)
        .map((item) => ({ number: item.number, id: item.id }))
        .sort((a, b) => a.number - b.number);
      setAvailableHouses(houses);
    } else {
      setAvailableHouses([]);
    }
  };

  const handleHouseChange = async (houseId) => {
    setSelectedHouse(houseId);

    if (!houseId) {
      setAvailableFees([]);
      setSelectedFeeId('');
      setFormData((previous) => ({ ...previous, fee_id: '', amount: '' }));
      setSelectedFeeInfo(createEmptyFeeInfo());
      return;
    }

    try {
      const response = await feesAPI.getFees(
        {
          property_id: houseId,
          status: 'pending,partially_paid',
        },
        1,
        100
      );

      const propertyFees = [...(response.data.data || [])];
      propertyFees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setAvailableFees(propertyFees);
    } catch (err) {
      console.error('Error fetching available fees for property:', err);
      setAvailableFees([]);
    } finally {
      setSelectedFeeId('');
      setFormData((previous) => ({ ...previous, fee_id: '', amount: '' }));
      setSelectedFeeInfo(createEmptyFeeInfo());
    }
  };

  const handleFeeChange = (feeId) => {
    setSelectedFeeId(feeId);

    if (!feeId) {
      setFormData((previous) => ({ ...previous, fee_id: '', amount: '' }));
      setSelectedFeeAmount(0);
      setSelectedFeeInfo(createEmptyFeeInfo());
      return;
    }

    const selectedFee = availableFees.find((fee) => fee.id === feeId);
    if (!selectedFee) return;

    setFormData((previous) => ({
      ...previous,
      fee_id: selectedFee.id,
      amount: selectedFee.remaining_amount.toString(),
    }));
    setSelectedFeeAmount(selectedFee.remaining_amount);
    setSelectedFeeInfo({
      ownerName: selectedFee.property_owner_name,
      month: selectedFee.month,
      year: selectedFee.year,
      dueDate: selectedFee.due_date,
      paidAmount: selectedFee.paid_amount,
      totalAmount: selectedFee.amount,
      status: selectedFee.status,
    });
  };

  return {
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
    handleOpenDialog,
    handleCloseDialog,
    handleVillaChange,
    handleRowChange,
    handleHouseChange,
    handleFeeChange,
    validateAmount,
    handleSubmit,
  };
}
