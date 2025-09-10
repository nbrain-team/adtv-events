import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface WaterfallAllocation {
  type: 'premium' | 'tax' | 'fee';
  description: string;
  required: number;
  allocated: number;
  remaining: number;
}

export default function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [waterfallAllocations, setWaterfallAllocations] = useState<WaterfallAllocation[]>([]);

  // Fetch payment details
  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const response = await api.get(`/payments/${id}`);
      return response.data;
    },
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.put(`/payments/${id}`, { amount });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      setIsEditing(false);
    },
  });

  // Calculate waterfall allocation whenever payment or amount changes
  useEffect(() => {
    if (payment?.data?.reconciliation?.invoice) {
      calculateWaterfall(isEditing ? parseFloat(editAmount) || 0 : payment.data.amount);
    }
  }, [payment, editAmount, isEditing]);

  const calculateWaterfall = (paymentAmount: number) => {
    if (!payment?.data?.reconciliation?.invoice) return;

    const invoice = payment.data.reconciliation.invoice;
    const policy = invoice.policy;
    const waterfall = policy.insuranceCompany.paymentWaterfall;
    const lineItems = invoice.lineItems || [];

    // Sort waterfall by priority
    const sortedWaterfall = [...waterfall].sort((a, b) => a.priority - b.priority);

    let remainingPayment = paymentAmount;
    const allocations: WaterfallAllocation[] = [];

    sortedWaterfall.forEach(waterfallItem => {
      // Get all line items of this type
      const itemsOfType = lineItems.filter((item: any) => item.type === waterfallItem.type);
      const requiredAmount = itemsOfType.reduce((sum: number, item: any) => sum + item.amount, 0);

      // Allocate payment
      const allocated = Math.min(remainingPayment, requiredAmount);
      remainingPayment -= allocated;

      allocations.push({
        type: waterfallItem.type,
        description: waterfallItem.description,
        required: requiredAmount,
        allocated: allocated,
        remaining: requiredAmount - allocated,
      });
    });

    setWaterfallAllocations(allocations);
  };

  const handleSaveAmount = () => {
    const amount = parseFloat(editAmount);
    if (!isNaN(amount) && amount > 0) {
      updatePaymentMutation.mutate(amount);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'premium': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'tax': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'fee': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading payment details...</div>;
  }

  if (!payment?.data) {
    return <div className="text-center py-12">Payment not found</div>;
  }

  const paymentData = payment.data;
  const hasInvoice = !!paymentData.reconciliation?.invoice;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
        <button
          onClick={() => navigate('/payments')}
          className="btn-outline btn-sm"
        >
          Back to Payments
        </button>
      </div>

      {/* Payment Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Payment Information</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Payment Reference</p>
              <p className="font-medium">{paymentData.paymentReference}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`badge-${paymentData.status === 'completed' ? 'success' : paymentData.status === 'pending' ? 'warning' : 'error'}`}>
                {paymentData.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Client</p>
              <p className="font-medium">{paymentData.client?.firstName} {paymentData.client?.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Date</p>
              <p className="font-medium">{new Date(paymentData.paymentDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Method</p>
              <p className="font-medium capitalize">{paymentData.paymentMethod?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="input input-sm w-32"
                    step="0.01"
                    min="0"
                  />
                  <button
                    onClick={handleSaveAmount}
                    className="btn-primary btn-xs"
                    disabled={updatePaymentMutation.isPending}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditAmount(paymentData.amount.toString());
                    }}
                    className="btn-outline btn-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <p className="font-medium">{formatCurrency(paymentData.amount)}</p>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditAmount(paymentData.amount.toString());
                    }}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Waterfall Allocation */}
      {hasInvoice && (
        <>
          {/* Underpayment Warning */}
          {paymentData.amount < paymentData.reconciliation.invoice.amount && (
            <div className="card bg-warning-50 border-warning-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-warning-800">Underpayment Detected</h3>
                  <div className="mt-2 text-sm text-warning-700">
                    <p>This payment of {formatCurrency(paymentData.amount)} is less than the invoice amount of {formatCurrency(paymentData.reconciliation.invoice.amount)}.</p>
                    <p className="mt-1 font-medium">
                      Remaining balance: {formatCurrency(paymentData.reconciliation.invoice.amount - paymentData.amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Payment Waterfall Allocation</h2>
              <p className="text-sm text-gray-500 mt-1">
                Shows how the payment is allocated based on {paymentData.reconciliation.invoice.policy.insuranceCompany.name}'s waterfall priority
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {waterfallAllocations.map((allocation, index) => (
                  <div key={allocation.type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-semibold text-gray-500">#{index + 1}</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(allocation.type)}`}>
                          {allocation.type}
                        </span>
                        <span className="text-gray-700">{allocation.description}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-gray-500">Required</p>
                        <p className="font-medium">{formatCurrency(allocation.required)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Allocated</p>
                        <p className={`font-medium ${allocation.allocated > 0 ? 'text-success-600' : 'text-gray-400'}`}>
                          {formatCurrency(allocation.allocated)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Remaining</p>
                        <p className={`font-medium ${allocation.remaining > 0 ? 'text-error-600' : 'text-gray-400'}`}>
                          {formatCurrency(allocation.remaining)}
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            allocation.type === 'premium' ? 'bg-gray-600' :
                            allocation.type === 'tax' ? 'bg-blue-600' :
                            'bg-purple-600'
                          }`}
                          style={{ width: `${allocation.required > 0 ? (allocation.allocated / allocation.required) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Invoice Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(paymentData.reconciliation.invoice.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Status</p>
                    <p className="text-lg font-semibold">
                      {paymentData.amount >= paymentData.reconciliation.invoice.amount ? (
                        <span className="text-success-600">Fully Paid</span>
                      ) : (
                        <span className="text-warning-600">Partially Paid</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Invoice Details */}
      {hasInvoice && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Related Invoice</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Invoice Number</p>
                <p className="font-medium">{paymentData.reconciliation.invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Policy Number</p>
                <p className="font-medium">{paymentData.reconciliation.invoice.policy.policyNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Policy Type</p>
                <p className="font-medium">{paymentData.reconciliation.invoice.policy.policyType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Insurance Company</p>
                <p className="font-medium">{paymentData.reconciliation.invoice.policy.insuranceCompany.name}</p>
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Invoice Line Items</h3>
              <div className="space-y-2">
                {paymentData.reconciliation.invoice.lineItems?.map((item: any) => {
                  // Find the corresponding allocation
                  const allocation = waterfallAllocations.find(a => a.type === item.type);
                  if (!allocation) return null;
                  
                  // Calculate how much this specific item gets based on proportional distribution
                  const itemsOfSameType = paymentData.reconciliation.invoice.lineItems.filter((li: any) => li.type === item.type);
                  const totalOfType = itemsOfSameType.reduce((sum: number, li: any) => sum + li.amount, 0);
                  const itemProportion = totalOfType > 0 ? item.amount / totalOfType : 0;
                  const itemPaidAmount = allocation.allocated * itemProportion;
                  const itemPaidPercentage = item.amount > 0 ? (itemPaidAmount / item.amount) * 100 : 0;
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-sm text-gray-700">{item.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium block">{formatCurrency(item.amount)}</span>
                          {itemPaidAmount < item.amount && (
                            <span className="text-xs text-error-600">
                              Paid: {formatCurrency(itemPaidAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Payment progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            itemPaidPercentage === 100 ? 'bg-success-600' :
                            itemPaidPercentage > 0 ? 'bg-warning-600' : 'bg-gray-300'
                          }`}
                          style={{ width: `${itemPaidPercentage}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {itemPaidPercentage === 100 ? 'Fully paid' : 
                         itemPaidPercentage > 0 ? `${itemPaidPercentage.toFixed(0)}% paid` : 'Unpaid'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 