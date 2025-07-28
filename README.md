# 🏰 Territory Wars - Multiplayer Strategy Game

A real-time multiplayer territory control strategy game built with Node.js, Socket.IO, and HTML5 Canvas. Compete with up to 4 players to dominate the battlefield by expanding your territory, collecting resources, and outmaneuvering your opponents!

![Territory Wars Screenshot](https://via.placeholder.com/800x400/2c3e50/ffffff?text=Territory+Wars+Game)

## 🎮 Game Features

### Core Gameplay
- **Real-time Multiplayer**: Up to 4 players in simultaneous matches
- **Territory Expansion**: Click adjacent tiles to grow your empire
- **Resource Collection**: Gather valuable resources for bonus points
- **Strategic Combat**: Attack enemy territories and defend your own
- **Timed Matches**: 5-minute battles with dynamic scoring

### Technical Features
- **Modern UI/UX**: Beautiful, responsive design with animations
- **Real-time Communication**: Live chat during matches
- **Reconnection Support**: Rejoin matches if disconnected
- **Matchmaking System**: Automatic player matching
- **Comprehensive Statistics**: Detailed end-game analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 14.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/territory-wars.git
   cd territory-wars
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Start the game server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   Navigate to http://localhost:3000
   ```

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## 🎯 How to Play

### Objective
Control the most territory when time runs out to claim victory!

### Game Rules

1. **Starting Position**: Each player begins with one territory in a corner
2. **Expansion**: Click on tiles adjacent to your territory to expand
3. **Combat**: Attack enemy territories - stronger territories are harder to capture
4. **Resources**: Collect golden diamond resources for bonus points and resources
5. **Reinforcement**: Click on your own territories to strengthen them
6. **Victory**: Player with the highest score wins when time expires

### Scoring System
- **+5 points** for capturing neutral territory
- **+10 points** for conquering enemy territory
- **+25 points** for collecting resources
- **Final Score** = Base Score + (Territories × 5) + (Resources ÷ 10)

### Strategy Tips
- 🎯 **Expand Early**: Claim neutral territory quickly in the opening
- 🛡️ **Fortify Borders**: Strengthen territories near enemies
- 💎 **Prioritize Resources**: They provide significant score boosts
- 🗺️ **Control Chokepoints**: Block enemy expansion routes
- ⚡ **Time Management**: Balance expansion with defense

## 🏗️ Project Structure

```
territory-wars/
├── server/
│   ├── server.js          # Main server file with game logic
│   └── package.json       # Server dependencies
├── public/
│   ├── index.html         # Main game interface
│   ├── styles.css         # Game styling and animations
│   └── game.js           # Client-side game logic
├── package.json          # Project configuration
└── README.md            # This file
```

## 🛠️ Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web server framework
- **Socket.IO**: Real-time communication
- **CORS**: Cross-origin resource sharing

### Frontend
- **HTML5 Canvas**: Game rendering
- **CSS3**: Modern styling with animations
- **Vanilla JavaScript**: Client-side logic
- **Socket.IO Client**: Real-time communication

## 🚢 Deployment

### Heroku Deployment

1. **Create Heroku app**
   ```bash
   heroku create your-territory-wars-app
   ```

2. **Configure environment**
   ```bash
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   COPY server/package*.json ./server/
   RUN npm run setup
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t territory-wars .
   docker run -p 3000:3000 territory-wars
   ```

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## 🎨 Customization

### Game Configuration

Edit `server/server.js` to modify:
- **Grid size**: `GRID_WIDTH` and `GRID_HEIGHT`
- **Player colors**: `PLAYER_COLORS` array
- **Game duration**: `timer` value in GameRoom
- **Starting positions**: `START_POSITIONS` array

### Visual Customization

Edit `public/styles.css` to customize:
- Color schemes and themes
- Animation effects
- Layout and spacing
- Responsive breakpoints

## 📊 Game Statistics

The game tracks comprehensive statistics:
- **Individual Scores**: Points from various actions
- **Territory Control**: Number of tiles owned
- **Resource Collection**: Resources gathered
- **Combat Effectiveness**: Successful attacks/defenses
- **Time Analytics**: Turn duration and efficiency

## 🔧 API Reference

### Socket Events

**Client to Server:**
- `findMatch(playerName)`: Join matchmaking queue
- `leaveMatchmaking()`: Exit matchmaking
- `playerMove({x, y})`: Make a move
- `chatMessage(message)`: Send chat message

**Server to Client:**
- `matchmakingStatus(data)`: Queue status update
- `matchFound(gameState)`: Match starting
- `gameState(state)`: Game state update
- `chatMessage(message)`: Incoming chat
- `gameOver(result)`: Match completion

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test multiplayer functionality
- Ensure responsive design
- Optimize for performance

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎖️ Acknowledgments

- Socket.IO team for excellent real-time communication
- Modern web standards for canvas and CSS features
- The gaming community for inspiration and feedback

## 📞 Support

- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Suggest improvements via issues
- 📧 **Contact**: [your-email@example.com]
- 🌐 **Live Demo**: [https://your-territory-wars-app.herokuapp.com]

---

**Ready to conquer? Start your Territory Wars server and dominate the battlefield!** 🏰⚔️

Made with ❤️ by the Territory Wars Team
