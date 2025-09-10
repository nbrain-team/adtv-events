import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/Modal';

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedPayment] = useState<any>(null);
  const [reconcileInvoiceId, setReconcileInvoiceId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, statusFilter],
    queryFn: async () => {
      const response = await api.get('/payments', {
        params: {
          page,
          limit: 20,
          status: statusFilter,
        },
      });
      return response.data;
    },
  });

  // Fetch reconciliations for the current payments
  const { data: reconciliationData } = useQuery({
    queryKey: ['payment-reconciliations', data?.data],
    queryFn: async () => {
      if (!data?.data?.length) return [];
      const response = await api.get('/reconciliations');
      return response.data.data;
    },
    enabled: !!data?.data?.length,
  });

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'credit_card':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'ach':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'wire':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Calculate total amounts
  const totalAmount = data?.data?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
  const completedAmount = data?.data?.filter((p: any) => p.status === 'completed')
    .reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;

  const handleReconcile = () => {
    if (selectedPayment && reconcileInvoiceId) {
      alert(`Reconciling payment ${selectedPayment.paymentReference} with invoice ${reconcileInvoiceId}`);
      setShowReconcileModal(false);
      setReconcileInvoiceId('');
      // In a real app, this would make an API call to create a reconciliation
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <button className="btn-primary btn-md">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Payments</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{data?.meta?.total || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Amount</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-success-600">
            ${completedAmount.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-warning-600">
            {data?.data?.filter((p: any) => p.status === 'pending').length || 0}
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
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reconciliation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  Loading payments...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  No payments found
                </td>
              </tr>
            ) : (
              data?.data?.map((payment: any) => {
                // Find reconciliation for this payment from the reconciliation data
                const reconciliation = reconciliationData?.find((r: any) => r.paymentId === payment.id);
                const reconciliationStatus = reconciliation?.status || 'unmatched';
                
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.paymentReference}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.client?.firstName} {payment.client?.lastName}
                      {payment.client?.companyName && (
                        <div className="text-xs text-gray-500">{payment.client.companyName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="mr-2 text-gray-400">
                          {getPaymentMethodIcon(payment.paymentMethod)}
                        </span>
                        <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge-${payment.status === 'completed' ? 'success' : payment.status === 'pending' ? 'warning' : 'error'}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge-${
                        reconciliationStatus === 'matched' ? 'success' : 
                        reconciliationStatus === 'disputed' ? 'error' : 'secondary'
                      }`}>
                        {reconciliationStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/payments/${payment.id}`}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                );
              })
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

      {/* Reconcile Modal */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="Reconcile Payment"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reconcile payment {selectedPayment?.paymentReference} - ${selectedPayment?.amount?.toLocaleString()}
          </p>
          <div>
            <label className="label">Invoice ID</label>
            <input
              type="text"
              value={reconcileInvoiceId}
              onChange={(e) => setReconcileInvoiceId(e.target.value)}
              className="input"
              placeholder="Enter invoice number..."
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowReconcileModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleReconcile}
              className="btn-primary btn-sm"
              disabled={!reconcileInvoiceId}
            >
              Reconcile
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
