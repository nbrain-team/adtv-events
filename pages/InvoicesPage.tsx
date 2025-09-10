import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: async () => {
      const response = await api.get('/invoices', {
        params: {
          page,
          limit: 20,
          status: statusFilter,
        },
      });
      return response.data;
    },
  });

  // Fetch invoice details when selected
  const { data: invoiceDetail } = useQuery({
    queryKey: ['invoice', selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) return null;
      const response = await api.get(`/invoices/${selectedInvoice.id}`);
      return response.data.data;
    },
    enabled: !!selectedInvoice?.id && showDetailModal,
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await api.post('/payments', paymentData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowPayModal(false);
      setPaymentAmount('');
      // Navigate to the payment detail page to show waterfall allocation
      if (data.data?.id) {
        navigate(`/payments/${data.data.id}`);
      }
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'overdue': return 'error';
      case 'partially_paid': return 'warning';
      default: return 'secondary';
    }
  };

  const handlePayment = () => {
    if (selectedInvoice && paymentMethod && paymentAmount) {
      const amount = parseFloat(paymentAmount);
      if (!isNaN(amount) && amount > 0) {
        createPaymentMutation.mutate({
          invoiceId: selectedInvoice.id,
          clientId: selectedInvoice.clientId,
          amount: amount,
          paymentMethod: paymentMethod,
          paymentDate: new Date().toISOString(),
        });
      }
    }
  };

  const openPayModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.amount.toString());
    setShowPayModal(true);
  };

  const getLineItemTypeColor = (type: string) => {
    switch (type) {
      case 'premium': return 'text-gray-900';
      case 'tax': return 'text-blue-600';
      case 'fee': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button className="btn-primary btn-md">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate Invoice
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Invoices</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{data?.meta?.total || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Paid</p>
          <p className="mt-1 text-2xl font-semibold text-success-600">
            {data?.data?.filter((inv: any) => inv.status === 'paid').length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Overdue</p>
          <p className="mt-1 text-2xl font-semibold text-error-600">
            {data?.data?.filter((inv: any) => inv.status === 'overdue').length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-warning-600">
            {data?.data?.filter((inv: any) => inv.status === 'sent').length || 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          className="input w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Policy
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading invoices...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              data?.data?.map((invoice: any) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.client?.firstName} {invoice.client?.lastName}
                    {invoice.client?.companyName && (
                      <div className="text-xs text-gray-500">{invoice.client.companyName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.policy?.policyNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${invoice.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                    {invoice.status === 'overdue' && (
                      <div className="text-xs text-error-600">
                        {Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge-${getStatusColor(invoice.status)}`}>
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        className="text-primary-600 hover:text-primary-900"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setShowDetailModal(true);
                        }}
                      >
                        View
                      </button>
                      {invoice.status === 'sent' && (
                        <button 
                          className="text-success-600 hover:text-success-900"
                          onClick={() => openPayModal(invoice)}
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.meta && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.meta.total)} of{' '}
            {data.meta.total} results
          </div>
          <div className="flex gap-2">
            <button
              className="btn-outline btn-sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="btn-outline btn-sm"
              disabled={page === data.meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title="Pay Invoice"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm font-medium text-gray-900">
              Invoice: {selectedInvoice?.invoiceNumber}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ${selectedInvoice?.amount?.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Due: {selectedInvoice && new Date(selectedInvoice.dueDate).toLocaleDateString()}
            </p>
          </div>
          
          <div>
            <label className="label">Payment Amount</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="input"
              placeholder="Enter payment amount"
            />
          </div>

          <div>
            <label className="label">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
            >
              <option value="credit_card">Credit Card</option>
              <option value="ach">ACH Transfer</option>
              <option value="check">Check</option>
              <option value="wire">Wire Transfer</option>
            </select>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowPayModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              className="btn-primary btn-sm"
              disabled={createPaymentMutation.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              {createPaymentMutation.isPending ? 'Processing...' : 'Process Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Invoice ${invoiceDetail?.invoiceNumber || ''}`}
      >
        <div className="space-y-6">
          {invoiceDetail && (
            <>
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Client</p>
                  <p className="font-medium">
                    {invoiceDetail.client?.firstName} {invoiceDetail.client?.lastName}
                    {invoiceDetail.client?.companyName && (
                      <span className="block text-xs text-gray-500">{invoiceDetail.client.companyName}</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Policy</p>
                  <p className="font-medium">{invoiceDetail.policy?.policyNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Billing Period</p>
                  <p className="font-medium">
                    {new Date(invoiceDetail.billingPeriodStart).toLocaleDateString()} - {new Date(invoiceDetail.billingPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Due Date</p>
                  <p className="font-medium">{new Date(invoiceDetail.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Invoice Breakdown</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceDetail.lineItems?.map((item: any) => (
                        <tr key={item.id}>
                          <td className={`px-4 py-2 text-sm ${getLineItemTypeColor(item.type)}`}>
                            {item.description}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right ${getLineItemTypeColor(item.type)}`}>
                            ${item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">Total</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                          ${invoiceDetail.amount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status and Notes */}
              <div className="flex items-center justify-between">
                <div>
                  <span className={`badge-${getStatusColor(invoiceDetail.status)}`}>
                    {invoiceDetail.status.replace('_', ' ')}
                  </span>
                </div>
                {invoiceDetail.notes && (
                  <p className="text-sm text-gray-600">{invoiceDetail.notes}</p>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
