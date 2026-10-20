import TraversalBoard from "./src/board";

const canvas = document.querySelector<HTMLCanvasElement>("canvas.game")!;
const board = new TraversalBoard(canvas);
board.init();