// Game State Management
// Handles all game state including players, decks, hands, trade row, construction row, etc.

export const GameState = {
  gameId: null,
  players: {},
  currentPlayer: null,
  turnPhase: 'action', // 'action', 'buy', 'cleanup'
  tradeRow: [],
  constructionRow: [],
  marketDeck: [],
  constructionDeck: [],
  startedAt: null,
  status: 'waiting', // 'waiting', 'active', 'finished'
  winner: null,

  // Player state template
  createPlayerState(playerId, playerName) {
    return {
      id: playerId,
      name: playerName,
      deck: [],
      hand: [],
      discard: [],
      constructionZone: {}, // Objective ID -> array of ants placed on it
      resources: 0,
      vp: 0,
      bonuses: {
        resourcesPerTurn: 0,
        defenseBonus: 0,
        vpMultiplier: 1,
        doubleVpFromAnts: false
      },
      ready: false
    };
  },

  // Initialize game state
  init(gameId, players) {
    this.gameId = gameId;
    this.players = {};
    this.turnPhase = 'action';
    this.tradeRow = [];
    this.constructionRow = [];
    this.marketDeck = [];
    this.constructionDeck = [];
    this.status = 'waiting';
    this.winner = null;

    // Create player states
    players.forEach(player => {
      this.players[player.id] = this.createPlayerState(player.id, player.name);
    });

    // Set first player
    this.currentPlayer = players[0].id;
  },

  // Load state from Firebase
  loadState(stateData) {
    Object.assign(this, stateData);

    // Helper to convert Firebase object to array
    const toArray = (obj) => {
      if (Array.isArray(obj)) return obj;
      if (!obj) return [];
      if (typeof obj === 'object') {
        return Object.values(obj);
      }
      return [];
    };

    // Ensure arrays are properly initialized (Firebase converts empty arrays to null)
    this.tradeRow = toArray(this.tradeRow);
    this.constructionRow = toArray(this.constructionRow);
    this.marketDeck = toArray(this.marketDeck);
    this.constructionDeck = toArray(this.constructionDeck);

    // Ensure player arrays are initialized
    Object.keys(this.players || {}).forEach(playerId => {
      const player = this.players[playerId];
      player.deck = toArray(player.deck);
      player.hand = toArray(player.hand);
      player.discard = toArray(player.discard);
      player.constructionZone = player.constructionZone || {};
      player.bonuses = player.bonuses || {
        resourcesPerTurn: 0,
        defenseBonus: 0,
        vpMultiplier: 1,
        doubleVpFromAnts: false
      };
    });
  },

  // Get current player state
  getCurrentPlayer() {
    return this.players[this.currentPlayer];
  },

  // Get player by ID
  getPlayer(playerId) {
    return this.players[playerId];
  },

  // Move to next player
  nextPlayer() {
    const playerIds = Object.keys(this.players);
    const currentIndex = playerIds.indexOf(this.currentPlayer);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    this.currentPlayer = playerIds[nextIndex];
  },

  // Get card from market deck by ID
  getCardById(cardId, cardData) {
    return cardData.ants.find(card => card.id === cardId);
  },

  // Get construction objective by ID
  getObjectiveById(objectiveId, constructionData) {
    return constructionData.objectives.find(obj => obj.id === objectiveId);
  },

  // Check if construction objective is completed
  isObjectiveComplete(playerId, objectiveId, constructionData) {
    const objective = this.getObjectiveById(objectiveId, constructionData);
    const antsOnObjective = this.players[playerId].constructionZone[objectiveId] || [];

    // Count ants, considering special abilities
    let antCount = 0;
    antsOnObjective.forEach(ant => {
      if (ant.abilities && ant.abilities.includes('double_build')) {
        antCount += 2;
      } else {
        antCount += 1;
      }
    });

    return antCount >= objective.antsRequired;
  },

  // Calculate total VP for a player
  calculateVP(playerId, cardData, constructionData) {
    const player = this.players[playerId];
    let totalVP = player.vp;

    // VP from cards in deck
    const allCards = [...player.deck, ...player.hand, ...player.discard];
    allCards.forEach(cardId => {
      const card = this.getCardById(cardId, cardData);
      if (card) {
        let cardVP = card.vp;
        if (player.bonuses.doubleVpFromAnts) {
          cardVP *= 2;
        }
        totalVP += cardVP;
      }
    });

    // VP from ants in construction zone
    Object.values(player.constructionZone).forEach(ants => {
      ants.forEach(ant => {
        let antVP = ant.vp || 0;
        if (player.bonuses.doubleVpFromAnts) {
          antVP *= 2;
        }
        totalVP += antVP;
      });
    });

    // Apply VP multiplier
    totalVP *= player.bonuses.vpMultiplier;

    return totalVP;
  },

  // Calculate total defense for a player's construction zone
  calculateDefense(playerId) {
    const player = this.players[playerId];
    let totalDefense = player.bonuses.defenseBonus;

    Object.values(player.constructionZone).forEach(ants => {
      ants.forEach(ant => {
        totalDefense += ant.defense || 0;
      });
    });

    return totalDefense;
  },

  // Shuffle array (Fisher-Yates)
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Serialize state for Firebase
  serialize() {
    // Firebase doesn't handle empty arrays well, so we ensure all arrays are properly formatted
    const serializedPlayers = {};
    Object.keys(this.players).forEach(playerId => {
      const player = this.players[playerId];
      serializedPlayers[playerId] = {
        id: player.id,
        name: player.name,
        deck: player.deck || [],
        hand: player.hand || [],
        discard: player.discard || [],
        constructionZone: player.constructionZone || {},
        resources: player.resources || 0,
        vp: player.vp || 0,
        bonuses: player.bonuses || {
          resourcesPerTurn: 0,
          defenseBonus: 0,
          vpMultiplier: 1,
          doubleVpFromAnts: false
        },
        ready: player.ready || false
      };
    });

    return {
      gameId: this.gameId,
      players: serializedPlayers,
      currentPlayer: this.currentPlayer,
      turnPhase: this.turnPhase,
      tradeRow: this.tradeRow || [],
      constructionRow: this.constructionRow || [],
      marketDeck: this.marketDeck || [],
      constructionDeck: this.constructionDeck || [],
      startedAt: this.startedAt,
      status: this.status,
      winner: this.winner
    };
  }
};
