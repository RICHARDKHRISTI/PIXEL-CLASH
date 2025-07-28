# 🚀 Territory Wars - Quick Start Guide

## Instant Deployment

### Option 1: Using the Start Script
```bash
./start.sh
```

### Option 2: Manual Start
```bash
# Install dependencies
npm run setup

# Start the game
npm start
```

### Option 3: Docker Deployment
```bash
# Build the container
docker build -t territory-wars .

# Run the game
docker run -p 3000:3000 territory-wars
```

## 🎮 Access Your Game

Once started, the game will be available at:
- **Local**: http://localhost:3000
- **Network**: http://[your-ip]:3000

## 🏆 Game Ready Features

✅ **4-Player Multiplayer** - Real-time matches with automatic matchmaking  
✅ **Solo vs AI Mode** - Practice against intelligent AI opponents  
✅ **Auto-Fill with AI** - AI joins when not enough players (30s wait)  
✅ **Beautiful UI** - Modern, responsive design with animations  
✅ **Live Chat** - In-game communication between players  
✅ **Strategic Gameplay** - Territory expansion, resource collection, combat  
✅ **Score System** - Comprehensive scoring with leaderboards  
✅ **Reconnection** - Players can rejoin if disconnected  
✅ **Mobile Responsive** - Works on desktop, tablet, and mobile  
✅ **Production Ready** - Optimized for deployment  

## 🌐 Deployment Platforms

### Heroku
```bash
heroku create your-game-name
git push heroku main
```

### Railway
```bash
railway login
railway deploy
```

### DigitalOcean App Platform
- Connect your repository
- Set build command: `npm run setup`
- Set run command: `npm start`

### AWS/Google Cloud
- Use the provided Dockerfile
- Deploy as a container service

## ⚡ Performance Tips

- **Memory**: Minimum 512MB RAM recommended
- **CPU**: Single core sufficient for 20+ concurrent players
- **Network**: Websocket connections (Socket.IO)
- **Scaling**: Each server instance handles multiple game rooms

## 🎯 What Players Experience

**Multiplayer Mode:**
1. **Enter Name** → Join matchmaking queue
2. **Wait for Players** → Auto-matched with others (AI fills after 30s)
3. **5-Minute Battle** → Real-time strategic gameplay
4. **Victory Screen** → Comprehensive stats and leaderboard
5. **Play Again** → Instant rematch capability

**Solo vs AI Mode:**
1. **Enter Name** → Click "Play vs AI" button
2. **Instant Start** → Immediate game with 3 smart AI opponents
3. **Strategic Challenge** → AI uses advanced tactics and prioritization
4. **Practice Mode** → Perfect for learning game mechanics

## 🔧 Customization

Edit configuration in `server/server.js`:
- `GRID_WIDTH/HEIGHT` - Game board size
- `PLAYER_COLORS` - Player color schemes  
- `timer` - Game duration
- `START_POSITIONS` - Starting locations

---

**Your Territory Wars game is ready to deploy and play!** 🏰⚔️