import { test, expect } from 'vitest';
import { renderMainService } from './service.ts';

const params = {
  projectDir: '/srv/homestead',
  serviceName: 'homestead',
  user: 'homie',
  port: 3000,
  dataDir: '/srv/homestead/data',
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
