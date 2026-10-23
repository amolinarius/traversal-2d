import generateHeights from "./generation";
import Utils from "./utils";

export default class TraversalBoard {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    heights: number[][];
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.heights = generateHeights();
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
    }
}