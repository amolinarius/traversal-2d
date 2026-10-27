importScripts("./bot.js");

type uint8_t = number; type uint16_t = number; type uint32_t = number; type uint64_t = bigint;
type int8_t = number; type int16_t = number; type int32_t = number; type int64_t = bigint;
type Pointer<T> = number;

interface BotInstance {
    _is_ready: () => boolean;
    _version: () => uint8_t;
    _set_board: (board: Pointer<uint8_t[][]>) => void;
    _get_board: () => Pointer<uint8_t[][]>;
    _get_all_legal_moves: (output_pointer: Pointer<uint64_t[]>) => uint16_t;
    _apply_move: (from: uint8_t, to: uint8_t) => boolean;
    _get_best_move: (time_limit: uint16_t) => uint64_t;
    _malloc: <T = any>(byte_size: uint32_t) => Pointer<T>;
    _free: (pointer: Pointer<any>) => void;
    HEAPU8: Uint8Array,
    HEAPU16: Uint16Array
}
declare function Module(settings?: Record<string, any>): Promise<BotInstance>;

const CHARS = "abcdefghij".split("");
const encodeSquare = (square: uint8_t): string => CHARS[square >> 4] + (10-(square & 0xf)).toString();
const decodeSquare = (square: string): uint8_t => CHARS.indexOf(square.charAt(0)) << 4 | (10-parseInt(square.slice(1)));
const uint16ToInt32 = (uint: uint16_t): int32_t => (uint << 16) >> 16; //? Propagate last bit (two's complement)

const isReady = (instance: BotInstance) => self.postMessage({ type: "info", message: instance._is_ready() ? "readyok" : "null" });
const setBoard = (instance: BotInstance, args: string[]) => {
    if (args.length < 1) throw new Error("missing board");
    const board = args[0].split('/').map(row => row.split(',').map(v => parseInt(v)));
    if (
        !board.every(row => row.every(v => Number.isInteger(v) && v >= 0 && v <= 36))
        || board.length != 10 || !board.every(row => row.length == 10)
    ) throw new Error("invalid board");

    const flatBoard = Uint8Array.from(board.flat());
    const boardPointer = instance._malloc(flatBoard.length);

    try {
        instance.HEAPU8.set(flatBoard, boardPointer);
        instance._set_board(boardPointer);
        const boardView = [...new Uint8Array(instance.HEAPU8.buffer, instance._get_board(), 100)];
        self.postMessage({ type: "info", message: Array.from({ length: 10 }, (_, row) => boardView.slice(row*10, row*10+10).join(',')).join('/') });
    }
    finally { instance._free(boardPointer) }
}
const legalMoves = (instance: BotInstance) => {
    const outputPointer = instance._malloc<uint16_t>(768 * 2); //? 768 * uint16
    try {
        const moveCount = instance._get_all_legal_moves(outputPointer);
        const moves = new Uint16Array(instance.HEAPU16.buffer, outputPointer, moveCount);
        self.postMessage({ type: "info", message: [...moves].map(m => m.toString(16).padStart(4,"0")).join(',') });
    }
    finally { instance._free(outputPointer) }
}
const move = (instance: BotInstance, args: string[]) => {
    if (args.length < 1) throw new Error("missing move");
    const arg = args[0];
    const MOVE_REGEX = /^([a-j](?:\d|10))([a-j](?:\d|10))$/;
    if (!arg.match(MOVE_REGEX)) throw new Error("invalid move");
    const move = decodeSquare(arg.replace(MOVE_REGEX, "$1")) << 8 | decodeSquare(arg.replace(MOVE_REGEX, "$2"));
    const validMove = instance._apply_move(move >> 8, move & 0xff);
    if (!validMove) throw new Error("illegal move");
    self.postMessage({ type: "info", message: "move ok" });
}
const bestMove = (instance: BotInstance, args: string[]) => {
    let time_limit;
    if (args.length >= 1) time_limit = parseInt(args[0]);
    if (!Number.isInteger(time_limit)) time_limit = undefined;

    const getBits = (value: number|bigint, shift: number|bigint , mask: number|bigint) => Number((BigInt(value) >> BigInt(shift)) & BigInt(mask));
    const packedMove = instance._get_best_move(time_limit ?? 5e3);
    const bestMove = {
        foundMove: Boolean(getBits(packedMove, 40, 1)),
        from: encodeSquare(getBits(packedMove, 32, 0xff)),
        to: encodeSquare(getBits(packedMove, 24, 0xff)),
        score: uint16ToInt32(getBits(packedMove, 8, 0xffff)),
        depth: getBits(packedMove, 0, 0xff)
    }
    self.postMessage({ type: "info", message: `info depth ${bestMove.depth} score ${bestMove.score}` });
    self.postMessage({ type: "info", message: `bestmove ${bestMove.from}${bestMove.to}` });
}

Module().then(instance => {
    const version = instance._version();
    self.postMessage({ type: "info", message: `id name Lantern ${version >> 4}.${version & 0xf}` });
    self.postMessage({ type: "info", message: "id author galaxymiller" });

    self.onmessage = async e => {
        try {
            if (typeof e.data != "string") { throw new Error("invalid format") }
            const args = e.data.trim().split(/\s+/);
            const command = args.shift();

            switch (command) {
                case "isready": isReady(instance); break;
                case "setboard": setBoard(instance, args); break;
                case "legal": legalMoves(instance); break;
                case "move": move(instance, args); break;
                case "bestmove": bestMove(instance, args); break;
                default: throw new Error("unknown command "+command);
            }
        }
        catch (err) { self.postMessage({ type: "error", message: err }) }
    };
}).catch((err: string) => self.postMessage({ type: "error", message: err }));