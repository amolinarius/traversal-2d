# Lantern Bot

This folder contains the C++ codebase for Lantern bot, used in this Traversal 2D repository, as well as an HTML file to test the worker through a pseudo-CLI.

## Building

Install and activate the [Emscripten SDK](https://emscripten.org/), then run in the **root folder** (not the bot folder):

```sh
npm run bot:build
```

This produces `bot.js` and `bot.wasm` and transpiles `worker.ts` into `worker.js`, which is an asynchronous implementation of the bot.

> [!NOTE]
> You need a web server like `python -m http.server` to load WebAssembly files

## Bot WASM Functions

The following commands are currently available for execution.  

- The **Worker Command** column contains the format of what you need to send to the WebWorker
- The **C++ Function** column contains the name of the exported C/C++ function executed when running this command
- The **Behavior** column contains a description of what the C++ function does

| Worker Command                    | C++ Function                                             | Behavior                                                                                                                |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `isready`                         | `bool is_ready()`                                        | Returns true when the board is initialized                                                                              |
| -                                 | `uint8_t version()`                                      | Returns the version as a packed 8-bit integer. Called automatically when initializing worker                            |
| `setboard <board>`                | `void set_board(uint8_t board[10][10])`                  | Sets the heights of the board. Argument is a pointer to a 100-elements long `UInt8Array`                                |
| -                                 | `uint8_t* get_board()`                                   | Returns a pointer to the heights. Called automatically by worker after `setboard`                                       |
| `legal`                           | `uint16_t get_all_legal_moves(uint64_t* output_pointer)` | Gets all possible moves, writes them at pointer `output_pointer` and returns the moves count                            |
| `move <move>`                     | `bool apply_move(uint8_t from, uint8_t to)`              | Applies the specified move. Arguments are packed squares (4 MSB are x, 4 LSB are y). Returns `false` if move is illegal |
| `bestmove [<time_limit_ms=5000>]` | `uint64_t get_best_move(uint16_t time_limit_ms)`         | Computes best move using minimax algorithm with alpha-beta pruning. Returns a packed `SearchResult`                     |

## Example Bot messages

> **Legend**
> `->`: Worker to GUI
> `<-`: GUI to Worker

```
-> id name Lantern 1.0
-> id author galaxymiller
<- isready
-> readyok
<- setboard 1222222222/2222222222/2221323212/2222222222/2222222222/2222222112/2122202222/3212222423/2222233222/2222222222
-> 1222222222/2222222222/2221323212/2222222222/2222222222/2222222112/2122202222/3212222423/2222233222/2222222222
<- move c1b3
-> move ok
<- bestmove 10000
-> info depth 3 score -18
-> bestmove f10g6
```