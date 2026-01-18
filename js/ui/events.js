// Event Handlers
// Handles all player interactions and UI events

import { GameState } from '../game/state.js';
import { GameActions } from '../game/actions.js';
import { GameRules } from '../game/rules.js';
import { UIRender } from './render.js';
import { ModalManager } from './modal.js';
import { logger, LogCategory } from '../utils/logger.js';

export const EventHandlers = {
  cardData: null,
  constructionData: null,
  currentPlayerId: null,
  updateCallback: null,
  selectedTarget: null,  // {type: 'construction'/'trade', objectiveId?}
  selectedHandIndices: [],  // Indices of cards selected from hand
  selectedTradeIndices: [],  // Indices of trade cards selected
  initialized: false,  // Track if event listeners are attached
  isProcessingScout: false,  // Prevent concurrent scout modals
  isProcessingDiscard: false,  // Prevent concurrent discard modals
  isProcessingSabotage: false,  // Prevent concurrent sabotage modals
  isProcessingTrash: false,  // Prevent concurrent trash modals
  processedEvents: new Set(),  // Track event IDs that have been processed

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

      // Play for Resources button
      if (e.target.id === 'play-for-resources-btn') {
        this.handlePlayForResources();
        return;
      }

      // Play for Attack button
      if (e.target.id === 'play-for-attack-btn') {
        this.handlePlayForAttack();
        return;
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

      // Refresh trade row button (for testing)
      const refreshBtn = e.target.closest('#refresh-trade-btn');
      if (refreshBtn || e.target.id === 'refresh-trade-btn') {
        this.handleRefreshTrade();
        return;
      }
    });

    // Direct listener for refresh button (for debugging)
    setTimeout(() => {
      const refreshBtn = document.getElementById('refresh-trade-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.handleRefreshTrade();
        });
      }
    }, 1000);
  },

  // Handle clicking a card in hand
  handleHandCardClick(cardElement) {
    const handIndex = parseInt(cardElement.dataset.handIndex);
    const player = GameState.players[this.currentPlayerId];
    const cardId = player?.hand[handIndex];

    if (GameState.currentPlayer !== this.currentPlayerId) {
      logger.uiInteraction('hand-card-click', false, {
        reason: 'not your turn',
        cardIndex: handIndex,
        cardId: cardId,
        currentPlayer: GameState.currentPlayer,
        localPlayer: this.currentPlayerId
      });
      UIRender.showMessage("It's not your turn!", 'error');
      return;
    }

    logger.uiInteraction('hand-card-click', true, {
      cardIndex: handIndex,
      cardId: cardId
    });

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
    const playForResourcesBtn = document.getElementById('play-for-resources-btn');
    const playForAttackBtn = document.getElementById('play-for-attack-btn');
    const resolveBtn = document.getElementById('resolve-btn');
    const clearBtn = document.getElementById('clear-selection-btn');

    if (!targetInfo || !selectedCardsInfo || !resolveBtn || !clearBtn) return;

    // Check if hand cards are selected without a target (choose: play for resources or attack)
    if (this.selectedHandIndices.length > 0 && !this.selectedTarget) {
      const player = GameState.players[this.currentPlayerId];

      // Calculate resources and attack from selected cards
      let totalResources = 0;
      let totalAttack = 0;
      this.selectedHandIndices.forEach(idx => {
        const cardId = player.hand[idx];
        const card = GameState.getCardById(cardId, this.cardData);
        if (card) {
          totalResources += card.resources || 0;
          totalAttack += card.attack || 0;
        }
      });

      targetInfo.textContent = 'Choose action:';
      selectedCardsInfo.textContent = `Selected ${this.selectedHandIndices.length} card(s) (${totalResources} resources, ${totalAttack} attack)`;
      if (playForResourcesBtn) playForResourcesBtn.style.display = 'inline-block';
      if (playForAttackBtn) playForAttackBtn.style.display = 'inline-block';
      resolveBtn.style.display = 'none'; // Hide generic resolve button
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

    // Hide the play-for buttons when target is selected
    if (playForResourcesBtn) playForResourcesBtn.style.display = 'none';
    if (playForAttackBtn) playForAttackBtn.style.display = 'none';

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
        const player = GameState.players[this.currentPlayerId];
        targetInfo.textContent = `Attacking: ${targetPlayer.name}`;
        clearBtn.style.display = 'inline-block';

        if (this.selectedHandIndices.length > 0) {
          // Calculate total attack power from selected cards
          let totalAttack = 0;
          this.selectedHandIndices.forEach(idx => {
            const cardId = player.hand[idx];
            const card = GameState.getCardById(cardId, this.cardData);
            if (card) totalAttack += card.attack || 0;
          });

          const targetDefense = GameState.calculateDefense(this.selectedTarget.targetPlayerId, this.cardData);
          resolveBtn.style.display = 'inline-block';
          selectedCardsInfo.textContent = `Attack: ${totalAttack} vs Defense: ${targetDefense}`;
        } else if (player.attackPower > 0) {
          // Can attack with accumulated attack power
          const targetDefense = GameState.calculateDefense(this.selectedTarget.targetPlayerId, this.cardData);
          resolveBtn.style.display = 'inline-block';
          selectedCardsInfo.textContent = `Attack with accumulated power: ${player.attackPower} vs Defense: ${targetDefense}`;
        } else {
          resolveBtn.style.display = 'none';
          selectedCardsInfo.textContent = 'Select cards to attack with or play cards for attack power';
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

  // Handle "Play for Resources" button
  handlePlayForResources() {
    this.resolvePlayAction();
  },

  // Handle "Play for Attack" button
  handlePlayForAttack() {
    if (this.selectedHandIndices.length === 0) {
      UIRender.showMessage('No cards selected', 'error');
      return;
    }

    const player = GameState.players[this.currentPlayerId];
    const results = [];
    let totalAttack = 0;

    // Get all card IDs FIRST, before playing any (to avoid index shifting)
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);
    const cardIds = sortedIndices.map(index => player.hand[index]);

    cardIds.forEach(cardId => {
      const card = GameState.getCardById(cardId, this.cardData);

      const result = GameActions.playCard(this.currentPlayerId, cardId, this.cardData);

      if (result.success) {
        results.push(card.name);
        totalAttack += card.attack || 0;
      }
    });

    if (results.length > 0) {
      // Add attack power to player's pool
      player.attackPower += totalAttack;

      UIRender.showMessage(`Played ${results.length} card(s) for ${totalAttack} attack (Total: ${player.attackPower})`, 'success');
      this.clearSelection();
      this.syncAndRender();
      // Pending events will be checked by Firebase listener after sync
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

    // Sort descending and get all card IDs FIRST, before playing any
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);
    const cardIds = sortedIndices.map(index => player.hand[index]);

    cardIds.forEach(cardId => {
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
      // Pending events will be checked by Firebase listener after sync
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

    // Get all card IDs FIRST, before placing any (sort descending to avoid index shifting)
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);
    const cardIds = sortedIndices.map(index => player.hand[index]);

    cardIds.forEach(cardId => {
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
      // Pending events will be checked by Firebase listener after sync
    }

    if (errors.length > 0) {
      UIRender.showMessage(errors[0], 'error');
    }
  },

  // Resolve attack action
  resolveAttackAction() {
    const player = GameState.players[this.currentPlayerId];

    // Check if attacking with cards or accumulated attack power
    if (this.selectedHandIndices.length === 0) {
      // Attack with accumulated attack power
      if (player.attackPower === 0) {
        UIRender.showMessage('No attack power available. Play cards for attack first.', 'error');
        return;
      }

      // Attack using accumulated power (no cards, so no card abilities trigger)
      const result = GameActions.attackWithPower(
        this.currentPlayerId,
        this.selectedTarget.targetPlayerId,
        player.attackPower,
        this.cardData,
        this.constructionData
      );

      if (result.success) {
        const objective = GameState.getObjectiveById(result.objectiveDestroyed, this.constructionData);
        UIRender.showMessage(
          `Attack successful! Destroyed "${objective.name}" with ${player.attackPower} attack power - ${result.antsRemoved} ant(s) returned to discard. +1 VP!`,
          'success'
        );
        this.clearSelection();
        this.syncAndRender();
      } else {
        UIRender.showMessage(result.error, 'error');
      }
      return;
    }

    // Attack with selected cards (triggers card abilities)
    // Get all card IDs FIRST, before attacking (sort descending to avoid index shifting)
    const sortedIndices = [...this.selectedHandIndices].sort((a, b) => b - a);
    const cardIds = sortedIndices.map(idx => player.hand[idx]);

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
      // Pending events will be checked by Firebase listener after sync
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

      // Get all card IDs FIRST, before playing any (to avoid index shifting)
      const cardIds = sortedIndices.map(index => player.hand[index]);

      cardIds.forEach(cardId => {
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

    const oldPlayer = GameState.currentPlayer;
    const result = GameActions.endTurn(this.currentPlayerId, this.cardData, this.constructionData);

    if (result.success) {
      logger.turnChange(oldPlayer, GameState.currentPlayer, GameState.turnPhase);
      UIRender.showMessage('Turn ended', 'success');
      this.clearSelection();
      this.syncAndRender();
    } else {
      UIRender.showMessage(result.error, 'error');
    }
  },

  // Refresh trade row (for testing)
  handleRefreshTrade() {
    // Put current trade row cards back into market deck
    GameState.marketDeck.push(...GameState.tradeRow);

    // Shuffle market deck for randomness
    for (let i = GameState.marketDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [GameState.marketDeck[i], GameState.marketDeck[j]] = [GameState.marketDeck[j], GameState.marketDeck[i]];
    }

    // Clear trade row
    GameState.tradeRow = [];

    // Refill from market deck
    GameRules.fillTradeRow();

    UIRender.showMessage('Trade row refreshed', 'success');
    this.syncAndRender();
  },

  // Sync state to Firebase and re-render
  syncAndRender() {
    if (this.updateCallback) {
      this.updateCallback(GameState.serialize());
    }
    UIRender.renderGame();
    this.updateSelectionUI();
  },

  // Check and handle pending scout action
  async checkPendingScout() {
    // Prevent concurrent scout modals
    if (this.isProcessingScout) {
      logger.eventSkipped('scout', 'already processing', GameState.pendingScout);
      return;
    }

    logger.debug(LogCategory.EVENT, 'checkPendingScout called', {
      hasPendingScout: !!GameState.pendingScout,
      eventId: GameState.pendingScout?.eventId,
      targetPlayer: GameState.pendingScout?.playerId,
      currentPlayer: GameState.currentPlayer,
      localPlayer: this.currentPlayerId
    });

    // Only show modal if it's this player's pending action AND it's their turn
    if (GameState.pendingScout &&
        GameState.pendingScout.playerId === this.currentPlayerId &&
        GameState.currentPlayer === this.currentPlayerId) {

      // Check if we've already processed this event
      const eventId = GameState.pendingScout.eventId;
      if (eventId && this.processedEvents.has(eventId)) {
        logger.eventSkipped('scout', 'already processed', { eventId });
        GameState.pendingScout = null;
        // Don't sync to Firebase - would create infinite loop with other client
        return;
      }

      // Mark event as being processed
      if (eventId) {
        this.processedEvents.add(eventId);
      }

      this.isProcessingScout = true;
      logger.eventProcessing('scout', {
        eventId: eventId,
        playerId: this.currentPlayerId,
        currentPlayer: GameState.currentPlayer,
        cardCount: GameState.pendingScout.cards.length
      });

      logger.modalShow('scout', eventId);

      try {
        const selectedCardId = await ModalManager.showCardSelection(
          GameState.pendingScout.cards,
          this.cardData,
          { title: 'Scout: Choose a card to add to your hand' }
        );

        // Complete the scout action (this clears pendingScout internally)
        const result = GameActions.completeScout(selectedCardId);

        logger.eventCompleted('scout', { eventId, playerId: this.currentPlayerId }, result);
        logger.modalClose('scout', eventId, true);

        if (result.success) {
          UIRender.showMessage('Card added to hand', 'success');
        } else {
          // If completion failed, still clear the pending state
          GameState.pendingScout = null;
          UIRender.showMessage(result.error || 'Scout failed', 'error');
        }
      } catch (error) {
        logger.error(LogCategory.EVENT, 'Scout selection error', { error: error.message, eventId });
        logger.modalClose('scout', eventId, false);
        // User cancelled - put cards back on top of deck
        if (GameState.pendingScout) {
          const player = GameState.players[GameState.pendingScout.playerId];
          player.deck.push(...GameState.pendingScout.cards);
          GameState.pendingScout = null;
        }
      } finally {
        // Reset flag BEFORE syncing to prevent re-triggering from Firebase listener
        this.isProcessingScout = false;
        // Always sync after processing to update Firebase
        this.syncAndRender();
      }
    } else if (GameState.pendingScout) {
      logger.eventSkipped('scout', 'not for this player or not their turn', {
        eventId: GameState.pendingScout.eventId,
        targetPlayer: GameState.pendingScout.playerId,
        currentPlayer: GameState.currentPlayer,
        localPlayer: this.currentPlayerId
      });
    }
  },

  // Check and handle pending forced discard
  async checkPendingDiscard() {
    // Prevent concurrent discard modals
    if (this.isProcessingDiscard) {
      logger.eventSkipped('discard', 'already processing', GameState.pendingDiscard);
      return;
    }

    logger.debug(LogCategory.EVENT, 'checkPendingDiscard called', {
      hasPendingDiscard: !!GameState.pendingDiscard,
      eventId: GameState.pendingDiscard?.eventId,
      targetPlayer: GameState.pendingDiscard?.playerId,
      attackerId: GameState.pendingDiscard?.attackerId,
      currentPlayer: GameState.currentPlayer,
      localPlayer: this.currentPlayerId
    });

    // Show modal immediately when this player has a pending discard (regardless of whose turn it is)
    if (GameState.pendingDiscard && GameState.pendingDiscard.playerId === this.currentPlayerId) {
      // Check if we've already processed this event
      const eventId = GameState.pendingDiscard.eventId;
      if (eventId && this.processedEvents.has(eventId)) {
        logger.eventSkipped('discard', 'already processed', { eventId });
        GameState.pendingDiscard = null;
        // Don't sync to Firebase - would create infinite loop with other client
        return;
      }

      // Mark event as being processed
      if (eventId) {
        this.processedEvents.add(eventId);
      }

      this.isProcessingDiscard = true;
      const player = GameState.players[this.currentPlayerId];

      logger.eventProcessing('discard', {
        eventId: eventId,
        playerId: this.currentPlayerId,
        currentPlayer: GameState.currentPlayer,
        handSize: player.hand.length
      });

      if (player.hand.length === 0) {
        logger.eventSkipped('discard', 'no cards in hand', { eventId });
        GameState.pendingDiscard = null;
        this.isProcessingDiscard = false;
        return;
      }

      logger.modalShow('discard', eventId);

      try {
        const selectedCardId = await ModalManager.showCardSelection(
          player.hand,
          this.cardData,
          { title: 'Opponent stole from you! Choose a card to discard' }
        );

        // Complete the forced discard (this clears pendingDiscard internally)
        const result = GameActions.completeDiscard(selectedCardId);

        logger.eventCompleted('discard', { eventId, playerId: this.currentPlayerId }, result);
        logger.modalClose('discard', eventId, true);

        if (result.success) {
          UIRender.showMessage('Card discarded', 'info');
        } else {
          // If completion failed, still clear the pending state
          GameState.pendingDiscard = null;
          UIRender.showMessage(result.error || 'Discard failed', 'error');
        }
      } catch (error) {
        logger.error(LogCategory.EVENT, 'Discard selection error', { error: error.message, eventId });
        logger.modalClose('discard', eventId, false);
        // User cancelled - auto-discard first card
        if (GameState.pendingDiscard && player.hand.length > 0) {
          GameActions.completeDiscard(player.hand[0]);
        } else {
          // No cards to discard, just clear the pending state
          GameState.pendingDiscard = null;
        }
      } finally {
        // Reset flag BEFORE syncing to prevent re-triggering from Firebase listener
        this.isProcessingDiscard = false;
        // Always sync after processing to update Firebase
        this.syncAndRender();
      }
    } else if (GameState.pendingDiscard) {
      logger.eventSkipped('discard', 'not for this player', {
        eventId: GameState.pendingDiscard.eventId,
        targetPlayer: GameState.pendingDiscard.playerId,
        localPlayer: this.currentPlayerId
      });
    }
  },

  // Check and handle pending sabotage
  async checkPendingSabotage() {
    // Prevent concurrent sabotage modals
    if (this.isProcessingSabotage) {
      logger.eventSkipped('sabotage', 'already processing', GameState.pendingSabotage);
      return;
    }

    logger.debug(LogCategory.EVENT, 'checkPendingSabotage called', {
      hasPendingSabotage: !!GameState.pendingSabotage,
      eventId: GameState.pendingSabotage?.eventId,
      targetPlayer: GameState.pendingSabotage?.playerId,
      saboteur: GameState.pendingSabotage?.saboteur,
      currentPlayer: GameState.currentPlayer,
      localPlayer: this.currentPlayerId
    });

    // Show modal immediately when this player has a pending sabotage (regardless of whose turn it is)
    if (GameState.pendingSabotage && GameState.pendingSabotage.playerId === this.currentPlayerId) {
      // Check if we've already processed this event
      const eventId = GameState.pendingSabotage.eventId;
      if (eventId && this.processedEvents.has(eventId)) {
        logger.eventSkipped('sabotage', 'already processed', { eventId });
        GameState.pendingSabotage = null;
        // Don't sync to Firebase - would create infinite loop with other client
        return;
      }

      // Mark event as being processed
      if (eventId) {
        this.processedEvents.add(eventId);
      }

      this.isProcessingSabotage = true;
      const player = GameState.players[this.currentPlayerId];

      // Collect all ants from all construction zones
      const allAnts = [];
      Object.keys(player.constructionZone).forEach(objectiveId => {
        const ants = player.constructionZone[objectiveId] || [];
        allAnts.push(...ants);
      });

      logger.eventProcessing('sabotage', {
        eventId: eventId,
        playerId: this.currentPlayerId,
        currentPlayer: GameState.currentPlayer,
        antCount: allAnts.length
      });

      if (allAnts.length === 0) {
        logger.eventSkipped('sabotage', 'no ants in construction', { eventId });
        GameState.pendingSabotage = null;
        this.isProcessingSabotage = false;
        this.syncAndRender();
        return;
      }

      logger.modalShow('sabotage', eventId);

      try {
        const selectedAntId = await ModalManager.showCardSelection(
          allAnts,
          this.cardData,
          { title: 'Sabotaged! Choose an ant to remove from your construction' }
        );

        // Complete the sabotage (this clears pendingSabotage internally)
        const result = GameActions.completeSabotage(selectedAntId);

        logger.eventCompleted('sabotage', { eventId, playerId: this.currentPlayerId }, result);
        logger.modalClose('sabotage', eventId, true);

        if (result.success) {
          UIRender.showMessage('Ant removed from construction', 'info');
        } else {
          // If completion failed, still clear the pending state
          GameState.pendingSabotage = null;
          UIRender.showMessage(result.error || 'Sabotage failed', 'error');
        }
      } catch (error) {
        logger.error(LogCategory.EVENT, 'Sabotage selection error', { error: error.message, eventId });
        logger.modalClose('sabotage', eventId, false);
        // User cancelled - auto-remove first ant
        if (GameState.pendingSabotage && allAnts.length > 0) {
          GameActions.completeSabotage(allAnts[0]);
        } else {
          // No ants to remove, just clear the pending state
          GameState.pendingSabotage = null;
        }
      } finally {
        // Reset flag BEFORE syncing to prevent re-triggering from Firebase listener
        this.isProcessingSabotage = false;
        // Always sync after processing to update Firebase
        this.syncAndRender();
      }
    } else if (GameState.pendingSabotage) {
      logger.eventSkipped('sabotage', 'not for this player', {
        eventId: GameState.pendingSabotage.eventId,
        targetPlayer: GameState.pendingSabotage.playerId,
        localPlayer: this.currentPlayerId
      });
    }
  },

  // Check and handle pending trash
  async checkPendingTrash() {
    // Prevent concurrent trash modals
    if (this.isProcessingTrash) {
      logger.eventSkipped('trash', 'already processing', GameState.pendingTrash);
      return;
    }

    logger.debug(LogCategory.EVENT, 'checkPendingTrash called', {
      hasPendingTrash: !!GameState.pendingTrash,
      eventId: GameState.pendingTrash?.eventId,
      targetPlayer: GameState.pendingTrash?.playerId,
      currentPlayer: GameState.currentPlayer,
      localPlayer: this.currentPlayerId
    });

    // Only show modal if it's this player's pending action AND it's their turn
    if (GameState.pendingTrash &&
        GameState.pendingTrash.playerId === this.currentPlayerId &&
        GameState.currentPlayer === this.currentPlayerId) {

      // Check if we've already processed this event
      const eventId = GameState.pendingTrash.eventId;
      if (eventId && this.processedEvents.has(eventId)) {
        logger.eventSkipped('trash', 'already processed', { eventId });
        GameState.pendingTrash = null;
        // Don't sync to Firebase - would create infinite loop with other client
        return;
      }

      // Mark event as being processed
      if (eventId) {
        this.processedEvents.add(eventId);
      }

      this.isProcessingTrash = true;
      const player = GameState.players[this.currentPlayerId];

      // Collect cards from hand and discard pile
      const availableCards = [...player.hand, ...player.discard];

      // Track where discard cards start in the combined array
      const discardStartIndex = player.hand.length;

      logger.eventProcessing('trash', {
        eventId: eventId,
        playerId: this.currentPlayerId,
        currentPlayer: GameState.currentPlayer,
        availableCardCount: availableCards.length
      });

      if (availableCards.length === 0) {
        logger.eventSkipped('trash', 'no cards available', { eventId });
        GameState.pendingTrash = null;
        this.isProcessingTrash = false;
        this.syncAndRender();
        return;
      }

      logger.modalShow('trash', eventId);

      try {
        const selectedCardId = await ModalManager.showCardSelection(
          availableCards,
          this.cardData,
          { title: 'Choose a card to trash (permanently remove from your deck)', discardStartIndex }
        );

        // Complete the trash (this clears pendingTrash internally)
        const result = GameActions.completeTrash(selectedCardId);

        logger.eventCompleted('trash', { eventId, playerId: this.currentPlayerId }, result);
        logger.modalClose('trash', eventId, true);

        if (result.success) {
          UIRender.showMessage(`Card trashed from ${result.location}`, 'success');
        } else {
          // If completion failed, still clear the pending state to prevent loops
          GameState.pendingTrash = null;
          UIRender.showMessage(result.error || 'Trash failed', 'error');
        }
      } catch (error) {
        logger.error(LogCategory.EVENT, 'Trash selection error', { error: error.message, eventId });
        logger.modalClose('trash', eventId, false);
        // User cancelled - clear pending trash
        GameState.pendingTrash = null;
      } finally {
        // Reset flag BEFORE syncing to prevent re-triggering from Firebase listener
        this.isProcessingTrash = false;
        // Always sync after processing to update Firebase
        this.syncAndRender();
      }
    } else if (GameState.pendingTrash) {
      logger.eventSkipped('trash', 'not for this player or not their turn', {
        eventId: GameState.pendingTrash.eventId,
        targetPlayer: GameState.pendingTrash.playerId,
        currentPlayer: GameState.currentPlayer,
        localPlayer: this.currentPlayerId
      });
    }
  }
};
