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
  selectedCards: [],
  actionMode: null, // 'play', 'attack', 'build'

  // Initialize event handlers
  init(cardData, constructionData, playerId, updateCallback) {
    this.cardData = cardData;
    this.constructionData = constructionData;
    this.currentPlayerId = playerId;
    this.updateCallback = updateCallback;
    this.selectedCards = [];
    this.actionMode = null;

    this.attachEventListeners();
  },

  // Attach all event listeners
  attachEventListeners() {
    // Card clicks
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) {
        this.handleCardClick(card);
      }

      const objective = e.target.closest('.objective');
      if (objective) {
        this.handleObjectiveClick(objective);
      }

      // End turn button
      if (e.target.id === 'end-turn-btn') {
        this.handleEndTurn();
      }

      // Action menu buttons
      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn) {
        this.handleActionButton(actionBtn);
      }
    });

    // Mode selection buttons
    const playModeBtn = document.getElementById('play-mode-btn');
    if (playModeBtn) {
      playModeBtn.addEventListener('click', () => this.setActionMode('play'));
    }

    const attackModeBtn = document.getElementById('attack-mode-btn');
    if (attackModeBtn) {
      attackModeBtn.addEventListener('click', () => this.setActionMode('attack'));
    }

    const buildModeBtn = document.getElementById('build-mode-btn');
    if (buildModeBtn) {
      buildModeBtn.addEventListener('click', () => this.setActionMode('build'));
    }
  },

  // Set action mode
  setActionMode(mode) {
    this.actionMode = mode;
    this.selectedCards = [];

    // Update UI to show current mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`${mode}-mode-btn`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    UIRender.showMessage(`Mode: ${mode.toUpperCase()}`, 'info');
  },

  // Handle card click
  handleCardClick(cardElement) {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const cardId = cardElement.dataset.cardId;
    const action = cardElement.dataset.action;
    const card = GameState.getCardById(cardId, this.cardData);

    if (!card) return;

    if (action === 'buy') {
      this.handleBuyCard(card);
    } else if (action === 'play') {
      this.handlePlayCard(card);
    }
  },

  // Handle playing a card
  handlePlayCard(card) {
    if (this.actionMode === 'attack') {
      // Add to selected cards for attack
      if (!this.selectedCards.includes(card.id)) {
        this.selectedCards.push(card.id);
        UIRender.showMessage(`Selected ${card.name} for attack`, 'info');

        // Show attack confirmation
        const totalAttack = this.calculateSelectedAttack();
        UIRender.showMessage(`Total attack: ${totalAttack}. Select target player to attack.`, 'info');
      }
    } else if (this.actionMode === 'build') {
      // Show objectives to place ant on
      this.showBuildTargets(card);
    } else {
      // Play card normally
      const result = GameActions.playCard(this.currentPlayerId, card.id, this.cardData);

      if (result.success) {
        UIRender.showMessage(`Played ${card.name}`, 'success');
        this.syncAndRender();
      } else {
        UIRender.showMessage(result.error, 'error');
      }
    }
  },

  // Handle buying a card
  handleBuyCard(card) {
    const result = GameActions.buyCard(this.currentPlayerId, card.id, this.cardData);

    if (result.success) {
      UIRender.showMessage(`Bought ${card.name} for ${card.cost} resources`, 'success');
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Handle objective click (for building)
  handleObjectiveClick(objectiveElement) {
    if (this.actionMode !== 'build') return;
    if (this.selectedCards.length === 0) {
      UIRender.showMessage('Select a card from your hand first', 'error');
      return;
    }

    const objectiveId = objectiveElement.dataset.objectiveId;
    const cardId = this.selectedCards[0]; // Take first selected card

    const result = GameActions.placeAntOnConstruction(
      this.currentPlayerId,
      cardId,
      objectiveId,
      this.cardData,
      this.constructionData
    );

    if (result.success) {
      const card = GameState.getCardById(cardId, this.cardData);
      UIRender.showMessage(`Placed ${card.name} on construction`, 'success');
      this.selectedCards = [];
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Show objectives that can receive the ant
  showBuildTargets(card) {
    if (!card.abilities || !card.abilities.includes('build')) {
      UIRender.showMessage('This ant cannot build', 'error');
      return;
    }

    this.selectedCards = [card.id];
    UIRender.showMessage(`Selected ${card.name}. Click an objective to place it.`, 'info');

    // Highlight available objectives
    document.querySelectorAll('.objective').forEach(obj => {
      obj.classList.add('selectable');
    });
  },

  // Calculate total attack from selected cards
  calculateSelectedAttack() {
    let total = 0;
    this.selectedCards.forEach(cardId => {
      const card = GameState.getCardById(cardId, this.cardData);
      if (card) {
        total += card.attack || 0;
      }
    });
    return total;
  },

  // Handle action button clicks
  handleActionButton(button) {
    if (button.classList.contains('cancel')) {
      UIRender.hideActionMenu();
      this.selectedCards = [];
      return;
    }

    const actionType = button.dataset.action;
    const cardId = button.dataset.cardId;

    // Handle different action types
    switch (actionType) {
      case 'play':
        const card = GameState.getCardById(cardId, this.cardData);
        this.handlePlayCard(card);
        break;

      case 'attack-player':
        const targetId = button.dataset.targetId;
        this.executeAttack(targetId);
        break;
    }

    UIRender.hideActionMenu();
  },

  // Execute attack on target player
  executeAttack(targetId) {
    if (this.selectedCards.length === 0) {
      UIRender.showMessage('No attack cards selected', 'error');
      return;
    }

    const result = GameActions.attackPlayer(
      this.currentPlayerId,
      targetId,
      this.selectedCards,
      this.cardData
    );

    if (result.success) {
      UIRender.showMessage(
        `Attack successful! Removed ${result.antsRemoved} ants with ${result.attackPower} attack power`,
        'success'
      );
      this.selectedCards = [];
      this.actionMode = null;
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Handle end turn
  handleEndTurn() {
    if (GameState.currentPlayer !== this.currentPlayerId) {
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    const result = GameActions.endTurn(this.currentPlayerId);

    if (result.success) {
      UIRender.showMessage('Turn ended', 'success');
      this.selectedCards = [];
      this.actionMode = null;
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
  }
};
