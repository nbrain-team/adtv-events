import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, searchTerm],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: {
          page,
          limit: 12,
          role: 'client',
          search: searchTerm,
        },
      });
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button className="btn-primary btn-md">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search clients..."
          className="input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1); // Reset to first page on search
          }}
        />
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading clients...</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm ? `No clients found matching "${searchTerm}"` : 'No clients found'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data?.map((client: any) => (
              <div key={client.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {client.firstName} {client.lastName}
                    </h3>
                    {client.companyName && (
                      <p className="text-sm font-medium text-gray-700">{client.companyName}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">{client.email}</p>
                    <p className="text-sm text-gray-600">{client.phone}</p>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-600">
                        {client.firstName[0]}{client.lastName[0]}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Policies</p>
                    <p className="font-semibold text-gray-900">{client.policyCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Premium</p>
                    <p className="font-semibold text-gray-900">
                      ${(client.totalPremium || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
                  <p className="text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <button className="btn-outline btn-sm flex-1">View Details</button>
                  <button className="btn-primary btn-sm flex-1">New Policy</button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(page - 1) * 12 + 1} to {Math.min(page * 12, data.meta.total)} of{' '}
                {data.meta.total} clients
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
    </div>
  );
}
