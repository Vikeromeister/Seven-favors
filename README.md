# Seven Favors

A browser-based single-player card game of secret gift distribution and tactical area control, built with vanilla HTML5, CSS3, and modern ES Modules (zero external runtime dependencies).

Compete online or locally against an AI engine featuring **3 difficulty levels** (Casual, Tactical, and Master) on an animated, viewport-fitted tabletop stage.

---

## Features

- **Zero Bundler / Zero Dependencies:** Pure vanilla JavaScript (ES modules) running directly in the browser and ready for GitHub Pages hosting from `docs/`.
- **Multi-Tier AI Opponent:**
  - **Casual (Easy):** Relaxed, semi-random play for casual games.
  - **Tactical (Medium):** Value-weighted decision making that evaluates contested characters, discards dead cards, and balances offers.
  - **Master (Hard):** Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and strategic win-condition / threat mitigation.
- **Viewport-Scaled Tabletop Stage:** Fixed 1760×900 presentation scaled smoothly to fit any viewport with zero scrolling, custom card artwork, hover-to-peek secret slots, and icon actions with tooltips.
- **Animated Card Flights & History Rail:** Web Animations API 3D card flights and flips for every draw, secret, discard, offer, and endgame reveal, paired with a colour-coded move history rail (blue = You, red = Computer).
- **Flexible Match Setup:** Choose your AI opponent (`Casual`, `Tactical`, or `Master`) and Round 1 starting player (`You`, `Computer`, or `Random`) before launching each game.
- **View Board Peek Mode:** Hold or click the **View Board** button on AI Gift/Competition offers or round-end summary cards to briefly hide the popup, un-dim the central board, and inspect character favor, card counts, and move history before deciding.
- **Visual Competition Pairing:** Real-time `1` and `2` pair badges on selected hand cards so you control exact competition splits.
- **Automated Test Suite:** Built-in unit and simulation tests using Node.js's native test runner (`node:test`).

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
