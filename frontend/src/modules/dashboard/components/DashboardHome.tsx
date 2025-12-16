/**
 * Dashboard Home Component
 *
 * Home screen showing all available modules for easy access
 */


import { useAuth } from '@/core/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { getNavigationModules } from '@/modules/registry';
import { ArrowRight } from 'lucide-react';

export function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const modules = getNavigationModules().filter(m => m.id !== 'dashboard');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name || 'User'}
        </h1>
        <p className="mt-2 text-gray-600">
          Choose a module to get started
        </p>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => navigate(module.basePath)}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg hover:border-primary-300 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                    <Icon className="w-8 h-8 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                      {module.name}
                    </h3>
                    {module.description && (
                      <p className="mt-1 text-sm text-gray-600">
                        {module.description}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {modules.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 border border-gray-200 text-center">
          <p className="text-gray-600">
            No modules available. Contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
}
