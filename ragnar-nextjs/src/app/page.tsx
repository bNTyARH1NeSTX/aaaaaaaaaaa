import { FileText, MessageSquare, Search, BookOpen, BarChart2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const stats = [
  { name: 'Total Documents', value: '1,234', icon: FileText, change: '+12%' },
  { name: 'Chat Sessions', value: '89', icon: MessageSquare, change: '+5%' },
  { name: 'Searches Today', value: '456', icon: Search, change: '+23%' },
  { name: 'Generated Manuals', value: '23', icon: BookOpen, change: '+8%' },
];

const quickActions = [
  { name: 'Start Chat', href: '/chat', icon: MessageSquare, color: 'bg-blue-500' },
  { name: 'Upload Document', href: '/documents', icon: FileText, color: 'bg-green-500' },
  { name: 'Generate Manual', href: '/manuals', icon: BookOpen, color: 'bg-purple-500' },
  { name: 'View Graphs', href: '/graphs', icon: BarChart2, color: 'bg-orange-500' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back! Here&apos;s what&apos;s happening with your documents and AI assistant.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className="flex items-center space-x-2">
                <stat.icon className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 ml-1">{stat.change}</span>
              <span className="text-sm text-gray-500 ml-1">from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`${action.color} p-3 rounded-lg`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">{action.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { action: 'Generated manual for Project Alpha', time: '2 hours ago', icon: BookOpen },
            { action: 'Uploaded document: Research Report.pdf', time: '4 hours ago', icon: FileText },
            { action: 'Chat session with AI assistant', time: '6 hours ago', icon: MessageSquare },
            { action: 'Created knowledge graph for Q4 data', time: '1 day ago', icon: BarChart2 },
          ].map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 py-2">
              <activity.icon className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}