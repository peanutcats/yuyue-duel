// Public matchmaking requires a separately deployed authority service.
// Enable only after configuring a compatible public wss:// endpoint and Origin.
// Leave serverUrl empty only when this website reverse-proxies /ws.
window.YY.MATCH_CONFIG = { serverUrl: '', enabled: false };
