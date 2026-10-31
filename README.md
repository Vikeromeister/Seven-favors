# Seven Favors

A browser-based card game of secret gift distribution and tactical area control, built with vanilla HTML5, CSS3, and modern ES Modules (zero external runtime dependencies).

Compete locally against an AI engine featuring **3 difficulty levels** (Easy, Medium, and Hard) or challenge a friend across the internet in **Online Two-Player Mode** on an animated, viewport-fitted tabletop stage.

---

## Features

- **Zero Bundler / Zero Dependencies:** Pure vanilla JavaScript (ES modules) running directly in the browser and ready for GitHub Pages hosting from `docs/`.
- **Online Two-Player Mode (Zero Backend WebRTC):** Play against another person over the internet with 6-character room codes and one-click shareable invite links (`?room=CODE`). Uses WebRTC DataChannels (PeerJS loaded on demand from CDN), sanitized host-authoritative state synchronization, symmetric board perspective, and rematches.
- **Multi-Tier AI Opponent:**
  - **Easy:** Relaxed, semi-random play for casual games.
  - **Medium:** Value-weighted decision making that evaluates contested characters, discards dead cards, and balances offers.
  - **Hard:** Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and strategic win-condition / threat mitigation.
- **Viewport-Scaled Tabletop Stage:** Fixed 1760×900 presentation scaled smoothly to fit any viewport with zero scrolling, custom card artwork, hover-to-peek secret slots, and icon actions with tooltips.
- **Animated Card Flights & History Rail:** Web Animations API 3D card flights and flips for every draw, secret, discard, offer, and endgame reveal, paired with a colour-coded move history rail (blue = You, red = Opponent/Computer).
- **Flexible Match Setup:** Choose between Single Player (`Easy`, `Medium`, or `Hard`) and Online 2P (`Host Room` or `Join Room`), with Round 1 starting player defaulting to **Random** (Coin toss).
- **View Board Peek Mode:** Hold or click the **View Board** button on Gift/Competition offers or round-end summary cards to briefly hide the popup, un-dim the central board, and inspect character favor, card counts, and move history before deciding.
- **Visual Competition Pairing:** Real-time `1` and `2` pair badges on selected hand cards so you control exact competition splits.
- **Automated Test Suite:** Built-in unit, networking, and simulation tests using Node.js's native test runner (`node:test`).

---

## Online Two-Player Mode Setup Guide

### 1. Playing Online (Out-of-the-Box)
No server installation or account setup is required to play online.
- **Host:** Select **Online 2P → Host Game**, choose starting player preference (defaults to **Random / Coin toss**), and click **Create Room**. Copy the 6-character room code or click **Copy Invite Link** and share it with your friend.
- **Guest:** Open the shared invite link (which auto-fills the room code) or select **Online 2P → Join Game**, enter the 6-character code, and click **Join Room**.

### 2. GitHub Pages Deployment
1. Go to repository **Settings → Pages**.
2. Select **Deploy from a branch**, choose your branch and the **`/docs`** folder.
3. Ensure **Enforce HTTPS** is enabled (required for `navigator.clipboard` copy and secure WebRTC signaling).

### 3. Optional: Free TURN Server (For Strict Firewalls / Symmetric Mobile NATs)
Direct WebRTC connects ~85% of home internet pairs via public STUN servers. If two players are on strict symmetric cellular NATs or enterprise firewalls and encounter connection timeouts:
1. Register for free TURN credentials (e.g. at [Metered OpenRelay](https://www.metered.ca/tools/openrelay/) or Cloudflare Calls).
2. Open `docs/src/net-config.js` and add your TURN server URL, username, and credential into `NET_CONFIG.peerOptions.config.iceServers`. Commit and push to GitHub Pages.

---

## Game Rules & Overview

Seven characters are placed in the center of the table, each with a Charm Point value from 2 to 5:
- **Burger (2 pts)** &times; 2 cards
- **Chips (2 pts)** &times; 2 cards
- **Fidget Spinner (2 pts)** &times; 2 cards
- **Cardigan (3 pts)** &times; 3 cards
- **Sunglasses (3 pts)** &times; 3 cards
- **Concert Ticket (4 pts)** &times; 4 cards
- **Smartphone (5 pts)** &times; 5 cards

The deck contains exactly **21 item cards**. At the start of the round, 1 card is set aside face down (out of play), and each player receives 6 cards. On your turn, you draw 1 card and must execute exactly one of four actions (each action can only be used once per round):

1. **Secret (1 card):** Set aside 1 card face down. It will score for you at the end of the round.
2. **Tradeoff (2 cards):** Discard 2 cards from the game face down.
3. **Gift (3 cards):** Offer 3 cards face up. Your opponent chooses 1 card for themselves, and you receive the remaining 2.
4. **Competition (4 cards):** Partition 4 cards into 2 pairs face up. Your opponent chooses 1 pair for themselves, and you receive the other pair.

### Scoring & Victory
After 8 total turns (4 per player), all secret cards are revealed and character majorities are evaluated:
- A player wins if they achieve **11 or more Charm Points** OR the favor of **4 or more Characters**.
- **Precedence Rule:** If one player achieves 11+ Charm Points and the other achieves 4+ Characters, the player with **11+ Charm Points wins**.
- Tiebreaker falls back to the higher total Charm Points.
- **Starting Player & Multi-Round Play:** Before starting a new game, you can select whether **You**, **Computer**, or **Random** goes first in Round 1. If neither player meets a victory condition after 8 turns, the round ends in a tie: all character favor states carry over, the starting player alternates cleanly from the prior round's starter, and you can launch the next round upon approval until someone wins.
- **New Game Confirmation:** If a game is in progress, clicking the New Game button displays a confirmation dialog to prevent accidental restarts.

---

## Running Locally

Because the application uses native ES Modules, it must be served over HTTP:

```bash
# Using npm script:
npm start

# Or using Python:
python3 -m http.server 8000 --directory docs
```

Open `http://localhost:8000` (or the port output by your server) in any modern browser.

### Regenerating Card Artwork

Card and character images in `docs/assets/` are sliced from the reference sheets in `art/` via a dev-only Python/Pillow script:

```bash
python3 tools/slice_cards.py
```

---

## Running Tests

Automated tests run with Node.js built-in test runner:

```bash
npm test
```

Includes rule validation, action validation, scoring logic, AI decision-making, and headless 50-game simulations.

---

## Legal & Attribution Disclaimer

**Seven Favors** is an independent, non-commercial, open-source educational web game.

- The underlying mathematical mechanics are inspired by the game design of **Kota Nakayama** (originally published in Japan as *21 Flowers*).
- *Hanamikoji* (花見小路) is a registered trademark of **EmperorS4** and **Taiwan Boardgame Design**. This project is not affiliated with, endorsed by, or sponsored by EmperorS4 or Taiwan Boardgame Design.
- All code, graphic layouts, and visual artwork used in this project are independently created and distinct from the original copyrighted commercial board game.
