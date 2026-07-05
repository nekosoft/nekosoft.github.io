// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ludahex.nl',

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
    },
  },

  // Old Hugo paths kept alive as meta-refresh stubs so existing
  // deep links (and search results) don't break after the rewrite.
  redirects: {
    '/web_recon_docs': '/docs/web-recon',
    '/web_recon_docs/recon_intro': '/docs/web-recon/recon-intro',
    '/web_recon_docs/web_reconnaissance': '/docs/web-recon/web-reconnaissance',
    '/web_recon_docs/domains': '/docs/web-recon/domains',
    '/web_recon_docs/domains/domains': '/docs/web-recon/domains/domains',
    '/web_recon_docs/domains/urls': '/docs/web-recon/domains/urls',
    '/web_recon_docs/domains/service_enumeration': '/docs/web-recon/domains/service-enumeration',
    '/iot_docs': '/docs/iot',
    '/iot_docs/radio_gaga': '/docs/iot/radio-gaga',
  },
});
