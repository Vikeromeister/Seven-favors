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

export function generateClientId(rng = Math.random) {
  let result = '';
  for (let i = 0; i < 12; i++) {
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
  const pongTimeoutMs = options.pongTimeoutMs ?? NET_CONFIG.pongTimeoutMs;
  const clientId = options.clientId || generateClientId();

  let peer = null;
  let activeConn = null;
  let role = null; // 'host' | 'guest' | null
  let roomCode = null;
  let closedByUs = false;
  let peerLeftIntentionally = false;
  let hasHadGuest = false;
  let guestClientId = null;
  let pingTimer = null;
  let reconnectSignalingTimer = null;
  let lastRxAt = 0;

  function startHeartbeat() {
    stopHeartbeat();
    lastRxAt = Date.now();
    pingTimer = setInterval(() => {
      if (activeConn && activeConn.open) {
        if (Date.now() - lastRxAt > pongTimeoutMs) {
          try { activeConn.close(); } catch (_) {}
          handleUnexpectedDisconnect('heartbeat_timeout');
          return;
        }
        try {
          activeConn.send({ v: 1, type: 'ping' });
        } catch (_) {}
      }
    }, pingIntervalMs);
    pingTimer.unref?.();
  }

  function stopHeartbeat() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function attachSignalingRecovery(p) {
    p.on('disconnected', () => {
      if (!closedByUs && peer === p && !p.destroyed) {
        if (reconnectSignalingTimer) {
          clearTimeout(reconnectSignalingTimer);
          reconnectSignalingTimer = null;
        }
        reconnectSignalingTimer = setTimeout(() => {
          if (!closedByUs && peer === p && p.disconnected && !p.destroyed) {
            try { p.reconnect(); } catch (_) {}
          }
        }, 1000);
        reconnectSignalingTimer.unref?.();
      }
    });
  }

  function handleIntentionalPeerLeft() {
    peerLeftIntentionally = true;
    stopHeartbeat();
    if (activeConn) {
      try { activeConn.close(); } catch (_) {}
      activeConn = null;
    }
    handlers.onPeerLeft?.();
  }

  function handleUnexpectedDisconnect(reason = 'connection_interrupted') {
    if (closedByUs || peerLeftIntentionally) return;
    stopHeartbeat();
    if (activeConn) {
      try { activeConn.close(); } catch (_) {}
      activeConn = null;
    }
    if (handlers.onConnectionLost) {
      handlers.onConnectionLost({ roomCode, role, reason });
    } else {
      handlers.onPeerLeft?.();
    }
  }

  function handleConnData(data) {
    if (!data || typeof data !== 'object') return;
    lastRxAt = Date.now();
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
      handleIntentionalPeerLeft();
      return;
    }
    handlers.onMessage?.(data);
  }

  function connectGuestToHost(p, code, isReconnect = false) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const targetPeerId = peerIdForRoom(code);

      function detachPeerError() {
        if (p.off) {
          p.off('error', onPeerError);
        } else {
          p.removeListener?.('error', onPeerError);
        }
      }

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          detachPeerError();
          try { conn.close(); } catch (_) {}
          if (!isReconnect) {
            close(false);
          }
          reject(new Error(isReconnect ? 'Connection timed out while reconnecting.' : 'Connection timed out while joining room.'));
        }
      }, connectTimeoutMs);
      timeout.unref?.();

      function cleanupAndReject(err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          detachPeerError();
          try { conn.close(); } catch (_) {}
          if (!isReconnect) {
            close(false);
          }
          reject(err);
        }
      }

      const onPeerError = (err) => {
        if (err && err.type === 'peer-unavailable') {
          cleanupAndReject(new Error('Room not found. Check the 6-character code and ensure the host has the room open.'));
        }
      };
      p.on('error', onPeerError);

      const conn = p.connect(targetPeerId, { reliable: true, serialization: 'json' });

      const sendHello = () => {
        try {
          conn.send({ v: 1, type: 'hello', clientId });
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
          detachPeerError();
          activeConn = conn;
          peerLeftIntentionally = false;
          lastRxAt = Date.now();
          startHeartbeat();
          handlers.onJoinedHost?.({ roomCode: code, resumed: Boolean(data.resumed) });
          resolve({ roomCode: code, resumed: Boolean(data.resumed) });
          return;
        }
        if (data && data.type === 'room_full') {
          cleanupAndReject(new Error('That room already has two players.'));
          return;
        }
        if (activeConn === conn) {
          handleConnData(data);
        }
      });

      conn.on('close', () => {
        if (!settled) {
          cleanupAndReject(new Error('Connection closed before joining room.'));
        } else if (activeConn === conn) {
          handleUnexpectedDisconnect('conn_closed');
        }
      });

      conn.on('error', (err) => {
        if (!settled) {
          cleanupAndReject(err);
        } else if (activeConn === conn) {
          handleUnexpectedDisconnect('conn_error');
        }
      });
    });
  }

  async function hostRoom(preferredCode = null, extraOpts = {}) {
    if (peer && !extraOpts.keepGuestState) {
      close(false);
    }
    closedByUs = false;
    peerLeftIntentionally = false;
    role = 'host';
    if (!extraOpts.keepGuestState) {
      hasHadGuest = false;
      guestClientId = null;
    }
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
          timeout.unref?.();

          p.on('open', () => {
            isOpened = true;
            clearTimeout(timeout);
            attachSignalingRecovery(p);
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

        if (peer && peer !== openResult.peerInstance) {
          try { peer.destroy(); } catch (_) {}
        }
        peer = openResult.peerInstance;
        roomCode = openResult.code;

        peer.on('connection', (conn) => {
          let greeted = false;
          const handshakeTimer = setTimeout(() => {
            if (!greeted) {
              try { conn.close(); } catch (_) {}
            }
          }, 8000);
          handshakeTimer.unref?.();

          conn.on('data', (data) => {
            if (!greeted && data && data.type === 'hello') {
              greeted = true;
              clearTimeout(handshakeTimer);
              const incomingClientId = typeof data.clientId === 'string' ? data.clientId : null;
              const isSameGuestReconnecting = Boolean(hasHadGuest && guestClientId && incomingClientId === guestClientId);

              if (activeConn && activeConn.open && !isSameGuestReconnecting) {
                // Room is full for other guests
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

              // Replace stale connection if activeConn was half-open for same guest
              if (activeConn && activeConn !== conn) {
                const stale = activeConn;
                activeConn = null;
                try { stale.close(); } catch (_) {}
              }

              const isResume = hasHadGuest;
              hasHadGuest = true;
              guestClientId = incomingClientId;
              peerLeftIntentionally = false;
              activeConn = conn;
              lastRxAt = Date.now();
              startHeartbeat();

              try {
                conn.send({ v: 1, type: 'welcome', resumed: isResume });
              } catch (_) {}

              if (isResume && handlers.onGuestReconnected) {
                handlers.onGuestReconnected({ roomCode });
              } else {
                handlers.onGuestJoined?.({ roomCode });
              }
              return;
            }

            if (greeted && activeConn === conn) {
              handleConnData(data);
            }
          });

          conn.on('close', () => {
            if (activeConn === conn) {
              handleUnexpectedDisconnect('conn_closed');
            }
          });

          conn.on('error', (err) => {
            if (activeConn === conn) {
              handleUnexpectedDisconnect('conn_error');
            }
          });
        });

        peer.on('close', () => {
          if (peer === openResult.peerInstance && !closedByUs && (!activeConn || !activeConn.open)) {
            handleUnexpectedDisconnect('peer_closed');
          }
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
    peerLeftIntentionally = false;
    role = 'guest';
    const code = normalizeRoomCode(rawCode);
    if (!isValidRoomCode(code)) {
      throw new Error('Please enter a 6-character room code.');
    }
    roomCode = code;
    const PeerCtor = await ensurePeerClass(options.PeerClass);

    return new Promise((resolve, reject) => {
      let peerSettled = false;
      const p = new PeerCtor(undefined, NET_CONFIG.peerOptions);
      peer = p;

      const peerTimeout = setTimeout(() => {
        if (!peerSettled) {
          peerSettled = true;
          close(false);
          reject(new Error('Connection timed out while joining room.'));
        }
      }, connectTimeoutMs);
      peerTimeout.unref?.();

      p.on('open', () => {
        if (peerSettled) return;
        peerSettled = true;
        clearTimeout(peerTimeout);
        attachSignalingRecovery(p);
        connectGuestToHost(p, code, false).then(resolve, reject);
      });

      p.on('error', (err) => {
        let mappedErr = err;
        if (err && err.type === 'peer-unavailable') {
          mappedErr = new Error('Room not found. Check the 6-character code and ensure the host has the room open.');
        }
        if (!peerSettled) {
          peerSettled = true;
          clearTimeout(peerTimeout);
          close(false);
          reject(mappedErr);
        } else {
          handlers.onError?.(mappedErr);
        }
      });

      p.on('close', () => {
        if (!peerSettled) {
          peerSettled = true;
          clearTimeout(peerTimeout);
          close(false);
          reject(new Error('Peer connection closed.'));
        } else if (peer === p && !closedByUs && (!activeConn || !activeConn.open)) {
          handleUnexpectedDisconnect('peer_closed');
        }
      });
    });
  }

  async function reconnect() {
    if (closedByUs || !role || !roomCode) {
      throw new Error('No active online session to reconnect.');
    }
    peerLeftIntentionally = false;
    const PeerCtor = await ensurePeerClass(options.PeerClass);

    if (role === 'host') {
      if (peer && !peer.destroyed) {
        if (peer.disconnected) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Signaling reconnect timed out.'));
            }, connectTimeoutMs);
            timeout.unref?.();

            const cleanup = () => {
              clearTimeout(timeout);
              peer.off?.('open', onOpen);
              peer.off?.('error', onErr);
              peer.removeListener?.('open', onOpen);
              peer.removeListener?.('error', onErr);
            };
            const onOpen = () => {
              cleanup();
              resolve();
            };
            const onErr = (e) => {
              cleanup();
              reject(e);
            };
            if (peer.once) {
              peer.once('open', onOpen);
              peer.once('error', onErr);
            } else {
              peer.on('open', onOpen);
              peer.on('error', onErr);
            }
            try {
              peer.reconnect();
            } catch (err) {
              cleanup();
              reject(err);
            }
          }).catch(async () => {
            await hostRoom(roomCode, { keepGuestState: true });
          });
        }
        return { roomCode, connected: isConnected() };
      }
      await hostRoom(roomCode, { keepGuestState: true });
      return { roomCode, connected: isConnected() };
    }

    if (role === 'guest') {
      stopHeartbeat();
      if (activeConn) {
        try { activeConn.close(); } catch (_) {}
        activeConn = null;
      }
      let guestPeer = peer;
      if (!guestPeer || guestPeer.destroyed) {
        guestPeer = await new Promise((resolve, reject) => {
          let isOpened = false;
          const p = new PeerCtor(undefined, NET_CONFIG.peerOptions);
          const timeout = setTimeout(() => {
            if (!isOpened) {
              try { p.destroy(); } catch (_) {}
              reject(new Error('Connection timed out while reconnecting.'));
            }
          }, connectTimeoutMs);
          timeout.unref?.();

          p.on('open', () => {
            isOpened = true;
            clearTimeout(timeout);
            resolve(p);
          });
          p.on('error', (err) => {
            if (!isOpened) {
              clearTimeout(timeout);
              try { p.destroy(); } catch (_) {}
              reject(err);
            }
          });
        });
        peer = guestPeer;
        attachSignalingRecovery(guestPeer);
      } else if (guestPeer.disconnected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Signaling reconnect timed out.'));
          }, connectTimeoutMs);
          timeout.unref?.();

          const cleanup = () => {
            clearTimeout(timeout);
            guestPeer.off?.('open', onOpen);
            guestPeer.off?.('error', onErr);
            guestPeer.removeListener?.('open', onOpen);
            guestPeer.removeListener?.('error', onErr);
          };
          const onOpen = () => {
            cleanup();
            resolve();
          };
          const onErr = (e) => {
            cleanup();
            reject(e);
          };
          if (guestPeer.once) {
            guestPeer.once('open', onOpen);
            guestPeer.once('error', onErr);
          } else {
            guestPeer.on('open', onOpen);
            guestPeer.on('error', onErr);
          }
          try {
            guestPeer.reconnect();
          } catch (err) {
            cleanup();
            reject(err);
          }
        }).catch(async () => {
          try { guestPeer.destroy(); } catch (_) {}
          peer = null;
          return reconnect();
        });
      }

      return await connectGuestToHost(peer, roomCode, true);
    }

    throw new Error('Invalid session role for reconnect.');
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

  function getClientId() {
    return clientId;
  }

  function close(notifyPeer = false) {
    closedByUs = true;
    peerLeftIntentionally = true;
    stopHeartbeat();
    if (reconnectSignalingTimer) {
      clearTimeout(reconnectSignalingTimer);
      reconnectSignalingTimer = null;
    }
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
    hasHadGuest = false;
    guestClientId = null;
  }

  return {
    hostRoom,
    joinRoom,
    reconnect,
    send,
    isConnected,
    getRole,
    getRoomCode,
    getClientId,
    close
  };
}
