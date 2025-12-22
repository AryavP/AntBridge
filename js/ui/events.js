// Event Handlers
// Handles all player interactions and UI events

import { GameState } from '../game/state.js';
import { GameActions } from '../game/actions.js';
import { UIRender } from './render.js';

export const EventHandlers = {
  cardData: null,
  constructionData: null,
  currentPlayerId: null,
  updateCallback: null,
  selectedTarget: null,  // {type: 'construction'/'trade', objectiveId?}
  selectedHandIndices: [],  // Indices of cards selected from hand
  selectedTradeIndices: [],  // Indices of trade cards selected
  initialized: false,  // Track if event listeners are attached

  // Initialize event handlers
  init(cardData, constructionData, playerId, updateCallback) {
    this.cardData = cardData;
    this.constructionData = constructionData;
    this.currentPlayerId = playerId;
    this.updateCallback = updateCallback;

    // Only attach event listeners once
    if (!this.initialized) {
      this.clearSelection();
      this.attachEventListeners();
      this.initialized = true;
      console.log('Event listeners attached');
    }
  },

  // Clear all selections
  clearSelection() {
    this.selectedTarget = null;
    this.selectedHandIndices = [];
    this.selectedTradeIndices = [];
    this.updateSelectionUI();
  },

  // Attach all event listeners
  attachEventListeners() {
    // Delegate click events
    document.addEventListener('click', (e) => {
      // Check if clicked element is a card
      const card = e.target.closest('.card');

      if (card) {
        // Determine if it's in hand or trade row
        const handContainer = document.getElementById('hand');
        const tradeRowContainer = document.getElementById('trade-row');

        if (handContainer && handContainer.contains(card)) {
          this.handleHandCardClick(card);
          return;
        }

        if (tradeRowContainer && tradeRowContainer.contains(card)) {
          this.handleTradeCardClick(card);
          return;
        }
      }

      // Construction objective (in construction row - to build on)
      const objective = e.target.closest('.objective');
      if (objective) {
        this.handleObjectiveClick(objective);
        return;
      }

      // Player's construction zone (to attack)
      const playerDiv = e.target.closest('.player');
      if (playerDiv) {
        const playerId = playerDiv.dataset.playerId;
        // Only allow attacking other players
        if (playerId && playerId !== this.currentPlayerId) {
          this.handlePlayerClick(playerId);
          return;
        }
      }

      // Resolve button
      if (e.target.id === 'resolve-btn') {
        this.handleResolve();
        return;
      }

      // Clear selection button
      if (e.target.id === 'clear-selection-btn') {
        this.clearSelection();
        return;
      }

      // End turn button
      if (e.target.id === 'end-turn-btn') {
        this.handleEndTurn();
        return;
      }
    });
  },

  // Handle clicking a card in hand
  handleHandCardClick(cardElement) {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const handIndex = parseInt(cardElement.dataset.handIndex);

    // Toggle selection
    const idx = this.selectedHandIndices.indexOf(handIndex);
    if (idx === -1) {
      this.selectedHandIndices.push(handIndex);
      cardElement.classList.add('selected');
    } else {
      this.selectedHandIndices.splice(idx, 1);
      cardElement.classList.remove('selected');
    }

    this.updateSelectionUI();
  },

  // Handle clicking a trade row card
  handleTradeCardClick(cardElement) {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const tradeIndex = parseInt(cardElement.dataset.tradeIndex);

    // Toggle selection for multi-buy
    const idx = this.selectedTradeIndices.indexOf(tradeIndex);
    if (idx === -1) {
      this.selectedTradeIndices.push(tradeIndex);
      cardElement.classList.add('selected');
    } else {
      this.selectedTradeIndices.splice(idx, 1);
      cardElement.classList.remove('selected');
    }

    // Set as target if not already set
    if (!this.selectedTarget || this.selectedTarget.type !== 'trade') {
      this.selectedTarget = { type: 'trade' };
    }

    this.updateSelectionUI();
  },

  // Handle clicking a construction objective
  handleObjectiveClick(objectiveElement) {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const objectiveId = objectiveElement.dataset.objectiveId;

    // Clear previous objective selection
    document.querySelectorAll('.objective').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.player').forEach(el => el.classList.remove('attack-target'));

    // Set new target
    this.selectedTarget = { type: 'construction', objectiveId };
    this.selectedTradeIndices = []; // Clear trade selections
    objectiveElement.classList.add('selected');

    this.updateSelectionUI();
  },

  // Handle clicking a player (to attack)
  handlePlayerClick(targetPlayerId) {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    // Clear previous selections
    document.querySelectorAll('.objective').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.player').forEach(el => el.classList.remove('attack-target'));
    this.selectedTradeIndices = []; // Clear trade selections

    // Set attack target
    this.selectedTarget = { type: 'attack', targetPlayerId };

    // Highlight the targeted player
    const targetDiv = document.querySelector(`.player[data-player-id="${targetPlayerId}"]`);
    if (targetDiv) {
      targetDiv.classList.add('attack-target');
    }

    this.updateSelectionUI();
  },

  // Update selection UI
  updateSelectionUI() {
    const targetInfo = document.getElementById('target-info');
    const selectedCardsInfo = document.getElementById('selected-cards-info');
    const resolveBtn = document.getElementById('resolve-btn');
    const clearBtn = document.getElementById('clear-selection-btn');

    if (!targetInfo || !selectedCardsInfo || !resolveBtn || !clearBtn) return;

    // Check if hand cards are selected without a target (play for resources)
    if (this.selectedHandIndices.length > 0 && !this.selectedTarget) {
      targetInfo.textContent = 'Playing cards for resources';
      selectedCardsInfo.textContent = `Selected ${this.selectedHandIndices.length} card(s)`;
      resolveBtn.style.display = 'inline-block';
      clearBtn.style.display = 'inline-block';

      // Update visual selection
      document.querySelectorAll('.hand .card').forEach(el => {
        const handIndex = parseInt(el.dataset.handIndex);
        if (this.selectedHandIndices.includes(handIndex)) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
      return;
    }

    // Update target info
    if (this.selectedTarget) {
      if (this.selectedTarget.type === 'construction') {
        const objective = GameState.getObjectiveById(this.selectedTarget.objectiveId, this.constructionData);
        targetInfo.textContent = `Building: ${objective.name}`;
        clearBtn.style.display = 'inline-block';

        // Show resolve button if cards are selected
        if (this.selectedHandIndices.length > 0) {
          resolveBtn.style.display = 'inline-block';
          selectedCardsInfo.textContent = `Selected ${this.selectedHandIndices.length} card(s)`;
        } else {
          resolveBtn.style.display = 'none';
          selectedCardsInfo.textContent = 'Select cards from your hand';
        }
      } else if (this.selectedTarget.type === 'attack') {
        const targetPlayer = GameState.players[this.selectedTarget.targetPlayerId];
        targetInfo.textContent = `Attacking: ${targetPlayer.name}`;
        clearBtn.style.display = 'inline-block';

        if (this.selectedHandIndices.length > 0) {
          // Calculate total attack power
          const player = GameState.players[this.currentPlayerId];
          let totalAttack = 0;
          this.selectedHandIndices.forEach(idx => {
            const cardId = player.hand[idx];
            const card = GameState.getCardById(cardId, this.cardData);
            if (card) totalAttack += card.attack || 0;
          });

          const targetDefense = GameState.calculateDefense(this.selectedTarget.targetPlayerId, this.cardData);
          resolveBtn.style.display = 'inline-block';
          selectedCardsInfo.textContent = `Attack: ${totalAttack} vs Defense: ${targetDefense}`;
        } else {
          resolveBtn.style.display = 'none';
          selectedCardsInfo.textContent = 'Select cards to attack with';
        }
      } else if (this.selectedTarget.type === 'trade') {
        // Calculate total cost of trade cards
        const player = GameState.players[this.currentPlayerId];
        let totalCost = 0;
        this.selectedTradeIndices.forEach(idx => {
          const cardId = GameState.tradeRow[idx];
          const card = GameState.getCardById(cardId, this.cardData);
          if (card) totalCost += card.cost;
        });

        // Calculate resources from selected hand cards
        let handResources = 0;
        this.selectedHandIndices.forEach(idx => {
          const cardId = player.hand[idx];
          const card = GameState.getCardById(cardId, this.cardData);
          if (card) handResources += card.resources || 0;
        });

        const currentResources = player.resources;
        const totalAfterPlaying = currentResources + handResources;

        targetInfo.textContent = `Buying ${this.selectedTradeIndices.length} card(s) - Cost: ${totalCost}`;
        selectedCardsInfo.textContent = `Playing ${this.selectedHandIndices.length} card(s) for ${handResources} resources (Total: ${totalAfterPlaying})`;
        clearBtn.style.display = 'inline-block';

        if (this.selectedTradeIndices.length > 0) {
          resolveBtn.style.display = 'inline-block';
        } else {
          resolveBtn.style.display = 'none';
        }
      }
    } else {
      targetInfo.textContent = 'Select an objective or trade card';
      selectedCardsInfo.textContent = '';
      resolveBtn.style.display = 'none';
      clearBtn.style.display = 'none';
    }

    // Update visual selection on hand cards
    document.querySelectorAll('.hand .card').forEach(el => {
      const handIndex = parseInt(el.dataset.handIndex);
      if (this.selectedHandIndices.includes(handIndex)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // Update visual selection on trade cards
    document.querySelectorAll('.trade-row .card').forEach(el => {
      const tradeIndex = parseInt(el.dataset.tradeIndex);
      if (this.selectedTradeIndices.includes(tradeIndex)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  },

  // Resolve the action
  handleResolve() {
    // Playing cards for resources (no target selected)
    if (!this.selectedTarget && this.selectedHandIndices.length > 0) {
      this.resolvePlayAction();
      return;
    }

    if (!this.selectedTarget) {
      UIRender.showMessage('No target selected', 'error');
      return;
    }

    if (this.selectedTarget.type === 'construction') {
      this.resolveBuildAction();
    } else if (this.selectedTarget.type === 'trade') {
      this.resolveBuyAction();
    } else if (this.selectedTarget.type === 'attack') {
      this.resolveAttackAction();
    }
  },

  // Resolve playing cards for resources
  resolvePlayAction() {
    if (this.selectedHandIndices.length === 0) {
      UIRender.showMessage('No cards selected', 'error');
      return;
    }

    const player = GameState.players[this.currentPlayerId];
    const results = [];
    let totalResources = 0;

    // Sort descending to remove from end first
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);

    sortedIndices.forEach(index => {
      const cardId = player.hand[index];
      const card = GameState.getCardById(cardId, this.cardData);

      const result = GameActions.playCard(this.currentPlayerId, cardId, this.cardData);

      if (result.success) {
        results.push(card.name);
        totalResources += card.resources || 0;
      }
    });

    if (results.length > 0) {
      UIRender.showMessage(`Played ${results.length} card(s) for ${totalResources} resources`, 'success');
      this.clearSelection();
      this.syncAndRender();
    }
  },

  // Resolve building on construction
  resolveBuildAction() {
    if (this.selectedHandIndices.length === 0) {
      UIRender.showMessage('Select cards from your hand to place on construction', 'error');
      return;
    }

    const player = GameState.players[this.currentPlayerId];
    const results = [];
    const errors = [];

    // Get card IDs from indices (sort descending to remove from end first)
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);

    sortedIndices.forEach(index => {
      const cardId = player.hand[index];
      const card = GameState.getCardById(cardId, this.cardData);

      const result = GameActions.placeAntOnConstruction(
        this.currentPlayerId,
        cardId,
        this.selectedTarget.objectiveId,
        this.cardData,
        this.constructionData
      );

      if (result.success) {
        results.push(card.name);
      } else {
        errors.push(result.error);
      }
    });

    if (results.length > 0) {
      UIRender.showMessage(`Placed ${results.length} ant(s) on construction`, 'success');
      this.clearSelection();
      this.syncAndRender();
    }

    if (errors.length > 0) {
      UIRender.showMessage(errors[0], 'error');
    }
  },

  // Resolve attack action
  resolveAttackAction() {
    if (this.selectedHandIndices.length === 0) {
      UIRender.showMessage('Select cards to attack with', 'error');
      return;
    }

    const player = GameState.players[this.currentPlayerId];

    // Get card IDs from indices
    const cardIds = this.selectedHandIndices.map(idx => player.hand[idx]);

    // Execute attack
    const result = GameActions.attackPlayer(
      this.currentPlayerId,
      this.selectedTarget.targetPlayerId,
      cardIds,
      this.cardData
    );

    if (result.success) {
      const objective = GameState.getObjectiveById(result.objectiveDestroyed, this.constructionData);
      UIRender.showMessage(
        `Attack successful! Destroyed "${objective.name}" - ${result.antsRemoved} ant(s) returned to discard. +1 VP!`,
        'success'
      );
      this.clearSelection();
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Resolve buying cards
  resolveBuyAction() {
    if (this.selectedTradeIndices.length === 0) {
      UIRender.showMessage('No cards selected to buy', 'error');
      return;
    }

    const player = GameState.players[this.currentPlayerId];

    // First, play selected hand cards for resources (sort descending)
    let resourcesGained = 0;
    if (this.selectedHandIndices.length > 0) {
      const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);

      sortedIndices.forEach(index => {
        const cardId = player.hand[index];
        const card = GameState.getCardById(cardId, this.cardData);

        const result = GameActions.playCard(this.currentPlayerId, cardId, this.cardData);
        if (result.success && card) {
          resourcesGained += card.resources || 0;
        }
      });
    }

    // Calculate total cost of trade cards
    let totalCost = 0;
    const cardsToBuy = [];
    this.selectedTradeIndices.forEach(idx => {
      const cardId = GameState.tradeRow[idx];
      const card = GameState.getCardById(cardId, this.cardData);
      if (card) {
        totalCost += card.cost;
        cardsToBuy.push({cardId, card});
      }
    });

    // Check if we have enough resources after playing cards
    if (player.resources < totalCost) {
      UIRender.showMessage(`Not enough resources! Need ${totalCost}, have ${player.resources} (gained ${resourcesGained})`, 'error');
      this.clearSelection();
      this.syncAndRender();
      return;
    }

    // Buy all selected cards
    const purchased = [];
    for (const {cardId, card} of cardsToBuy) {
      const result = GameActions.buyCard(this.currentPlayerId, cardId, this.cardData);
      if (result.success) {
        purchased.push(card.name);
      }
    }

    if (purchased.length > 0) {
      const message = resourcesGained > 0
        ? `Played cards for ${resourcesGained} resources, then bought ${purchased.length} card(s) for ${totalCost} resources`
        : `Bought ${purchased.length} card(s) for ${totalCost} resources`;
      UIRender.showMessage(message, 'success');
      this.clearSelection();
      this.syncAndRender();
    }
  },

  // Handle end turn
  handleEndTurn() {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const result = GameActions.endTurn(this.currentPlayerId, this.cardData, this.constructionData);

    if (result.success) {
      UIRender.showMessage('Turn ended', 'success');
      this.clearSelection();
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Sync state to Firebase and re-render
  syncAndRender() {
    if (this.updateCallback) {
      this.updateCallback(GameState.serialize());
    }
    UIRender.renderGame();
    this.updateSelectionUI();
  }
};
