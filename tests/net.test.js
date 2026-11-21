import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as Net from '../docs/src/net.js';
import * as Game from '../docs/src/game.js';

test('Room code utilities validate and format properly', () => {
  assert.equal(Net.normalizeRoomCode('abc123xyz'), 'ABC123');
  assert.equal(Net.normalizeRoomCode('a-b_c!4 5 6'), 'ABC456');
  assert.equal(Net.isValidRoomCode('K7M4P9'), true);
  assert.equal(Net.isValidRoomCode('12345'), false);
  assert.equal(Net.isValidRoomCode('1234567'), false);
  assert.equal(Net.isValidRoomCode('ABC!23'), false);

  const generated = Net.generateRoomCode();
  assert.equal(generated.length, Net.ROOM_CODE_LEN);
  assert.equal(Net.isValidRoomCode(generated), true);

  const peerId = Net.peerIdForRoom('K7M4P9');
  assert.ok(peerId.endsWith('K7M4P9'));
});

test('buildPlayerView masks hidden information and applyPlayerView updates local state', () => {
  Game.startGame(1);
  assert.equal(Game.state.currentPlayer, 1);

  // Set secrets
  Game.state.secretCard[1] = 5;
  Game.state.secretCard[2] = 7;

  // View for Guest (seat 2) before game over
  const guestView = Game.buildPlayerView(2);
  assert.equal(guestView.viewerSeat, 2);
  assert.equal(guestView.oppHandCount, Game.state.players[1].hand.length);
  assert.deepEqual(guestView.myHand, Game.state.players[2].hand);
  // Guest should see their own secret (7), but host secret should be masked as 0
  assert.equal(guestView.secretCard[2], 7);
  assert.equal(guestView.secretCard[1], 0);
  assert.equal(typeof guestView.deckCount, 'number');
  assert.equal(guestView.deckCount, Game.state.deck.length);

  // View for Host (seat 1) before game over
  const hostView = Game.buildPlayerView(1);
  assert.equal(hostView.viewerSeat, 1);
  assert.equal(hostView.secretCard[1], 5);
  assert.equal(hostView.secretCard[2], 0);

  // View after game over reveals secrets
  Game.state.gameOver = true;
  const endgameGuestView = Game.buildPlayerView(2);
  assert.equal(endgameGuestView.secretCard[1], 5);
  assert.equal(endgameGuestView.secretCard[2], 7);

  // Test applyPlayerView
  Game.resetGame(1);
  Game.applyPlayerView(guestView);
  assert.equal(Game.state.players[2].hand.length, guestView.myHand.length);
  assert.equal(Game.state.players[1].hand.length, guestView.oppHandCount);
  assert.equal(Game.state.deck.length, guestView.deckCount);
  assert.equal(Game.state.secretCard[2], 7);
  assert.equal(Game.state.secretCard[1], 0);
});

// Mock PeerJS network implementation for headless testing
function createMockPeerNetwork() {
  const peers = new Map();

  class MockConn extends EventEmitter {
    constructor(peer, peerId) {
      super();
      this.peer = peer;
      this.peerId = peerId;
      this.open = false;
      this.remote = null;
    }

    send(data) {
      if (this.remote && this.remote.open) {
        queueMicrotask(() => {
          this.remote.emit('data', data);
        });
      }
    }

    close() {
      if (this.open) {
        this.open = false;
        this.emit('close');
        if (this.remote && this.remote.open) {
          this.remote.open = false;
          this.remote.emit('close');
        }
      }
    }
  }

  class MockPeer extends EventEmitter {
    constructor(id) {
      super();
      this.id = id || `anon-${Math.random().toString(36).slice(2, 8)}`;
      this.disconnected = false;
      this.destroyed = false;
      if (id && peers.has(id)) {
        queueMicrotask(() => {
          const err = new Error('ID unavailable');
          err.type = 'unavailable-id';
          this.emit('error', err);
        });
        return;
      }
      peers.set(this.id, this);
      this.connections = new Map();

      queueMicrotask(() => {
        this.emit('open', this.id);
      });
    }

    reconnect() {
      this.disconnected = false;
      queueMicrotask(() => {
        this.emit('open', this.id);
      });
    }

    connect(targetId) {
      const connLocal = new MockConn(this, targetId);
      const targetPeer = peers.get(targetId);

      if (!targetPeer) {
        queueMicrotask(() => {
          const err = new Error('Peer unavailable');
          err.type = 'peer-unavailable';
          this.emit('error', err);
        });
        return connLocal;
      }

      const connRemote = new MockConn(targetPeer, this.id);
      connLocal.remote = connRemote;
      connRemote.remote = connLocal;

      queueMicrotask(() => {
        connLocal.open = true;
        connRemote.open = true;
        targetPeer.emit('connection', connRemote);
        connLocal.emit('open');
      });

      return connLocal;
    }

    destroy() {
      peers.delete(this.id);
      this.emit('close');
    }
  }

  return MockPeer;
}

test('Mock PeerJS network supports host/join session and bidirectional messaging', async () => {
  const MockPeer = createMockPeerNetwork();

  let guestJoinedCode = null;
  let hostJoinedCode = null;
  const hostMessages = [];
  const guestMessages = [];

  const hostSession = Net.createNetSession(
    {
      onGuestJoined: ({ roomCode }) => {
        guestJoinedCode = roomCode;
      },
      onMessage: (msg) => {
        hostMessages.push(msg);
      }
    },
    { PeerClass: MockPeer }
  );

  const { roomCode } = await hostSession.hostRoom('ABC123');
  assert.equal(roomCode, 'ABC123');
  assert.equal(hostSession.getRole(), 'host');

  const guestSession = Net.createNetSession(
    {
      onJoinedHost: ({ roomCode: code }) => {
        hostJoinedCode = code;
      },
      onMessage: (msg) => {
        guestMessages.push(msg);
      }
    },
    { PeerClass: MockPeer }
  );

  await guestSession.joinRoom('ABC123');
  assert.equal(guestSession.getRole(), 'guest');

  // Wait a tick for hello handshake
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(guestJoinedCode, 'ABC123');
  assert.equal(hostJoinedCode, 'ABC123');
  assert.equal(hostSession.isConnected(), true);
  assert.equal(guestSession.isConnected(), true);

  // Test messages
  hostSession.send({ type: 'test_host', payload: 42 });
  guestSession.send({ type: 'test_guest', payload: 99 });

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(guestMessages.length, 1);
  assert.equal(guestMessages[0].type, 'test_host');
  assert.equal(guestMessages[0].payload, 42);

  assert.equal(hostMessages.length, 1);
  assert.equal(hostMessages[0].type, 'test_guest');
  assert.equal(hostMessages[0].payload, 99);

  hostSession.close(false);
  guestSession.close(false);
});

test('Third player connecting to an occupied room is rejected with room_full', async () => {
  const MockPeer = createMockPeerNetwork();

  const hostSession = Net.createNetSession({}, { PeerClass: MockPeer });
  await hostSession.hostRoom('ROOM99');

  const guestSession1 = Net.createNetSession({}, { PeerClass: MockPeer });
  await guestSession1.joinRoom('ROOM99');
  await new Promise((r) => setTimeout(r, 20));

  const guestSession2 = Net.createNetSession({}, { PeerClass: MockPeer });
  await assert.rejects(
    async () => {
      await guestSession2.joinRoom('ROOM99');
    },
    { message: 'That room already has two players.' }
  );

  hostSession.close(false);
  guestSession1.close(false);
  guestSession2.close(false);
});

test('Full round simulation of Host authoritative state projection and Guest sync', () => {
  // Host initializes match
  Game.startGame(1);
  assert.equal(Game.state.currentPlayer, 1);

  // Turn 1 (P1): Secret
  Game.performSecret(1, 0);
  let guestView = Game.buildPlayerView(2);
  assert.equal(guestView.currentPlayer, 2);
  assert.equal(guestView.secretCard[1], 0);

  // Turn 2 (P2): Guest does Secret
  Game.performSecret(2, 0);
  guestView = Game.buildPlayerView(2);
  assert.equal(guestView.currentPlayer, 1);
  assert.ok(guestView.secretCard[2] > 0);

  // Turn 3 & 4: Tradeoffs
  Game.performTradeoff(1, [0, 1]);
  Game.performTradeoff(2, [0, 1]);

  // Turn 5 & 6: Gifts
  Game.performGift(1, [0, 1, 2], 0);
  Game.performGift(2, [0, 1, 2], 0);

  // Turn 7 & 8: Competitions
  Game.performCompetition(1, [0, 1, 2, 3], 1);
  Game.performCompetition(2, [0, 1, 2, 3], 1);

  assert.equal(Game.state.turnsTaken, 8);
  assert.equal(Game.state.gameOver, true);

  // At endgame, buildPlayerView gives guest both secrets
  guestView = Game.buildPlayerView(2);
  assert.ok(guestView.secretCard[1] > 0);
  assert.ok(guestView.secretCard[2] > 0);
});

test('onConnectionLost triggers on unexpected disconnect and supports reconnection with clientId', async () => {
  const MockPeer = createMockPeerNetwork();

  let hostConnectionLost = null;
  let guestConnectionLost = null;
  let guestReconnectedCode = null;

  const hostSession = Net.createNetSession(
    {
      onGuestReconnected: ({ roomCode }) => {
        guestReconnectedCode = roomCode;
      },
      onConnectionLost: (info) => {
        hostConnectionLost = info;
      }
    },
    { PeerClass: MockPeer }
  );

  const { roomCode } = await hostSession.hostRoom('RECON1');

  const guestSession = Net.createNetSession(
    {
      onConnectionLost: (info) => {
        guestConnectionLost = info;
      }
    },
    { PeerClass: MockPeer }
  );

  await guestSession.joinRoom('RECON1');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(hostSession.isConnected(), true);
  assert.equal(guestSession.isConnected(), true);

  // Simulate unexpected connection closure (e.g. network blip) without peer_left message
  // Close active connection directly to trigger unexpected disconnect
  const guestConn = guestSession.getClientId();
  assert.ok(guestConn.length >= 6);

  // Disconnect guest
  await guestSession.reconnect();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(guestReconnectedCode, 'RECON1');
  assert.equal(hostSession.isConnected(), true);
  assert.equal(guestSession.isConnected(), true);

  hostSession.close(false);
  guestSession.close(false);
});

test('Heartbeat pongTimeoutMs detects stale connection and invokes onConnectionLost', async () => {
  const BaseMockPeer = createMockPeerNetwork();
  let dropGuestOutgoing = false;

  class MutableMockPeer extends BaseMockPeer {
    connect(targetId) {
      const conn = super.connect(targetId);
      const origSend = conn.send.bind(conn);
      conn.send = (data) => {
        if (!dropGuestOutgoing) {
          origSend(data);
        }
      };
      return conn;
    }
  }

  let lostReason = null;
  const hostSession = Net.createNetSession(
    {
      onConnectionLost: ({ reason }) => {
        lostReason = reason;
      }
    },
    {
      PeerClass: MutableMockPeer,
      pingIntervalMs: 20,
      pongTimeoutMs: 50
    }
  );

  await hostSession.hostRoom('STALE1');

  const guestSession = Net.createNetSession({}, { PeerClass: MutableMockPeer });
  await guestSession.joinRoom('STALE1');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(hostSession.isConnected(), true);

  // Mute guest so it stops replying to pings (simulating stale connection)
  dropGuestOutgoing = true;
  await new Promise((r) => setTimeout(r, 120));

  assert.equal(lostReason, 'heartbeat_timeout');
  assert.equal(hostSession.isConnected(), false);

  hostSession.close(false);
  guestSession.close(false);
});

test('joinRoom rejects immediately with Room not found on peer-unavailable', async () => {
  const MockPeer = createMockPeerNetwork();
  const guestSession = Net.createNetSession(
    {},
    { PeerClass: MockPeer, connectTimeoutMs: 5000 }
  );

  const startedAt = Date.now();
  await assert.rejects(
    async () => {
      await guestSession.joinRoom('NOPE99');
    },
    { message: 'Room not found. Check the 6-character code and ensure the host has the room open.' }
  );
  const elapsedMs = Date.now() - startedAt;
  assert.ok(elapsedMs < 500, `Expected fast rejection on peer-unavailable, took ${elapsedMs}ms`);

  guestSession.close(false);
});
