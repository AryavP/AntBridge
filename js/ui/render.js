// UI Rendering
// Handles rendering all game elements to the DOM

import { GameState } from '../game/state.js';
import { Animations } from './animations.js';

export const UIRender = {
  cardData: null,
  constructionData: null,
  currentPlayerId: null,
  lastSeenFeedIndex: 0,  // Track last rendered feed event index

  // Initialize with game data
  init(cardData, constructionData, playerId) {
    this.cardData = cardData;
    this.constructionData = constructionData;
    this.currentPlayerId = playerId;
    this.lastSeenFeedIndex = 0;
  },

  // Render entire game state
  renderGame() {
    console.log('Rendering game...', {
      tradeRow: GameState.tradeRow,
      constructionRow: GameState.constructionRow,
      playerId: this.currentPlayerId
    });
    this.renderPlayers();
    this.renderTradeRow();
    this.renderConstructionRow();
    this.renderCurrentPlayerHand();
    this.renderGameInfo();
    this.renderNewFeedEvents();
  },

  // Render all players' info
  renderPlayers() {
    const playersContainer = document.getElementById('players-container');
    if (!playersContainer) return;

    playersContainer.innerHTML = '';

    Object.values(GameState.players).forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = `player ${player.id === GameState.currentPlayer ? 'current-turn' : ''}`;
      playerDiv.dataset.playerId = player.id;

      const vp = GameState.calculateVP(player.id);

      playerDiv.innerHTML = `
        <h3>${player.name} ${player.id === this.currentPlayerId ? '(You)' : ''}</h3>
        <div class="player-stats">
          <div>VP: <span class="vp">${vp}</span></div>
          <div>Resources: <span class="resources">${player.resources}</span></div>
          <div>Attack: <span class="attack-power">${player.attackPower || 0}</span></div>
          <div>Deck: <span class="deck-count">${player.deck.length}</span></div>
          <div>Hand: <span class="hand-count">${player.hand.length}</span></div>
          <div>Discard: <span class="discard-count">${player.discard.length}</span></div>
        </div>
        <div class="completed-objectives" id="completed-${player.id}">
          <h4>Scored Objectives</h4>
          ${this.renderCompletedObjectives(player)}
        </div>
        <div class="construction-zone" id="construction-${player.id}">
          <h4>Construction Zone (In Progress)</h4>
          ${this.renderPlayerConstruction(player)}
        </div>
      `;

      playersContainer.appendChild(playerDiv);
    });
  },

  // Render a player's completed (scored) objectives
  renderCompletedObjectives(player) {
    console.log('Rendering completed objectives for player:', player.id);
    console.log('completedObjectives:', player.completedObjectives);

    if (!player.completedObjectives || player.completedObjectives.length === 0) {
      console.log('No completed objectives, showing empty message');
      return '<p class="empty">No objectives scored yet</p>';
    }

    let html = '';
    player.completedObjectives.forEach(objectiveId => {
      const objective = GameState.getObjectiveById(objectiveId, this.constructionData);
      console.log(`Rendering completed objective ${objectiveId}:`, objective);
      if (objective) {
        const rewardText = this.formatReward(objective.reward);

        html += `
          <div class="construction-objective complete scored">
            <div class="objective-name">${objective.name}</div>
            <div class="objective-progress">COMPLETED | ★ ${objective.vp}</div>
            <div class="objective-requirement">
              Required: ${objective.antsRequired} ants
            </div>
            <div class="objective-reward">
              Reward: ${rewardText}
            </div>
          </div>
        `;
      }
    });

    console.log('Completed objectives HTML:', html);
    return html;
  },

  // Render a player's construction zone
  renderPlayerConstruction(player) {
    console.log('Rendering construction zone for player:', player.id, 'Zone:', player.constructionZone);
    console.log('typeof constructionZone:', typeof player.constructionZone);
    console.log('Is Array?:', Array.isArray(player.constructionZone));

    // Ensure constructionZone is an object
    if (!player.constructionZone || typeof player.constructionZone !== 'object' || Array.isArray(player.constructionZone)) {
      console.log('Construction zone is invalid type, showing empty message');
      return '<p class="empty">No objectives in progress</p>';
    }

    const objectiveKeys = Object.keys(player.constructionZone);
    console.log('Objective keys:', objectiveKeys);
    console.log('Number of objectives in construction zone:', objectiveKeys.length);

    if (objectiveKeys.length === 0) {
      console.log('Construction zone is empty, showing empty message');
      return '<p class="empty">No objectives in progress</p>';
    }

    let html = '';
    Object.entries(player.constructionZone).forEach(([objectiveId, antIds]) => {
      console.log(`Rendering objective ${objectiveId}, ant IDs:`, antIds, 'Length:', antIds.length);
      const objective = GameState.getObjectiveById(objectiveId, this.constructionData);
      if (objective) {
        const isComplete = GameState.isObjectiveComplete(player.id, objectiveId, this.constructionData);
        console.log(`Objective ${objective.name} complete status:`, isComplete);

        // Look up card objects from IDs and calculate total defense
        let totalDefense = 0;
        const antCards = antIds.map(antId => {
          const card = GameState.getCardById(antId, this.cardData);
          if (card) {
            totalDefense += card.defense || 0;
          }
          return card;
        }).filter(card => card !== null);

        html += `
          <div class="construction-objective ${isComplete ? 'complete' : ''}">
            <div class="objective-name">${objective.name}</div>
            <div class="objective-progress">${antIds.length}/${objective.antsRequired} | 🛡️ ${totalDefense}</div>
            <div class="ants-on-objective">
              ${antCards.map(ant => `<span class="ant-chip">${ant.name}</span>`).join('')}
            </div>
          </div>
        `;
      } else {
        console.log(`Objective ${objectiveId} not found!`);
      }
    });

    console.log('Final HTML output:', html);
    return html;
  },

  // Render trade row
  renderTradeRow() {
    const tradeRowContainer = document.getElementById('trade-row');
    if (!tradeRowContainer) return;

    tradeRowContainer.innerHTML = '<h3>Trade Row</h3>';

    GameState.tradeRow.forEach((cardId, index) => {
      const card = GameState.getCardById(cardId, this.cardData);
      if (card) {
        const cardElement = this.createCardElement(card, 'buy');
        cardElement.dataset.tradeIndex = index;  // Add unique index
        tradeRowContainer.appendChild(cardElement);
      }
    });
  },

  // Render construction row
  renderConstructionRow() {
    const constructionRowContainer = document.getElementById('construction-row');
    if (!constructionRowContainer) return;

    constructionRowContainer.innerHTML = '<h3>Construction Objectives</h3>';

    GameState.constructionRow.forEach(objectiveId => {
      const objective = GameState.getObjectiveById(objectiveId, this.constructionData);
      if (objective) {
        // Check if any player is building this objective
        let claimedBy = null;
        Object.values(GameState.players).forEach(player => {
          if (player.constructionZone[objectiveId]) {
            claimedBy = player;
          }
        });

        const objElement = this.createObjectiveElement(objective);

        // Add visual indicator if claimed
        if (claimedBy) {
          objElement.classList.add('claimed');
          const claimBadge = document.createElement('div');
          claimBadge.className = 'claim-badge';
          claimBadge.textContent = `Building: ${claimedBy.name}`;
          objElement.appendChild(claimBadge);
        }

        constructionRowContainer.appendChild(objElement);
      }
    });
  },

  // Render current player's hand
  renderCurrentPlayerHand() {
    const handContainer = document.getElementById('hand');
    if (!handContainer) return;

    const currentPlayer = GameState.players[this.currentPlayerId];
    if (!currentPlayer) return;

    handContainer.innerHTML = '<h3>Your Hand</h3>';

    currentPlayer.hand.forEach((cardId, index) => {
      const card = GameState.getCardById(cardId, this.cardData);
      if (card) {
        const cardElement = this.createCardElement(card, 'play');
        cardElement.dataset.handIndex = index;  // Add unique index
        handContainer.appendChild(cardElement);
      }
    });

    if (currentPlayer.hand.length === 0) {
      handContainer.innerHTML += '<p class="empty">No cards in hand</p>';
    }
  },

  // Create card DOM element
  createCardElement(card, action) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card ${card.type}`;
    cardDiv.dataset.cardId = card.id;
    cardDiv.dataset.action = action;

    const abilitiesHtml = card.abilities ?
      `<div class="abilities">${card.abilities.map(a => `<span class="ability">${a}</span>`).join(' ')}</div>` : '';

    cardDiv.innerHTML = `
      <div class="card-header">
        <span class="card-name">${card.name}</span>
        ${card.cost > 0 ? `<span class="card-cost">💎 ${card.cost}</span>` : '<span class="card-cost"></span>'}
      </div>
      <div class="card-stats">
        <span class="attack">⚔️ ${card.attack}</span>
        <span class="defense">🛡️ ${card.defense}</span>
        ${card.vp > 0 ? `<span class="vp">★ ${card.vp}</span>` : ''}
        ${card.resources > 0 ? `<span class="resources">💎 +${card.resources}</span>` : ''}
      </div>
      ${abilitiesHtml}
      <div class="card-description">${card.description}</div>
    `;

    return cardDiv;
  },

  // Create objective DOM element
  createObjectiveElement(objective) {
    const objDiv = document.createElement('div');
    objDiv.className = `objective tier-${objective.tier}`;
    objDiv.dataset.objectiveId = objective.id;

    const rewardText = this.formatReward(objective.reward);

    objDiv.innerHTML = `
      <div class="objective-header">
        <span class="objective-name">${objective.name}</span>
        <span class="objective-vp">★ ${objective.vp}</span>
      </div>
      <div class="objective-requirement">
        Requires: ${objective.antsRequired} ants
      </div>
      <div class="objective-reward">
        Reward: ${rewardText}
      </div>
      <div class="objective-description">${objective.description}</div>
    `;

    return objDiv;
  },

  // Format reward text
  formatReward(reward) {
    if (!reward) return 'None';

    switch (reward.type) {
      case 'resources':
        return `${reward.amount} Resources`;
      case 'draw':
        return `Draw ${reward.amount} card${reward.amount > 1 ? 's' : ''}`;
      case 'card':
        return `Gain ${reward.cardId}`;
      case 'vp_multiplier':
        return `+${reward.amount}x VP multiplier`;
      case 'vp_bonus':
        return `+${reward.amount} VP`;
      case 'defense':
        return `+${reward.amount} Defense`;
      case 'resources_per_turn':
        return `+${reward.amount} Resources/turn`;
      case 'game_bonus':
        return 'Special bonus';
      case 'instant_win':
        return 'WIN THE GAME!';
      default:
        return 'Unknown';
    }
  },

  // Render game info (turn, phase, etc.)
  renderGameInfo() {
    const gameInfoContainer = document.getElementById('game-info');
    if (!gameInfoContainer) return;

    const currentPlayer = GameState.players[GameState.currentPlayer];
    const isYourTurn = GameState.currentPlayer === this.currentPlayerId;

    gameInfoContainer.innerHTML = `
      <div class="turn-info">
        <div>Current Turn: <strong>${currentPlayer.name}</strong></div>
        ${isYourTurn ? '<div class="your-turn">It\'s your turn!</div>' : ''}
        <div>Phase: ${GameState.turnPhase}</div>
        <div>Status: ${GameState.status}</div>
      </div>
      ${GameState.winner ? `<div class="winner">Winner: ${GameState.players[GameState.winner].name}!</div>` : ''}
    `;
  },

  // Show message as a temporary toast notification
  showMessage(message, type = 'info') {
    // Create a toast notification instead of using the old messages sidebar
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position:fixed;top:70px;right:20px;z-index:4000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(toastContainer);
    }

    const colorMap = {
      info: 'var(--blue)',
      success: 'var(--emerald)',
      error: 'var(--red)'
    };
    const color = colorMap[type] || colorMap.info;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `padding:10px 16px;border-radius:8px;font-size:13px;color:var(--text-primary);background:var(--bg-surface);border-left:3px solid ${color};box-shadow:0 4px 15px rgba(0,0,0,0.4);animation:feedSlideIn 0.3s ease;pointer-events:auto;max-width:320px;`;
    msgDiv.textContent = message;

    toastContainer.appendChild(msgDiv);

    setTimeout(() => {
      msgDiv.style.opacity = '0';
      msgDiv.style.transition = 'opacity 0.3s ease';
      setTimeout(() => msgDiv.remove(), 300);
    }, 3000);
  },

  // Render new feed events (appends only new items)
  renderNewFeedEvents() {
    const feedContainer = document.getElementById('activity-feed');
    if (!feedContainer) return;

    const feed = GameState.activityFeed || [];

    // Only render events we haven't seen yet
    const newEvents = feed.slice(this.lastSeenFeedIndex);

    newEvents.forEach(event => {
      const itemDiv = document.createElement('div');
      const cssType = event.type.replace(/_/g, '-');
      itemDiv.className = `feed-item feed-${cssType}`;
      itemDiv.dataset.eventId = event.id;
      itemDiv.innerHTML = this.generateFeedText(event);
      feedContainer.appendChild(itemDiv);
    });

    this.lastSeenFeedIndex = feed.length;

    // Auto-scroll to bottom
    feedContainer.scrollTop = feedContainer.scrollHeight;
  },

  // Generate human-readable feed text for an event
  generateFeedText(event) {
    const player = `<span class="feed-player">${event.playerName}</span>`;
    const d = event.data || {};
    const hl = (t) => `<span class="feed-highlight">${t}</span>`;

    switch (event.type) {
      case 'card_played':
        return `${player} played ${hl(d.cardName || 'a card')}${d.resources ? ` for ${hl(d.resources)} resources` : ''}`;
      case 'card_bought':
        return `${player} bought ${hl(d.cardName || 'a card')} for ${hl(d.cost)} resources${d.vpGained ? ` (+${d.vpGained} VP)` : ''}`;
      case 'objective_placed':
        return `${player} placed ${hl(d.cardName || 'an ant')} on ${hl(d.objectiveName || 'an objective')}`;
      case 'objective_scored':
        return `${player} scored ${hl(d.objectiveName || 'an objective')} for ${hl(d.vpGained || 0)} VP!`;
      case 'attack':
        return `${player} attacked ${hl(d.targetPlayerName || 'opponent')} with ${hl(d.amount || 0)} power`;
      case 'scout':
        return `${player} scouted and kept ${hl(d.amount || 1)} card(s)`;
      case 'sabotage':
        return `${player} lost ${hl(d.amount || 1)} ant(s) to sabotage`;
      case 'trash':
        return `${player} trashed ${hl(d.amount || 1)} card(s)`;
      case 'steal':
        return `${player} was forced to discard`;
      case 'clear':
        return `${player} cleared ${hl(d.amount || 1)} card(s) from trade row`;
      case 'turn_start':
        return `${player}'s turn begins`;
      case 'turn_end':
        return `${player} ended their turn`;
      default:
        return `${player} performed an action`;
    }
  },

  // === Granular update methods for targeted rendering (Phase 3) ===

  // Update only player stats without re-rendering everything
  updatePlayerStats() {
    Object.values(GameState.players).forEach(player => {
      const playerDiv = document.querySelector(`.player[data-player-id="${player.id}"]`);
      if (!playerDiv) return;

      const vp = GameState.calculateVP(player.id);

      // Update stat values with animation on change
      const vpEl = playerDiv.querySelector('.vp');
      const resEl = playerDiv.querySelector('.resources');
      const atkEl = playerDiv.querySelector('.attack-power');
      const deckEl = playerDiv.querySelector('.deck-count');
      const handEl = playerDiv.querySelector('.hand-count');
      const discardEl = playerDiv.querySelector('.discard-count');

      if (vpEl && vpEl.textContent !== String(vp)) {
        vpEl.textContent = vp;
        Animations.statPulse(vpEl);
      }
      if (resEl && resEl.textContent !== String(player.resources)) {
        resEl.textContent = player.resources;
        Animations.statPulse(resEl);
      }
      if (atkEl) atkEl.textContent = player.attackPower || 0;
      if (deckEl) deckEl.textContent = player.deck.length;
      if (handEl) handEl.textContent = player.hand.length;
      if (discardEl) discardEl.textContent = player.discard.length;

      // Update current-turn class
      if (player.id === GameState.currentPlayer) {
        playerDiv.classList.add('current-turn');
      } else {
        playerDiv.classList.remove('current-turn');
      }
    });
  },

  // Update only the trade row
  updateTradeRow() {
    this.renderTradeRow();
  },

  // Update only the player's hand
  updateHand() {
    this.renderCurrentPlayerHand();
  },

  // Update only the construction row
  updateConstructionRow() {
    this.renderConstructionRow();
  },

  // Update construction zones inside player cards
  updateConstructionZones() {
    Object.values(GameState.players).forEach(player => {
      const completedEl = document.getElementById(`completed-${player.id}`);
      const constructionEl = document.getElementById(`construction-${player.id}`);

      if (completedEl) {
        completedEl.innerHTML = `<h4>Scored Objectives</h4>${this.renderCompletedObjectives(player)}`;
      }
      if (constructionEl) {
        constructionEl.innerHTML = `<h4>Construction Zone (In Progress)</h4>${this.renderPlayerConstruction(player)}`;
      }
    });
  },

  // Show action menu for a card
  showCardActions(card, availableActions) {
    const menuContainer = document.getElementById('action-menu');
    if (!menuContainer) return;

    menuContainer.innerHTML = `
      <div class="action-menu-content">
        <h4>${card.name}</h4>
        <div class="actions">
          ${availableActions.map(action => `
            <button class="action-btn" data-action="${action.type}" data-card-id="${card.id}">
              ${action.label}
            </button>
          `).join('')}
          <button class="action-btn cancel">Cancel</button>
        </div>
      </div>
    `;

    menuContainer.style.display = 'block';
  },

  // Hide action menu
  hideActionMenu() {
    const menuContainer = document.getElementById('action-menu');
    if (menuContainer) {
      menuContainer.style.display = 'none';
    }
  }
};
