#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const JustHTML = require('../src/index');

function printHelp() {
    console.log(`
Usage: rohan [file] [options]

Arguments:
  file                  Path to HTML file (optional, reads from stdin if omitted)

Options:
  --format <type>       Output format: html, text, markdown, tree (default: html)
  --select <selector>   CSS selector to extract specific element(s)
  --help                Show this help message

Examples:
  rohan index.html --format markdown
  cat index.html | rohan --select "h1" --format text
`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        file: null,
        format: 'html',
        selector: null,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--format') {
            options.format = args[++i];
        } else if (arg === '--select') {
            options.selector = args[++i];
        } else if (!arg.startsWith('-')) {
            options.file = arg;
        }
    }
    return options;
}

function renderTree(node, indent = 0) {
    let result = "";
    const prefix = "  ".repeat(indent);
    
    if (node.nodeType === 9) { // Document
        result += `${prefix}#document\n`;
        node.childNodes.forEach(child => {
            result += renderTree(child, indent + 1);
        });
    } else if (node.nodeType === 10) { // Doctype
        result += `${prefix}<!DOCTYPE ${node.name}>\n`;
    } else if (node.nodeType === 1) { // Element
        let attrs = "";
        if (node.attrs && Object.keys(node.attrs).length > 0) {
            attrs = " " + Object.entries(node.attrs)
                .map(([k, v]) => `${k}="${v}"`)
                .join(" ");
        }
        result += `${prefix}<${node.tagName}${attrs}>\n`;
        node.childNodes.forEach(child => {
            result += renderTree(child, indent + 1);
        });
    } else if (node.nodeType === 3) { // Text
        const text = node.textContent.replace(/\n/g, '\\n');
        if (text.trim() || text === '\\n') {
            result += `${prefix}"${text}"\n`;
        }
    } else if (node.nodeType === 8) { // Comment
        result += `${prefix}<!-- ${node.textContent} -->\n`;
    }
    
    return result;
}

async function readInput(file) {
    if (file) {
        return fs.readFileSync(file, 'utf8');
    }
    
    // Read from stdin
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        
        if (process.stdin.isTTY) {
            // Don't hang if no input and TTY
            resolve(''); 
            return;
        }

        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    const html = await readInput(options.file);
    if (!html && !options.file) {
        console.error("Error: No input provided.");
        printHelp();
        process.exit(1);
    }

    const parser = new JustHTML(html);
    let target = parser.root;

    if (options.selector) {
        const found = parser.root.querySelector(options.selector);
        if (!found) {
            console.error(`Error: Selector "${options.selector}" not found.`);
            process.exit(1);
        }
        target = found;
    }

    let output = "";
    switch (options.format) {
        case 'text':
            output = target.toText();
            break;
        case 'markdown':
            output = target.toMarkdown();
            break;
        case 'tree':
            output = renderTree(target);
            break;
        case 'html':
        default:
            output = target.toHtml();
            break;
    }

    console.log(output);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
