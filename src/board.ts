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
        console.log(this.heights);
    }
    init() {
        const maxHeight = Utils.getMaxHeight(this.heights);
        for (let y=0; y<10; y++) {
            for (let x=0; x<10; x++) {
                this.ctx.fillStyle = Utils.getHeightShade(this.heights[y][x], maxHeight);
                this.ctx.strokeStyle = "#000";
                this.ctx.fillRect(x*200, y*200, 200, 200);
                this.ctx.strokeRect(x*200, y*200, 200, 200);
            }
        }
    }
}