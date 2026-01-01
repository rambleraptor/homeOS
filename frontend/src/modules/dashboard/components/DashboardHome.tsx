'use client';

/**
 * Dashboard Home Component
 *
 * Home screen showing upcoming birthdays and anniversaries
 */

import { useRouter } from 'next/navigation';
import { useAuth } from '@/core/auth/useAuth';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { useUpcomingPeople } from '../hooks/useUpcomingPeople';
import { format } from 'date-fns';
import { getTodaysHoliday } from '@/shared/utils/dateUtils';

export function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: upcomingPeople, isLoading: peopleLoading } = useUpcomingPeople();
  const todaysHoliday = getTodaysHoliday();

  const getGreeting = () => {
    if (todaysHoliday) {
      return todaysHoliday.message;
    }
    return user?.name ? `Welcome back, ${user.name}` : 'Welcome back';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl">
        {/* Upcoming Birthdays & Anniversaries Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Upcoming Birthdays & Anniversaries
                </h2>
              </div>
              <button
                onClick={() => router.push('/people')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {peopleLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : upcomingPeople && upcomingPeople.length > 0 ? (
              <div className="space-y-4">
                {upcomingPeople.map(({ person, type, date }) => {
                  const daysUntil = Math.ceil(
                    (date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={`${person.id}-${type}`}
                      className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                      onClick={() => router.push('/people')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {person.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">
                              {format(date, 'MMM dd')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {daysUntil === 0
                                ? 'Today'
                                : daysUntil === 1
                                ? 'Tomorrow'
                                : `in ${daysUntil} days`}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            type === 'Birthday'
                              ? 'bg-pink-100 text-pink-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming birthdays or anniversaries in the next 30 days</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
