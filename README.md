# SKELE

A 3D interactive web experience built with React Three Fiber featuring a controllable skeleton character exploring a western town environment. The map expands as the $SKELE token market cap grows.

![SKELE](https://img.shields.io/badge/SKELE-Solana-purple)
![React](https://img.shields.io/badge/React-19-blue)
![Three.js](https://img.shields.io/badge/Three.js-r182-green)

## Features

### 3D Western Town Experience
- Fully explorable 3D western town environment
- Third-person camera that follows the skeleton character
- Smooth WASD/Arrow key controls with collision detection
- Real-time shadows and dynamic lighting

### Market Cap Unlockable Map
The game world expands based on $SKELE token market cap:

| Tier | Market Cap | Unlocks |
|------|-----------|---------|
| 1 | $0 | Main Street (starting area) |
| 2 | $50K | Saloon area |
| 3 | $100K | Inner Town (expanded access) |

### Solana Wallet Integration
- Connect with Phantom, Solflare, Torus, or Ledger
- Live market cap tracking via DexScreener API
- Wallet address display in header

### Collectible System
- 30 glowing orbs scattered across the map
- Collect by walking into them
- Progress saved to localStorage
- Satisfying collect animations

### Doom Fire Algorithm
The start screen features a procedural fire effect using the classic "doom fire" algorithm - pure pixel manipulation, no images.

## Tech Stack

- **React 19** - UI framework
- **React Three Fiber** - React renderer for Three.js
- **Three.js** - 3D graphics library
- **@react-three/drei** - Useful helpers for R3F
- **@solana/wallet-adapter** - Solana wallet integration
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Project Structure

```
src/
├── App.jsx                 # Main application component
├── contexts/
│   ├── WalletContext.jsx   # Solana wallet provider
│   └── GameContext.jsx     # Game state (tier, collectibles)
├── components/
│   ├── WalletButton.jsx    # Connect wallet button
│   ├── MarketCapDisplay.jsx # Market cap HUD
│   ├── Collectible.jsx     # 3D collectible orbs
│   ├── LockedZoneBarrier.jsx # Zone lock visuals
│   ├── TierUpNotification.jsx # Tier unlock celebration
│   ├── UnlockPrompt.jsx    # Locked zone message
│   └── DevPanel.jsx        # Dev testing panel
├── utils/
│   ├── tiers.js            # Tier definitions
│   ├── zones.js            # Zone boundaries
│   └── collectibles.js     # Collectible positions
└── main.jsx                # Entry point
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/skele.git
cd skele

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## Controls

| Key | Action |
|-----|--------|
| W / Arrow Up | Move forward |
| S / Arrow Down | Move backward |
| A / Arrow Left | Turn left |
| D / Arrow Right | Turn right |
| Shift + D | Open dev panel |

## Key Implementation Details

### Zone System
Zones are defined as 3D bounding boxes. Movement is checked against zone boundaries.

```javascript
// Example zone definition
{
  id: 'saloon',
  tier: 2,
  name: 'Saloon',
  bounds: { minX: 25, maxX: 50, minZ: -20, maxZ: 15 }
}
```

### Collectibles
Three.js meshes with floating animation, glow effects, and proximity-based collection.

### Market Cap Tracking
Polls DexScreener API every 30 seconds when contract address is configured.

## Links

- [Twitter/X](https://x.com/skele_coin)
- Contract Address: Coming Soon

## License

MIT

---

Built with bones and determination.
