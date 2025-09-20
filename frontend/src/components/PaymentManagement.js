import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Pagination,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { paymentsAPI, feesAPI, propertiesAPI, reportsAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';
import LoadingSpinner from './common/LoadingSpinner';

const PaymentManagement = () => {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({
    fee_id: '',
    amount: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
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
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const fetchPayments = useCallback(async (page = 1, filters = {}) => {
    try {
      setLoading(true);
      const response = await paymentsAPI.getPayments(page, pageSize, filters);
      console.log('Fetched payments:', response.data);
      setPayments(response.data.data);
      setFilteredPayments(response.data.data);
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
  }, [fetchPayments]);


  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const handleOpenDialog = (payment = null) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        fee_id: payment.fee_id,
        amount: payment.amount.toString(),
        notes: payment.notes || '',
      });
      setSelectedFeeAmount(payment.amount); // For editing, allow any amount
      setReceiptFile(null); // Reset file input
    } else {
      setEditingPayment(null);
      setFormData({
        fee_id: '',
        amount: '',
        notes: '',
      });
      setSelectedFeeAmount(0);
      setReceiptFile(null);
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
    });
    setReceiptFile(null);
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
      setError(amountError);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('fee_id', formData.fee_id);
      formDataToSend.append('amount', parseFloat(formData.amount));
      formDataToSend.append('notes', formData.notes || '');

      if (receiptFile) {
        formDataToSend.append('receipt_file', receiptFile);
      }

      if (editingPayment) {
        await paymentsAPI.updatePayment(editingPayment.id, formDataToSend);
      } else {
        await paymentsAPI.createPayment(formDataToSend);
      }
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      fetchPayments(currentPage, currentFilters);
      handleCloseDialog();
    } catch (err) {
      setError(editingPayment ? 'Error al actualizar pago' : 'Error al crear pago');
      console.error('Error saving payment:', err);
    }
  };

  const handleDelete = async (paymentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este pago?')) {
      try {
        await paymentsAPI.deletePayment(paymentId);
        const currentFilters = {};
        if (filterYear) currentFilters.year = parseInt(filterYear);
        if (filterMonth) currentFilters.month = parseInt(filterMonth);
        if (filterStatus) currentFilters.status = filterStatus;
        fetchPayments(currentPage, currentFilters);
      } catch (err) {
        setError('Error al eliminar pago');
        console.error('Error deleting payment:', err);
      }
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      console.log('Approving payment:', paymentId);
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      const response = await paymentsAPI.updatePayment(paymentId, formDataToSend);
      console.log('Approval response:', response.data);

      // Wait a bit for receipt generation to complete
      setTimeout(async () => {
        const currentFilters = {};
        if (filterYear) currentFilters.year = parseInt(filterYear);
        if (filterMonth) currentFilters.month = parseInt(filterMonth);
        if (filterStatus) currentFilters.status = filterStatus;
        await fetchPayments(currentPage, currentFilters);
        console.log('Payments refreshed after approval');
      }, 2000); // 2 second delay
    } catch (err) {
      setError('Error al aprobar pago');
      console.error('Error approving payment:', err);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await paymentsAPI.updatePayment(paymentId, formDataToSend);
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      fetchPayments(currentPage, currentFilters);
    } catch (err) {
      setError('Error al rechazar pago');
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
      fetchPayments(currentPage, currentFilters); // Refresh the payments list
    } catch (err) {
      setError('Error al subir archivo masivo');
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
    if (selectAll) {
      setSelectedPayments([]);
      setSelectAll(false);
    } else {
      const pendingPayments = filteredPayments.filter(p => p.status === 'pending').map(p => p.id);
      setSelectedPayments(pendingPayments);
      setSelectAll(true);
    }
  };

  const applyFilters = () => {
    const filters = {};
    if (filterYear) filters.year = parseInt(filterYear);
    if (filterMonth) filters.month = parseInt(filterMonth);
    if (filterStatus) filters.status = filterStatus;

    fetchPayments(1, filters); // Reset to first page when filters change
    setSelectedPayments([]);
    setSelectAll(false);
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setFilterStatus('');
    fetchPayments(1, {}); // Fetch without filters and reset to first page
    setSelectedPayments([]);
    setSelectAll(false);
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
      setError('Error al exportar el reporte de pagos');
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
      console.log('Bulk approval response:', response.data);

      // Refresh payments list
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      await fetchPayments(currentPage, currentFilters);

      // Reset selection
      setSelectedPayments([]);
      setSelectAll(false);

      // Show success message
      setError('');
      alert(`Se aprobaron ${response.data.approved_count} pagos exitosamente`);
    } catch (err) {
      setError('Error al aprobar pagos masivamente');
      console.error('Error bulk approving payments:', err);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      const currentFilters = {};
      if (filterYear) currentFilters.year = parseInt(filterYear);
      if (filterMonth) currentFilters.month = parseInt(filterMonth);
      if (filterStatus) currentFilters.status = filterStatus;
      fetchPayments(newPage, currentFilters);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'partially_paid':
        return 'info';
      case 'rejected':
        return 'error';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'Aprobado';
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'Pendiente';
      case 'partially_paid':
        return 'Pago Parcial';
      case 'rejected':
        return 'Rechazado';
      case 'failed':
        return 'Fallido';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Pagos de Cuotas Condominales
        </Typography>
        <Box>
          {isAdmin && selectedPayments.length > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleBulkApprove}
              sx={{ mr: 2 }}
            >
              Aprobar Seleccionados ({selectedPayments.length})
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleBulkUploadOpen}
              sx={{ mr: 2 }}
            >
              Subida Masiva
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportExcel}
            sx={{ mr: 2 }}
          >
            Exportar Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Pago
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filtros
        </Typography>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Año</InputLabel>
            <Select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              label="Año"
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              {[...new Set(payments.map(p => new Date(p.payment_date).getFullYear()))]
                .sort((a, b) => b - a)
                .map(year => (
                  <MenuItem key={year} value={year.toString()}>
                    {year}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Mes</InputLabel>
            <Select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              label="Mes"
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              {[
                { value: '1', label: 'Enero' },
                { value: '2', label: 'Febrero' },
                { value: '3', label: 'Marzo' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Mayo' },
                { value: '6', label: 'Junio' },
                { value: '7', label: 'Julio' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Septiembre' },
                { value: '10', label: 'Octubre' },
                { value: '11', label: 'Noviembre' },
                { value: '12', label: 'Diciembre' }
              ].map(month => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Estado"
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              <MenuItem value="pending">Pendiente</MenuItem>
              <MenuItem value="approved">Aprobado</MenuItem>
              <MenuItem value="completed">Completado</MenuItem>
              <MenuItem value="partially_paid">Pago Parcial</MenuItem>
              <MenuItem value="rejected">Rechazado</MenuItem>
              <MenuItem value="failed">Fallido</MenuItem>
              <MenuItem value="cancelled">Cancelado</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" onClick={applyFilters}>
            Aplicar Filtros
          </Button>
          <Button variant="outlined" onClick={clearFilters}>
            Limpiar
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        {/* Pagination Info */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Mostrando {filteredPayments.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount} pagos
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  {isAdmin && filteredPayments.some(p => p.status === 'pending') && (
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                      indeterminate={selectedPayments.length > 0 && selectedPayments.length < filteredPayments.filter(p => p.status === 'pending').length}
                    />
                  )}
                </TableCell>
                <TableCell>Cuota</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Pago</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Comprobante</TableCell>
                <TableCell>Recibo</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={8} />
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay pagos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell padding="checkbox">
                      {isAdmin && payment.status === 'pending' && (
                        <Checkbox
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => handleSelectPayment(payment.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.property_row_letter && payment.property_number && payment.fee_month && payment.fee_year
                        ? `${payment.property_row_letter}${payment.property_number} - ${payment.fee_month}/${payment.fee_year}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>S/ {payment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(payment.status)}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.receipt_file ? (
                        <a href={`http://localhost:8000${payment.receipt_file}`} target="_blank" rel="noopener noreferrer">
                          Ver Comprobante
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {(payment.status === 'approved' || payment.status === 'completed') ? (
                        payment.generated_receipt_file ? (
                          <a href={`http://localhost:8000/payments/${payment.id}/download-receipt`} target="_blank" rel="noopener noreferrer">
                            Descargar Recibo
                          </a>
                        ) : (
                          <span style={{ color: 'orange' }}>Generando...</span>
                        )
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(payment)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && payment.status === 'pending' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleApprove(payment.id)}
                            sx={{ ml: 1 }}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => handleReject(payment.id)}
                            sx={{ ml: 1 }}
                          >
                            Rechazar
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(payment.id)}
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(event, page) => handlePageChange(page)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Dialog for Add/Edit Payment */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPayment ? 'Editar Pago' : 'Nuevo Pago'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box display="flex" gap={2} sx={{ mb: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Villa</InputLabel>
                <Select
                  value={selectedVilla}
                  onChange={(e) => handleVillaChange(e.target.value)}
                  label="Villa"
                  required
                >
                  <MenuItem value="">
                    <em>Seleccionar Villa</em>
                  </MenuItem>
                  {[...new Set(properties.map(p => p.villa))].sort().map((villa) => (
                    <MenuItem key={villa} value={villa}>
                      {villa}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ flex: 1 }} disabled={!selectedVilla}>
                <InputLabel>Fila</InputLabel>
                <Select
                  value={selectedRow}
                  onChange={(e) => handleRowChange(e.target.value)}
                  label="Fila"
                  required
                >
                  <MenuItem value="">
                    <em>Seleccionar Fila</em>
                  </MenuItem>
                  {availableRows.map((row) => (
                    <MenuItem key={row} value={row}>
                      {row}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ flex: 1 }} disabled={!selectedRow}>
                <InputLabel>Casa</InputLabel>
                <Select
                  value={selectedHouse}
                  onChange={(e) => handleHouseChange(e.target.value)}
                  label="Casa"
                  required
                >
                  <MenuItem value="">
                    <em>Seleccionar Casa</em>
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
              <FormControl sx={{ mt: 2 }} fullWidth>
                <InputLabel>Seleccionar Cuota (Pendiente o Parcial)</InputLabel>
                <Select
                  value={selectedFeeId}
                  onChange={(e) => handleFeeChange(e.target.value)}
                  label="Seleccionar Cuota (Pendiente o Parcial)"
                  required
                >
                  <MenuItem value="">
                    <em>Seleccionar Cuota</em>
                  </MenuItem>
                  {availableFees.map((fee) => (
                    <MenuItem key={fee.id} value={fee.id}>
                      {fee.status === 'partially_paid'
                        ? `Cuota ${fee.month}/${fee.year} - Pagado: S/ ${fee.paid_amount.toFixed(2)} - Restante: S/ ${fee.remaining_amount.toFixed(2)} - Vence: ${new Date(fee.due_date).toLocaleDateString('es-ES')}`
                        : `Cuota ${fee.month}/${fee.year} - S/ ${fee.amount.toFixed(2)} - Vence: ${new Date(fee.due_date).toLocaleDateString('es-ES')}`
                      }
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {availableFees.length === 0 && selectedHouse && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No hay cuotas pendientes o parcialmente pagadas para esta propiedad.
              </Alert>
            )}

            {selectedFeeInfo && (
              <>
                <TextField
                  margin="dense"
                  label="Propietario"
                  fullWidth
                  value={selectedFeeInfo.ownerName}
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <Box display="flex" gap={2} sx={{ mb: 2 }}>
                  <TextField
                    sx={{ flex: 1 }}
                    label="Período"
                    value={`${selectedFeeInfo.month}/${selectedFeeInfo.year}`}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                  <TextField
                    sx={{ flex: 1 }}
                    label="Fecha de Vencimiento"
                    value={new Date(selectedFeeInfo.dueDate).toLocaleDateString('es-ES')}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                  {selectedFeeInfo.status === 'partially_paid' && (
                    <>
                      <TextField
                        sx={{ flex: 1 }}
                        label="Monto Total"
                        value={`S/ ${selectedFeeInfo.totalAmount.toFixed(2)}`}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                      <TextField
                        sx={{ flex: 1 }}
                        label="Monto Pagado"
                        value={`S/ ${selectedFeeInfo.paidAmount.toFixed(2)}`}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </>
                  )}
                  <TextField
                    sx={{ flex: selectedFeeInfo.status === 'partially_paid' ? 1 : 2 }}
                    label={selectedFeeInfo.status === 'partially_paid' ? "Monto Restante (S/)" : "Monto (S/)"}
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText={
                      editingPayment
                        ? "💰 Editar monto del pago"
                        : selectedFeeInfo.status === 'partially_paid'
                          ? `💰 Pago restante (máx. S/ ${selectedFeeAmount.toFixed(2)})`
                          : `💰 Pagos parciales permitidos (máx. S/ ${selectedFeeAmount.toFixed(2)})`
                    }
                    required
                  />
                </Box>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files[0])}
              style={{ marginTop: 16, marginBottom: 8 }}
            />
            {receiptFile && <Typography variant="body2">{receiptFile.name}</Typography>}
            <TextField
              margin="dense"
              label="Notas"
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingPayment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadOpen} onClose={handleBulkUploadClose} maxWidth="md" fullWidth>
        <DialogTitle>Subida Masiva de Pagos</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sube un archivo Excel con los pagos. El formato debe incluir las columnas: Villa, Fila, Número, Año, Mes, Monto, Fecha de Pago, Notas.
          </Typography>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleBulkFileChange}
            style={{ marginBottom: 16 }}
          />

          {bulkFile && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Archivo seleccionado: {bulkFile.name}
            </Typography>
          )}

          {bulkResults && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" color="success.main">
                Pagos exitosos: {bulkResults.successful_imports}
              </Typography>
              <Typography variant="h6" color="error.main">
                Pagos fallidos: {bulkResults.failed_imports}
              </Typography>

              {bulkResults.errors && bulkResults.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6">Errores:</Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {bulkResults.errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`Fila ${error.row}: ${error.error}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBulkUploadClose}>Cerrar</Button>
          <Button
            onClick={handleBulkUpload}
            variant="contained"
            disabled={!bulkFile || bulkUploading}
          >
            {bulkUploading ? (
              <LoadingSpinner buttonVariant size={20} message="Subiendo..." showMessage />
            ) : (
              'Subir Archivo'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PaymentManagement;