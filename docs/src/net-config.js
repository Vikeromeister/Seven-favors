export const NET_CONFIG = {
  roomPrefix: 'seven-favors-v1-',
  connectTimeoutMs: 12000,
  pingIntervalMs: 15000,
  cdnUrls: [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
  ],
  peerOptions: {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
        // Optional TURN server for strict mobile / corporate symmetric NATs:
        // {
        //   urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
        //   username: 'YOUR_TURN_USERNAME',
        //   credential: 'YOUR_TURN_PASSWORD'
        // }
      ]
    }
  }
};
