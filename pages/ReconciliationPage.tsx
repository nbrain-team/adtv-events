import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/Modal';

export default function ReconciliationPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReconciliation, setSelectedReconciliation] = useState<any>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showManualMatchModal, setShowManualMatchModal] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliations', page, statusFilter],
    queryFn: async () => {
      const response = await api.get('/reconciliations', {
        params: {
          page,
          limit: 20,
          status: statusFilter,
        },
      });
      return response.data;
    },
  });

  // Accept AI Suggestion mutation
  const acceptSuggestionMutation = useMutation({
    mutationFn: async ({ reconciliationId, invoiceId }: { reconciliationId: string; invoiceId: string }) => {
      const response = await api.post(`/reconciliations/${reconciliationId}/accept-suggestion`, {
        invoiceId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });

  // Resolve Dispute mutation
  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ reconciliationId, notes }: { reconciliationId: string; notes: string }) => {
      const response = await api.post(`/reconciliations/${reconciliationId}/resolve-dispute`, {
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      setShowDisputeModal(false);
      setDisputeNotes('');
    },
  });

  // Manual Match mutation
  const manualMatchMutation = useMutation({
    mutationFn: async ({ reconciliationId, invoiceId }: { reconciliationId: string; invoiceId: string }) => {
      const response = await api.post(`/reconciliations/${reconciliationId}/manual-match`, {
        invoiceId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      setShowManualMatchModal(false);
      setSelectedInvoiceId('');
    },
  });

  const handleAcceptSuggestion = (reconciliation: any) => {
    const topSuggestion = reconciliation.aiSuggestions?.suggestedMatches?.[0];
    if (topSuggestion) {
      acceptSuggestionMutation.mutate({
        reconciliationId: reconciliation.id,
        invoiceId: topSuggestion.invoiceId,
      });
    }
  };

  const handleResolveDispute = () => {
    if (selectedReconciliation && disputeNotes) {
      resolveDisputeMutation.mutate({
        reconciliationId: selectedReconciliation.id,
        notes: disputeNotes,
      });
    }
  };

  const handleManualMatch = () => {
    if (selectedReconciliation && selectedInvoiceId) {
      manualMatchMutation.mutate({
        reconciliationId: selectedReconciliation.id,
        invoiceId: selectedInvoiceId,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched': return 'success';
      case 'disputed': return 'error';
      case 'unmatched': return 'warning';
      default: return 'secondary';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-success-600';
    if (score >= 0.6) return 'text-warning-600';
    return 'text-error-600';
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI-Powered Reconciliation</h1>
          <p className="mt-1 text-sm text-gray-600">
            Intelligent matching of payments to invoices using AI
          </p>
        </div>
        <button className="btn-primary btn-md">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Run AI Reconciliation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Records</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{data?.meta?.total || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Matched</p>
          <p className="mt-1 text-2xl font-semibold text-success-600">
            {data?.data?.filter((r: any) => r.status === 'matched').length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Unmatched</p>
          <p className="mt-1 text-2xl font-semibold text-warning-600">
            {data?.data?.filter((r: any) => r.status === 'unmatched').length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Disputed</p>
          <p className="mt-1 text-2xl font-semibold text-error-600">
            {data?.data?.filter((r: any) => r.status === 'disputed').length || 0}
          </p>
        </div>
      </div>

      {/* AI Insights Card */}
      <div className="card bg-primary-50 border-primary-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-primary-800">AI Insights</h3>
            <div className="mt-2 text-sm text-primary-700">
              <p>• Average confidence score: 82.5%</p>
              <p>• 15 payments need manual review</p>
              <p>• 3 potential duplicate payments detected</p>
              <p>• Suggested bulk actions available for 8 records</p>
            </div>
          </div>
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
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="disputed">Disputed</option>
        </select>
      </div>

      {/* Reconciliation Table */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading reconciliation data...</div>
        ) : data?.data?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No reconciliation records found</div>
        ) : (
          data?.data?.map((reconciliation: any) => (
            <div key={reconciliation.id} className="card">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Side */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Payment Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reference:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {reconciliation.payment?.paymentReference}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Client:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {reconciliation.payment?.client?.firstName} {reconciliation.payment?.client?.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Amount:</span>
                      <span className="text-sm font-medium text-gray-900">
                        ${reconciliation.payment?.amount?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Date:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(reconciliation.payment?.paymentDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Method:</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {reconciliation.payment?.paymentMethod?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Invoice Side */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    {reconciliation.invoice ? 'Matched Invoice' : 'AI Suggestions'}
                  </h4>
                  {reconciliation.invoice ? (
                    <div className="bg-success-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Invoice:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {reconciliation.invoice?.invoiceNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Policy:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {reconciliation.invoice?.policy?.policyNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount:</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${reconciliation.invoice?.amount?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Due Date:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(reconciliation.invoice?.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-warning-50 rounded-lg p-4">
                      {reconciliation.aiSuggestions?.suggestedMatches?.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm text-warning-800 font-medium mb-2">
                            Potential Matches:
                          </p>
                          {reconciliation.aiSuggestions.suggestedMatches.map((suggestion: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span>Invoice #{suggestion.invoiceId?.slice(-8)}</span>
                                <span className={getConfidenceColor(suggestion.confidence)}>
                                  {Math.round(suggestion.confidence * 100)}% match
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-warning-800">No matching invoices found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with Status and Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className={`badge-${getStatusColor(reconciliation.status)}`}>
                    {reconciliation.status}
                  </span>
                  <span className="text-sm text-gray-600">
                    Confidence: 
                    <span className={`ml-1 font-medium ${getConfidenceColor(reconciliation.confidenceScore)}`}>
                      {Math.round(reconciliation.confidenceScore * 100)}%
                    </span>
                  </span>
                  {reconciliation.reconciledBy && (
                    <span className="text-sm text-gray-600">
                      Reconciled by: {reconciliation.reconciledBy}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  {reconciliation.status === 'unmatched' && (
                    <>
                      <button 
                        className="btn-outline btn-sm"
                        onClick={() => {
                          setSelectedReconciliation(reconciliation);
                          setShowManualMatchModal(true);
                        }}
                      >
                        Manual Match
                      </button>
                      <button 
                        className="btn-primary btn-sm"
                        onClick={() => handleAcceptSuggestion(reconciliation)}
                        disabled={acceptSuggestionMutation.isPending}
                      >
                        {acceptSuggestionMutation.isPending ? 'Processing...' : 'Accept AI Suggestion'}
                      </button>
                    </>
                  )}
                  {reconciliation.status === 'disputed' && (
                    <button 
                      className="btn-outline btn-sm"
                      onClick={() => {
                        setSelectedReconciliation(reconciliation);
                        setShowDisputeModal(true);
                      }}
                    >
                      Resolve Dispute
                    </button>
                  )}
                  <button className="text-primary-600 hover:text-primary-900 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>

              {/* Manual Notes if any */}
              {reconciliation.manualNotes && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Note:</span> {reconciliation.manualNotes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
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

      {/* Dispute Resolution Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Resolve Dispute"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Resolve the dispute for payment {selectedReconciliation?.payment?.paymentReference}
          </p>
          <div>
            <label className="label">Resolution Notes</label>
            <textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              className="input"
              rows={4}
              placeholder="Explain the resolution..."
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowDisputeModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveDispute}
              className="btn-primary btn-sm"
              disabled={!disputeNotes || resolveDisputeMutation.isPending}
            >
              {resolveDisputeMutation.isPending ? 'Resolving...' : 'Resolve Dispute'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manual Match Modal */}
      <Modal
        isOpen={showManualMatchModal}
        onClose={() => setShowManualMatchModal(false)}
        title="Manual Match"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Manually match payment {selectedReconciliation?.payment?.paymentReference}
          </p>
          <div>
            <label className="label">Select Invoice</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="input"
            >
              <option value="">Choose an invoice...</option>
              {selectedReconciliation?.aiSuggestions?.suggestedMatches?.map((match: any) => (
                <option key={match.invoiceId} value={match.invoiceId}>
                  Invoice #{match.invoiceId?.slice(-8)} - {Math.round(match.confidence * 100)}% confidence
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowManualMatchModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleManualMatch}
              className="btn-primary btn-sm"
              disabled={!selectedInvoiceId || manualMatchMutation.isPending}
            >
              {manualMatchMutation.isPending ? 'Matching...' : 'Match Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
