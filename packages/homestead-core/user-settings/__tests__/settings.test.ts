import { describe, expect, it } from 'vitest';
import {
  buildSchemaProperties,
  fieldName,
  parseFieldName,
  unflatten,
  withDefaults,
  type UserSettingDefs,
} from '../settings';

const defs: UserSettingDefs = {
  people: {
    map_provider: {
      type: 'enum',
      label: 'Map provider',
      description: 'Which map service to use.',
      options: ['google', 'apple'],
      default: 'google',
    },
  },
  events: {
    countdown_event_id: {
      type: 'string',
      label: 'Countdown event',
      description: 'Id of the countdown target event.',
      default: '',
    },
    countdown_show_days: {
      type: 'boolean',
      label: 'Show days',
      description: 'Show the days unit on the countdown widget.',
      default: true,
    },
  },
};

describe('fieldName / parseFieldName', () => {
  it('flattens a kebab-case app id to snake_case with a double-underscore separator', () => {
    expect(fieldName('people', 'map_provider')).toBe('people__map_provider');
    expect(fieldName('gift-cards', 'show_archived')).toBe(
      'gift_cards__show_archived',
    );
  });

  it('round-trips to the original app id and key', () => {
    expect(parseFieldName('people__map_provider')).toEqual({
      appId: 'people',
      key: 'map_provider',
    });
    expect(parseFieldName('gift_cards__show_archived')).toEqual({
      appId: 'gift-cards',
      key: 'show_archived',
    });
  });

  it('returns null when the separator is missing', () => {
    expect(parseFieldName('id')).toBeNull();
    expect(parseFieldName('create_time')).toBeNull();
    expect(parseFieldName('map_provider')).toBeNull();
  });
});

describe('unflatten', () => {
  it('parses aepbase flat fields back into the nested tree', () => {
    const nested = unflatten(
      {
        id: 'abc',
        create_time: '2024-01-01',
        people__map_provider: 'apple',
        events__countdown_event_id: 'event-123',
        events__countdown_show_days: false,
      },
      defs,
    );
    expect(nested).toEqual({
      people: { map_provider: 'apple' },
      events: { countdown_event_id: 'event-123', countdown_show_days: false },
    });
  });

  it('drops values that are not in the allowed enum options', () => {
    const nested = unflatten({ people__map_provider: 'bing' }, defs);
    expect(nested.people.map_provider).toBe('google');
  });

  it('merges defaults for unset keys', () => {
    const nested = unflatten({}, defs);
    expect(nested).toEqual({
      people: { map_provider: 'google' },
      events: { countdown_event_id: '', countdown_show_days: true },
    });
  });

  it('handles a null record gracefully', () => {
    expect(unflatten(null, defs).people.map_provider).toBe('google');
  });
});

describe('withDefaults', () => {
  it('leaves existing values alone and fills in defaults only where missing', () => {
    const merged = withDefaults(defs, {
      people: { map_provider: 'apple' },
    });
    expect(merged.people.map_provider).toBe('apple');
    expect(merged.events.countdown_event_id).toBe('');
    expect(merged.events.countdown_show_days).toBe(true);
  });
});

describe('buildSchemaProperties', () => {
  it('produces one alphabetically-sorted property per declared setting', () => {
    const properties = buildSchemaProperties(defs);
    expect(Object.keys(properties)).toEqual([
      'events__countdown_event_id',
      'events__countdown_show_days',
      'people__map_provider',
    ]);
  });

  it('encodes enum options and defaults into the description', () => {
    const properties = buildSchemaProperties(defs);
    expect(properties.people__map_provider).toEqual({
      type: 'string',
      description: expect.stringContaining('google, apple'),
    });
    expect(properties.people__map_provider.description).toContain(
      '(default: google)',
    );
    expect(properties.events__countdown_show_days.type).toBe('boolean');
    expect(properties.events__countdown_show_days.description).toContain(
      '(default: true)',
    );
  });
});
