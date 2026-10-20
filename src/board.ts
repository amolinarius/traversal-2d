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
    init() { //? NOTE: The borders might appear weird on small devices/windows because of antialiasing
        const maxHeight = Utils.getMaxHeight(this.heights);
        for (let y=0; y<10; y++) {
            for (let x=0; x<10; x++) {
                this.ctx.fillStyle = Utils.getHeightShade(this.heights[y][x], maxHeight);
                this.ctx.fillRect(x*100, y*100, 100, 100);
            }
        }

        this.ctx.fillStyle = "#000";
        for (let y=0; y<10; y++) {
            for (let x=0; x<10; x++) {
                if (x < 9) {
                    if (this.heights[y][x+1] - this.heights[y][x] < 2) this.ctx.fillRect((x+1)*100 - 1, y*100, 2, 100);
                    else {
                        this.ctx.fillRect((x+1)*100 - 4, y*100, 3, 100);
                        this.ctx.fillRect((x+1)*100 + 1, y*100, 3, 100);
                    }
                }
                if (y < 9) {
                    if (this.heights[y+1][x] - this.heights[y][x] < 2) this.ctx.fillRect(x*100, (y+1)*100 - 1, 100, 2);
                    else {
                        this.ctx.fillRect(x*100, (y+1)*100 - 4, 100, 3);
                        this.ctx.fillRect(x*100, (y+1)*100 + 1, 100, 3);
                    }
                }
            }
        }
    }
}