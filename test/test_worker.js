const { parentPort } = require('worker_threads');
const JustHTML = require('../src/index');

parentPort.on('message', (task) => {
    try {
        const { input, expected } = task;
        const parser = new JustHTML(input);
        const actual = parser.root.toTestFormat();
        
        if (actual.trim() === expected.trim()) {
            parentPort.postMessage({ success: true });
        } else {
            parentPort.postMessage({ success: false, actual });
        }
    } catch (e) {
        parentPort.postMessage({ success: false, error: { message: e.message, stack: e.stack } });
    }
});
