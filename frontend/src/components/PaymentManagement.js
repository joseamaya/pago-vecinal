import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Pagination,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  Add as AddIcon,
  CheckCircleOutline as ApproveIcon,
  DeleteOutline as DeleteIcon,
  Download as DownloadIcon,
  EditOutlined as EditIcon,
  HighlightOffOutlined as RejectIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { paymentsAPI, feesAPI, propertiesAPI, reportsAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import FilterBar from './common/FilterBar';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import StatusChip from './common/StatusChip';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import { MONTHS } from '../utils/months';
import { formatCurrency, formatDate, formatPeriod, formatPropertyLabel, toInputDate } from '../utils/formatters';

const PaymentManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({
    fee_id: '',
    amount: '',
    notes: '',
    payment_date: '',
  });
  const [approveDirectly, setApproveDirectly] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedVilla, setSelectedVilla] = useState('');
  const [selectedRow, setSelectedRow] = useState('');
  const [selectedHouse, setSelectedHouse] = useState('');
  const [availableRows, setAvailableRows] = useState([]);
  const [availableHouses, setAvailableHouses] = useState([]);
  const [selectedFeeInfo, setSelectedFeeInfo] = useState({
    ownerName: '',
    month: 0,
    year: 0,
    dueDate: '',
    paidAmount: 0,
    totalAmount: 0,
    status: 'pending',
  });
  const [availableFees, setAvailableFees] = useState([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [selectedFeeAmount, setSelectedFeeAmount] = useState(0);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [availableYears, setAvailableYears] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchPayments = useCallback(async (page = 1, filters = {}) => {
    try {
      setLoading(true);
      const response = await paymentsAPI.getPayments(page, pageSize, filters);

      const sortedData = response.data.data.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      setFilteredPayments(sortedData);
      setTotalPages(response.data.pagination.total_pages);
      setTotalCount(response.data.pagination.total_count);
      setCurrentPage(page);
      setError('');
    } catch (err) {
      setError('Error al cargar pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchPayments();
    fetchProperties();
    // Generate available years from current year back to 2020
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 2020; year--) {
      years.push(year);
    }
    setAvailableYears(years);
  }, [fetchPayments]);

  // Auto-apply filters when filter values change
  useEffect(() => {
    if (!initialLoad) {
      applyFilters();
    } else {
      setInitialLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterMonth, filterStatus, filterProperty]);


  const fetchProperties = async () => {
    try {
      // Fetch all properties for filters and selection dropdowns (set high limit)
      const response = await propertiesAPI.getProperties(1, 10000);
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const handleOpenDialog = async (payment = null) => {
    if (payment) {
      setEditingPayment(payment);

      // --- Pre-fill form for editing ---

      // 1. Set basic form data
      setFormData({
        fee_id: payment.fee_id,
        amount: payment.amount.toString(),
        notes: payment.notes || '',
        payment_date: toInputDate(payment.payment_date),
      });

      try {
        // 2. Fetch the associated fee to get all details
        const feeResponse = await feesAPI.getFee(payment.fee_id);
        const fee = feeResponse.data;

        // 3. Find the property from the local properties list
        const property = properties.find(p => p.id === fee.property_id);

        if (property) {
          // 4. Set Villa, Row, House selectors
          const rows = [...new Set(properties.filter(p => p.villa === property.villa).map(p => p.row_letter))].sort();
          const houses = properties
            .filter(p => p.villa === property.villa && p.row_letter === property.row_letter)
            .map(p => ({ number: p.number, id: p.id }))
            .sort((a, b) => a.number - b.number);

          setSelectedVilla(property.villa);
          setAvailableRows(rows);
          setSelectedRow(property.row_letter);
          setAvailableHouses(houses);
          setSelectedHouse(property.id);
        }

        // 5. Populate fee information for the form
        // Since we are editing, the available fees list should include the fee being edited.
        // We also fetch other pending fees for that property for completeness.
        const availableFeesResponse = await feesAPI.getFees({
          property_id: fee.property_id,
          status: 'pending,partially_paid'
        }, 1, 100);

        const availableFeesData = availableFeesResponse.data.data;
        // Ensure the current fee is in the list, even if its status changed
        if (!availableFeesData.find(f => f.id === fee.id)) {
            availableFeesData.unshift(fee);
        }

        setAvailableFees(availableFeesData);
        setSelectedFeeId(fee.id);

        // Populate the fee info box
        setSelectedFeeInfo({
          ownerName: fee.property_owner_name,
          month: fee.month,
          year: fee.year,
          dueDate: fee.due_date,
          paidAmount: fee.paid_amount,
          totalAmount: fee.amount,
          status: fee.status,
        });

        // For editing, the amount can be different from remaining amount
        setSelectedFeeAmount(payment.amount);

      } catch (err) {
        setError('Error al cargar los detalles del pago para editar.');
        console.error("Error fetching details for edit:", err);
        // Don't open the dialog if data can't be loaded
        return;
      }

    } else {
      // --- Reset for new payment ---
      setEditingPayment(null);
      // Reset all relevant states for the 'new payment' form manually
      setFormData({
        fee_id: '',
        amount: '',
        notes: '',
        payment_date: toInputDate(new Date()),
      });
      setSelectedVilla('');
      setSelectedRow('');
      setSelectedHouse('');
      setAvailableRows([]);
      setAvailableHouses([]);
      setSelectedFeeInfo({
        ownerName: '',
        month: 0,
        year: 0,
        dueDate: '',
        paidAmount: 0,
        totalAmount: 0,
        status: 'pending',
      });
      setAvailableFees([]);
      setSelectedFeeId('');
      setSelectedFeeAmount(0);
      setApproveDirectly(false);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingPayment(null);
    setFormData({
      fee_id: '',
      amount: '',
      notes: '',
      payment_date: '',
    });
    setSelectedVilla('');
    setSelectedRow('');
    setSelectedHouse('');
    setAvailableRows([]);
    setAvailableHouses([]);
    setSelectedFeeInfo({
      ownerName: '',
      month: 0,
      year: 0,
      dueDate: '',
      paidAmount: 0,
      totalAmount: 0,
      status: 'pending',
    });
    setAvailableFees([]);
    setSelectedFeeId('');
    setSelectedFeeAmount(0);
    setApproveDirectly(false);
  };

  const validateAmount = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'El monto debe ser un número positivo mayor a 0';
    }
    // Only validate against fee amount when creating new payment (not editing)
    if (!editingPayment && numAmount > selectedFeeAmount) {
      return `El monto no puede exceder el valor de la cuota (S/ ${selectedFeeAmount.toFixed(2)})`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate amount
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

      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      fetchPayments(currentPage, currentFilters);
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

  const handleDelete = async (payment) => {
    const confirmed = await confirm({
      title: 'Eliminar pago',
      message: `¿Estás seguro de que quieres eliminar este pago de S/ ${payment.amount.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await paymentsAPI.deletePayment(payment.id);
      toast.success('Pago eliminado correctamente');
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      fetchPayments(currentPage, currentFilters);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar pago');
      }
      console.error('Error deleting payment:', err);
    }
  };

  const handleApprove = async (payment) => {
    try {

      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      await paymentsAPI.updatePayment(payment.id, formDataToSend);
      toast.success('Pago aprobado correctamente');

      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      await fetchPayments(currentPage, currentFilters);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al aprobar pago');
      }
      console.error('Error approving payment:', err);
    }
  };

  const handleReject = async (payment) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await paymentsAPI.updatePayment(payment.id, formDataToSend);
      toast.success('Pago rechazado');
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      fetchPayments(currentPage, currentFilters);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al rechazar pago');
      }
      console.error('Error rejecting payment:', err);
    }
  };

  const handleBulkUploadOpen = () => {
    setBulkUploadOpen(true);
    setBulkFile(null);
    setBulkResults(null);
  };

  const handleBulkUploadClose = () => {
    setBulkUploadOpen(false);
    setBulkFile(null);
    setBulkResults(null);
  };

  const handleBulkFileChange = (e) => {
    setBulkFile(e.target.files[0]);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      setBulkUploading(true);
      setError('');
      const response = await paymentsAPI.bulkImportPayments(bulkFile);
      setBulkResults(response.data);
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      fetchPayments(currentPage, currentFilters); // Refresh the payments list
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al subir archivo masivo');
      }
      console.error('Error bulk uploading payments:', err);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleSelectPayment = (paymentId) => {
    setSelectedPayments(prev => {
      const newSelected = prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId];
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    const pendingIds = filteredPayments.filter((payment) => payment.status === 'pending').map((payment) => payment.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedPayments.includes(id));
    setSelectedPayments(allSelected ? [] : pendingIds);
  };

  const applyFilters = () => {
    const filters = {};
    if (filterYear) filters.year = parseInt(filterYear);
    if (filterMonth) filters.month = parseInt(filterMonth);
    if (filterStatus) filters.status = filterStatus;
    if (filterProperty) filters.property_id = filterProperty;

    fetchPayments(1, filters); // Reset to first page when filters change
    setSelectedPayments([]);
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setFilterStatus('');
    setFilterProperty('');
    fetchPayments(1, {}); // Fetch without filters and reset to first page
    setSelectedPayments([]);
  };

  const handleExportExcel = async () => {
    try {
      const response = await reportsAPI.getAllPaymentsReport();
      // Create a blob from the response data
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'reporte_pagos_completo.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al exportar el reporte de pagos');
      }
      console.error('Error exporting payments:', err);
    }
  };

  const handleVillaChange = (villa) => {
    setSelectedVilla(villa);
    setSelectedRow('');
    setSelectedHouse('');
    setAvailableHouses([]);
    if (villa) {
      const rows = [...new Set(properties.filter(p => p.villa === villa).map(p => p.row_letter))].sort();
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
        .filter(p => p.villa === selectedVilla && p.row_letter === row)
        .map(p => ({ number: p.number, id: p.id }))
        .sort((a, b) => a.number - b.number);
      setAvailableHouses(houses);
    } else {
      setAvailableHouses([]);
    }
  };

  const handleHouseChange = async (houseId) => {
    setSelectedHouse(houseId);
    if (houseId) {
      try {
        // Get pending and partially paid fees for this specific property
        const response = await feesAPI.getFees({
          property_id: houseId,
          status: 'pending,partially_paid'
        }, 1, 100); // Get up to 100 pending and partially paid fees, sorted by period

        const propertyFees = response.data.data;
        if (propertyFees.length > 0) {
          // Sort by due_date ascending (oldest first)
          propertyFees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
          setAvailableFees(propertyFees);
          setSelectedFeeId('');
          setFormData({
            ...formData,
            fee_id: '',
            amount: '',
          });
          setSelectedFeeInfo({
            ownerName: '',
            month: 0,
            year: 0,
            dueDate: '',
            paidAmount: 0,
            totalAmount: 0,
            status: 'pending',
          });
        } else {
          // No available fees
          setAvailableFees([]);
          setSelectedFeeId('');
          setFormData({
            ...formData,
            fee_id: '',
            amount: '',
          });
          setSelectedFeeInfo({
            ownerName: '',
            month: 0,
            year: 0,
            dueDate: '',
            paidAmount: 0,
            totalAmount: 0,
            status: 'pending',
          });
        }
      } catch (err) {
        console.error('Error fetching available fees for property:', err);
        setAvailableFees([]);
        setSelectedFeeId('');
        setFormData({
          ...formData,
          fee_id: '',
          amount: '',
        });
        setSelectedFeeInfo({
          ownerName: '',
          month: 0,
          year: 0,
          dueDate: '',
          paidAmount: 0,
          totalAmount: 0,
          status: 'pending',
        });
      }
    } else {
      setAvailableFees([]);
      setSelectedFeeId('');
      setFormData({
        ...formData,
        fee_id: '',
        amount: '',
      });
      setSelectedFeeInfo({
        ownerName: '',
        month: 0,
        year: 0,
        dueDate: '',
        paidAmount: 0,
        totalAmount: 0,
        status: 'pending',
      });
    }
  };

  const handleFeeChange = (feeId) => {
    setSelectedFeeId(feeId);
    if (feeId) {
      const selectedFee = availableFees.find(fee => fee.id === feeId);
      if (selectedFee) {
        setFormData({
          ...formData,
          fee_id: selectedFee.id,
          amount: selectedFee.remaining_amount.toString(),
        });
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
      }
    } else {
      setFormData({
        ...formData,
        fee_id: '',
        amount: '',
      });
      setSelectedFeeAmount(0);
      setSelectedFeeInfo({
        ownerName: '',
        month: 0,
        year: 0,
        dueDate: '',
        paidAmount: 0,
        totalAmount: 0,
        status: 'pending',
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPayments.length === 0) {
      setError('Por favor selecciona al menos un pago para aprobar');
      return;
    }

    try {
      setError('');
      const response = await paymentsAPI.bulkApprovePayments(selectedPayments);

      // Refresh payments list
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      await fetchPayments(currentPage, currentFilters);

      // Reset selection
      setSelectedPayments([]);

      // Show success message
      setError('');
      toast.success(`Se aprobaron ${response.data.approved_count} pagos exitosamente`);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al aprobar pagos masivamente');
      }
      console.error('Error bulk approving payments:', err);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      if (filterProperty) currentFilters.property_id = filterProperty;
      fetchPayments(newPage, currentFilters);
    }
  };


  const handleDownload = async (payment) => {
    try {
      const response = await paymentsAPI.downloadGeneratedReceipt(payment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const correlative = payment.receipt_correlative_number || `REC-${new Date().getFullYear()}-${payment.id.slice(-5).toUpperCase()}`;
      link.setAttribute('download', `recibo_${correlative}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al descargar el recibo');
      }
      console.error('Error downloading receipt:', err);
    }
  };


  const activeFilterChips = [
    filterYear && {
      key: 'year',
      label: `Año ${filterYear}`,
      onRemove: () => setFilterYear(''),
    },
    filterMonth && {
      key: 'month',
      label: MONTHS.find((month) => month.value.toString() === filterMonth.toString())?.label,
      onRemove: () => setFilterMonth(''),
    },
    filterStatus && {
      key: 'status',
      label: filterStatus,
      onRemove: () => setFilterStatus(''),
    },
    filterProperty && {
      key: 'property',
      label: (() => {
        const property = properties.find((item) => item.id === filterProperty);
        return property ? formatPropertyLabel(property) : 'Propiedad';
      })(),
      onRemove: () => setFilterProperty(''),
    },
  ].filter(Boolean);

  const columns = [
    {
      key: 'fee',
      label: 'Cuota',
      mobile: false,
      render: (payment) =>
        payment.property_row_letter && payment.property_number && payment.fee_month
          ? `${payment.property_row_letter}${payment.property_number} · ${formatPeriod(payment.fee_month, payment.fee_year)}`
          : '—',
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (payment) => <MoneyText value={payment.amount} variant="body2" />,
    },
    {
      key: 'payment_date',
      label: 'Fecha de pago',
      render: (payment) => formatDate(payment.payment_date),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (payment) => <StatusChip status={payment.status} />,
    },
    {
      key: 'receipt',
      label: 'Recibo',
      render: (payment) =>
        payment.status === 'approved' || payment.status === 'completed' ? (
          <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={() => handleDownload(payment)}>
            PDF
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Cobranzas"
        title="Pagos"
        subtitle="Registra pagos, revisa comprobantes y aprueba los pendientes."
        actions={
          <>
            {isAdmin && (
              <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={handleBulkUploadOpen}>
                Importar
              </Button>
            )}
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportExcel}>
              Exportar
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Nuevo pago
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => fetchPayments(currentPage)}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {isAdmin && selectedPayments.length > 0 && (
        <Paper
          sx={{
            p: 1.5,
            pl: 2.5,
            mb: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            borderColor: 'success.main',
            bgcolor: (theme) => (theme.palette.mode === 'light' ? 'rgba(94, 125, 69, 0.08)' : 'rgba(157, 178, 132, 0.12)'),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {selectedPayments.length} {selectedPayments.length === 1 ? 'pago seleccionado' : 'pagos seleccionados'}
          </Typography>
          <Button size="small" color="inherit" onClick={() => setSelectedPayments([])}>
            Cancelar
          </Button>
          <Button variant="contained" color="success" size="small" startIcon={<ApproveIcon />} onClick={handleBulkApprove}>
            Aprobar seleccionados
          </Button>
        </Paper>
      )}

      <FilterBar chips={activeFilterChips} onClear={clearFilters}>
        <FormControl fullWidth>
          <InputLabel>Año</InputLabel>
          <Select value={filterYear} onChange={(event) => setFilterYear(event.target.value)} label="Año">
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {availableYears.map((year) => (
              <MenuItem key={year} value={year.toString()}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Mes</InputLabel>
          <Select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} label="Mes">
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {MONTHS.map((month) => (
              <MenuItem key={month.value} value={month.value.toString()}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Estado</InputLabel>
          <Select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} label="Estado">
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            <MenuItem value="pending">Pendiente</MenuItem>
            <MenuItem value="approved">Aprobado</MenuItem>
            <MenuItem value="completed">Completado</MenuItem>
            <MenuItem value="partially_paid">Pago parcial</MenuItem>
            <MenuItem value="rejected">Rechazado</MenuItem>
            <MenuItem value="failed">Fallido</MenuItem>
            <MenuItem value="cancelled">Cancelado</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Propiedad</InputLabel>
          <Select
            value={filterProperty}
            onChange={(event) => setFilterProperty(event.target.value)}
            label="Propiedad"
          >
            <MenuItem value="">
              <em>Todas</em>
            </MenuItem>
            {properties.map((property) => (
              <MenuItem key={property.id} value={property.id}>
                {formatPropertyLabel(property)} · {property.owner_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      <ResponsiveTable
        columns={columns}
        rows={filteredPayments}
        loading={loading}
        getRowId={(payment) => payment.id}
        selectable={isAdmin}
        selectedIds={selectedPayments}
        onToggleSelect={handleSelectPayment}
        onToggleSelectAll={handleSelectAll}
        isSelectable={(payment) => payment.status === 'pending'}
        mobileTitle={(payment) =>
          payment.property_row_letter && payment.property_number && payment.fee_month
            ? `${payment.property_row_letter}${payment.property_number} · ${formatPeriod(payment.fee_month, payment.fee_year)}`
            : 'Pago'
        }
        mobileSubtitle={(payment) => `${formatCurrency(payment.amount)} · ${formatDate(payment.payment_date)}`}
        emptyState={
          <EmptyState
            title="No hay pagos registrados"
            description="Registra un pago o ajusta los filtros."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo pago
              </Button>
            }
          />
        }
        renderActions={(payment) => (
          <ActionMenu
            ariaLabel={`Acciones para el pago de ${formatCurrency(payment.amount)}`}
            items={[
              (payment.status === 'approved' || payment.status === 'completed') && {
                label: 'Descargar recibo',
                icon: <DownloadIcon fontSize="small" />,
                onClick: () => handleDownload(payment),
              },
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(payment) },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Aprobar',
                  icon: <ApproveIcon fontSize="small" />,
                  color: 'success',
                  onClick: () => handleApprove(payment),
                },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Rechazar',
                  icon: <RejectIcon fontSize="small" />,
                  color: 'error',
                  onClick: () => handleReject(payment),
                },
              isAdmin && { divider: true },
              isAdmin && {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(payment),
              },
            ].filter(Boolean)}
          />
        )}
        header={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {filteredPayments.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, totalCount)} de {totalCount} pagos
            </Typography>
            {isAdmin && selectedPayments.length > 0 && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                {selectedPayments.length} seleccionados
              </Typography>
            )}
          </Box>
        }
        footer={
          totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => handlePageChange(page)}
                color="primary"
              />
            </Box>
          ) : null
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingPayment ? 'Editar pago' : 'Nuevo pago'}
        subtitle="Selecciona la propiedad, la cuota y el monto del pago."
        submitLabel={editingPayment ? 'Guardar cambios' : 'Registrar pago'}
        saving={saving}
        maxWidth="md"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
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
                {[...new Set(properties.map((property) => property.villa))].sort().map((villa) => (
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
                      ? `${formatPeriod(fee.month, fee.year)} · Pagado ${formatCurrency(fee.paid_amount)} · Resta ${formatCurrency(fee.remaining_amount)}`
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
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField label="Propietario" fullWidth value={selectedFeeInfo.ownerName} InputProps={{ readOnly: true }} />
                <TextField
                  label="Fecha de vencimiento"
                  fullWidth
                  value={selectedFeeInfo.dueDate ? formatDate(selectedFeeInfo.dueDate) : '—'}
                  InputProps={{ readOnly: true }}
                />
                {selectedFeeInfo.status === 'partially_paid' && (
                  <>
                    <TextField
                      label="Monto total"
                      fullWidth
                      value={formatCurrency(selectedFeeInfo.totalAmount)}
                      InputProps={{ readOnly: true }}
                    />
                    <TextField
                      label="Monto pagado"
                      fullWidth
                      value={formatCurrency(selectedFeeInfo.paidAmount)}
                      InputProps={{ readOnly: true }}
                    />
                  </>
                )}
              </Box>
              <TextField
                label={selectedFeeInfo.status === 'partially_paid' ? 'Monto restante (S/)' : 'Monto (S/)'}
                type="number"
                fullWidth
                value={formData.amount}
                onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                inputProps={{ min: 0, step: 0.01 }}
                helperText={
                  editingPayment
                    ? 'Edita el monto del pago'
                    : `Máximo ${formatCurrency(selectedFeeAmount)}`
                }
                required
              />
            </>
          )}

          <TextField
            label="Fecha de pago"
            type="date"
            fullWidth
            value={formData.payment_date}
            onChange={(event) => setFormData({ ...formData, payment_date: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Notas"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
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

      <FormDialog
        open={bulkUploadOpen}
        onClose={handleBulkUploadClose}
        onSubmit={(event) => {
          event.preventDefault();
          handleBulkUpload();
        }}
        title="Importar pagos desde Excel"
        subtitle="El archivo debe incluir Villa, Fila, Número, Año, Mes, Monto, Fecha de pago y Notas."
        submitLabel="Subir archivo"
        savingLabel="Subiendo…"
        saving={bulkUploading}
        submitDisabled={!bulkFile}
        maxWidth="md"
      >
        <Box sx={{ pt: 1 }}>
          <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
            Seleccionar archivo
            <input type="file" hidden accept=".xlsx,.xls" onChange={handleBulkFileChange} />
          </Button>

          {bulkFile && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Archivo seleccionado: <strong>{bulkFile.name}</strong>
            </Typography>
          )}

          {bulkResults && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Exitosos
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'success.main' }}>
                    {bulkResults.successful_imports}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Fallidos
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'error.main' }}>
                    {bulkResults.failed_imports}
                  </Typography>
                </Box>
              </Box>
              {bulkResults.errors?.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Errores
                  </Typography>
                  <List dense sx={{ maxHeight: 220, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 2, py: 0.5 }}>
                    {bulkResults.errors.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={`Fila ${item.row}: ${item.error}`} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
        </Box>
      </FormDialog>
    </PageContainer>
  );
};

export default PaymentManagement;
