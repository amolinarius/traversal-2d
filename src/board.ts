import { Color, PieceType } from "../types";
import generateHeights from "./generation";
import type { Piece } from "../types";
import Engine from "./engine";
import Utils from "./utils";

export default class TraversalBoard {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    heights: number[][];
    engine: Engine;
    selection?: { x: number, y: number};
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        canvas.addEventListener('click', e => this.onClick(e));
        this.ctx = canvas.getContext('2d')!;
        // this.heights = generateHeights();
        this.heights = [
            [2,2,1,0,0,1,2,3,4,4],
            [2,2,1,0,1,2,3,3,4,4],
            [2,2,2,2,2,3,3,4,4,3],
            [2,2,2,2,3,3,4,4,3,4],
            [2,2,2,2,3,4,5,4,4,3],
            [2,2,2,2,2,3,3,4,4,4],
            [2,2,2,2,2,2,1,3,3,4],
            [2,2,2,2,2,2,1,2,2,3],
            [2,2,2,2,2,2,2,1,2,2],
            [2,2,2,2,2,2,2,2,2,3]
        ];
        this.engine = new Engine(this.heights);
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
        if (!piece) {
            this.init();
            delete this.selection;
            return;
        }

        if (this.selection) {
            this.init(); //TODO Only redraw part of the board (annoying because of shadows)
            if (this.selection.x == x && this.selection.y == y) {
                delete this.selection;
                return;
            }
        }
        this.selection = { x, y };

        const moves = this.engine.getLegalMoves(piece, true);
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = "24px \"Consolas\"";
        for (const move of moves) {
            this.ctx.fillStyle = "#fff8";
            this.ctx.fillRect(move.dest.x*100, move.dest.y*100, 100, 100);
            this.ctx.fillStyle = "#000";
            this.ctx.fillText(move.cost.toString(), move.dest.x*100+50, move.dest.y*100+50);
        }
    }
}