import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Homestead',
  description: 'Personal apps on your own server.',
  cleanUrls: true,
  appearance: false,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/homestead-icon.png' }],
    [
      'meta',
      {
        name: 'description',
        content:
          'Homestead is a single-binary platform for personal apps with an agent-accessible backend.',
      },
    ],
  ],
  themeConfig: {
    search: {
      provider: 'local',
    },
  },
});
