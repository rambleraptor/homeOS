import { test, expect } from 'vitest';
import {
  parseInterval,
  renderMainService,
  renderUpdateService,
  renderUpdateTimer,
} from './service.ts';

test('parseInterval understands suffixes and bare minutes', () => {
  expect(parseInterval('30s')).toBe(30);
  expect(parseInterval('5m')).toBe(300);
  expect(parseInterval('5min')).toBe(300);
  expect(parseInterval('2h')).toBe(7200);
  expect(parseInterval('5')).toBe(300); // bare number => minutes
  expect(parseInterval(' 10m ')).toBe(600);
});

test('parseInterval rejects garbage and non-positive values', () => {
  expect(() => parseInterval('soon')).toThrow();
  expect(() => parseInterval('0m')).toThrow();
  expect(() => parseInterval('')).toThrow();
});

const params = {
  projectDir: '/srv/homestead',
  serviceName: 'homestead',
  user: 'homie',
  port: 3000,
  dataDir: '/srv/homestead/data',
  intervalSeconds: 300,
  invocation: '/usr/local/bin/homestead',
  cacheDir: '/srv/homestead/.homestead/cache',
  envFile: '/srv/homestead/.env',
};

test('main service runs `homestead start` as the configured user', () => {
  const unit = renderMainService(params);
  expect(unit).toContain('User=homie');
  expect(unit).toContain(
    'ExecStart=/usr/local/bin/homestead start --port 3000 --data-dir /srv/homestead/data',
  );
  expect(unit).toContain('EnvironmentFile=/srv/homestead/.env');
  expect(unit).toContain('ReadWritePaths=/srv/homestead/data /srv/homestead/.homestead/cache');
});

test('main service omits EnvironmentFile when none is configured', () => {
  const unit = renderMainService({ ...params, envFile: undefined });
  expect(unit).not.toContain('EnvironmentFile=');
});

test('update service runs `homestead update` for the named service', () => {
  const unit = renderUpdateService(params);
  expect(unit).toContain('Type=oneshot');
  expect(unit).toContain('User=homie');
  expect(unit).toContain(
    'ExecStart=/usr/local/bin/homestead update --service-name homestead',
  );
});

test('timer fires on the configured interval and catches up missed runs', () => {
  const unit = renderUpdateTimer(params);
  expect(unit).toContain('OnUnitActiveSec=300s');
  expect(unit).toContain('Requires=homestead-update.service');
  expect(unit).toContain('Persistent=true');
});
