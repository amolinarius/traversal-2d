# Lantern Bot

This folder contains the C++ codebase for Lantern bot, used in this Traversal 2D repository, as well as an HTML file to test the worker through a pseudo-CLI.

## Building

Install and activate the [Emscripten SDK](https://emscripten.org/), then run:

```powershell
em++ main.cpp -O3 -sEXPORTED_FUNCTIONS=_is_ready -sEXPORTED_RUNTIME_METHODS=ccall -sMODULARIZE -o dist/bot.js
```

This produces `bot.js` and `bot.wasm`, used asynchronously by `worker.js`.

> [!NOTE]
> You need a web server, like `python -m http.server`, to load WebAssembly files

## Bot Commands

The following commands are currently available for execution.  

- The **Worker Command** column contains the format of what you need to send to the WebWorker
- The **C++ Function** column contains the name of the exported C/C++ function executed when running this command
- The **Behavior** column contains a description of what the function does

| Worker Command | C++ Function      | Behavior                       |
| -------------- | ----------------- | ------------------------------ |
| `isready`      | `bool is_ready()` | Currently, always returns true |