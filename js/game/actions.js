// Game Actions
// Handles all player actions: play card, buy card, attack, end turn, etc.

import { GameState } from './state.js';
import { GameRules } from './rules.js';

export const GameActions = {
  // Play a card from hand
  playCard(playerId, cardId, cardData) {
    const player = GameState.players[playerId];
    const card = GameState.getCardById(cardId, cardData);

    if (!card) {
      return { success: false, error: "Card not found" };
    }

    // Remove from hand
    const cardIndex = player.hand.indexOf(cardId);
    if (cardIndex === -1) {
      return { success: false, error: "Card not in hand" };
    }

    player.hand.splice(cardIndex, 1);

    // Grant resources from card
    if (card.resources) {
      player.resources += card.resources;
    }

    // Execute card abilities
    this.executeCardAbilities(playerId, card, cardData);

    // Card goes to play area (will be discarded at end of turn)
    player.discard.push(cardId);

    return { success: true, card };
  },

  // Execute card abilities when played
  executeCardAbilities(playerId, card, cardData, skipResources = false) {
    const player = GameState.players[playerId];

    if (!card.abilities) return;

    card.abilities.forEach(ability => {
      switch (ability) {
        case 'draw':
          GameRules.drawCards(playerId, 1);
          break;

        case 'resources':
          if (!skipResources) {
            player.resources += 1;
          }
          break;

        case 'heal':
          // Return 1 ant from discard to hand
          if (player.discard.length > 0) {
            const antId = player.discard.pop();
            player.hand.push(antId);
          }
          break;

        case 'scout':
          // Look at top 3 cards - store them for interactive selection
          // If deck doesn't have enough cards, shuffle discard into deck first
          if (player.deck.length < 3 && player.discard.length > 0) {
            // Shuffle discard pile into deck
            player.deck.push(...player.discard);
            player.discard = [];

            // Shuffle the deck
            for (let i = player.deck.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
            }
          }

          const topCards = player.deck.splice(-3);
          if (topCards.length > 0) {
            // Store scout state for UI to handle
            GameState.pendingScout = {
              playerId: playerId,
              cards: topCards
            };
          }
          break;

        case 'sabotage':
          // Find opponents with ants in construction zones
          const opponents = Object.keys(GameState.players).filter(pid => {
            if (pid === playerId) return false; // Skip current player
            const opponent = GameState.players[pid];
            const hasAnts = Object.values(opponent.constructionZone || {}).some(ants => ants && ants.length > 0);
            return hasAnts;
          });

          // Sabotage the first opponent with construction (in 2-player, this is the only opponent)
          if (opponents.length > 0) {
            GameState.pendingSabotage = {
              playerId: opponents[0],
              saboteur: playerId
            };
          }
          break;

        case 'trash':
          // Allow player to trash a card from hand or discard pile
          GameState.pendingTrash = {
            playerId: playerId
          };
          break;

        // Other abilities handled in specific contexts
        default:
          break;
      }
    });

    // Special abilities based on card ID
    if (card.id === 'queen_ant') {
      GameRules.drawCards(playerId, 2);
      if (!skipResources) {
        player.resources += 2;
      }
    } else if (card.id === 'forager_ant') {
      if (!skipResources) {
        player.resources += 1;
      }
    } else if (card.id === 'heavy_lifter') {
      if (!skipResources) {
        player.resources += 2;
      }
    }
  },

  // Place an ant on a construction objective
  placeAntOnConstruction(playerId, cardId, objectiveId, cardData, constructionData) {
    const player = GameState.players[playerId];
    const card = GameState.getCardById(cardId, cardData);
    const objective = GameState.getObjectiveById(objectiveId, constructionData);

    if (!card || !objective) {
      return { success: false, error: "Card or objective not found" };
    }

    // Check if another player is already building this objective
    const claimedByOther = Object.keys(GameState.players).find(otherPlayerId => {
      if (otherPlayerId === playerId) return false; // Skip current player
      return GameState.players[otherPlayerId].constructionZone[objectiveId] !== undefined;
    });

    if (claimedByOther) {
      const claimingPlayer = GameState.players[claimedByOther];
      return { success: false, error: `${claimingPlayer.name} is already building this objective!` };
    }

    // Validate placement
    if (!GameRules.canPlaceOnConstruction(playerId, card, objectiveId)) {
      return { success: false, error: "Cannot place this ant on construction" };
    }

    // Add to construction zone (store card ID, not the full card object)
    if (!player.constructionZone[objectiveId]) {
      player.constructionZone[objectiveId] = [];
    }

    // Check if construction zone is already at capacity
    const currentAnts = player.constructionZone[objectiveId].length;
    if (currentAnts >= objective.antsRequired) {
      return { success: false, error: `This objective already has the maximum ${objective.antsRequired} ants` };
    }

    // Remove from hand
    const cardIndex = player.hand.indexOf(cardId);
    if (cardIndex === -1) {
      return { success: false, error: "Card not in hand" };
    }

    player.hand.splice(cardIndex, 1);

    // Add to construction zone
    player.constructionZone[objectiveId].push(cardId);

    // Execute card abilities (draw, scout, etc.) but skip resources
    this.executeCardAbilities(playerId, card, cardData, true);

    console.log(`Placed ${card.name} on ${objective.name}. Construction zone now has ${player.constructionZone[objectiveId].length} ants.`);
    console.log('Construction zone:', player.constructionZone);

    // Don't auto-complete - objectives will be scored at the start of the builder's next turn
    // This gives other players a chance to attack the objective

    return { success: true };
  },

  // Complete a construction objective
  completeObjective(playerId, objectiveId, cardData, constructionData) {
    const player = GameState.players[playerId];
    const objective = GameState.getObjectiveById(objectiveId, constructionData);

    if (!objective) return;

    // Scrap (permanently remove) all ants used in this construction
    const antsToScrap = player.constructionZone[objectiveId] || [];
    console.log(`Scrapping ${antsToScrap.length} ants from completed construction`);

    // Remove the construction zone entry (ants are not returned to discard, they're scrapped)
    delete player.constructionZone[objectiveId];

    // Add to completed objectives (so it shows as scored under the player's name)
    if (!player.completedObjectives.includes(objectiveId)) {
      player.completedObjectives.push(objectiveId);
    }

    // Award VP
    player.vp += objective.vp;

    // Grant rewards
    if (objective.reward) {
      switch (objective.reward.type) {
        case 'resources':
          player.resources += objective.reward.amount;
          break;

        case 'draw':
          GameRules.drawCards(playerId, objective.reward.amount);
          break;

        case 'card':
          // Add specific card to discard
          player.discard.push(objective.reward.cardId);
          break;

        case 'vp_multiplier':
          player.bonuses.vpMultiplier += objective.reward.amount;
          break;

        case 'defense':
          player.bonuses.defenseBonus += objective.reward.amount;
          break;

        case 'resources_per_turn':
          player.bonuses.resourcesPerTurn += objective.reward.amount;
          break;

        case 'instant_win':
          GameState.winner = playerId;
          GameState.status = 'finished';
          break;

        case 'vp_bonus':
          player.vp += objective.reward.amount;
          break;
      }
    }

    // Remove objective from construction row
    const index = GameState.constructionRow.indexOf(objectiveId);
    if (index !== -1) {
      GameState.constructionRow.splice(index, 1);
    }

    // Also remove from construction deck if it's still there
    const deckIndex = GameState.constructionDeck.indexOf(objectiveId);
    if (deckIndex !== -1) {
      GameState.constructionDeck.splice(deckIndex, 1);
    }

    // Check if we need to advance to next tier
    if (GameState.constructionDeck.length === 0 && GameState.constructionRow.length === 0) {
      // Current tier is exhausted, advance to next tier
      GameState.currentTier += 1;
      const nextTierObjectives = GameState.objectivesByTier[GameState.currentTier];
      if (nextTierObjectives) {
        GameState.constructionDeck = GameState.shuffle([...nextTierObjectives]);
      }
    }

    // Fill construction row with a new objective
    GameRules.fillConstructionRow();
  },

  // Buy a card from trade row
  buyCard(playerId, cardId, cardData) {
    const player = GameState.players[playerId];
    const card = GameState.getCardById(cardId, cardData);

    if (!card) {
      return { success: false, error: "Card not found" };
    }

    // Check if card is in trade row
    if (!GameState.tradeRow.includes(cardId)) {
      return { success: false, error: "Card not in trade row" };
    }

    // Check if player can afford it
    if (!GameRules.canAffordCard(playerId, card.cost)) {
      return { success: false, error: `Need ${card.cost} resources, have ${player.resources}` };
    }

    // Pay cost
    player.resources -= card.cost;

    // Remove from trade row
    const index = GameState.tradeRow.indexOf(cardId);
    GameState.tradeRow.splice(index, 1);

    // Add to player's discard
    player.discard.push(cardId);

    // Grant VP from card (one-time upon purchase)
    if (card.vp) {
      player.vp += card.vp;
    }

    // Refill trade row
    GameRules.fillTradeRow();

    return { success: true, card };
  },

  // Attack another player's construction
  attackPlayer(attackerId, targetId, cardIds, cardData) {
    const attacker = GameState.players[attackerId];
    const target = GameState.players[targetId];

    // Calculate total attack power
    let totalAttack = 0;
    const attackCards = [];

    cardIds.forEach(cardId => {
      const card = GameState.getCardById(cardId, cardData);
      if (card && attacker.hand.includes(cardId)) {
        totalAttack += card.attack || 0;
        attackCards.push(card);
      }
    });

    // Validate attack
    const validation = GameRules.canAttack(attackerId, targetId, totalAttack, cardData);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Remove attack cards from hand
    cardIds.forEach(cardId => {
      const index = attacker.hand.indexOf(cardId);
      if (index !== -1) {
        attacker.hand.splice(index, 1);
        attacker.discard.push(cardId);
      }
    });

    // Attack succeeds if attack > defense - destroy one construction objective
    const targetDefense = GameState.calculateDefense(targetId, cardData);

    if (totalAttack <= targetDefense) {
      return { success: false, error: `Attack failed! Need more than ${targetDefense} attack power.` };
    }

    // Find the objective with the most ants (most progress) to destroy
    let targetObjectiveId = null;
    let maxAnts = 0;

    Object.keys(target.constructionZone).forEach(objectiveId => {
      const antIds = target.constructionZone[objectiveId];
      if (antIds.length > maxAnts) {
        maxAnts = antIds.length;
        targetObjectiveId = objectiveId;
      }
    });

    // If no objectives in construction, attack fails
    if (!targetObjectiveId) {
      return { success: false, error: `${target.name} has no objectives to attack!` };
    }

    // Destroy the objective - return all ants to discard
    const destroyedAnts = target.constructionZone[targetObjectiveId];
    destroyedAnts.forEach(antId => {
      target.discard.push(antId);
    });

    const removed = destroyedAnts.length;
    delete target.constructionZone[targetObjectiveId];

    // Award VP to attacker for successful attack
    attacker.vp += 1;

    // Execute special attack abilities
    attackCards.forEach(card => {
      if (card.abilities && card.abilities.includes('steal')) {
        // Force opponent to discard a card
        if (target.hand.length > 0) {
          console.log('Setting pendingDiscard for player', targetId);
          GameState.pendingDiscard = {
            playerId: targetId,
            reason: 'stolen',
            attackerId: attackerId
          };
          console.log('pendingDiscard set:', GameState.pendingDiscard);
        } else {
          console.log('Target has no cards to discard');
        }
      }

      if (card.abilities && card.abilities.includes('sabotage')) {
        // Already handled in card play
      }
    });

    return {
      success: true,
      antsRemoved: removed,
      attackPower: totalAttack,
      objectiveDestroyed: targetObjectiveId
    };
  },

  // Score any completable objectives for the next player
  scorePlayerObjectives(playerId, cardData, constructionData) {
    const player = GameState.players[playerId];
    const objectivesToScore = [];

    // Check which objectives can be scored
    Object.keys(player.constructionZone).forEach(objectiveId => {
      if (GameState.isObjectiveComplete(playerId, objectiveId, constructionData, cardData)) {
        objectivesToScore.push(objectiveId);
      }
    });

    // Score all completable objectives
    objectivesToScore.forEach(objectiveId => {
      console.log(`Scoring objective ${objectiveId} for player ${playerId}`);
      this.completeObjective(playerId, objectiveId, cardData, constructionData);
    });

    return { scored: objectivesToScore.length };
  },

  // Complete scout action with player's card selection
  completeScout(selectedCardId) {
    if (!GameState.pendingScout) {
      return { success: false, error: "No pending scout action" };
    }

    const { playerId, cards } = GameState.pendingScout;
    const player = GameState.players[playerId];

    if (!cards.includes(selectedCardId)) {
      return { success: false, error: "Invalid card selection" };
    }

    // Add selected card to hand
    player.hand.push(selectedCardId);

    // Put remaining cards on bottom of deck
    const remainingCards = cards.filter(c => c !== selectedCardId);
    player.deck.unshift(...remainingCards);

    // Clear pending scout
    GameState.pendingScout = null;

    return { success: true };
  },

  // Complete forced discard with player's card selection
  completeDiscard(selectedCardId) {
    if (!GameState.pendingDiscard) {
      return { success: false, error: "No pending discard" };
    }

    const { playerId } = GameState.pendingDiscard;
    const player = GameState.players[playerId];

    if (!player.hand.includes(selectedCardId)) {
      return { success: false, error: "Invalid card selection" };
    }

    // Remove card from hand and put in discard
    const cardIndex = player.hand.indexOf(selectedCardId);
    player.hand.splice(cardIndex, 1);
    player.discard.push(selectedCardId);

    // Clear pending discard
    GameState.pendingDiscard = null;

    return { success: true };
  },

  // Complete sabotage with player's ant selection
  completeSabotage(selectedAntId) {
    if (!GameState.pendingSabotage) {
      return { success: false, error: "No pending sabotage" };
    }

    const { playerId } = GameState.pendingSabotage;
    const player = GameState.players[playerId];

    // Find which objective has this ant
    let foundObjective = null;
    let antIndex = -1;

    Object.keys(player.constructionZone).forEach(objectiveId => {
      const ants = player.constructionZone[objectiveId];
      const index = ants.indexOf(selectedAntId);
      if (index !== -1) {
        foundObjective = objectiveId;
        antIndex = index;
      }
    });

    if (foundObjective === null) {
      return { success: false, error: "Invalid ant selection" };
    }

    // Remove ant from construction zone
    player.constructionZone[foundObjective].splice(antIndex, 1);

    // If no ants left on this objective, remove the objective entry
    if (player.constructionZone[foundObjective].length === 0) {
      delete player.constructionZone[foundObjective];
    }

    // Ant goes to discard pile
    player.discard.push(selectedAntId);

    // Clear pending sabotage
    GameState.pendingSabotage = null;

    return { success: true };
  },

  // Complete trash with player's card selection
  completeTrash(selectedCardId) {
    if (!GameState.pendingTrash) {
      return { success: false, error: "No pending trash" };
    }

    const { playerId } = GameState.pendingTrash;
    const player = GameState.players[playerId];

    // Try to find and remove card from hand
    const handIndex = player.hand.indexOf(selectedCardId);
    if (handIndex !== -1) {
      player.hand.splice(handIndex, 1);
      // Card is permanently removed (not added to discard)
      GameState.pendingTrash = null;
      return { success: true, location: 'hand' };
    }

    // Try to find and remove card from discard
    const discardIndex = player.discard.indexOf(selectedCardId);
    if (discardIndex !== -1) {
      player.discard.splice(discardIndex, 1);
      // Card is permanently removed (not added back anywhere)
      GameState.pendingTrash = null;
      return { success: true, location: 'discard' };
    }

    return { success: false, error: "Card not found in hand or discard" };
  },

  // End current player's turn
  endTurn(playerId, cardData, constructionData) {
    if (GameState.currentPlayer !== playerId) {
      return { success: false, error: "Not your turn" };
    }

    // End the turn (move to next player)
    GameRules.endTurn(playerId);

    // Score objectives for the player whose turn it now is
    // (This gives other players a chance to attack objectives before they score)
    this.scorePlayerObjectives(GameState.currentPlayer, cardData, constructionData);

    return { success: true };
  }
};
