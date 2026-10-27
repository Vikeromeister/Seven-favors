# Seven Favors

A browser-based, two-player card game of secret gift distribution and tactical area control, built with vanilla HTML5, CSS3, and modern ES Modules (zero external runtime dependencies).

Play online or locally against an AI engine featuring **3 difficulty levels** (Casual, Tactical, Master), or challenge a friend in **Local Pass & Play** mode with private hand transitions.

---

## Features

- **Zero Bundler / Zero Dependencies:** Pure vanilla JavaScript (ES modules) running directly in the browser and ready for GitHub Pages hosting from `docs/`.
- **Multi-Tier AI Opponent:**
  - **Casual (Easy):** Relaxed, semi-random play for casual games.
  - **Tactical (Medium):** Value-weighted decision making that evaluates contested characters, discards dead cards, and balances offers.
  - **Master (Hard):** Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and strategic win-condition / threat mitigation.
- **Pass & Play Multiplayer:** Local two-player mode with privacy transition screens so players cannot see each other's hands on a shared device.
- **Visual Competition Pairing:** Interactive, real-time Pair 1 and Pair 2 badges so you have complete control over how cards are offered in competition.
- **Live Favor Markers:** Real-time visual favor badges (`▲ Favors AI/P2`, `● Neutral`, `▼ Favors P1`) on every character column.
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
