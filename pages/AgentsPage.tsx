import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../services/auth.store';

export default function AgentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Fetch agents - show all for admin, broker-specific for brokers
  const { data, isLoading } = useQuery({
    queryKey: ['agents', page, searchTerm, user?.id, user?.role],
    queryFn: async () => {
      const params: any = {
        page,
        limit: 12,
        role: 'agent',
        search: searchTerm,
      };
      
      // Only filter by brokerId for broker users, not admin
      if (user?.role === 'broker') {
        params.brokerId = user.id;
      }
      
      const response = await api.get('/users', { params });
      return response.data;
    },
    enabled: user?.role === 'broker' || user?.role === 'admin',
  });

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: any) => {
      const response = await api.post('/users/agents', {
        ...agentData,
        brokerId: user?.id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowAddModal(false);
      setNewAgent({ firstName: '', lastName: '', email: '', phone: '' });
    },
  });

  // Toggle agent status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: string; isActive: boolean }) => {
      const response = await api.patch(`/users/${agentId}/status`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleCreateAgent = () => {
    if (newAgent.firstName && newAgent.lastName && newAgent.email && newAgent.phone) {
      createAgentMutation.mutate(newAgent);
    }
  };

  if (user?.role !== 'broker' && user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access restricted to brokers and administrators</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary btn-md"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Agent
        </button>
      </div>

      {/* Summary Statistics */}
      {data?.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm font-medium text-gray-600">Total Agents</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{data.meta.total}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600">Total Policies</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {data.data.reduce((sum: number, agent: any) => sum + (agent.policyCount || 0), 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600">Total Clients</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {data.data.reduce((sum: number, agent: any) => sum + (agent.totalClients || 0), 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600">Total Premium</p>
            <p className="mt-1 text-2xl font-semibold text-success-600">
              ${data.data.reduce((sum: number, agent: any) => sum + (agent.totalPremium || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search agents..."
          className="input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading agents...</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm ? `No agents found matching "${searchTerm}"` : 'No agents found'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data?.map((agent: any) => (
              <div key={agent.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {agent.firstName} {agent.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{agent.email}</p>
                    <p className="text-sm text-gray-600">{agent.phone}</p>
                    <div className="mt-2">
                      <span className={`badge-${agent.isActive ? 'success' : 'secondary'}`}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-600">
                        {agent.firstName[0]}{agent.lastName[0]}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Policies</p>
                    <p className="font-semibold text-gray-900">{agent.policyCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Clients</p>
                    <p className="font-semibold text-gray-900">{agent.totalClients || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Premium</p>
                    <p className="font-semibold text-gray-900">
                      ${(agent.totalPremium || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
                  <p className="text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <button className="btn-outline btn-sm flex-1">View Details</button>
                  <button
                    onClick={() => toggleStatusMutation.mutate({
                      agentId: agent.id,
                      isActive: !agent.isActive,
                    })}
                    className={`btn-${agent.isActive ? 'secondary' : 'success'} btn-sm flex-1`}
                  >
                    {agent.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(page - 1) * 12 + 1} to {Math.min(page * 12, data.meta.total)} of{' '}
                {data.meta.total} agents
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
        </>
      )}

      {/* Add Agent Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Agent"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                type="text"
                className="input"
                value={newAgent.firstName}
                onChange={(e) => setNewAgent({ ...newAgent, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                type="text"
                className="input"
                value={newAgent.lastName}
                onChange={(e) => setNewAgent({ ...newAgent, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={newAgent.email}
              onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
              placeholder="john.doe@company.com"
            />
          </div>
          
          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              className="input"
              value={newAgent.phone}
              onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
              placeholder="555-123-4567"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowAddModal(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAgent}
              className="btn-primary btn-sm"
              disabled={createAgentMutation.isPending || !newAgent.firstName || !newAgent.lastName || !newAgent.email || !newAgent.phone}
            >
              {createAgentMutation.isPending ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 