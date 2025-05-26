import { BarChart2, Network, Zap, Settings as SettingsIcon } from 'lucide-react';

export default function GraphsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-blue-600" />
          Knowledge Graphs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Visualize relationships and connections in your document collection
        </p>
      </div>

      {/* Graph Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-8 h-8 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Entity Graph</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Visualize entities and their relationships across documents
          </p>
          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors">
            Generate Entity Graph
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Topic Graph</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Explore topic clusters and semantic relationships
          </p>
          <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-md transition-colors">
            Generate Topic Graph
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Graph</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create custom visualizations with specific parameters
          </p>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors">
            Configure Graph
          </button>
        </div>
      </div>

      {/* Graph Visualization Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Graph Visualization
        </h2>
        
        <div className="h-96 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No graph generated yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a graph type above to visualize your data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
