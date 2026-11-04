'use strict';
module.exports = {
  appId: 'wx4c24e883bac82367',
  version: '1.0.3',
  // Cloud SDK transport does not require a manually configured socket domain.
  // Use 'socket' only for explicit public WSS/local testing; 'off' disables online.
  networkTransport: 'cloud',
  cloud: { env: 'prod-d9g91zv98490ac83f', service: 'express-gtlm', path: '/ws' },
  // Retained for explicit socket mode and diagnostics; never an automatic fallback.
  serverUrl: 'wss://express-gtlm-341234-6-1525027827.sh.run.tcloudbase.com/ws',
  shareTitle: '羽跃对决｜来一场羽毛球！',
  maxPixelRatio: 2,
};
