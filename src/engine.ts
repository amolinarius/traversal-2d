//Adapted from localGameEngine.ts - See https://gist.github.com/amolinarius/4d9e4aa8ed44cac56206b6a1a4b7e18f
import { Color, PieceType, Winner, VictoryType, WinReason, DrawReason } from "../types";
import type { GameState, Move, Piece, SearchPosition } from "../types";
import Utils from "./utils";

const CARDINAL_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
const EXPLORER_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-2, 0], [0, -2], [2, 0], [0, 2]] as const;
const MOVE_LIMIT = 200;
const STARTING_PIECES: readonly [PieceType, number][] = [
    [PieceType.SENTINEL, 2],
    [PieceType.VANGUARD, 3],
    [PieceType.EXPLORER, 4],
    [PieceType.EXPLORER, 5],
    [PieceType.VANGUARD, 6],
    [PieceType.SENTINEL, 7]
];
const PIECE_STATS: Record<PieceType, { movement: number; strength: number }> = {
    [PieceType.EXPLORER]: { movement: 5, strength: 1 },
    [PieceType.VANGUARD]: { movement: 4, strength: 2 },
    [PieceType.SENTINEL]: { movement: 3, strength: 3 },
};

export default class Engine {
    state: GameState;
    constructor(heights: number[][]) {
        this.state = this.createInitialGameState(heights);
    }
    createInitialGameState(heights: number[][]): GameState {
        const pieces: Piece[] = [];
        for (const [type, x] of STARTING_PIECES) pieces.push({ type, color: Color.RED, x, y: 9 });
        for (const [type, x] of STARTING_PIECES) pieces.push({ type, color: Color.BLUE, x, y: 0 });
        return {
            heights, pieces,
            currentTurn: Color.RED,
            moveCount: 0,
            finishedPieces: [],
            gameOver: false,
            scores: [0, 0],
            positionHistory: []
        };
    }
    getMovementCost(piece: { x: number, y: number}, to: { x: number, y: number }): number {
        const heightDiff = this.state.heights[to.y][to.x] - this.state.heights[piece.y][piece.x];
        return heightDiff == 0 ? 1 : Math.abs(heightDiff) + 1;
    }
    countAdjacentFriendlyPieces(piece: Piece): number {
        let count = 0;
        for (const [_x, _y] of CARDINAL_DIRECTIONS) {
            const x = piece.x + _x;
            const y = piece.y + _y;
            count += +(Utils.isInBounds(x, y) && this.state.pieces.some(p => p.x==x && p.y==y && p.color==piece.color && p != piece));
        }
        return count;
    }
    getAdjacentFriendlyStrength(attacker: Piece, defender: Piece): number {
        let strength = 0;
        for (const [_x, _y] of CARDINAL_DIRECTIONS) {
            const x = defender.x+_x, y = defender.y+_y;
            if (!Utils.isInBounds(x, y)) continue;
            const adjacentPiece = this.state.pieces.find(p => p.x==x && p.y==y && p.color == attacker.color && p != attacker);
            if (adjacentPiece) strength += PIECE_STATS[adjacentPiece.type].strength;
        }
        return strength;
    }
    getCombatStrength(attacker: Piece, defender: Piece): { attacker: number, defender: number } {
        const heightDiff = this.state.heights[attacker.y][attacker.x] - this.state.heights[defender.y][defender.x];
        return {
            attacker: PIECE_STATS[attacker.type].strength + +(heightDiff>0) - +(heightDiff<0) + this.getAdjacentFriendlyStrength(attacker, defender),
            defender: PIECE_STATS[defender.type].strength + this.countAdjacentFriendlyPieces(defender)
        };
    }
    canPieceFinish(piece: Piece, row?: number): boolean { return piece.color == Color.RED ? (row ?? piece.y) == 0 : (row ?? piece.y) == 9 }
    getLegalMoves(piece: Piece, ignoreTurn: boolean = false): Move[] {
        if ((!ignoreTurn && piece.color != this.state.currentTurn) || !this.state.pieces.includes(piece)) return [];
        const getPositionId = (pos: Omit<SearchPosition,"remaining">) => `${pos.x},${pos.y}`;
        const bestRemainingMovement = new Map<string, number>([[getPositionId(piece), PIECE_STATS[piece.type].movement]]);
        const movesByPosition = new Map<string, Move>();
        const attackTargets = new Map<string, { minCost: number, target: Piece }>();
        const finishColumns: SearchPosition[] = [];
        const queue: SearchPosition[] = [{ x: piece.x, y: piece.y, remaining: PIECE_STATS[piece.type].movement }];
        if (this.canPieceFinish(piece)) finishColumns.push({ x: piece.x, y: piece.y, remaining: PIECE_STATS[piece.type].movement });

        while (queue.length > 0) {
            const pos = queue.shift()!;
            const posId = getPositionId(pos);
            if (pos.remaining < (bestRemainingMovement.get(posId) ?? -1)) continue;
            if (pos.remaining >= 1 && (pos.x != piece.x || pos.y != piece.y) && this.canPieceFinish(piece, pos.y)) finishColumns.push(pos);
            for (const [_x, _y] of CARDINAL_DIRECTIONS) {
                const x = pos.x + _x, y = pos.y + _y, id = getPositionId({ x, y });
                if (!Utils.isInBounds(x, y)) continue;
                const movementCost = this.getMovementCost({ x: pos.x, y: pos.y }, { x, y });
                if (movementCost > pos.remaining) continue;

                const occupyingPiece = this.state.pieces.find(p => p.x == x && p.y == y);
                if (occupyingPiece) {
                    if (occupyingPiece.color != piece.color) {
                        const attackCost = PIECE_STATS[piece.type].movement - pos.remaining + movementCost;
                        const currentTarget = attackTargets.get(id);
                        if (!currentTarget || attackCost < currentTarget.minCost) attackTargets.set(id, { minCost: attackCost, target: occupyingPiece });
                    }
                    continue;
                }

                const nextRemaining = pos.remaining - movementCost;
                const bestRemaining = bestRemainingMovement.get(id) ?? -1;
                if (nextRemaining > bestRemaining) {
                    bestRemainingMovement.set(id, nextRemaining);
                    if (piece.x != x || piece.y != y) movesByPosition.set(id, { dest: { x, y }, cost: PIECE_STATS[piece.type].movement - nextRemaining, isAttack: false });
                    if (nextRemaining > 0) queue.push({ x, y, remaining: nextRemaining });
                }
            }
        }

        const moves = [...movesByPosition.values()];
        for (const [posId, { minCost, target }] of attackTargets) {
            const [x, y] = posId.split(',').map(Number);
            const combatStrength = this.getCombatStrength(piece, target);
            const effectiveAttackerStrength = combatStrength.attacker + +(piece.type == PieceType.VANGUARD && minCost == 4);
            if (effectiveAttackerStrength >= combatStrength.defender) moves.push({ dest: { x, y }, cost: minCost, isAttack: true });
        }

        const addedFinishColumns = new Set<number>();
        for (const { x } of finishColumns) {
            if (addedFinishColumns.has(x)) continue;
            addedFinishColumns.add(x);
            moves.push({ dest: { x, y: piece.color == Color.RED ? -1 : 10 }, cost: PIECE_STATS[piece.type].movement, isAttack: false });
        }

        if (piece.type == PieceType.EXPLORER) {
            for (const [_x, _y] of EXPLORER_DIRECTIONS) {
                if (Math.abs(_x) == 2 || Math.abs(_y) == 2) {
                    const jumpedX = piece.x + Math.floor(_x/2);
                    const jumpedY = piece.y + Math.floor(_y/2);
                    if (!Utils.isInBounds(jumpedX, jumpedY) || this.state.pieces.some(p => p.x==jumpedX && p.y==jumpedY)) continue;
                }
                const x = piece.x + _x, y = piece.y + _y;
                if (y < 0 || y >= 10) {
                    if (x >= 0 && x < 10 && (piece.color == Color.RED ? _y < 0 : _y > 0) && !addedFinishColumns.has(x)) {
                        addedFinishColumns.add(x);
                        moves.push({ dest: { x, y: piece.color == Color.RED ? -1 : 10 }, cost: PIECE_STATS[piece.type].movement, isAttack: false });
                    }
                    continue;
                }
                if (x < 0 || x >= 10) continue;

                const posId = getPositionId({ x, y });
                if (bestRemainingMovement.has(posId) || attackTargets.has(posId)) continue;
                const occupyingPiece = this.state.pieces.find(p => p.x==x && p.y==y);
                if (!occupyingPiece) moves.push({ dest: { x, y }, cost: PIECE_STATS[piece.type].movement, isAttack: false });
                else if (occupyingPiece.color != piece.color) {
                    const combatStrength = this.getCombatStrength(piece, occupyingPiece);
                    if (combatStrength.attacker >= combatStrength.defender) moves.push({ dest: { x, y }, cost: PIECE_STATS[piece.type].movement, isAttack: true });
                }
            }
        }
        return moves;
    }
    applyMove(piece: Piece, move: Move) {
        if (!this.state.pieces.includes(piece)) {
            console.error("Piece not found");
            return;
        }
        const legalMove = this.getLegalMoves(piece).find(candidate => candidate.dest.x == move.dest.x && candidate.dest.y == move.dest.y);
        if (!legalMove) {
            console.error("Illegal move");
            return;
        }
        const target = this.state.pieces.find(p => p.x == move.dest.x && p.y == move.dest.y && p.color != piece.color);
        if (legalMove.isAttack && target) this.state.pieces.splice(this.state.pieces.indexOf(target), 1);
        if (move.dest.y >= 0 && move.dest.y < 10) { piece.x = move.dest.x; piece.y = move.dest.y; }
        else {
            this.state.pieces.splice(this.state.pieces.indexOf(piece), 1);
            this.state.finishedPieces.push(piece);
            this.state.scores[piece.color] += PIECE_STATS[piece.type].strength;
            if (this.state.firstToFinish == null) {
                this.state.firstToFinish = piece;
                if (piece.type == PieceType.SENTINEL) {
                    this.state.gameOver = true;
                    this.state.winner = piece.color as unknown as Winner;
                }
            }
        }
        if (this.state.finishedPieces.length >= 2 && !this.state.gameOver) {
            this.state.gameOver = true;
            this.state.winner = this.state.scores[Color.RED]>this.state.scores[Color.BLUE] ? Winner.RED : (this.state.scores[Color.RED]<this.state.scores[Color.BLUE] ? Winner.BLUE : Winner.DRAW);
        }
        if (!this.state.gameOver) {
            const redPieces = this.state.pieces.filter(p => p.color == Color.RED);
            const bluePieces = this.state.pieces.filter(p => p.color == Color.BLUE);
            if (redPieces.length == 0 || bluePieces.length == 0) {
                this.state.gameOver = true;
                const redStrength = redPieces.length > 0 ? Math.max(...redPieces.map(({type}) => PIECE_STATS[type].strength)) : 0;
                const blueStrength = bluePieces.length > 0 ? Math.max(...bluePieces.map(({type}) => PIECE_STATS[type].strength)) : 0;
                this.state.scores = [this.state.scores[Color.RED]+redStrength, this.state.scores[Color.BLUE]+blueStrength];
                this.state.winner = this.state.scores[Color.RED]>this.state.scores[Color.BLUE] ? Winner.RED : (this.state.scores[Color.RED]<this.state.scores[Color.BLUE] ? Winner.BLUE : Winner.DRAW);
            }
        }
        if (this.state.gameOver && this.state.victoryType == undefined) this.state.victoryType = this.getVictoryType();
        this.state.currentTurn = (this.state.currentTurn+1) % 2; //? Weird but cool
        this.state.moveCount++;
        if (!this.state.gameOver && this.state.moveCount >= MOVE_LIMIT) this.resolveMoveLimit();

        if (!this.state.gameOver) {
            this.state.positionHistory.push(this.serializePosition());
            for (let repetitionLength = 2; repetitionLength <= Math.floor(this.state.positionHistory.length / 3); repetitionLength += 2) {
                if (this.state.positionHistory.length < 3 * repetitionLength) continue;
                const recent = this.state.positionHistory.slice(-repetitionLength);
                const previous = this.state.positionHistory.slice(-2 * repetitionLength, -repetitionLength);
                const oldest = this.state.positionHistory.slice(-3 * repetitionLength, -2 * repetitionLength);
                if (recent.every((position, index) => position == previous[index] && position === oldest[index])) {
                    this.state.gameOver = true;
                    this.state.winner = 0;
                    this.state.drawReason = DrawReason.THREEFOLD_REPETITION;
                    break;
                }
            }
        }
    }
    getVictoryType(): VictoryType|undefined {
        if (this.state.winner != Winner.RED && this.state.winner != Winner.BLUE) return undefined;
        const losingPlayer = this.state.winner == Winner.RED ? Color.BLUE : Color.RED;
        if (this.state.pieces.filter(p => p.color == losingPlayer).length == 0) return VictoryType.TOTAL_DOMINATION;

        const winningTypes = new Set<PieceType>();
        let losingFinishedCount = 0;
        for (const piece of this.state.finishedPieces) {
            if (piece.color as unknown as Winner == this.state.winner) winningTypes.add(piece.type);
            else losingFinishedCount++;
        }
        return losingFinishedCount == 0 && winningTypes.has(PieceType.VANGUARD) && winningTypes.has(PieceType.SENTINEL) ? VictoryType.PERFECT_GAME : undefined;
    }
    resolveMoveLimit(): void {
        this.state.gameOver = true;
        if (this.state.scores[Color.RED] != this.state.scores[Color.BLUE]) {
            this.state.winner = this.state.scores[Color.RED] > this.state.scores[Color.BLUE] ? Winner.RED : Winner.BLUE;
            this.state.winReason = WinReason.MOVE_LIMIT_SCORE;
            return;
        }
        const closestPiece = (color: Color): [number, number] | null => {
            let closest: [number, number] | null = null;
            for (const piece of this.state.pieces) {
                if (piece.color != color) continue;
                const advancement = color == Color.RED ? piece.y : 9 - piece.y;
                if (!closest || advancement < closest[0] || (advancement == closest[0] && PIECE_STATS[piece.type].strength > closest[1])) closest = [advancement, PIECE_STATS[piece.type].strength];
            }
            return closest;
        };
        const isAhead = (candidate: [number, number]|null, opponent: [number, number]|null): boolean =>
            candidate != null && (opponent == null || candidate[0] < opponent[0] || (candidate[0] == opponent[0] && candidate[1] > opponent[1]));
        const red = closestPiece(Color.RED);
        const blue = closestPiece(Color.BLUE);
        this.state.winner = isAhead(red, blue) ? Winner.RED : (isAhead(blue, red) ? Winner.BLUE : Winner.DRAW);
        if (this.state.winner) this.state.winReason = WinReason.MOVE_LIMIT_ADVANCEMENT;
        else this.state.drawReason = DrawReason.MOVE_LIMIT;
    }
    serializePosition(): string {
        const serializePiece = (piece: Piece) => `${piece.color+1},${piece.type},${piece.y},${piece.x}`; //? Color+1 and y/x for compatibility with original game
        const pieces = this.state.pieces.map(serializePiece).sort();
        const finishedPieces = this.state.finishedPieces.map(serializePiece).sort().join(",");
        return `${this.state.currentTurn}|${pieces.join(";")}|${finishedPieces}`;
    }
}