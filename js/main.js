// Main Entry Point
// Initializes the game, handles Firebase connection, and coordinates all modules

import { GameState } from './game/state.js';
import { GameRules } from './game/rules.js';
import { GameActions } from './game/actions.js';
import { UIRender } from './ui/render.js';
import { EventHandlers } from './ui/events.js';

// Firebase configuration
const firebaseConfig = {
  // TODO: Replace with your Firebase config
  apiKey: "AIzaSyAhqfCscSs42lPQ6pJAHq7I08bxn0p8xtQ",
  authDomain: "ant-bridge-dc8f5.firebaseapp.com",
  databaseURL: "https://ant-bridge-dc8f5-default-rtdb.firebaseio.com/",
  projectId: "ant-bridge-dc8f5",
  storageBucket: "ant-bridge-dc8f5.firebasestorage.app",
  messagingSenderId: "708836264910",
  appId: "1:708836264910:web:d00f24897f9f6f3114f99f"
};

class AntBridgeGame {
  constructor() {
    this.db = null;
    this.gameRef = null;
    this.playerId = null;
    this.playerName = null;
    this.gameId = null;
    this.cardData = null;
    this.constructionData = null;
    this.starterDeckData = null;
  }

  // Initialize Firebase
  async initFirebase() {
    try {
      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);
      this.db = firebase.database();
      console.log('Firebase initialized');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  // Load game data from JSON files
  async loadGameData() {
    try {
      const [cards, construction, starterDeck] = await Promise.all([
        fetch('./js/data/cards.json').then(r => r.json()),
        fetch('./js/data/construction.json').then(r => r.json()),
        fetch('./js/data/starter-deck.json').then(r => r.json())
      ]);

      this.cardData = cards;
      this.constructionData = construction;
      this.starterDeckData = starterDeck;

      console.log('Game data loaded');
    } catch (error) {
      console.error('Error loading game data:', error);
      throw error;
    }
  }

  // Initialize the game
  async init() {
    try {
      // Show loading screen
      this.showLoading(true);

      // Load game data
      await this.loadGameData();

      // Initialize Firebase
      await this.initFirebase();

      // Generate player ID
      this.playerId = this.generatePlayerId();

      // Show lobby
      this.showLobby();

    } catch (error) {
      console.error('Initialization error:', error);
      this.showError('Failed to initialize game. Please refresh the page.');
    } finally {
      this.showLoading(false);
    }
  }

  // Show/hide loading screen
  showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) {
      loader.style.display = show ? 'block' : 'none';
    }
  }

  // Show error message
  showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  // Show lobby screen
  showLobby() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');

    if (lobbyScreen) lobbyScreen.style.display = 'block';
    if (gameScreen) gameScreen.style.display = 'none';

    // Attach lobby event listeners
    const createGameBtn = document.getElementById('create-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');

    if (createGameBtn) {
      createGameBtn.onclick = () => this.createGame();
    }

    if (joinGameBtn) {
      joinGameBtn.onclick = () => {
        const gameId = document.getElementById('game-id-input').value;
        if (gameId) {
          this.joinGame(gameId);
        }
      };
    }
  }

  // Create a new game
  async createGame() {
    const playerName = document.getElementById('player-name-input').value || 'Player';
    this.playerName = playerName;

    // Generate game ID
    this.gameId = this.generateGameId();

    // Create game in Firebase
    this.gameRef = this.db.ref(`games/${this.gameId}`);

    const initialGameState = {
      id: this.gameId,
      status: 'waiting',
      host: this.playerId,
      players: {
        [this.playerId]: {
          id: this.playerId,
          name: playerName,
          ready: false
        }
      },
      createdAt: Date.now()
    };

    await this.gameRef.set(initialGameState);

    // Show waiting room
    this.showWaitingRoom();

    // Listen for game updates
    this.listenToGame();
  }

  // Join an existing game
  async joinGame(gameId) {
    const playerName = document.getElementById('player-name-input').value || 'Player';
    this.playerName = playerName;
    this.gameId = gameId;

    this.gameRef = this.db.ref(`games/${gameId}`);

    // Check if game exists
    const snapshot = await this.gameRef.once('value');
    if (!snapshot.exists()) {
      this.showError('Game not found');
      return;
    }

    const gameData = snapshot.val();

    // Check if game is full (max 4 players)
    if (Object.keys(gameData.players || {}).length >= 4) {
      this.showError('Game is full');
      return;
    }

    // Check if game already started
    if (gameData.status !== 'waiting') {
      this.showError('Game already started');
      return;
    }

    // Add player to game
    await this.gameRef.child(`players/${this.playerId}`).set({
      id: this.playerId,
      name: playerName,
      ready: false
    });

    // Show waiting room
    this.showWaitingRoom();

    // Listen for game updates
    this.listenToGame();
  }

  // Show waiting room
  showWaitingRoom() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const waitingRoom = document.getElementById('waiting-room');

    if (lobbyScreen) lobbyScreen.style.display = 'none';
    if (waitingRoom) waitingRoom.style.display = 'block';

    // Display game ID
    const gameIdDisplay = document.getElementById('game-id-display');
    if (gameIdDisplay) {
      gameIdDisplay.textContent = `Game ID: ${this.gameId}`;
    }

    // Ready button
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
      readyBtn.onclick = () => this.toggleReady();
    }

    // Start game button (only for host)
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.onclick = () => this.startGame();
    }
  }

  // Toggle player ready status
  async toggleReady() {
    await this.gameRef.child(`players/${this.playerId}/ready`).set(true);
  }

  // Start the game (host only)
  async startGame() {
    const snapshot = await this.gameRef.once('value');
    const gameData = snapshot.val();

    // Check if all players are ready
    const players = Object.values(gameData.players);
    const allReady = players.every(p => p.ready);

    if (!allReady) {
      this.showError('All players must be ready');
      return;
    }

    if (players.length < 1) {
      this.showError('Need at least 1 player');
      return;
    }

    // Initialize game state
    GameState.init(this.gameId, players);
    GameRules.setupGame(this.cardData, this.starterDeckData, this.constructionData);

    // Debug logging
    console.log('Game initialized:', {
      players: Object.keys(GameState.players),
      tradeRow: GameState.tradeRow.length,
      constructionRow: GameState.constructionRow.length,
      currentPlayer: GameState.currentPlayer
    });

    const currentPlayer = GameState.getCurrentPlayer();
    console.log('Current player hand:', currentPlayer.hand.length);

    // Update Firebase with full game state
    await this.gameRef.update(GameState.serialize());

    // Start game UI
    this.showGameScreen();
  }

  // Listen to game updates from Firebase
  listenToGame() {
    let gameInitialized = false;

    this.gameRef.on('value', (snapshot) => {
      const gameData = snapshot.val();

      if (!gameData) return;

      // Update waiting room if in lobby
      if (gameData.status === 'waiting') {
        this.updateWaitingRoom(gameData);
      }

      // Load game state if game is active
      if (gameData.status === 'active' || gameData.status === 'finished') {
        GameState.loadState(gameData);

        // Only initialize UI once
        if (!gameInitialized) {
          this.showGameScreen();
          gameInitialized = true;
        } else {
          // Just update the rendering, don't re-initialize
          UIRender.renderGame();
          // Restore selection UI after rendering
          if (window.eventHandlers) {
            window.eventHandlers.updateSelectionUI();
            // Check for pending actions when state updates (e.g., when turn changes)
            window.eventHandlers.checkPendingScout();
            window.eventHandlers.checkPendingDiscard();
            window.eventHandlers.checkPendingSabotage();
          }
        }
      }
    });
  }

  // Update waiting room UI
  updateWaitingRoom(gameData) {
    const playersList = document.getElementById('players-list');
    if (!playersList) return;

    playersList.innerHTML = '';

    Object.values(gameData.players).forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'waiting-player';
      playerDiv.innerHTML = `
        <span>${player.name}</span>
        <span class="${player.ready ? 'ready' : 'not-ready'}">
          ${player.ready ? '✓ Ready' : 'Not Ready'}
        </span>
      `;
      playersList.appendChild(playerDiv);
    });

    // Show start button only for host
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.style.display = gameData.host === this.playerId ? 'block' : 'none';
    }
  }

  // Show game screen
  showGameScreen() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const waitingRoom = document.getElementById('waiting-room');
    const gameScreen = document.getElementById('game-screen');

    if (lobbyScreen) lobbyScreen.style.display = 'none';
    if (waitingRoom) waitingRoom.style.display = 'none';
    if (gameScreen) gameScreen.style.display = 'block';

    // Initialize UI
    UIRender.init(this.cardData, this.constructionData, this.playerId);
    EventHandlers.init(this.cardData, this.constructionData, this.playerId, (state) => {
      this.updateGameState(state);
    });

    // Store reference for later use
    window.eventHandlers = EventHandlers;

    // Render initial state
    UIRender.renderGame();
  }

  // Update game state to Firebase
  async updateGameState(state) {
    try {
      console.log('Updating Firebase with state:', state);

      // Log specifically the constructionZone data being sent
      if (state.players) {
        Object.keys(state.players).forEach(playerId => {
          if (state.players[playerId].constructionZone) {
            console.log(`Sending to Firebase - player ${playerId} constructionZone:`,
                       state.players[playerId].constructionZone);
          }
        });
      }

      await this.gameRef.update(state);
      console.log('Firebase update completed');
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  }

  // Generate unique player ID
  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate unique game ID
  generateGameId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new AntBridgeGame();
  game.init();

  // Expose game instance for debugging
  window.antBridgeGame = game;
});
