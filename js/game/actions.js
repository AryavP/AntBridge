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
  executeCardAbilities(playerId, card, cardData) {
    const player = GameState.players[playerId];

    if (!card.abilities) return;

    card.abilities.forEach(ability => {
      switch (ability) {
        case 'draw':
          GameRules.drawCards(playerId, 1);
          break;

        case 'resources':
          player.resources += 1;
          break;

        case 'heal':
          // Return 1 ant from discard to hand
          if (player.discard.length > 0) {
            const antId = player.discard.pop();
            player.hand.push(antId);
          }
          break;

        case 'scout':
          // Look at top 3 cards, put 1 in hand, rest on bottom
          const topCards = player.deck.splice(-3);
          if (topCards.length > 0) {
            player.hand.push(topCards[0]); // Take first card
            player.deck.unshift(...topCards.slice(1)); // Rest to bottom
          }
          break;

        // Other abilities handled in specific contexts
        default:
          break;
      }
    });

    // Special abilities based on card ID
    if (card.id === 'queen_ant') {
      GameRules.drawCards(playerId, 2);
      player.resources += 2;
    } else if (card.id === 'forager_ant') {
      player.resources += 1;
    } else if (card.id === 'heavy_lifter') {
      player.resources += 2;
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

    // Validate placement
    if (!GameRules.canPlaceOnConstruction(playerId, card, objectiveId)) {
      return { success: false, error: "Cannot place this ant on construction" };
    }

    // Remove from hand
    const cardIndex = player.hand.indexOf(cardId);
    if (cardIndex === -1) {
      return { success: false, error: "Card not in hand" };
    }

    player.hand.splice(cardIndex, 1);

    // Don't grant resources when placing on construction
    // Resources are only granted when playing cards explicitly for resources

    // Add to construction zone (store card ID, not the full card object)
    if (!player.constructionZone[objectiveId]) {
      player.constructionZone[objectiveId] = [];
    }
    player.constructionZone[objectiveId].push(cardId);

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

        case 'game_bonus':
          if (objective.reward.effect === 'double_vp_from_ants') {
            player.bonuses.doubleVpFromAnts = true;
          }
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

      // Check if we need to advance to next tier
      if (GameState.constructionDeck.length === 0 && GameState.constructionRow.length === 0) {
        // Current tier is exhausted, advance to next tier
        GameState.currentTier += 1;
        const nextTierObjectives = GameState.objectivesByTier[GameState.currentTier];
        if (nextTierObjectives) {
          GameState.constructionDeck = GameState.shuffle([...nextTierObjectives]);
        }
      }

      GameRules.fillConstructionRow();
    }
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

    // Attack succeeds - remove ants from target's construction
    const antsToRemove = Math.floor((totalAttack - GameState.calculateDefense(targetId, cardData)) / 2);
    let removed = 0;

    // Remove ants from construction zone
    Object.keys(target.constructionZone).forEach(objectiveId => {
      if (removed >= antsToRemove) return;

      const antIds = target.constructionZone[objectiveId];
      while (antIds.length > 0 && removed < antsToRemove) {
        const removedAntId = antIds.pop();
        target.discard.push(removedAntId);
        removed++;
      }

      // Clean up empty objectives
      if (antIds.length === 0) {
        delete target.constructionZone[objectiveId];
      }
    });

    // Execute special attack abilities
    attackCards.forEach(card => {
      if (card.abilities && card.abilities.includes('steal')) {
        // Steal 1 resource
        if (target.resources > 0) {
          target.resources -= 1;
          attacker.resources += 1;
        }
      }

      if (card.abilities && card.abilities.includes('sabotage')) {
        // Already handled in card play
      }
    });

    return { success: true, antsRemoved: removed, attackPower: totalAttack };
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
