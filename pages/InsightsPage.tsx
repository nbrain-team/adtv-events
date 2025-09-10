import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import api from '../services/api';
import { useAuthStore } from '../services/auth.store';
import Modal from '../components/Modal';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function InsightsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'clients' | 'ai'>('overview');
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Fetch insights data
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['insights', user?.id, user?.role],
    queryFn: async () => {
      const response = await api.get('/insights', {
        params: {
          userId: user?.id,
          userRole: user?.role,
        },
      });
      return response.data.data;
    },
    enabled: !!user,
  });

  const handleAIQuery = async () => {
    if (!aiQuery.trim()) return;

    const userMessage = aiQuery;
    setAiQuery('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAiLoading(true);

    try {
      const response = await api.post('/ai/insights', {
        query: userMessage,
        context: 'payment_analytics',
      });

      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.data.content 
      }]);
    } catch (error) {
      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I encountered an error analyzing your data. Please try rephrasing your question.' 
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle opening chat with pre-populated question
  const openChatWithQuestion = (question: string) => {
    setAiQuery(question);
    setShowAIChat(true);
    // Auto-submit the question after a brief delay
    setTimeout(() => {
      if (question) {
        handleAIQuery();
      }
    }, 100);
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading insights...</div>;
  }

  const data = insights || {};

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Insights Dashboard</h1>
        <button
          onClick={() => setShowAIChat(true)}
          className="btn-primary btn-md"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask AI Assistant
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'agents', 'clients', 'ai'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'ai' ? 'AI Insights' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                ${data.totalRevenue?.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-sm text-success-600">
                +{data.revenueGrowth || 0}% from last month
              </p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Active Policies</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {data.activePolicies || 0}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {data.newPoliciesThisMonth || 0} new this month
              </p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Collection Rate</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {data.collectionRate || 0}%
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {data.overdueAmount ? `$${data.overdueAmount.toLocaleString()} overdue` : 'No overdue'}
              </p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Avg Days to Pay</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {data.avgDaysToPay || 0}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {data.daysToPayTrend || 0}% vs last month
              </p>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: data.revenueTrend?.labels || [],
                    datasets: [
                      {
                        label: 'Revenue',
                        data: data.revenueTrend?.values || [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true,
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: ['Credit Card', 'ACH', 'Check', 'Wire'],
                    datasets: [
                      {
                        data: data.paymentMethods || [40, 30, 20, 10],
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(251, 146, 60, 0.8)',
                          'rgba(147, 51, 234, 0.8)',
                        ],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Policy Distribution */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Distribution by Type</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: data.policyTypes?.labels || [],
                    datasets: [
                      {
                        label: 'Policies',
                        data: data.policyTypes?.values || [],
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            {/* Reconciliation Status */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reconciliation Status</h3>
              <div className="h-64">
                <Pie
                  data={{
                    labels: ['Matched', 'Partially Matched', 'Unmatched', 'Disputed'],
                    datasets: [
                      {
                        data: data.reconciliationStatus || [70, 15, 10, 5],
                        backgroundColor: [
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(251, 146, 60, 0.8)',
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(156, 163, 175, 0.8)',
                        ],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          {/* Agent Performance */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Performance</h3>
            <div className="h-96">
              <Bar
                data={{
                  labels: data.agentPerformance?.labels || [],
                  datasets: [
                    {
                      label: 'Premium Collected',
                      data: data.agentPerformance?.premiums || [],
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    },
                    {
                      label: 'Policies',
                      data: data.agentPerformance?.policies || [],
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                  scales: {
                    x: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Agent Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Top Performer</h4>
              <p className="text-lg font-semibold">{data.topAgent?.name || 'N/A'}</p>
              <p className="text-sm text-gray-600">${data.topAgent?.premium?.toLocaleString() || 0} in premiums</p>
              <p className="text-xs text-gray-500 mt-1">{data.topAgent?.policies || 0} policies</p>
            </div>
            <div className="card">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Average Premium per Agent</h4>
              <p className="text-lg font-semibold">${data.avgPremiumPerAgent?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-600">{data.totalAgents || 0} active agents</p>
            </div>
            <div className="card">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Agent Retention</h4>
              <p className="text-lg font-semibold">{data.agentRetention || 0}%</p>
              <p className="text-sm text-gray-600">Based on active status</p>
            </div>
          </div>

          {/* Detailed Agent Table */}
          {data.agentMetrics && data.agentMetrics.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Policies
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clients
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Premium
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Collected
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversion Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.agentMetrics.map((agent: any) => (
                      <tr key={agent.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            <div className="text-sm text-gray-500">{agent.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {agent.policies}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {agent.clients}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${agent.premium.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${agent.collected.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900">{agent.conversionRate}%</span>
                            <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full"
                                style={{ width: `${agent.conversionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          {/* Client Segments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Client Segments</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: ['Individual', 'Small Business', 'Enterprise'],
                    datasets: [
                      {
                        data: data.clientSegments || [60, 30, 10],
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(147, 51, 234, 0.8)',
                        ],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Behavior</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: ['On Time', 'Late (<30d)', 'Late (>30d)', 'Default'],
                    datasets: [
                      {
                        label: 'Clients',
                        data: data.paymentBehavior || [70, 20, 8, 2],
                        backgroundColor: [
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(251, 146, 60, 0.8)',
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(156, 163, 175, 0.8)',
                        ],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          {/* Client Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Total Clients</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{data.totalClients || 0}</p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Client Retention</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{data.clientRetention || 0}%</p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Avg Policies per Client</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{data.avgPoliciesPerClient || 0}</p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Client Lifetime Value</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">${data.avgClientValue?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">AI-Generated Insights</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => refetch()}
                  className="btn-outline btn-sm"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Insights
                </button>
                <button
                  onClick={() => setShowAIChat(true)}
                  className="btn-primary btn-sm"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ask Question
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {data.aiInsights?.map((insight: any, index: number) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      insight.type === 'positive' ? 'bg-success-100' :
                      insight.type === 'warning' ? 'bg-warning-100' :
                      'bg-primary-100'
                    }`}>
                      <svg className={`h-5 w-5 ${
                        insight.type === 'positive' ? 'text-success-600' :
                        insight.type === 'warning' ? 'text-warning-600' :
                        'text-primary-600'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                      {insight.recommendation && (
                        <p className="mt-2 text-sm text-primary-600">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!data.aiInsights || data.aiInsights.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <p>No insights available. Click "Refresh Insights" to generate new insights.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Predictive Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Payment Default Risk</p>
                <p className="mt-1 text-2xl font-semibold text-error-600">{data.defaultRisk || 0}%</p>
                <p className="mt-1 text-xs text-gray-500">Next 30 days</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Expected Collections</p>
                <p className="mt-1 text-2xl font-semibold text-success-600">${data.expectedCollections?.toLocaleString() || 0}</p>
                <p className="mt-1 text-xs text-gray-500">Next 30 days</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Churn Probability</p>
                <p className="mt-1 text-2xl font-semibold text-warning-600">{data.churnProbability || 0}%</p>
                <p className="mt-1 text-xs text-gray-500">High-risk clients</p>
              </div>
            </div>
          </div>

          {/* Quick Insights Questions */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Questions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "What are my top performing agents this month?",
                "Which clients are at risk of churning?",
                "What's my collection rate trend?",
                "Show me overdue payments by agent",
                "Which payment methods are most profitable?",
                "What policies are expiring soon?"
              ].map((question, index) => (
                <button
                  key={index}
                  onClick={() => openChatWithQuestion(question)}
                  className="text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm text-gray-700">{question}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      <Modal
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        title="AI Analytics Assistant"
      >
        <div className="flex flex-col h-96">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.length === 0 ? (
              <div className="text-center text-gray-500">
                <p>Ask me anything about your payment data!</p>
                <p className="text-sm mt-2">Example questions:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>"What's our collection rate trend?"</li>
                  <li>"Which agents are top performers?"</li>
                  <li>"Show me overdue payments by client"</li>
                  <li>"What's the average payment delay?"</li>
                </ul>
              </div>
            ) : (
              <>
                {aiMessages.length > 0 && (
                  <div className="text-center mb-2">
                    <button
                      onClick={() => setAiMessages([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear chat history
                    </button>
                  </div>
                )}
                {aiMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`${
                      message.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {isAiLoading && (
              <div className="text-left">
                <div className="inline-block p-3 rounded-lg bg-gray-100">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAIQuery()}
                placeholder="Ask about your data..."
                className="input flex-1"
                disabled={isAiLoading}
              />
              <button
                onClick={handleAIQuery}
                disabled={isAiLoading || !aiQuery.trim()}
                className="btn-primary btn-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
} 