type ChessState = any;
type ChessMove = any;
type Color = 'BLACK' | 'WHITE';

/**
 * SERVER-SENT EVENTS
 */

interface BaseEvent {
    gameId: string;
    yourColor: Color;
    state: ChessState;
}

interface GameEvent extends BaseEvent {
    type: 'YOUR_MOVE';
}

interface ConfirmMove extends BaseEvent {
    type: 'CONFIRM_BOT_MOVE';
}

interface InvalidMove extends BaseEvent {
    type: 'INVALID_BOT_MOVE';
}

interface NotYourMove extends BaseEvent {
    type: 'NOT_YOUR_MOVE';
}

interface GameEnd extends BaseEvent {
    type: 'GAME_END';
    reason: 'CHECKMATE' | 'STALEMATE' | 'INSUFFICIENT_MATERIAL' | 'TIMEOUT' | 'TOO_MANY_INVALID_MOVES' | 'DISQUALIFIED';
    winner: Color;
}

interface ConfirmRegistration {
    type: 'CONFIRM_BOT_REGISTRATION';
}

/**
 * BOT-SENT EVENTS
 */

interface RegisterEvent {
    type: 'REGISTER_BOT';
    name: string;
}

interface BotMove {
    type: 'BOT_MOVE';
    move: ChessMove;
    gameId: string;
}