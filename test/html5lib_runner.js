const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const TESTS_DIR = path.join(__dirname, '../../html5lib-tests/tree-construction');
const TEST_FILES = ['tests1.dat']; // Start with tests1.dat
const FAILED_FILE = path.join(__dirname, '../../FAILED.md');
const TIMEOUT_MS = 2000; // 2 seconds timeout

// Initialize FAILED.md
fs.writeFileSync(FAILED_FILE, '# Failed Tests\n\n');

function parseTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tests = [];
    const lines = content.split('\n');
    
    let currentTest = null;
    let section = null;
    
    for (const line of lines) {
        if (line.startsWith('#data')) {
            if (currentTest) tests.push(currentTest);
            currentTest = { data: '', errors: [], document: '' };
            section = 'data';
        } else if (line.startsWith('#errors')) {
            section = 'errors';
        } else if (line.startsWith('#document')) {
            section = 'document';
        } else if (line.startsWith('#')) {
            // Other sections like #document-fragment
            section = 'other'; 
        } else {
            if (section === 'data') {
                currentTest.data += line + '\n';
            } else if (section === 'document') {
                currentTest.document += line + '\n';
            }
        }
    }
    if (currentTest) tests.push(currentTest);
    return tests;
}

function runTestInWorker(worker, task, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout'));
        }, timeout);

        function onMessage(result) {
            cleanup();
            if (result.success) {
                resolve();
            } else {
                const error = new Error(result.error ? result.error.message : 'Mismatch');
                if (result.actual) error.actual = result.actual;
                if (result.error) error.stack = result.error.stack;
                reject(error);
            }
        }

        function onError(err) {
            cleanup();
            reject(err);
        }
        
        function onExit(code) {
             cleanup();
             if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        }

        function cleanup() {
            clearTimeout(timer);
            worker.off('message', onMessage);
            worker.off('error', onError);
            worker.off('exit', onExit);
        }

        worker.on('message', onMessage);
        worker.on('error', onError);
        worker.on('exit', onExit);
        
        worker.postMessage(task);
    });
}

async function runTests() {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    let worker = new Worker(path.join(__dirname, 'test_worker.js'));

    for (const file of TEST_FILES) {
        console.log(`Running tests from ${file}...`);
        const tests = parseTestFile(path.join(TESTS_DIR, file));
        
        let index = 0;
        for (const test of tests) {
            index++;
            // Skip fragment tests for now
            if (test.document.includes('#document-fragment')) continue;

            totalTests++;
            const input = test.data.replace(/\n$/, ''); // Remove trailing newline from data
            const expected = test.document;
            
            // Verbose logging
            console.log(`[${index}/${tests.length}] Running test: ${input.substring(0, 50).replace(/\n/g, '\\n')}...`);

            try {
                await runTestInWorker(worker, { input, expected }, TIMEOUT_MS);
                passedTests++;
            } catch (e) {
                failedTests++;
                let failMsg = `\n## Test ${index} (File: ${file})\n\nInput:\n\`\`\`html\n${input}\n\`\`\`\n\n`;
                
                if (e.message === 'Timeout') {
                    console.log(`TIMEOUT Test ${index}`);
                    failMsg += `Error: Timeout after ${TIMEOUT_MS}ms\n`;
                    
                    // Terminate and restart worker
                    await worker.terminate();
                    worker = new Worker(path.join(__dirname, 'test_worker.js'));
                } else if (e.message === 'Mismatch') {
                    console.log(`FAILED Test ${index}`);
                    failMsg += `Expected:\n\`\`\`\n${expected}\n\`\`\`\n\nActual:\n\`\`\`\n${e.actual}\n\`\`\`\n`;
                } else {
                    console.log(`ERROR Test ${index}: ${e.message}`);
                    failMsg += `Error:\n\`\`\`\n${e.message}\n${e.stack}\n\`\`\`\n`;
                }
                
                fs.appendFileSync(FAILED_FILE, failMsg);
            }
        }
    }

    await worker.terminate();

    console.log(`\nTotal: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);
    console.log(`Failures recorded in ${FAILED_FILE}`);
}

runTests().catch(err => console.error(err));
