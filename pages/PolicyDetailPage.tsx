import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export default function PolicyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: async () => {
      const response = await api.get(`/policies/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['policy-invoices', id],
    queryFn: async () => {
      const response = await api.get(`/invoices`, {
        params: { policyId: id, limit: 50 }
      });
      return response.data.data;
    },
    enabled: !!id,
  });

  if (policyLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading policy details...</div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Policy not found</p>
        <button 
          onClick={() => navigate('/policies')}
          className="mt-4 btn-primary btn-sm"
        >
          Back to Policies
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/policies')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Policies
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Policy Details</h1>
          <p className="text-sm text-gray-600">{policy.policyNumber}</p>
        </div>
        <span className={`badge-${policy.status === 'active' ? 'success' : policy.status === 'expired' ? 'error' : 'warning'} badge-lg`}>
          {policy.status}
        </span>
      </div>

      {/* Policy Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Policy Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{policy.policyType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Insurance Company</dt>
              <dd className="mt-1 text-sm text-gray-900">{policy.insuranceCompany?.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Premium Amount</dt>
              <dd className="mt-1 text-sm text-gray-900">${policy.premiumAmount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Payment Frequency</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{policy.paymentFrequency}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Effective Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(policy.effectiveDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Expiration Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(policy.expirationDate).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {policy.client?.firstName} {policy.client?.lastName}
              </dd>
            </div>
            {policy.client?.companyName && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Company</dt>
                <dd className="mt-1 text-sm text-gray-900">{policy.client.companyName}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{policy.client?.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{policy.client?.phone}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Agent</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {policy.agent?.firstName} {policy.agent?.lastName}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Related Invoices */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Related Invoices</h3>
        {invoices && invoices.length > 0 ? (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Number
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
                {invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge-${
                        invoice.status === 'paid' ? 'success' : 
                        invoice.status === 'overdue' ? 'error' : 
                        invoice.status === 'partially_paid' ? 'warning' : 'secondary'
                      }`}>
                        {invoice.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        className="text-primary-600 hover:text-primary-900"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No invoices found for this policy</p>
        )}
      </div>
    </div>
  );
} 