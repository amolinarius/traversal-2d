export enum PieceType { EXPLORER, VANGUARD, SENTINEL }
export enum Color { RED, BLUE }
export enum Winner { RED, BLUE, DRAW }
export enum DrawReason { THREEFOLD_REPETITION, MOVE_LIMIT }
export enum WinReason { MOVE_LIMIT_SCORE, MOVE_LIMIT_ADVANCEMENT }
export enum VictoryType { TOTAL_DOMINATION, PERFECT_GAME }
export enum PlayerType { PLAYER, BOT }

export interface Piece {
    type: PieceType;
    color: Color;
    x: number;
    y: number;
}
export interface GameState {
    heights: number[][];
    pieces: Piece[];
    currentTurn: Color;
    moveCount: number;
    finishedPieces: Piece[];
    firstToFinish?: Piece;
    gameOver: boolean;
    winner?: Winner;
    scores: [number, number];
    positionHistory: string[];
    drawReason?: DrawReason;
    winReason?: WinReason;
    victoryType?: VictoryType;
}
export interface Move {
	dest: { x: number, y: number };
	cost: number;
	isAttack: boolean;
}
export interface SearchPosition {
    x: number;
    y: number;
    /** Remaining movement points */
    remaining: number;
}
export interface Players {
    red: { type: PlayerType };
    blue: { type: PlayerType };
}