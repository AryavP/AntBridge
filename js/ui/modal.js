// Modal Manager
// Handles reusable modals for card selection and other interactions

export const ModalManager = {
  // Show card selection modal and return a promise with the selected card
  showCardSelection(cards, cardData, options = {}) {
    return new Promise((resolve, reject) => {
      const modal = document.getElementById('card-selection-modal');
      const title = document.getElementById('card-selection-title');
      const cardsContainer = document.getElementById('card-selection-cards');
      const cancelBtn = document.getElementById('card-selection-cancel');

      // Set title
      title.textContent = options.title || 'Select a Card';

      // Clear previous cards
      cardsContainer.innerHTML = '';

      // Render cards
      cards.forEach((cardId, index) => {
        const card = this.getCardById(cardId, cardData);
        if (!card) return;

        const cardDiv = document.createElement('div');
        const isFromDiscard = options.discardStartIndex !== undefined && index >= options.discardStartIndex;
        cardDiv.className = 'selectable-card' + (isFromDiscard ? ' from-discard' : '');
        cardDiv.dataset.cardId = cardId;

        cardDiv.innerHTML = `
          <div class="card-name">${card.name}</div>
          <div class="card-cost">Cost: ${card.cost}</div>
          <div class="card-stats">
            <span>⚔️ ${card.attack}</span>
            <span>🛡️ ${card.defense}</span>
            <span>📦 ${card.resources}</span>
            ${card.vp ? `<span>⭐ ${card.vp}</span>` : ''}
          </div>
          <div class="card-description">${card.description || ''}</div>
        `;

        // Handle card selection
        cardDiv.addEventListener('click', () => {
          this.hideCardSelection();
          resolve(cardId);
        });

        cardsContainer.appendChild(cardDiv);
      });

      // Handle cancel
      const cancelHandler = () => {
        this.hideCardSelection();
        reject(new Error('Card selection cancelled'));
      };

      cancelBtn.onclick = cancelHandler;

      // Handle backdrop click
      const backdrop = modal.querySelector('.modal-backdrop');
      backdrop.onclick = cancelHandler;

      // Show modal
      modal.style.display = 'flex';
    });
  },

  // Hide card selection modal
  hideCardSelection() {
    const modal = document.getElementById('card-selection-modal');
    modal.style.display = 'none';
  },

  // Helper to get card by ID
  getCardById(cardId, cardData) {
    if (!cardData || !cardData.ants) return null;
    return cardData.ants.find(c => c.id === cardId);
  }
};
