import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../services/auth.store';

interface WaterfallItem {
  id: string;
  type: 'premium' | 'tax' | 'fee';
  priority: number;
  description: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  commissionRate: number;
  claimsEmail: string;
  claimsPhone: string;
  policyTypes: string[];
  paymentWaterfall: WaterfallItem[];
  isActive: boolean;
}

export default function InsuranceCompaniesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<InsuranceCompany | null>(null);
  const [editedWaterfall, setEditedWaterfall] = useState<WaterfallItem[]>([]);

  // Fetch insurance companies for the current broker
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-companies', user?.id],
    queryFn: async () => {
      const response = await api.get('/insurance-companies', {
        params: {
          page: 1,
          limit: 100, // Get all companies for now
          brokerId: user?.id,
        },
      });
      return response.data;
    },
    enabled: user?.role === 'broker',
  });

  // Update waterfall mutation
  const updateWaterfallMutation = useMutation({
    mutationFn: async ({ companyId, waterfall }: { companyId: string; waterfall: WaterfallItem[] }) => {
      const response = await api.put(`/insurance-companies/${companyId}/waterfall`, { waterfall });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] });
      setShowEditModal(false);
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(editedWaterfall);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setEditedWaterfall(items);
  };

  const handleEditWaterfall = (company: InsuranceCompany) => {
    setSelectedCompany(company);
    setEditedWaterfall([...company.paymentWaterfall].sort((a, b) => a.priority - b.priority));
    setShowEditModal(true);
  };

  const handleSaveWaterfall = () => {
    if (selectedCompany) {
      updateWaterfallMutation.mutate({
        companyId: selectedCompany.id,
        waterfall: editedWaterfall,
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'premium': return 'bg-gray-100 text-gray-800';
      case 'tax': return 'bg-blue-100 text-blue-800';
      case 'fee': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (user?.role !== 'broker') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access restricted to brokers only</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Insurance Companies</h1>
      </div>

      {/* Companies List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading insurance companies...</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No insurance companies found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.data?.map((company: InsuranceCompany) => (
            <div key={company.id} className="card">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Company Info */}
                <div className="lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                      <p className="text-sm text-gray-600">Code: {company.code}</p>
                    </div>
                    <span className={`badge-${company.isActive ? 'success' : 'secondary'}`}>
                      {company.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Contact Email</p>
                      <p className="font-medium">{company.contactEmail}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Contact Phone</p>
                      <p className="font-medium">{company.contactPhone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Claims Email</p>
                      <p className="font-medium">{company.claimsEmail}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Commission Rate</p>
                      <p className="font-medium">{(company.commissionRate * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">Policy Types</p>
                    <div className="flex flex-wrap gap-2">
                      {company.policyTypes.map((type, index) => (
                        <span key={index} className="badge-secondary">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Payment Waterfall */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Payment Waterfall</h4>
                    <button
                      onClick={() => handleEditWaterfall(company)}
                      className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-2">
                    {company.paymentWaterfall
                      .sort((a, b) => a.priority - b.priority)
                      .map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <span className="text-gray-500 font-medium">{index + 1}.</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-gray-700">{item.description}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Waterfall Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Payment Waterfall - ${selectedCompany?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Drag and drop to reorder how payments are applied to invoice line items. 
            Payments will be allocated in this order until each category is satisfied.
          </p>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="waterfall">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {editedWaterfall.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center space-x-3 p-3 bg-white border rounded-lg ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          <span className="text-gray-500 font-medium">{index + 1}.</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-gray-700">{item.description}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWaterfall}
              className="btn-primary btn-sm"
              disabled={updateWaterfallMutation.isPending}
            >
              {updateWaterfallMutation.isPending ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 