import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export default function DataVerificationPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['data-verification'],
    queryFn: async () => {
      const response = await api.get('/verify/data-consistency');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Verifying data consistency...</div>;
  }

  const consistencyClass = data?.summary?.dataConsistent ? 'text-success-600' : 'text-error-600';
  const consistencyIcon = data?.summary?.dataConsistent ? '✓' : '✗';

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Data Consistency Verification</h1>
        <button onClick={() => refetch()} className="btn-primary btn-md">
          Re-verify Data
        </button>
      </div>

      {/* Summary Card */}
      <div className={`card border-2 ${data?.summary?.dataConsistent ? 'border-success-200 bg-success-50' : 'border-error-200 bg-error-50'}`}>
        <div className="flex items-center">
          <div className={`text-4xl mr-4 ${consistencyClass}`}>{consistencyIcon}</div>
          <div>
            <h2 className={`text-xl font-semibold ${consistencyClass}`}>
              {data?.summary?.message}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Last verified: {new Date(data?.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Agent Metrics */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Data Verification</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Agent</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Policies</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Active</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Premium</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Clients</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Collected</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.agentMetrics?.map((agent: any) => (
                <tr key={agent.email}>
                  <td className="px-4 py-2 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">{agent.agent}</div>
                      <div className="text-gray-500">{agent.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{agent.metrics.policyCount}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{agent.metrics.activePolicies}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">${agent.metrics.totalPremium.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{agent.metrics.totalClients}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">${agent.metrics.collected.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">Total</td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {data?.agentMetrics?.reduce((sum: number, a: any) => sum + a.metrics.policyCount, 0)}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {data?.agentMetrics?.reduce((sum: number, a: any) => sum + a.metrics.activePolicies, 0)}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  ${data?.agentMetrics?.reduce((sum: number, a: any) => sum + a.metrics.totalPremium, 0).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">-</td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  ${data?.agentMetrics?.reduce((sum: number, a: any) => sum + a.metrics.collected, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cross-Reference Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Data Integrity Checks</h3>
          <div className="space-y-2">
            {Object.entries(data?.crossChecks || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className={`text-sm font-medium ${
                  typeof value === 'boolean' 
                    ? value ? 'text-success-600' : 'text-error-600'
                    : 'text-gray-900'
                }`}>
                  {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Metrics</h3>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Clients</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total: {data?.clientMetrics?.totalClients}</div>
                <div>With Policies: {data?.clientMetrics?.clientsWithPolicies}</div>
                <div>Individual: {data?.clientMetrics?.individualClients}</div>
                <div>Business: {data?.clientMetrics?.businessClients}</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Policies</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total: {data?.policyMetrics?.totalPolicies}</div>
                <div>Active: {data?.policyMetrics?.activePolicies}</div>
                <div>Pending: {data?.policyMetrics?.pendingPolicies}</div>
                <div>Expired: {data?.policyMetrics?.expiredPolicies}</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Financials</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Revenue: ${data?.financialMetrics?.totalRevenue?.toLocaleString()}</div>
                <div>Invoiced: ${data?.financialMetrics?.totalInvoiced?.toLocaleString()}</div>
                <div>Collection: {data?.financialMetrics?.collectionRate}%</div>
                <div>Overdue: ${data?.financialMetrics?.overdueAmount?.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 