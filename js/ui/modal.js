// Modal Manager
// Handles reusable modals for card selection and other interactions

export const ModalManager = {
  // Track current keyboard handler for cleanup
  currentKeyHandler: null,

  // Show card selection modal and return a promise with selected cards
  // Options:
  //   title: Modal title
  //   maxSelections: Maximum cards to select (default 1)
  //   minSelections: Minimum cards required to confirm (default 1)
  //   forceComplete: If true, hide cancel button (for sabotage)
  //   discardStartIndex: Index where discard pile cards start (for trash modal)
  showCardSelection(cards, cardData, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        title = 'Select a Card',
        maxSelections = 1,
        minSelections = 1,
        forceComplete = false,
        discardStartIndex
      } = options;

      const modal = document.getElementById('card-selection-modal');
      const titleEl = document.getElementById('card-selection-title');
      const cardsContainer = document.getElementById('card-selection-cards');
      const confirmBtn = document.getElementById('card-selection-confirm');
      const cancelBtn = document.getElementById('card-selection-cancel');

      // Track selected card indices
      let selectedIndices = [];
      const cardDivs = [];

      // Set title
      titleEl.textContent = title;

      // Clear previous cards
      cardsContainer.innerHTML = '';

      // Update confirm button state
      const updateConfirmButton = () => {
        const canConfirm = selectedIndices.length >= minSelections;
        confirmBtn.disabled = !canConfirm;

        // Update button text to show selection count
        if (maxSelections > 1) {
          confirmBtn.textContent = `Confirm (${selectedIndices.length}/${maxSelections})`;
        } else {
          confirmBtn.textContent = 'Confirm';
        }
      };

      // Render cards
      cards.forEach((cardId, index) => {
        const card = this.getCardById(cardId, cardData);
        if (!card) return;

        const cardDiv = document.createElement('div');
        const isFromDiscard = discardStartIndex !== undefined && index >= discardStartIndex;
        cardDiv.className = 'selectable-card' + (isFromDiscard ? ' from-discard' : '');
        cardDiv.dataset.cardId = cardId;
        cardDiv.dataset.index = index;

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

        // Handle card selection toggle
        cardDiv.addEventListener('click', () => {
          const idx = selectedIndices.indexOf(index);
          if (idx === -1) {
            // Not selected - try to add
            if (selectedIndices.length < maxSelections) {
              selectedIndices.push(index);
              cardDiv.classList.add('selected');
            }
          } else {
            // Already selected - remove
            selectedIndices.splice(idx, 1);
            cardDiv.classList.remove('selected');
          }
          updateConfirmButton();
        });

        cardsContainer.appendChild(cardDiv);
        cardDivs.push(cardDiv);
      });

      // Build result object with card IDs, indices, and locations
      const buildResult = () => {
        return {
          cardIds: selectedIndices.map(i => cards[i]),
          indices: selectedIndices.slice(),
          locations: selectedIndices.map(i => {
            if (discardStartIndex !== undefined && i >= discardStartIndex) {
              return 'discard';
            }
            return 'hand';
          })
        };
      };

      // Handle confirm
      const confirmHandler = () => {
        if (selectedIndices.length >= minSelections) {
          this.hideCardSelection();
          resolve(buildResult());
        }
      };

      confirmBtn.onclick = confirmHandler;

      // Handle cancel
      const cancelHandler = () => {
        this.hideCardSelection();
        reject(new Error('Card selection cancelled'));
      };

      // Show/hide cancel button based on forceComplete
      if (forceComplete) {
        cancelBtn.style.display = 'none';
      } else {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = cancelHandler;
      }

      // Handle backdrop click (only if not forced)
      const backdrop = modal.querySelector('.modal-backdrop');
      if (!forceComplete) {
        backdrop.onclick = cancelHandler;
      } else {
        backdrop.onclick = null;
      }

      // Handle Enter key to confirm
      const keyHandler = (e) => {
        if (e.key === 'Enter' && selectedIndices.length >= minSelections) {
          e.preventDefault();
          confirmHandler();
        } else if (e.key === 'Escape' && !forceComplete) {
          e.preventDefault();
          cancelHandler();
        }
      };

      // Remove previous key handler if any
      if (this.currentKeyHandler) {
        document.removeEventListener('keydown', this.currentKeyHandler);
      }
      this.currentKeyHandler = keyHandler;
      document.addEventListener('keydown', keyHandler);

      // Initialize confirm button state
      updateConfirmButton();

      // Show modal
      modal.style.display = 'flex';
    });
  },

  // Hide card selection modal
  hideCardSelection() {
    const modal = document.getElementById('card-selection-modal');
    modal.style.display = 'none';

    // Clean up keyboard handler
    if (this.currentKeyHandler) {
      document.removeEventListener('keydown', this.currentKeyHandler);
      this.currentKeyHandler = null;
    }
  },

  // Helper to get card by ID
  getCardById(cardId, cardData) {
    if (!cardData || !cardData.ants) return null;
    return cardData.ants.find(c => c.id === cardId);
  }
};
