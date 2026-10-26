import TraversalBoard from "./src/board";
import { Color, PlayerType, type Players } from "./types";

const canvasContainer = document.querySelector<HTMLCanvasElement>(".game-container")!;
const canvas = canvasContainer.querySelector<HTMLCanvasElement>("canvas.game")!;
const mainMenu = document.querySelector<HTMLDivElement>(".main-menu")!;
const botMenu = document.querySelector<HTMLDivElement>(".bot-menu")!;

function startGame(players: Players) {
    canvasContainer.classList.remove("hidden");
    mainMenu.classList.add("hidden");
    botMenu.classList.add("hidden");
    const board = new TraversalBoard(canvas, players);
    board.init();
}

const playPerson = document.querySelector<HTMLButtonElement>(".main-menu .play-person")!;
const playBot = {
    main: document.querySelector<HTMLButtonElement>(".main-menu .play-bot")!,
    red: document.querySelector<HTMLButtonElement>(".bot-menu .play-red")!,
    blue: document.querySelector<HTMLButtonElement>(".bot-menu .play-blue")!,
    random: document.querySelector<HTMLButtonElement>(".bot-menu .play-random")!
};

playBot.main.addEventListener("click", () => {
    mainMenu.classList.add("hidden");
    botMenu.classList.remove("hidden");
})
playPerson.addEventListener("click", () => startGame({
    red: { type: PlayerType.PLAYER },
    blue: { type: PlayerType.PLAYER }
}));
playBot.red.addEventListener("click", () => startGame({
    red: { type: PlayerType.PLAYER },
    blue: { type: PlayerType.BOT }
}));
playBot.blue.addEventListener("click", () => startGame({
    red: { type: PlayerType.BOT },
    blue: { type: PlayerType.PLAYER }
}));
playBot.random.addEventListener("click", () => {
    const player = Math.round(Math.random());
    startGame({
        red: { type: player == Color.RED ? PlayerType.PLAYER : PlayerType.BOT },
        blue: { type: player == Color.BLUE ? PlayerType.PLAYER : PlayerType.BOT }
    });
});