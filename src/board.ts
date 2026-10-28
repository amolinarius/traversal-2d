import { Color, PieceType, PlayerType } from "../types";
import generateHeights from "./generation";
import type { Move, Piece, Players } from "../types";
import Engine from "./engine";
import Utils from "./utils";

interface BotMessage {
    type: "info"|"error";
    message: string
}

function waitForMessage(messageStack: BotMessage[], count?: 1): Promise<BotMessage>
function waitForMessage(messageStack: BotMessage[], count: number): Promise<BotMessage[]>
function waitForMessage(messageStack: BotMessage[] /*pointer*/, count: number = 1): Promise<BotMessage|BotMessage[]> {
    let baseLength = messageStack.length;
    const p = (resolve: (lastMessage: BotMessage|BotMessage[]) => void) => {
        if (messageStack.length - baseLength >= count) resolve(count == 1 ? messageStack.slice(-1)[0] : messageStack.slice(-count));
        else setTimeout(() => p(resolve), 100);
    }
    return new Promise(p);
}
const CHARS = "abcdefghij".split("");
const decodeSquare = (square: string): number => CHARS.indexOf(square.charAt(0)) << 4 | (10-parseInt(square.slice(1)));
const decodeMove = (move: string): number => {
    const MOVE_REGEX = /^([a-j](?:\d|10))([a-j](?:\d|10))$/;
    if (!move.match(MOVE_REGEX)) throw new Error("Invalid Move");
    return decodeSquare(move.replace(MOVE_REGEX, "$1")) << 8 | decodeSquare(move.replace(MOVE_REGEX, "$2"));
}
const encodeSquare = (square: number): string => CHARS[square >> 4] + (10-(square & 0xf)).toString();
const encodeMove = (packedMove: number): string => encodeSquare(packedMove >> 8) + encodeSquare(packedMove & 0xff);

export default class TraversalBoard {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    heights: number[][];
    engine: Engine;
    selection?: { x: number, y: number};
    highlightedMoves: Move[] = [];
    players: Players;
    botWorker: Worker;
    workerMessages: BotMessage[] = [];
    constructor(canvas: HTMLCanvasElement, players?: Players) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.heights = generateHeights();
        this.engine = new Engine(this.heights);
        this.players = players ?? { red: {type:PlayerType.PLAYER}, blue: {type:PlayerType.PLAYER} };
        this.botWorker = new Worker("src/bot/dist/worker.js");
        
        canvas.addEventListener('click', e => this.onClick(e));
        this.initWorker();
    }
    async initWorker() {
        this.botWorker.onmessage = e => {
            this.workerMessages.push(e.data);
            const { data: { type, message } } = e as { data: BotMessage };
            if (type == "error") console.error("Worker Error:", message);
            else console.info("Worker Info:", message);
        };
        await waitForMessage(this.workerMessages); //? Wait for worker to identify
        this.botWorker.postMessage("setboard "+this.heights.map(row => row.join(',')).join('/'));
        await waitForMessage(this.workerMessages);
        if (this.players.red.type == PlayerType.BOT) await this.workerMove();
    }
    async workerMove() {
        this.botWorker.postMessage("bestmove 2000");
        const { message: moveMessage } = (await waitForMessage(this.workerMessages, 2)).slice(-1)[0];
        const packedMove = decodeMove(moveMessage.replace("bestmove ", ""));
        const from = { x: packedMove >> 12, y: (packedMove >> 8) & 0xf };
        const to = { x: (packedMove >> 4) & 0xf, y: packedMove & 0xf };

        const originPiece = this.engine.state.pieces.find(p => p.x == from.x && p.y == from.y);
        if (originPiece == undefined) throw new Error("Worker Move: No origin piece");
        const move = this.engine.getLegalMoves(originPiece, false).find(m => m.dest.x == to.x && m.dest.y == to.y);
        if (move == undefined) {
            console.log(packedMove.toString(16), from, to, originPiece, this.engine.getLegalMoves(originPiece, false).map(m => m.dest));
            this.botWorker.postMessage("legal");
            await waitForMessage(this.workerMessages);
            throw new Error("Worker Move: Illegal move")
        }

        this.applyMove(originPiece, move);
        this.init();
    }
    init() { //? NOTE: The borders might appear weird on small devices/windows because of antialiasing
        const maxHeight = Utils.getMaxHeight(this.heights);
        for (let y=0; y<10; y++) {
            for (let x=0; x<10; x++) {
                this.ctx.fillStyle = Utils.getHeightShade(this.heights[y][x], maxHeight);
                this.ctx.fillRect(x*100, y*100, 100, 100);
            }
        }

        this.ctx.shadowColor = this.ctx.fillStyle = "#000";
        this.ctx.shadowBlur = 7;
        for (let y=0; y<10; y++) {
            for (let x=0; x<10; x++) {
                this.ctx.shadowOffsetY = 0;
                if (x < 9) {
                    const diff = this.heights[y][x+1] - this.heights[y][x];
                    this.ctx.shadowOffsetX = diff > 0 ? -5 : 5;
                    switch (Math.abs(diff)) {
                        case 1: this.ctx.fillRect((x+1)*100 - 1, y*100, 2, 100); break;
                        case 2: this.ctx.fillRect((x+1)*100 - 2, y*100, 4, 100); break;
                        default:
                            this.ctx.shadowColor = "#0000";
                            this.ctx.fillRect((x+1)*100 - 1, y*100, 2, 100);
                            this.ctx.shadowColor = "#000";
                    }
                }
                this.ctx.shadowOffsetX = 0;
                if (y < 9) {
                    const diff = this.heights[y+1][x] - this.heights[y][x];
                    this.ctx.shadowOffsetY = diff > 0 ? -5 : 5;
                    switch (Math.abs(diff)) {
                        case 1: this.ctx.fillRect(x*100, (y+1)*100 - 1, 100, 2); break;
                        case 2: this.ctx.fillRect(x*100, (y+1)*100 - 2, 100, 4); break;
                        default:
                            this.ctx.shadowColor = "#0000";
                            this.ctx.fillRect(x*100, (y+1)*100 - 1, 100, 2);
                            this.ctx.shadowColor = "#000";
                    }
                }
            }
        }

        this.ctx.shadowColor = "#0000";
        this.engine.state.pieces.forEach(p => this.drawPiece(p));
    }
    drawPiece(piece: Piece) {
        const { type, color, x, y } = piece;
        this.ctx.fillStyle = color == Color.RED ? "#e8505b" : "#3a8ee6";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 5;

        switch (type) {
            case PieceType.EXPLORER:
                this.ctx.beginPath();
                this.ctx.arc(x*100+50, y*100+50, 30, 0, 2*Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case PieceType.VANGUARD:
                this.ctx.fillRect(x*100+20, y*100+20, 60, 60);
                this.ctx.strokeRect(x*100+20, y*100+20, 60, 60);
                break;
            case PieceType.SENTINEL:
                const points = [[x*100+50, y*100+20], [x*100+20, y*100+80], [x*100+80, y*100+80]];
                this.ctx.beginPath();
                this.ctx.moveTo(points[0][0], points[0][1]);
                points.reverse().forEach(p => this.ctx.lineTo(p[0], p[1]));
                this.ctx.fill();
                this.ctx.stroke();
        }
    }
    getClickLocation(e: PointerEvent) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX-rect.left) / rect.width * 10),
            y: Math.floor((e.clientY-rect.top) /rect.height * 10)
        };
    }
    onClick(e: PointerEvent) {
        const { x, y } = this.getClickLocation(e);
        const piece = this.engine.state.pieces.find(p => p.x==x && p.y==y);

        if (this.players[this.engine.state.currentTurn == Color.RED ? "red" : "blue"].type == PlayerType.BOT) return;

        if (this.selection) {
            if (this.selection.x == x && this.selection.y == y) {
                const move = this.highlightedMoves.find(m => m.dest.y < 0 || m.dest.y >= 10);
                if (piece && move) this.applyMove(piece, move);
                this.init(); //TODO Only redraw part of the board (annoying because of shadows)
                delete this.selection;
                this.highlightedMoves = [];
                return;
            }
            const originPiece = this.engine.state.pieces.find(p => p.x == this.selection!.x && p.y == this.selection!.y);
            const move = this.highlightedMoves.find(m => m.dest.x == x && m.dest.y == y);
            if (move) {
                this.applyMove(originPiece!, move);
                this.init();
                delete this.selection;
                this.highlightedMoves = [];
                return;
            }
            this.init();
            delete this.selection;
            this.highlightedMoves = [];
        }
        
        if (!piece) return;
        this.selection = { x, y };
        const moves = this.engine.getLegalMoves(piece, true);
        let drewFinishMove = false;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = "24px Consolas";
        for (const move of moves) {
            const finishMove = move.dest.y < 0 || move.dest.y >= 10;
            if (finishMove && drewFinishMove) continue;
            const [_x, _y] = finishMove ? [piece.x, piece.y] : [move.dest.x, move.dest.y];
            this.ctx.fillStyle = finishMove ? "#0f08" : "#fff8";
            this.ctx.beginPath();
            if (finishMove) this.ctx.roundRect(_x*100+10, _y*100+10, 80, 80, 20);
            else this.ctx.roundRect(_x*100+10+move.cost*1.5, _y*100+10+move.cost*1.5, 80-move.cost*3, 80-move.cost*3, 20);
            this.ctx.fill();
            
            this.ctx.fillStyle = "#000";
            if (finishMove) this.ctx.font = "14px Consolas";
            this.ctx.fillText(finishMove ? "Finish" : move.cost.toString(), _x*100+50, _y*100+50);
            if (finishMove) {
                this.ctx.font = "24px Consolas";
                drewFinishMove = true;
            }
        }
        this.highlightedMoves = moves;
    }
    applyMove(piece: Piece, move: Move, syncWorker: boolean = true) {
        if (piece.color != this.engine.state.currentTurn) return;
        const packedMove = (piece.x << 12) | (piece.y << 8) | (move.dest.x << 4) | move.dest.y;
        if (syncWorker) this.botWorker.postMessage(`move ${encodeMove(packedMove)}`)
        this.engine.applyMove(piece, move);
        console.log(encodeMove(packedMove));
        if (this.players[this.engine.state.currentTurn == Color.RED ? "red" : "blue"].type == PlayerType.BOT) this.workerMove();
    }
}