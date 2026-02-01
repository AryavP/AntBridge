// Game Rules and Mechanics
// Handles core game logic, turn phases, card drawing, win conditions, etc.

import { GameState } from './state.js';

export const GameRules = {
  HAND_SIZE: 5,
  TRADE_ROW_SIZE: 5,
  CONSTRUCTION_ROW_SIZE: 1,  // Only show 1 objective at a time

  // Initialize game with starter decks and market
  setupGame(cardData, starterDeckData, constructionData) {
    // Give each player their starter deck
    Object.keys(GameState.players).forEach(playerId => {
      const player = GameState.players[playerId];
      player.deck = GameState.shuffle([...starterDeckData.starterDeck]);
      player.hand = [];
      player.discard = [];
      player.resources = 0;
      player.vp = 0;
    });

    // Create market deck (all available cards)
    GameState.marketDeck = GameState.shuffle([
      ...this.createMarketPool(cardData)
    ]);

    // Create construction deck organized by tier
    // Group objectives by tier
    const objectivesByTier = {};
    constructionData.objectives.forEach(obj => {
      if (!objectivesByTier[obj.tier]) {
        objectivesByTier[obj.tier] = [];
      }
      objectivesByTier[obj.tier].push(obj.id);
    });

    // Shuffle within each tier and store
    GameState.constructionDeck = [];
    GameState.objectivesByTier = objectivesByTier;
    GameState.currentTier = 1;  // Start at tier 1

    // Shuffle tier 1 objectives for the starting pool
    if (objectivesByTier[1]) {
      GameState.constructionDeck = GameState.shuffle([...objectivesByTier[1]]);
    }

    // Fill trade row and construction row
    this.fillTradeRow();
    this.fillConstructionRow();

    // Each player draws starting hand
    Object.keys(GameState.players).forEach(playerId => {
      this.drawCards(playerId, this.HAND_SIZE);
    });

    GameState.status = 'active';
    GameState.startedAt = Date.now();
  },

  // Create pool of cards for market (copies defined per card in cards.json)
  createMarketPool(cardData) {
    const pool = [];
    cardData.ants.forEach(card => {
      // Skip starter cards (cost 0) - they don't appear in trade row
      if (card.cost === 0) return;

      // Use copies field from card data, default to 0 if not specified
      const quantity = card.copies || 0;

      for (let i = 0; i < quantity; i++) {
        pool.push(card.id);
      }
    });
    return pool;
  },

  // Reshuffle cards back into the market deck (batch operation)
  reshuffleToMarket(cardIds) {
    if (cardIds.length === 0) return;
    GameState.marketDeck.push(...cardIds);
    GameState.marketDeck = GameState.shuffle(GameState.marketDeck);
  },

  // Fill trade row with cards from market deck
  fillTradeRow() {
    while (GameState.tradeRow.length < this.TRADE_ROW_SIZE && GameState.marketDeck.length > 0) {
      GameState.tradeRow.push(GameState.marketDeck.pop());
    }
  },

  // Fill construction row with objectives
  fillConstructionRow() {
    while (GameState.constructionRow.length < this.CONSTRUCTION_ROW_SIZE && GameState.constructionDeck.length > 0) {
      GameState.constructionRow.push(GameState.constructionDeck.pop());
    }
  },

  // Draw cards for a player
  drawCards(playerId, count) {
    const player = GameState.players[playerId];

    for (let i = 0; i < count; i++) {
      // If deck is empty, shuffle discard into deck
      if (player.deck.length === 0) {
        if (player.discard.length === 0) {
          break; // No cards to draw
        }
        player.deck = GameState.shuffle([...player.discard]);
        player.discard = [];
      }

      // Draw card
      if (player.deck.length > 0) {
        player.hand.push(player.deck.pop());
      }
    }
  },

  // Start of turn
  startTurn(playerId) {
    const player = GameState.players[playerId];

    // Note: Objective scoring happens in endTurn (of the previous player)
    // right before calling nextPlayer/startTurn

    // Gain resources per turn bonus
    player.resources += player.bonuses.resourcesPerTurn;

    GameState.turnPhase = 'action';

    GameState.addFeedEvent('turn_start', playerId, player.name, {});
  },

  // End of turn - discard hand and draw new cards
  endTurn(playerId) {
    const player = GameState.players[playerId];

    GameState.addFeedEvent('turn_end', playerId, player.name, {});

    // Discard entire hand
    player.discard.push(...player.hand);
    player.hand = [];

    // Reset resources and attack power (unused resources/attack don't carry over)
    player.resources = 0;
    player.attackPower = 0;

    // Clear all pending events when turn ends
    // Events should be handled immediately and shouldn't carry over between turns
    GameState.pendingScout = null;
    GameState.pendingDiscard = null;
    GameState.pendingSabotage = null;
    GameState.pendingTrash = null;
    GameState.pendingClear = null;

    // Draw new hand
    this.drawCards(playerId, this.HAND_SIZE);

    // Move to next player
    GameState.nextPlayer();

    // Start next turn
    this.startTurn(GameState.currentPlayer);

    // Check if game should end
    this.checkEndGame();
  },

  // Check if game has ended
  checkEndGame() {
    // Game ends when construction deck is exhausted
    if (GameState.constructionDeck.length === 0 && GameState.constructionRow.length === 0) {
      this.endGame();
    }

    // Check for instant win condition
    Object.keys(GameState.players).forEach(playerId => {
      const player = GameState.players[playerId];
      Object.keys(player.constructionZone).forEach(objectiveId => {
        // Check if this objective has instant win
        // This would be checked in actions when completing an objective
      });
    });
  },

  // End game and determine winner
  endGame() {
    GameState.status = 'finished';

    // Calculate final VP for all players
    let highestVP = -1;
    let winnerId = null;

    Object.keys(GameState.players).forEach(playerId => {
      const vp = GameState.calculateVP(playerId);
      if (vp > highestVP) {
        highestVP = vp;
        winnerId = playerId;
      }
    });

    GameState.winner = winnerId;
  },

  // Check if player can afford a card
  canAffordCard(playerId, cardCost) {
    return GameState.players[playerId].resources >= cardCost;
  },

  // Validate if a card can be played
  canPlayCard(playerId, cardId, cardData) {
    const player = GameState.players[playerId];
    return player.hand.includes(cardId);
  },

  // Validate if an ant can be placed on construction objective
  canPlaceOnConstruction(playerId, antCard, objectiveId) {
    // Check if objective is in construction row
    if (!GameState.constructionRow.includes(objectiveId)) {
      return false;
    }

    return true;
  },

  // Validate attack
  canAttack(attackerId, targetId, attackPower, cardData) {
    if (attackerId === targetId) {
      return { valid: false, reason: "Cannot attack yourself" };
    }

    const targetDefense = GameState.calculateDefense(targetId, cardData);

    if (attackPower <= targetDefense) {
      return { valid: false, reason: `Attack power (${attackPower}) must exceed defense (${targetDefense})` };
    }

    return { valid: true };
  }
};
