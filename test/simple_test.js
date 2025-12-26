const JustHTML = require('../src/index');
const assert = require('assert');

console.log("Running simple prototype test...");

const html = "<div>hello</div>";
const parser = new JustHTML(html);

// Check root
assert.strictEqual(parser.root.type, '#document');
// Now we expect <html> element as child of root
assert.strictEqual(parser.root.children.length, 1);
const htmlNode = parser.root.children[0];
assert.strictEqual(htmlNode.name, 'html');

// Check body (html -> head, body)
const body = htmlNode.children[1];
assert.strictEqual(body.name, 'body');

// Check div
const div = body.children[0];
assert.strictEqual(div.name, 'div');
assert.strictEqual(div.type, '#element');
assert.strictEqual(div.children.length, 1);

// Check text
const text = div.children[0];
assert.strictEqual(text.type, '#text');
assert.strictEqual(text.text, 'hello');

console.log("Test passed!");
console.log("Output HTML:", parser.root.toHtml({ indent: 0 }));
