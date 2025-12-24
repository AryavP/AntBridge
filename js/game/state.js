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
  objectivesByTier: {},  // Organized objectives by tier
  currentTier: 1,  // Current construction tier
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
      completedObjectives: [], // Array of objective IDs that this player has scored
      resources: 0,
      vp: 0,
      bonuses: {
        resourcesPerTurn: 0,
        defenseBonus: 0,
        vpMultiplier: 1
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
    console.log('Loading state from Firebase:', stateData);

    // Log the raw constructionZone data from Firebase BEFORE any processing
    if (stateData.players) {
      Object.keys(stateData.players).forEach(pid => {
        console.log(`RAW Firebase data for player ${pid} constructionZone:`, stateData.players[pid].constructionZone);
      });
    }

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
      console.log(`Loading player ${playerId}, constructionZone from Firebase:`, player.constructionZone);

      player.deck = toArray(player.deck);
      player.hand = toArray(player.hand);
      player.discard = toArray(player.discard);
      player.constructionZone = player.constructionZone || {};
      player.completedObjectives = toArray(player.completedObjectives);

      // Convert constructionZone ant arrays from Firebase objects to arrays
      // Firebase sometimes converts objects to arrays or objects with numeric keys
      if (player.constructionZone && typeof player.constructionZone === 'object') {
        // Check if constructionZone itself was converted to an array by Firebase
        if (Array.isArray(player.constructionZone)) {
          console.log('WARNING: constructionZone is an array from Firebase, attempting to reconstruct');
          // Firebase converted our object to an array - convert back
          const reconstructed = {};
          player.constructionZone.forEach((value, index) => {
            if (value && typeof value === 'object') {
              // This array element should be an objective's ants
              // But we've lost the objectiveId - this is a Firebase limitation
              // We need to prevent this from happening in the first place
              console.error('Cannot reconstruct constructionZone from array - objective IDs lost');
            }
          });
          player.constructionZone = reconstructed;
        } else {
          // constructionZone is an object (correct structure)
          Object.keys(player.constructionZone).forEach(objectiveId => {
            console.log(`Converting constructionZone[${objectiveId}]:`, player.constructionZone[objectiveId]);
            const ants = player.constructionZone[objectiveId];

            // Convert to array if it's an object with numeric keys
            if (ants && !Array.isArray(ants) && typeof ants === 'object') {
              player.constructionZone[objectiveId] = toArray(ants);
              console.log(`Converted from object to array:`, player.constructionZone[objectiveId]);
            } else if (!ants) {
              console.log(`Ants is null/undefined for ${objectiveId}, removing entry`);
              delete player.constructionZone[objectiveId];
            } else if (!Array.isArray(ants)) {
              console.log(`Invalid ants structure for ${objectiveId}, resetting to empty array`);
              player.constructionZone[objectiveId] = [];
            }
          });
        }
      } else {
        console.log('constructionZone is not an object, resetting to {}');
        player.constructionZone = {};
      }

      console.log(`After conversion, player ${playerId} constructionZone:`, player.constructionZone);

      player.bonuses = player.bonuses || {
        resourcesPerTurn: 0,
        defenseBonus: 0,
        vpMultiplier: 1
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
  isObjectiveComplete(playerId, objectiveId, constructionData, cardData) {
    const objective = this.getObjectiveById(objectiveId, constructionData);
    const antIds = this.players[playerId].constructionZone[objectiveId] || [];

    // Count ants, considering special abilities
    let antCount = 0;
    antIds.forEach(antId => {
      // Note: antId is now a card ID string, not a card object
      // For now, just count each ant as 1
      // If we need to support double_build ability, we'd need to pass cardData and look up the card
      antCount += 1;
    });

    return antCount >= objective.antsRequired;
  },

  // Calculate total VP for a player
  calculateVP(playerId) {
    const player = this.players[playerId];
    let totalVP = player.vp;

    // VP is now granted once upon purchase, not counted from cards
    // Only apply bonuses and multipliers to base VP

    // Apply VP multiplier
    totalVP *= player.bonuses.vpMultiplier;

    return totalVP;
  },

  // Calculate total defense for a player's construction zone
  calculateDefense(playerId, cardData) {
    const player = this.players[playerId];
    let totalDefense = player.bonuses.defenseBonus;

    Object.values(player.constructionZone).forEach(antIds => {
      antIds.forEach(antId => {
        const ant = this.getCardById(antId, cardData);
        if (ant) {
          totalDefense += ant.defense || 0;
        }
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

      console.log(`Serializing player ${playerId}, constructionZone:`, player.constructionZone);

      // Ensure constructionZone arrays are properly formatted
      const serializedConstructionZone = {};
      if (player.constructionZone) {
        Object.keys(player.constructionZone).forEach(objectiveId => {
          const ants = player.constructionZone[objectiveId];
          // Ensure it's an array
          serializedConstructionZone[objectiveId] = Array.isArray(ants) ? ants : [];
        });
      }

      console.log(`Serialized constructionZone:`, serializedConstructionZone);

      serializedPlayers[playerId] = {
        id: player.id,
        name: player.name,
        deck: player.deck || [],
        hand: player.hand || [],
        discard: player.discard || [],
        constructionZone: serializedConstructionZone,
        completedObjectives: player.completedObjectives || [],
        resources: player.resources || 0,
        vp: player.vp || 0,
        bonuses: player.bonuses || {
          resourcesPerTurn: 0,
          defenseBonus: 0,
          vpMultiplier: 1
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
      objectivesByTier: this.objectivesByTier || {},
      currentTier: this.currentTier || 1,
      startedAt: this.startedAt,
      status: this.status,
      winner: this.winner
    };
  }
};
