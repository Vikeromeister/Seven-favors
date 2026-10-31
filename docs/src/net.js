import { NET_CONFIG } from './net-config.js';

export const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LEN = 6;

export function normalizeRoomCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LEN);
}

export function isValidRoomCode(code) {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function generateRoomCode(rng = Math.random) {
  let result = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    const idx = Math.floor(rng() * ROOM_ALPHABET.length);
    result += ROOM_ALPHABET[idx];
  }
  return result;
}

export function peerIdForRoom(code) {
  return `${NET_CONFIG.roomPrefix}${normalizeRoomCode(code)}`;
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document is undefined in non-browser environment'));
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script from ${url}`));
    document.head.appendChild(script);
  });
}

export async function ensurePeerClass(PeerClass = null) {
  if (PeerClass) return PeerClass;
  if (typeof globalThis !== 'undefined' && globalThis.Peer) {
    return globalThis.Peer;
  }
  for (const url of NET_CONFIG.cdnUrls) {
    try {
      await loadScript(url);
      if (globalThis.Peer) {
        return globalThis.Peer;
      }
    } catch (_) {
      // try next url
    }
  }
  throw new Error('Could not load networking library. Check your internet connection.');
}

export function createNetSession(handlers = {}, options = {}) {
  const connectTimeoutMs = options.connectTimeoutMs ?? NET_CONFIG.connectTimeoutMs;
  const pingIntervalMs = options.pingIntervalMs ?? NET_CONFIG.pingIntervalMs;

  let peer = null;
  let activeConn = null;
  let role = null; // 'host' | 'guest' | null
  let roomCode = null;
  let closedByUs = false;
  let pingTimer = null;

  function startHeartbeat() {
    stopHeartbeat();
    pingTimer = setInterval(() => {
      if (activeConn && activeConn.open) {
        try {
          activeConn.send({ v: 1, type: 'ping' });
        } catch (_) {}
      }
    }, pingIntervalMs);
  }

  function stopHeartbeat() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function handlePeerDisconnect() {
    if (closedByUs) return;
    stopHeartbeat();
    if (activeConn) {
      try { activeConn.close(); } catch (_) {}
      activeConn = null;
    }
    handlers.onPeerLeft?.();
  }

  function handleConnData(data) {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ping') {
      if (activeConn && activeConn.open) {
        try {
          activeConn.send({ v: 1, type: 'pong' });
        } catch (_) {}
      }
      return;
    }
    if (data.type === 'pong') {
      return;
    }
    if (data.type === 'peer_left') {
      handlePeerDisconnect();
      return;
    }
    handlers.onMessage?.(data);
  }

  async function hostRoom(preferredCode = null) {
    if (peer) {
      close(false);
    }
    closedByUs = false;
    role = 'host';
    const PeerCtor = await ensurePeerClass(options.PeerClass);
    const maxAttempts = preferredCode ? 1 : 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = preferredCode && isValidRoomCode(normalizeRoomCode(preferredCode))
        ? normalizeRoomCode(preferredCode)
        : generateRoomCode();
      const pid = peerIdForRoom(code);

      try {
        const openResult = await new Promise((resolve, reject) => {
          let isOpened = false;
          const p = new PeerCtor(pid, NET_CONFIG.peerOptions);

          const timeout = setTimeout(() => {
            if (!isOpened) {
              try { p.destroy(); } catch (_) {}
              reject(new Error('Connection timed out while creating room.'));
            }
          }, connectTimeoutMs);

          p.on('open', () => {
            isOpened = true;
            clearTimeout(timeout);
            resolve({ peerInstance: p, code });
          });

          p.on('error', (err) => {
            if (!isOpened) {
              clearTimeout(timeout);
              try { p.destroy(); } catch (_) {}
              reject(err);
            } else {
              handlers.onError?.(err);
            }
          });
        });

        peer = openResult.peerInstance;
        roomCode = openResult.code;

        peer.on('connection', (conn) => {
          if (activeConn && activeConn.open) {
            // Room is full
            const sendRoomFull = () => {
              try {
                conn.send({ v: 1, type: 'room_full' });
                setTimeout(() => {
                  try { conn.close(); } catch (_) {}
                }, 100);
              } catch (_) {}
            };
            if (conn.open) {
              sendRoomFull();
            } else {
              conn.on('open', sendRoomFull);
            }
            return;
          }

          activeConn = conn;
          let greeted = false;

          conn.on('data', (data) => {
            if (data && data.type === 'hello') {
              if (!greeted) {
                greeted = true;
                startHeartbeat();
                try {
                  conn.send({ v: 1, type: 'welcome' });
                } catch (_) {}
                handlers.onGuestJoined?.({ roomCode });
              }
              return;
            }
            handleConnData(data);
          });

          conn.on('close', () => {
            if (activeConn === conn) {
              handlePeerDisconnect();
            }
          });

          conn.on('error', (err) => {
            if (activeConn === conn) {
              handlePeerDisconnect();
            }
          });
        });

        peer.on('close', () => {
          handlePeerDisconnect();
        });

        return { roomCode };
      } catch (err) {
        if (err && err.type === 'unavailable-id' && attempt < maxAttempts - 1) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to find an available room code. Please try again.');
  }

  async function joinRoom(rawCode) {
    if (peer) {
      close(false);
    }
    closedByUs = false;
    role = 'guest';
    const code = normalizeRoomCode(rawCode);
    if (!isValidRoomCode(code)) {
      throw new Error('Please enter a 6-character room code.');
    }
    roomCode = code;
    const PeerCtor = await ensurePeerClass(options.PeerClass);

    return new Promise((resolve, reject) => {
      let settled = false;
      const p = new PeerCtor(undefined, NET_CONFIG.peerOptions);
      peer = p;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          close(false);
          reject(new Error('Connection timed out while joining room.'));
        }
      }, connectTimeoutMs);

      function cleanupAndReject(err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          close(false);
          reject(err);
        }
      }

      p.on('open', () => {
        const targetPeerId = peerIdForRoom(code);
        const conn = p.connect(targetPeerId, { reliable: true, serialization: 'json' });
        activeConn = conn;

        const sendHello = () => {
          try {
            conn.send({ v: 1, type: 'hello' });
          } catch (_) {}
        };

        if (conn.open) {
          sendHello();
        } else {
          conn.on('open', sendHello);
        }

        conn.on('data', (data) => {
          if (data && data.type === 'welcome') {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            startHeartbeat();
            handlers.onJoinedHost?.({ roomCode: code });
            resolve({ roomCode: code });
            return;
          }
          if (data && data.type === 'room_full') {
            cleanupAndReject(new Error('That room already has two players.'));
            return;
          }
          handleConnData(data);
        });

        conn.on('close', () => {
          if (!settled) {
            cleanupAndReject(new Error('Connection closed before joining room.'));
          } else if (activeConn === conn) {
            handlePeerDisconnect();
          }
        });

        conn.on('error', (err) => {
          if (!settled) {
            cleanupAndReject(err);
          } else if (activeConn === conn) {
            handlePeerDisconnect();
          }
        });
      });

      p.on('error', (err) => {
        let mappedErr = err;
        if (err && err.type === 'peer-unavailable') {
          mappedErr = new Error('Room not found. Check the 6-character code and ensure the host has the room open.');
        }
        if (!settled) {
          cleanupAndReject(mappedErr);
        } else {
          handlers.onError?.(mappedErr);
        }
      });

      p.on('close', () => {
        if (!settled) {
          cleanupAndReject(new Error('Peer connection closed.'));
        } else {
          handlePeerDisconnect();
        }
      });
    });
  }

  function send(payload) {
    if (activeConn && activeConn.open) {
      try {
        activeConn.send({ v: 1, ...payload });
        return true;
      } catch (err) {
        console.error('Error sending message:', err);
        return false;
      }
    }
    return false;
  }

  function isConnected() {
    return Boolean(activeConn && activeConn.open);
  }

  function getRole() {
    return role;
  }

  function getRoomCode() {
    return roomCode;
  }

  function close(notifyPeer = false) {
    closedByUs = true;
    stopHeartbeat();
    if (notifyPeer && activeConn && activeConn.open) {
      try {
        activeConn.send({ v: 1, type: 'peer_left' });
      } catch (_) {}
    }
    if (activeConn) {
      try { activeConn.close(); } catch (_) {}
      activeConn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (_) {}
      peer = null;
    }
    role = null;
    roomCode = null;
  }

  return {
    hostRoom,
    joinRoom,
    send,
    isConnected,
    getRole,
    getRoomCode,
    close
  };
}
