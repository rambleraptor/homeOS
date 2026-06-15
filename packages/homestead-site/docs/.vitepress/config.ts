import { defineConfig } from 'vitepress';

const tagline = 'Build and deploy apps for you, your family, and your agents.';
const siteUrl = 'https://myhomestead.dev';

export default defineConfig({
  title: 'Homestead',
  description: tagline,
  cleanUrls: true,
  appearance: false,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/homestead-icon.png' }],
    ['meta', { name: 'description', content: tagline }],
    ['meta', { property: 'og:title', content: 'Homestead' }],
    ['meta', { property: 'og:description', content: tagline }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Homestead' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/homestead-icon.png` }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'theme-color', content: '#1f3a2e' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340..680;1,9..144,340..560&family=Outfit:wght@300..600&display=swap',
      },
    ],
  ],
  transformHead({ pageData }) {
    const path = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '');
    const canonical = `${siteUrl}/${path}`;
    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
    ];
  },
  themeConfig: {
    logo: '/homestead-icon.png',
    siteTitle: 'Homestead',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Apps', link: '/apps' },
      { text: 'Docs', link: '/guides/' },
      { text: 'GitHub', link: 'https://github.com/rambleraptor/homestead' },
    ],
    sidebar: {
      '/guides/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/guides/installation' },
            { text: 'Quick Start', link: '/guides/quick-start' },
          ],
        },
        {
          text: 'App Development',
          items: [
            { text: 'Defining Resources', link: '/guides/resources' },
            { text: 'State Management', link: '/guides/state-management' },
            { text: 'Dashboard Widgets', link: '/guides/widgets' },
            { text: 'App Flags', link: '/guides/app-flags' },
            { text: 'Notifications', link: '/guides/notifications' },
            { text: 'Bulk Import', link: '/guides/bulk-import' },
            { text: 'AI Support', link: '/guides/ai' },
          ],
        },
        {
          text: 'Using Homestead',
          items: [
            { text: 'Creating Users', link: '/guides/users' },
            { text: 'Access & Tags', link: '/guides/access' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/rambleraptor/homestead' },
    ],
    search: {
      provider: 'local',
    },
  },
});
