import generateHeights from "./generation";
import Utils from "./utils";

enum PieceType { EXPLORER, VANGUARD, SENTINEL };
enum Color { RED, BLUE };
interface Piece {
    type: PieceType;
    color: Color;
    x: number;
    y: number;
}

export default class TraversalBoard {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    heights: number[][];
    pieces: Piece[];
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.heights = generateHeights();
        this.pieces = [
            { type: PieceType.SENTINEL, color: Color.BLUE, x: 2, y: 0 },
            { type: PieceType.VANGUARD, color: Color.BLUE, x: 3, y: 0 },
            { type: PieceType.EXPLORER, color: Color.BLUE, x: 4, y: 0 },
            { type: PieceType.EXPLORER, color: Color.BLUE, x: 5, y: 0 },
            { type: PieceType.VANGUARD, color: Color.BLUE, x: 6, y: 0 },
            { type: PieceType.SENTINEL, color: Color.BLUE, x: 7, y: 0 }
        ].flatMap(p => [p, { ...p, color: Color.RED, y: 9 }]);
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
        this.pieces.forEach(p => this.drawPiece(p));
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
}