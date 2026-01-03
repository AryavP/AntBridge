// Comprehensive Logger Utility
// Provides structured logging for debugging UI glitching and race conditions

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

export const LogCategory = {
  GAME: 'GAME',
  ACTION: 'ACTION',
  EVENT: 'EVENT',
  UI: 'UI',
  FIREBASE: 'FIREBASE',
  STATE: 'STATE'
};

class Logger {
  constructor() {
    this.level = LogLevel.DEBUG;
    this.playerId = null;
    this.enabled = true;
  }

  // Initialize logger with player context
  init(playerId) {
    this.playerId = playerId;
    this.log(LogLevel.INFO, LogCategory.GAME, 'Logger initialized', { playerId });
  }

  // Set minimum log level
  setLevel(level) {
    this.level = level;
  }

  // Enable/disable logging
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // Format timestamp with milliseconds
  getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  // Core logging method
  log(level, category, message, data = {}) {
    if (!this.enabled || level < this.level) {
      return;
    }

    const timestamp = this.getTimestamp();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level) || 'UNKNOWN';

    // Add player context to data
    const enrichedData = {
      ...data,
      playerId: this.playerId
    };

    // Format log message
    const logPrefix = `[${timestamp}] [${levelName}] [${category}]`;
    const logMessage = `${logPrefix} ${message}`;

    // Choose console method based on level
    const consoleMethod = level >= LogLevel.ERROR ? 'error' :
                         level >= LogLevel.WARN ? 'warn' :
                         level >= LogLevel.INFO ? 'info' :
                         'log';

    // Log with data if present
    if (Object.keys(enrichedData).length > 1) { // More than just playerId
      console[consoleMethod](logMessage, enrichedData);
    } else {
      console[consoleMethod](logMessage);
    }
  }

  // Convenience methods
  debug(category, message, data) {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category, message, data) {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category, message, data) {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category, message, data) {
    this.log(LogLevel.ERROR, category, message, data);
  }

  // Event lifecycle logging helpers
  eventInitiated(eventType, eventData) {
    this.info(LogCategory.EVENT, `Event initiated: ${eventType}`, {
      eventType,
      eventId: eventData.eventId,
      targetPlayer: eventData.playerId,
      initiator: this.playerId,
      timestamp: Date.now()
    });
  }

  eventProcessing(eventType, eventData) {
    this.debug(LogCategory.EVENT, `Event processing: ${eventType}`, {
      eventType,
      eventId: eventData.eventId,
      targetPlayer: eventData.playerId,
      currentPlayer: eventData.currentPlayer,
      timestamp: Date.now()
    });
  }

  eventCompleted(eventType, eventData, result) {
    this.info(LogCategory.EVENT, `Event completed: ${eventType}`, {
      eventType,
      eventId: eventData.eventId,
      success: result.success,
      timestamp: Date.now()
    });
  }

  eventSkipped(eventType, reason, eventData) {
    this.debug(LogCategory.EVENT, `Event skipped: ${eventType} - ${reason}`, {
      eventType,
      eventId: eventData?.eventId,
      reason,
      timestamp: Date.now()
    });
  }

  // Firebase listener logging
  firebaseUpdate(source, gameState) {
    this.debug(LogCategory.FIREBASE, `Firebase listener fired - ${source}`, {
      source,
      currentPlayer: gameState.currentPlayer,
      turn: gameState.turnPhase,
      hasPendingScout: !!gameState.pendingScout,
      hasPendingDiscard: !!gameState.pendingDiscard,
      hasPendingSabotage: !!gameState.pendingSabotage,
      hasPendingTrash: !!gameState.pendingTrash,
      timestamp: Date.now()
    });
  }

  // UI interaction logging
  uiInteraction(action, allowed, details) {
    this.debug(LogCategory.UI, `UI interaction: ${action}`, {
      action,
      allowed,
      reason: details.reason,
      ...details
    });
  }

  // Modal lifecycle logging
  modalShow(modalType, eventId) {
    this.info(LogCategory.UI, `Modal shown: ${modalType}`, {
      modalType,
      eventId,
      timestamp: Date.now()
    });
  }

  modalClose(modalType, eventId, completed) {
    this.info(LogCategory.UI, `Modal closed: ${modalType}`, {
      modalType,
      eventId,
      completed,
      timestamp: Date.now()
    });
  }

  // Turn state logging
  turnChange(oldPlayer, newPlayer, turnPhase) {
    this.info(LogCategory.GAME, 'Turn changed', {
      from: oldPlayer,
      to: newPlayer,
      phase: turnPhase,
      isMyTurn: newPlayer === this.playerId,
      timestamp: Date.now()
    });
  }

  // Action logging
  actionAttempt(actionType, actionData) {
    this.debug(LogCategory.ACTION, `Action attempt: ${actionType}`, {
      actionType,
      ...actionData,
      timestamp: Date.now()
    });
  }

  actionResult(actionType, success, result) {
    this.info(LogCategory.ACTION, `Action result: ${actionType} - ${success ? 'SUCCESS' : 'FAILED'}`, {
      actionType,
      success,
      error: result.error,
      timestamp: Date.now()
    });
  }

  // State change logging
  stateChange(component, change) {
    this.debug(LogCategory.STATE, `State change: ${component}`, {
      component,
      ...change,
      timestamp: Date.now()
    });
  }
}

// Export singleton instance
export const logger = new Logger();
