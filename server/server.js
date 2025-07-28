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
      name: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      isAI: false,
      joinTime: Date.now()
    };
    
    matchmakingQueue.push(player);
    socket.emit('matchmakingStatus', { 
      message: `Looking for players... (${matchmakingQueue.length}/4) - AI fills after 30s`,
      playersInQueue: matchmakingQueue.length 
    });
    
    // Notify other players in queue
    matchmakingQueue.forEach(p => {
      if (p.id !== socket.id && !p.isAI) {
        io.to(p.id).emit('matchmakingStatus', { 
          message: `Looking for players... (${matchmakingQueue.length}/4) - AI fills after 30s`,
          playersInQueue: matchmakingQueue.length 
        });
      }
    });
    
    checkMatchmaking();
  });
  
  // Handle solo play request
  socket.on('playSolo', (playerName) => {
    const player = {
      id: socket.id,
      name: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      isAI: false
    };
    
    // Create AI players
    const aiPlayers = [];
    const aiNames = ['AI Commander', 'Bot Warrior', 'Cyber General'];
    
    for (let i = 0; i < 3; i++) {
      aiPlayers.push({
        id: `ai_${Date.now()}_${i}`,
        name: aiNames[i],
        isAI: true
      });
    }
    
    const allPlayers = [player, ...aiPlayers];
    const roomId = `solo_${Date.now()}`;
    
    // Create game room with AI
    gameRooms[roomId] = new GameRoom(roomId, allPlayers);
    
    // Add human player to room
    socket.join(roomId);
    playerSessions[socket.id] = { roomId, playerIndex: 0 };
    socket.emit('matchFound', gameRooms[roomId].getGameState());
    
    // Start game
    gameRooms[roomId].startGame();
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
      if (!player.isAI) {
        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
          socket.join(roomId);
          playerSessions[player.id] = { roomId, playerIndex: index };
          socket.emit('matchFound', gameRooms[roomId].getGameState());
        }
      }
    });
    
    // Start game loop
    gameRooms[roomId].startGame();
  } else if (matchmakingQueue.length >= 1) {
    // Check if any player has been waiting too long (30 seconds)
    const waitingTime = 30000; // 30 seconds
    const oldestPlayer = matchmakingQueue[0];
    const currentTime = Date.now();
    
    if (!oldestPlayer.joinTime) {
      oldestPlayer.joinTime = currentTime;
    }
    
    if (currentTime - oldestPlayer.joinTime > waitingTime) {
      // Fill with AI players
      const roomId = `mixed_${Date.now()}`;
      const humanPlayers = matchmakingQueue.splice(0, matchmakingQueue.length);
      const aiNames = ['AI Commander', 'Bot Warrior', 'Cyber General', 'Neural Fighter'];
      
      // Create AI players to fill remaining slots
      const aiPlayers = [];
      const neededAI = 4 - humanPlayers.length;
      
      for (let i = 0; i < neededAI; i++) {
        aiPlayers.push({
          id: `ai_${Date.now()}_${i}`,
          name: aiNames[i] || `AI Bot ${i + 1}`,
          isAI: true
        });
      }
      
      const allPlayers = [...humanPlayers, ...aiPlayers];
      
      // Create game room
      gameRooms[roomId] = new GameRoom(roomId, allPlayers);
      
      // Add human players to room
      humanPlayers.forEach((player, index) => {
        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
          socket.join(roomId);
          playerSessions[player.id] = { roomId, playerIndex: index };
          socket.emit('matchFound', gameRooms[roomId].getGameState());
        }
      });
      
      // Start game
      gameRooms[roomId].startGame();
    }
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
        score: 0,
        isAI: playerInfo.isAI || false
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
    
    // AI moves (every 2-3 seconds)
    if (this.timer % 2 === 0 || this.timer % 3 === 0) {
      this.processAIMoves();
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
  
  // AI Logic Methods
  processAIMoves() {
    const aiPlayers = Object.values(this.players).filter(p => p.isAI && p.connected);
    
    aiPlayers.forEach(aiPlayer => {
      // Add some randomness to AI decision making
      if (Math.random() < 0.7) { // 70% chance AI makes a move
        const move = this.getAIMove(aiPlayer);
        if (move) {
          this.handlePlayerMove(aiPlayer.id, move.x, move.y);
        }
      }
    });
  }
  
  getAIMove(aiPlayer) {
    const possibleMoves = this.getValidMovesForPlayer(aiPlayer.id);
    if (possibleMoves.length === 0) return null;
    
    // AI Strategy: Prioritize moves
    let bestMoves = [];
    
    // 1. Prioritize resource collection (highest priority)
    const resourceMoves = possibleMoves.filter(move => 
      this.grid[move.y][move.x].hasResource
    );
    if (resourceMoves.length > 0) {
      bestMoves = resourceMoves;
    } else {
      // 2. Prioritize attacking weak enemy territories
      const attackMoves = possibleMoves.filter(move => {
        const cell = this.grid[move.y][move.x];
        return cell.ownerId && cell.ownerId !== aiPlayer.id && cell.strength <= 15;
      });
      
      if (attackMoves.length > 0) {
        bestMoves = attackMoves;
      } else {
        // 3. Expand to neutral territories
        const expansionMoves = possibleMoves.filter(move => 
          !this.grid[move.y][move.x].ownerId
        );
        
        if (expansionMoves.length > 0) {
          bestMoves = expansionMoves;
        } else {
          // 4. Reinforce own territories
          const reinforceMoves = possibleMoves.filter(move => {
            const cell = this.grid[move.y][move.x];
            return cell.ownerId === aiPlayer.id && cell.strength < 30;
          });
          
          bestMoves = reinforceMoves.length > 0 ? reinforceMoves : possibleMoves;
        }
      }
    }
    
    // Return random move from best moves
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
  
  getValidMovesForPlayer(playerId) {
    const player = this.players[playerId];
    if (!player) return [];
    
    const validMoves = [];
    
    // Check all adjacent cells to player's territories
    player.territories.forEach(territory => {
      const directions = [
        { dx: 0, dy: -1 }, // Up
        { dx: 1, dy: 0 },  // Right
        { dx: 0, dy: 1 },  // Down
        { dx: -1, dy: 0 }  // Left
      ];
      
      directions.forEach(dir => {
        const x = territory.x + dir.dx;
        const y = territory.y + dir.dy;
        
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          // Check if this move is already in validMoves
          const existingMove = validMoves.find(move => move.x === x && move.y === y);
          if (!existingMove) {
            validMoves.push({ x, y });
          }
        }
      });
    });
    
    return validMoves;
  }
}

server.listen(PORT, () => {
  console.log(`🎮 Territory Wars server running on port ${PORT}`);
  console.log(`🌐 Game available at http://localhost:${PORT}`);
});