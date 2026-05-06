'use client';

import React from 'react';
import { CalendarHeart, Edit, Trash2, MapPin, Users } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import {
  getNextEventOccurrence,
  parseDateString,
} from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { useEventsForPerson } from '../../events/hooks/useEventsForPerson';
import type { Event } from '../../events/types';
import { getMapUrl } from '../utils/mapUtils';
import type { Person } from '../types';

interface PersonCardProps {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
}

function badgeVariantForTag(
  tag?: string,
): 'birthday' | 'anniversary' | 'neutral' {
  if (tag === 'birthday') return 'birthday';
  if (tag === 'anniversary') return 'anniversary';
  return 'neutral';
}

function formatEventDate(event: Event): string {
  if (!event.date?.trim()) return '';
  const next = getNextEventOccurrence(
    parseDateString(event.date),
    event.recurrence,
    event.recurrence_rule,
  );
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function PersonCard({
  person,
  onEdit,
  onDelete,
}: PersonCardProps) {
  const { user } = useAuth();
  const partner = person.partner;
  const events = useEventsForPerson(person.id);

  const formatAddress = (address: Person['addresses'][0]): string => {
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const mapProvider = user?.map_provider || 'google';

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{person.name}</h3>
              {partner && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" aria-label="Partner icon" />
                  <span>{partner.name}</span>
                </div>
              )}
            </div>
            {events.length > 0 && (
              <ul className="mt-1 space-y-1">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-2 text-sm text-gray-600"
                    data-testid={`person-event-${event.id}`}
                  >
                    <CalendarHeart
                      className="w-4 h-4 text-brand-navy"
                      aria-label={`${event.tag ?? 'Event'} icon`}
                    />
                    <span>{formatEventDate(event)}</span>
                    {event.tag ? (
                      <Badge variant={badgeVariantForTag(event.tag)}>
                        {event.tag}
                      </Badge>
                    ) : (
                      <span className="text-gray-500">{event.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {person.addresses && person.addresses.length > 0 && (
              <div className="mt-1 space-y-2">
                {person.addresses.map((address, index) => {
                  const addressString = formatAddress(address);
                  const mapsUrl = getMapUrl(addressString, mapProvider);

                  return (
                    <div key={address.id || index}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-500" aria-label="Map pin icon" />
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline"
                        >
                          {addressString}
                        </a>
                      </div>
                      {address.wifi_network && (
                        <div className="ml-7 mt-1 text-xs text-gray-600">
                          <span className="font-medium">WiFi:</span> {address.wifi_network}
                          {address.wifi_password && (
                            <span className="ml-2 font-mono">{address.wifi_password}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(person)}
            aria-label={`Edit ${person.name}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDelete(person)}
            aria-label={`Delete ${person.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
