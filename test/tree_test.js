const JustHTML = require('../src/index');
const assert = require('assert');

console.log("Running tree construction tests...");

// Test 1: Basic document structure
{
    const html = "<div>hello</div>";
    const parser = new JustHTML(html);
    const root = parser.root;
    
    assert.strictEqual(root.type, '#document');
    // Should have html -> body -> div
    const htmlNode = root.children[0];
    assert.strictEqual(htmlNode.name, 'html');
    
    const bodyNode = htmlNode.children[1]; // 0 is head
    assert.strictEqual(bodyNode.name, 'body');
    
    const divNode = bodyNode.children[0];
    assert.strictEqual(divNode.name, 'div');
    assert.strictEqual(divNode.children[0].text, 'hello');
}

// Test 2: Head elements
{
    const html = "<head><title>Foo</title></head><body>Bar</body>";
    const parser = new JustHTML(html);
    const root = parser.root;
    
    const htmlNode = root.children[0];
    const headNode = htmlNode.children[0];
    assert.strictEqual(headNode.name, 'head');
    
    const titleNode = headNode.children[0];
    assert.strictEqual(titleNode.name, 'title');
    assert.strictEqual(titleNode.children[0].text, 'Foo');
    
    const bodyNode = htmlNode.children[1];
    assert.strictEqual(bodyNode.name, 'body');
    assert.strictEqual(bodyNode.children[0].text, 'Bar');
}

// Test 3: Implicit tags
{
    const html = "Hello";
    const parser = new JustHTML(html);
    const root = parser.root;
    
    // Should imply html, head, body
    const htmlNode = root.children[0];
    assert.strictEqual(htmlNode.name, 'html');
    
    const headNode = htmlNode.children[0];
    assert.strictEqual(headNode.name, 'head');
    
    const bodyNode = htmlNode.children[1];
    assert.strictEqual(bodyNode.name, 'body');
    assert.strictEqual(bodyNode.children[0].text, 'Hello');
}

console.log("Tree construction tests passed!");
