# AntBridge Logging System

This document describes the comprehensive logging system added to help debug UI glitching and race conditions.

## Logger Utility

Location: `/Users/aryavpal/Projects/AntBridge/js/utils/logger.js`

### Features

- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Categories**: GAME, ACTION, EVENT, UI, FIREBASE, STATE
- **Timestamps**: Millisecond precision (HH:MM:SS.mmm)
- **Player Context**: Every log includes the player ID
- **Event IDs**: Events are tracked with unique IDs for correlation

### Log Format

```
[HH:MM:SS.mmm] [LEVEL] [CATEGORY] message {data}
```

Example:
```
[14:23:45.123] [INFO] [EVENT] Event initiated: scout {eventType: "scout", eventId: "scout_1234567_0.123", ...}
```

## What's Logged

### 1. Event Lifecycle (actions.js)

**Event Initiation** - When a card ability triggers an event:
- Scout events (when Spy Ant is played)
- Sabotage events (when Engineer Ant is played)
- Steal/Discard events (when Thief Ant is played)
- Trash events (when Recycler Ant is played)

Each log includes:
- Event type
- Target player ID
- Initiating player ID
- Unique event ID
- Timestamp

### 2. Event Processing (events.js)

**checkPending* Methods** - Logs when events are checked and processed:
- When method is called
- Whether event exists
- Who the event is for
- Current player vs target player
- Whether event is skipped (already processed, wrong player, etc.)
- When modal shows
- When modal closes (completed or cancelled)

### 3. Firebase Listener (main.js)

**Every Firebase Update**:
- Source (initial load vs remote update)
- Current player
- Turn phase
- Pending event flags (scout, discard, sabotage, trash)
- Time since last update (milliseconds)

### 4. UI Interactions (events.js)

**Card Clicks**:
- Whether click was allowed
- Reason if not allowed
- Card ID and index
- Current player vs local player

**Turn Changes**:
- Previous player
- New player
- Whether it's the local player's turn
- Turn phase

### 5. Turn State

All logs include context about:
- Whose turn it is (GameState.currentPlayer)
- Who the local player is (this.currentPlayerId)
- Whether UI interactions should be allowed

## Using the Logs

### Filtering by Category

```javascript
// In browser console, filter by category:
// Look for only EVENT logs
[18:23:45.123] [DEBUG] [EVENT] ...

// Look for only FIREBASE logs
[18:23:45.234] [DEBUG] [FIREBASE] ...
```

### Tracing an Event

1. Find event initiation:
```
[18:23:45.123] [INFO] [EVENT] Event initiated: discard {eventId: "discard_1234567_0.123", targetPlayer: "player_abc", attackerId: "player_xyz"}
```

2. Follow through processing:
```
[18:23:45.234] [DEBUG] [EVENT] checkPendingDiscard called {eventId: "discard_1234567_0.123", ...}
[18:23:45.345] [DEBUG] [EVENT] Event processing: discard {eventId: "discard_1234567_0.123", ...}
[18:23:45.456] [INFO] [UI] Modal shown: discard {eventId: "discard_1234567_0.123"}
```

3. See completion:
```
[18:23:47.890] [INFO] [EVENT] Event completed: discard {eventId: "discard_1234567_0.123", success: true}
[18:23:47.901] [INFO] [UI] Modal closed: discard {eventId: "discard_1234567_0.123", completed: true}
```

### Investigating Race Conditions

Look for:
1. **Multiple Firebase updates in quick succession**:
   - Check `timeSinceLastUpdate` values
   - Look for updates < 100ms apart

2. **Events being processed multiple times**:
   - Look for "already processing" skip messages
   - Look for "already processed" skip messages with same eventId

3. **Events shown to wrong player**:
   - Compare `targetPlayer` vs `localPlayer`
   - Check `currentPlayer` vs `localPlayer`

4. **Modal timing issues**:
   - Check time between "Modal shown" and "Modal closed"
   - Look for multiple "Modal shown" without corresponding closes

## Adjusting Log Level

To reduce log noise, increase the minimum level in browser console:

```javascript
// Only show INFO and above (hides DEBUG)
logger.setLevel(LogLevel.INFO);

// Only show WARN and above
logger.setLevel(LogLevel.WARN);

// Show everything (default)
logger.setLevel(LogLevel.DEBUG);
```

## Key Scenarios to Watch

### Scenario 1: Steal/Discard Race
- Player 1 plays Thief Ant on their turn
- pendingDiscard is set for Player 2
- Firebase update triggers
- Player 2 sees modal (correct)
- BUT: Player 1 might ALSO check the event
- Look for: "Event skipped: not for this player"

### Scenario 2: Double Modal
- Event is initiated
- Firebase update triggers checkPending*
- Modal shows
- ANOTHER Firebase update triggers before modal closes
- Second checkPending* call happens
- Look for: "Event skipped: already processing"

### Scenario 3: Turn Confusion
- Player completes their action
- Turn changes via endTurn
- Events are checked before state fully syncs
- Look for: currentPlayer !== localPlayer in event logs

## What Was Removed

Cleaned up verbose logs:
- constructionZone conversion logs (state.js)
- Raw Firebase data dumps (state.js, main.js)
- Generic console.logs throughout (actions.js, events.js)
- Redundant "Refresh trade clicked!" logs (events.js)

These were replaced with structured, searchable logs using the logger utility.
