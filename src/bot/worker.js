importScripts("./dist/bot.js");

Module({ locateFile: path => new URL(`./dist/${path}`, self.location.href).href })
.then(instance => {
    self.onmessage = async e => {
        try {
            if (typeof e.data != "string") { throw new Error("Invalid format") }
            const args = e.data.trim().split(/\s+/);
            const command = args.shift();
            if (command != "isready") { throw new Error("Expected: isready") }
            self.postMessage({ type: "info", message: instance._is_ready() });
        } catch (err) { self.postMessage({ type: "error", message: err }) }
    };
}).catch(err => self.postMessage({ type: "error", message: err }));