const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Game state
const gameRooms = {};
const playerSessions = {}; // Track player sessions for reconnection

// Game config
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const START_POSITIONS = [
  { x: 2, y: 2 },
  { x: GRID_WIDTH - 3, y: 2 },
  { x: 2, y: GRID_HEIGHT - 3 },
  { x: GRID_WIDTH - 3, y: GRID_HEIGHT - 3 }
];

// Matchmaking queue
let matchmakingQueue = [];

// Serve the game client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle player joining matchmaking
  socket.on('findMatch', (playerName) => {
    if (matchmakingQueue.some(p => p.id === socket.id)) return;
    
    const player = {
      id: socket.id,
      name: playerName || `Player${Math.floor(Math.random() * 1000)}`
    };
    
    matchmakingQueue.push(player);
    socket.emit('matchmakingStatus', { 
      message: `Looking for players... (${matchmakingQueue.length}/4)`,
      playersInQueue: matchmakingQueue.length 
    });
    
    // Notify other players in queue
    matchmakingQueue.forEach(p => {
      if (p.id !== socket.id) {
        io.to(p.id).emit('matchmakingStatus', { 
          message: `Looking for players... (${matchmakingQueue.length}/4)`,
          playersInQueue: matchmakingQueue.length 
        });
      }
    });
    
    checkMatchmaking();
  });
  
  // Handle leaving matchmaking
  socket.on('leaveMatchmaking', () => {
    matchmakingQueue = matchmakingQueue.filter(p => p.id !== socket.id);
  });
  
  // Handle player moves
  socket.on('playerMove', (data) => {
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    if (!roomId || !gameRooms[roomId]) return;
    
    const gameRoom = gameRooms[roomId];
    gameRoom.handlePlayerMove(socket.id, data.x, data.y);
  });
  
  // Handle player chat
  socket.on('chatMessage', (message) => {
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    if (!roomId || !gameRooms[roomId]) return;
    
    const gameRoom = gameRooms[roomId];
    const player = gameRoom.players[socket.id];
    if (player) {
      io.to(roomId).emit('chatMessage', {
        playerName: player.name,
        message: message.trim(),
        color: player.color,
        timestamp: Date.now()
      });
    }
  });
  
  // Handle reconnection
  socket.on('reconnect', (sessionId) => {
    if (playerSessions[sessionId]) {
      const roomId = playerSessions[sessionId].roomId;
      if (gameRooms[roomId]) {
        socket.join(roomId);
        socket.emit('reconnected', gameRooms[roomId].getGameState());
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    matchmakingQueue = matchmakingQueue.filter(p => p.id !== socket.id);
    
    // Handle disconnection from active games
    Object.keys(gameRooms).forEach(roomId => {
      const gameRoom = gameRooms[roomId];
      if (gameRoom.players[socket.id]) {
        gameRoom.handlePlayerDisconnect(socket.id);
      }
    });
  });
});

function checkMatchmaking() {
  if (matchmakingQueue.length >= 4) {
    const roomId = `room_${Date.now()}`;
    const players = matchmakingQueue.splice(0, 4);
    
    // Create game room
    gameRooms[roomId] = new GameRoom(roomId, players);
    
    // Add players to room and create sessions
    players.forEach((player, index) => {
      const socket = io.sockets.sockets.get(player.id);
      if (socket) {
        socket.join(roomId);
        playerSessions[player.id] = { roomId, playerIndex: index };
        socket.emit('matchFound', gameRooms[roomId].getGameState());
      }
    });
    
    // Start game loop
    gameRooms[roomId].startGame();
  }
}

class GameRoom {
  constructor(roomId, playerData) {
    this.roomId = roomId;
    this.playerData = playerData;
    this.players = {};
    this.grid = [];
    this.resources = [];
    this.timer = 300; // 5 minutes
    this.gameInterval = null;
    this.gameStarted = false;
    this.gameEnded = false;
    
    this.initializeGame();
  }
  
  initializeGame() {
    // Create grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        row.push({
          ownerId: null,
          strength: 0,
          hasResource: false
        });
      }
      this.grid.push(row);
    }
    
    // Create players
    this.playerData.forEach((playerInfo, index) => {
      this.players[playerInfo.id] = {
        id: playerInfo.id,
        name: playerInfo.name,
        color: PLAYER_COLORS[index],
        resources: 100,
        territories: [],
        startPosition: START_POSITIONS[index],
        connected: true,
        score: 0
      };
      
      // Capture starting territory
      this.captureTerritory(playerInfo.id, START_POSITIONS[index].x, START_POSITIONS[index].y, true);
    });
    
    // Generate resources
    this.generateResources(12);
  }
  
  captureTerritory(playerId, x, y, isStarting = false) {
    if (this.gameEnded) return false;
    
    const cell = this.grid[y][x];
    const player = this.players[playerId];
    
    if (!player) return false;
    
    if (cell.ownerId) {
      // Attack existing territory
      if (cell.ownerId !== playerId) {
        const attackPower = isStarting ? 100 : 15;
        cell.strength -= attackPower;
        
        if (cell.strength <= 0) {
          const oldOwner = this.players[cell.ownerId];
          if (oldOwner) {
            oldOwner.territories = oldOwner.territories.filter(t => !(t.x === x && t.y === y));
          }
          
          cell.ownerId = playerId;
          cell.strength = isStarting ? 20 : 10;
          player.territories.push({x, y});
          player.score += 10;
          
          // Check for resource collection
          if (cell.hasResource) {
            player.resources += 50;
            player.score += 25;
            cell.hasResource = false;
            this.resources = this.resources.filter(r => !(r.x === x && r.y === y));
          }
          
          return true;
        }
      } else {
        // Reinforce own territory
        cell.strength = Math.min(cell.strength + 5, 50);
        return true;
      }
    } else {
      // Capture neutral territory
      cell.ownerId = playerId;
      cell.strength = isStarting ? 20 : 10;
      player.territories.push({x, y});
      player.score += 5;
      
      // Check for resource collection
      if (cell.hasResource) {
        player.resources += 50;
        player.score += 25;
        cell.hasResource = false;
        this.resources = this.resources.filter(r => !(r.x === x && r.y === y));
      }
      
      return true;
    }
    
    return false;
  }
  
  generateResources(count) {
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const x = Math.floor(Math.random() * GRID_WIDTH);
        const y = Math.floor(Math.random() * GRID_HEIGHT);
        
        if (!this.grid[y][x].ownerId && !this.grid[y][x].hasResource) {
          this.grid[y][x].hasResource = true;
          this.resources.push({x, y, value: 50});
          break;
        }
        attempts++;
      }
    }
  }
  
  handlePlayerMove(playerId, x, y) {
    if (this.gameEnded || !this.gameStarted) return;
    
    // Validate move
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;
    
    const player = this.players[playerId];
    if (!player || !player.connected) return;
    
    // Check if adjacent to player's territory
    let validMove = false;
    for (const territory of player.territories) {
      const dx = Math.abs(territory.x - x);
      const dy = Math.abs(territory.y - y);
      if (dx <= 1 && dy <= 1 && (dx + dy === 1)) { // Only adjacent, not diagonal
        validMove = true;
        break;
      }
    }
    
    if (validMove) {
      if (this.captureTerritory(playerId, x, y)) {
        this.broadcastState();
      }
    }
  }
  
  handlePlayerDisconnect(playerId) {
    if (this.players[playerId]) {
      this.players[playerId].connected = false;
      this.broadcastState();
      
      // If all players disconnect, end the game after delay
      const connectedPlayers = Object.values(this.players).filter(p => p.connected);
      if (connectedPlayers.length === 0) {
        setTimeout(() => {
          this.endGame();
        }, 30000);
      }
    }
  }
  
  startGame() {
    this.gameStarted = true;
    this.gameInterval = setInterval(() => {
      this.gameTick();
    }, 1000);
    
    io.to(this.roomId).emit('gameStarted');
  }
  
  gameTick() {
    if (this.gameEnded) return;
    
    // Reduce timer
    this.timer--;
    
    // Generate resources for territories
    Object.values(this.players).forEach(player => {
      if (player.connected) {
        player.resources += Math.floor(player.territories.length * 0.5);
      }
    });
    
    // Randomly spawn new resources
    if (Math.random() < 0.1 && this.resources.length < 15) {
      this.generateResources(1);
    }
    
    this.broadcastState();
    
    // Check game end conditions
    if (this.timer <= 0) {
      this.endGame();
    }
  }
  
  endGame() {
    if (this.gameEnded) return;
    
    this.gameEnded = true;
    clearInterval(this.gameInterval);
    
    // Calculate final scores
    Object.values(this.players).forEach(player => {
      player.finalScore = player.score + (player.territories.length * 5) + Math.floor(player.resources / 10);
    });
    
    // Determine winner
    const sortedPlayers = Object.values(this.players).sort((a, b) => b.finalScore - a.finalScore);
    
    // Broadcast game result
    io.to(this.roomId).emit('gameOver', { 
      winner: sortedPlayers[0],
      leaderboard: sortedPlayers,
      finalStats: this.getFinalStats()
    });
    
    // Clean up sessions
    Object.keys(this.players).forEach(playerId => {
      delete playerSessions[playerId];
    });
    
    // Clean up room after delay
    setTimeout(() => {
      delete gameRooms[this.roomId];
    }, 60000);
  }
  
  getFinalStats() {
    return {
      totalTurns: 300 - this.timer,
      resourcesGenerated: this.resources.length,
      totalTerritories: Object.values(this.players).reduce((sum, p) => sum + p.territories.length, 0)
    };
  }
  
  broadcastState() {
    io.to(this.roomId).emit('gameState', this.getGameState());
  }
  
  getGameState() {
    return {
      players: Object.values(this.players).map(player => ({
        id: player.id,
        name: player.name,
        color: player.color,
        resources: player.resources,
        territories: player.territories,
        connected: player.connected,
        score: player.score
      })),
      grid: this.grid,
      resources: this.resources,
      timer: this.timer,
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded
    };
  }
}

server.listen(PORT, () => {
  console.log(`🎮 Territory Wars server running on port ${PORT}`);
  console.log(`🌐 Game available at http://localhost:${PORT}`);
});