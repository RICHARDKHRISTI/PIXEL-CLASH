// Game Client JavaScript
class TerritoryWarsClient {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.currentPlayer = null;
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 30;
        this.offsetX = 50;
        this.offsetY = 50;
        this.isConnected = false;
        this.animationFrame = null;
        
        this.GRID_WIDTH = 20;
        this.GRID_HEIGHT = 15;
        
        this.init();
    }
    
    init() {
        this.setupSocket();
        this.setupUI();
        this.setupCanvas();
        this.showScreen('mainMenu');
    }
    
    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.hideLoadingOverlay();
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.showLoadingOverlay('Connection lost. Reconnecting...');
        });
        
        this.socket.on('matchmakingStatus', (data) => {
            this.updateMatchmakingStatus(data);
        });
        
        this.socket.on('matchFound', (gameState) => {
            console.log('Match found!', gameState);
            this.gameState = gameState;
            this.currentPlayer = gameState.players.find(p => p.id === this.socket.id);
            this.showScreen('gameScreen');
            this.updateGameDisplay();
        });
        
        this.socket.on('gameStarted', () => {
            this.updateGameStatus('Game Started! Expand your territory!');
        });
        
        this.socket.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.currentPlayer = gameState.players.find(p => p.id === this.socket.id);
            this.updateGameDisplay();
        });
        
        this.socket.on('chatMessage', (message) => {
            this.addChatMessage(message);
        });
        
        this.socket.on('gameOver', (result) => {
            this.handleGameOver(result);
        });
        
        this.socket.on('reconnected', (gameState) => {
            this.gameState = gameState;
            this.currentPlayer = gameState.players.find(p => p.id === this.socket.id);
            this.showScreen('gameScreen');
            this.updateGameDisplay();
        });
    }
    
    setupUI() {
        // Main menu
        document.getElementById('findMatchBtn').addEventListener('click', () => {
            this.findMatch();
        });
        
        document.getElementById('cancelMatchBtn').addEventListener('click', () => {
            this.cancelMatchmaking();
        });
        
        // Game screen
        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Game over screen
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        document.getElementById('mainMenuBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        // Enter key for player name
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.findMatch();
            }
        });
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleCanvasMouseMove(e);
        });
        
        // Start render loop
        this.render();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageElement = overlay.querySelector('p');
        messageElement.textContent = message;
        overlay.classList.add('active');
    }
    
    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
    
    findMatch() {
        const playerName = document.getElementById('playerName').value.trim() || 'Warrior';
        if (playerName.length > 15) {
            alert('Player name must be 15 characters or less');
            return;
        }
        
        this.socket.emit('findMatch', playerName);
        this.showScreen('matchmakingScreen');
    }
    
    cancelMatchmaking() {
        this.socket.emit('leaveMatchmaking');
        this.showScreen('mainMenu');
    }
    
    updateMatchmakingStatus(data) {
        document.getElementById('matchmakingStatus').textContent = data.message;
        
        // Update queue slots
        const slots = ['slot1', 'slot2', 'slot3'];
        slots.forEach((slotId, index) => {
            const slot = document.getElementById(slotId);
            if (index < data.playersInQueue - 1) {
                slot.classList.add('filled');
                slot.textContent = `Player ${index + 2}`;
            } else {
                slot.classList.remove('filled');
                slot.textContent = 'Waiting...';
            }
        });
    }
    
    handleCanvasClick(e) {
        if (!this.gameState || !this.currentPlayer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gridX = Math.floor((x - this.offsetX) / this.cellSize);
        const gridY = Math.floor((y - this.offsetY) / this.cellSize);
        
        if (gridX >= 0 && gridX < this.GRID_WIDTH && gridY >= 0 && gridY < this.GRID_HEIGHT) {
            this.socket.emit('playerMove', { x: gridX, y: gridY });
        }
    }
    
    handleCanvasMouseMove(e) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gridX = Math.floor((x - this.offsetX) / this.cellSize);
        const gridY = Math.floor((y - this.offsetY) / this.cellSize);
        
        this.hoveredCell = { x: gridX, y: gridY };
    }
    
    isValidMove(x, y) {
        if (!this.currentPlayer || !this.gameState) return false;
        
        // Check if adjacent to player's territory
        for (const territory of this.currentPlayer.territories) {
            const dx = Math.abs(territory.x - x);
            const dy = Math.abs(territory.y - y);
            if (dx <= 1 && dy <= 1 && (dx + dy === 1)) {
                return true;
            }
        }
        return false;
    }
    
    updateGameDisplay() {
        if (!this.gameState) return;
        
        this.updateTimer();
        this.updatePlayersList();
        this.updatePlayerStats();
    }
    
    updateTimer() {
        if (!this.gameState) return;
        
        const minutes = Math.floor(this.gameState.timer / 60);
        const seconds = this.gameState.timer % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('gameTimer').textContent = timeString;
        
        // Change color based on time remaining
        const timerElement = document.getElementById('gameTimer');
        if (this.gameState.timer <= 60) {
            timerElement.style.color = '#e74c3c';
            timerElement.classList.add('animate-pulse');
        } else if (this.gameState.timer <= 120) {
            timerElement.style.color = '#f39c12';
        } else {
            timerElement.style.color = '#ffd700';
            timerElement.classList.remove('animate-pulse');
        }
    }
    
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item animate-fade-in';
            playerDiv.style.borderLeftColor = player.color;
            
            const isCurrentPlayer = player.id === this.socket.id;
            
            playerDiv.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}${isCurrentPlayer ? ' (You)' : ''}</div>
                    <div class="player-stats-mini">
                        Score: ${player.score} | Territories: ${player.territories.length}
                    </div>
                </div>
                <div class="connection-status ${player.connected ? '' : 'disconnected'}"></div>
            `;
            
            playersList.appendChild(playerDiv);
        });
    }
    
    updatePlayerStats() {
        if (!this.currentPlayer) return;
        
        document.getElementById('playerScore').textContent = this.currentPlayer.score;
        document.getElementById('playerResources').textContent = this.currentPlayer.resources;
        document.getElementById('playerTerritories').textContent = this.currentPlayer.territories.length;
    }
    
    updateGameStatus(status) {
        document.getElementById('gameStatus').textContent = status;
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message) {
            this.socket.emit('chatMessage', message);
            input.value = '';
        }
    }
    
    addChatMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message animate-slide-in';
        messageDiv.style.borderLeftColor = message.color;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="chat-sender">${message.playerName}</div>
            <div class="chat-text">${this.escapeHtml(message.message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove old messages if too many
        while (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    handleGameOver(result) {
        this.showScreen('gameOverScreen');
        
        // Update game result
        const gameResult = document.getElementById('gameResult');
        const winnerAnnouncement = document.getElementById('winnerAnnouncement');
        
        if (result.winner.id === this.socket.id) {
            gameResult.textContent = '🎉 Victory! 🎉';
            gameResult.style.color = '#2ecc71';
            winnerAnnouncement.innerHTML = `Congratulations! You conquered the most territory!`;
        } else {
            gameResult.textContent = '💀 Defeated 💀';
            gameResult.style.color = '#e74c3c';
            winnerAnnouncement.innerHTML = `<strong style="color: ${result.winner.color}">${result.winner.name}</strong> has claimed victory!`;
        }
        
        // Update leaderboard
        this.updateLeaderboard(result.leaderboard);
        
        // Update final stats
        this.updateFinalStats(result.finalStats);
    }
    
    updateLeaderboard(leaderboard) {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = '';
        
        leaderboard.forEach((player, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item animate-fade-in';
            itemDiv.style.borderLeftColor = player.color;
            itemDiv.style.animationDelay = `${index * 0.1}s`;
            
            const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣'][index] || `${index + 1}️⃣`;
            
            itemDiv.innerHTML = `
                <div class="player-rank">${rankEmoji}</div>
                <div class="player-details">
                    <div class="player-name">${player.name}</div>
                    <div class="player-stats-mini">
                        Territories: ${player.territories.length} | Resources: ${player.resources}
                    </div>
                </div>
                <div class="player-score-final">${player.finalScore}</div>
            `;
            
            leaderboardDiv.appendChild(itemDiv);
        });
    }
    
    updateFinalStats(stats) {
        const finalStatsDiv = document.getElementById('finalStats');
        finalStatsDiv.innerHTML = `
            <div class="stat-box animate-fade-in">
                <span class="stat-number">${stats.totalTurns}</span>
                <span class="stat-description">Total Turns</span>
            </div>
            <div class="stat-box animate-fade-in" style="animation-delay: 0.1s">
                <span class="stat-number">${stats.resourcesGenerated}</span>
                <span class="stat-description">Resources Found</span>
            </div>
            <div class="stat-box animate-fade-in" style="animation-delay: 0.2s">
                <span class="stat-number">${stats.totalTerritories}</span>
                <span class="stat-description">Total Territories</span>
            </div>
        `;
    }
    
    render() {
        if (this.canvas && this.ctx && this.gameState) {
            this.drawGame();
        }
        
        this.animationFrame = requestAnimationFrame(() => this.render());
    }
    
    drawGame() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw territories
        this.drawTerritories();
        
        // Draw resources
        this.drawResources();
        
        // Draw hover effect
        this.drawHoverEffect();
        
        // Draw grid lines
        this.drawGridLines();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                const pixelX = this.offsetX + x * this.cellSize;
                const pixelY = this.offsetY + y * this.cellSize;
                
                // Draw base cell
                ctx.fillStyle = '#34495e';
                ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
            }
        }
    }
    
    drawTerritories() {
        const ctx = this.ctx;
        
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                const cell = this.gameState.grid[y][x];
                const pixelX = this.offsetX + x * this.cellSize;
                const pixelY = this.offsetY + y * this.cellSize;
                
                if (cell.ownerId) {
                    const player = this.gameState.players.find(p => p.id === cell.ownerId);
                    if (player) {
                        // Territory color
                        ctx.fillStyle = player.color;
                        ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
                        
                        // Strength indicator
                        const strengthAlpha = Math.min(cell.strength / 50, 1);
                        ctx.fillStyle = `rgba(255, 255, 255, ${strengthAlpha * 0.3})`;
                        ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
                        
                        // Draw strength text
                        ctx.fillStyle = 'white';
                        ctx.font = '10px Inter';
                        ctx.textAlign = 'center';
                        ctx.fillText(
                            cell.strength.toString(),
                            pixelX + this.cellSize / 2,
                            pixelY + this.cellSize / 2 + 3
                        );
                    }
                }
            }
        }
    }
    
    drawResources() {
        const ctx = this.ctx;
        
        this.gameState.resources.forEach(resource => {
            const pixelX = this.offsetX + resource.x * this.cellSize;
            const pixelY = this.offsetY + resource.y * this.cellSize;
            
            // Resource glow effect
            const gradient = ctx.createRadialGradient(
                pixelX + this.cellSize / 2, pixelY + this.cellSize / 2, 0,
                pixelX + this.cellSize / 2, pixelY + this.cellSize / 2, this.cellSize / 2
            );
            gradient.addColorStop(0, 'rgba(241, 196, 15, 0.8)');
            gradient.addColorStop(1, 'rgba(241, 196, 15, 0.2)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
            
            // Resource icon
            ctx.fillStyle = '#f1c40f';
            ctx.font = '16px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('💎', pixelX + this.cellSize / 2, pixelY + this.cellSize / 2 + 5);
        });
    }
    
    drawHoverEffect() {
        if (!this.hoveredCell || !this.currentPlayer) return;
        
        const ctx = this.ctx;
        const { x, y } = this.hoveredCell;
        
        if (x >= 0 && x < this.GRID_WIDTH && y >= 0 && y < this.GRID_HEIGHT) {
            const pixelX = this.offsetX + x * this.cellSize;
            const pixelY = this.offsetY + y * this.cellSize;
            
            const isValid = this.isValidMove(x, y);
            
            ctx.strokeStyle = isValid ? '#2ecc71' : '#e74c3c';
            ctx.lineWidth = 3;
            ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
            
            if (isValid) {
                ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
                ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
            }
        }
    }
    
    drawGridLines() {
        const ctx = this.ctx;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.GRID_WIDTH; x++) {
            const pixelX = this.offsetX + x * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(pixelX, this.offsetY);
            ctx.lineTo(pixelX, this.offsetY + this.GRID_HEIGHT * this.cellSize);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.GRID_HEIGHT; y++) {
            const pixelY = this.offsetY + y * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(this.offsetX, pixelY);
            ctx.lineTo(this.offsetX + this.GRID_WIDTH * this.cellSize, pixelY);
            ctx.stroke();
        }
    }
    
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize the game when the page loads
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new TerritoryWarsClient();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (game) {
        game.destroy();
    }
});