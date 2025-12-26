const JustHTML = require('../src/index');
const assert = require('assert');

console.log("Running DOM Compatibility tests...");

// Test 1: Node Types and Names
{
    const html = "<div id='foo'>Hello</div><!-- comment -->";
    const parser = new JustHTML(html);
    const doc = parser.root;
    
    assert.strictEqual(doc.nodeType, 9); // DOCUMENT_NODE
    assert.strictEqual(doc.nodeName, '#document');
    
    const div = doc.children[0].children[1].children[0]; // html -> body -> div
    assert.strictEqual(div.nodeType, 1); // ELEMENT_NODE
    assert.strictEqual(div.nodeName, 'DIV');
    assert.strictEqual(div.tagName, 'DIV');
    
    const text = div.firstChild;
    assert.strictEqual(text.nodeType, 3); // TEXT_NODE
    assert.strictEqual(text.nodeName, '#text');
    
    // Comment is child of body, after div? No, wait.
    // html -> body -> div
    // The comment might be in body or after body depending on tree construction rules.
    // Let's check a simpler structure for comment.
}

// Test 2: Traversal
{
    const html = "<ul><li>One</li><li>Two</li><li>Three</li></ul>";
    const parser = new JustHTML(html);
    const ul = parser.root.querySelector('ul');
    
    assert.strictEqual(ul.childNodes.length, 3);
    
    const li1 = ul.firstChild;
    const li2 = li1.nextSibling;
    const li3 = ul.lastChild;
    
    assert.strictEqual(li1.textContent, 'One');
    assert.strictEqual(li2.textContent, 'Two');
    assert.strictEqual(li3.textContent, 'Three');
    
    assert.strictEqual(li2.previousSibling, li1);
    assert.strictEqual(li2.nextSibling, li3);
    
    assert.strictEqual(li1.parentNode, ul);
}

// Test 3: Attributes
{
    const html = "<div class='foo' data-val='123'></div>";
    const parser = new JustHTML(html);
    const div = parser.root.querySelector('div');
    
    assert.strictEqual(div.getAttribute('class'), 'foo');
    assert.strictEqual(div.getAttribute('data-val'), '123');
    assert.strictEqual(div.getAttribute('missing'), null);
    
    assert.strictEqual(div.hasAttribute('class'), true);
    assert.strictEqual(div.hasAttribute('missing'), false);
}

// Test 4: Query Selector Alias
{
    const html = "<div id='main'><span class='foo'>Bar</span></div>";
    const parser = new JustHTML(html);
    const doc = parser.root;
    
    const span = doc.querySelector('.foo');
    assert.strictEqual(span.textContent, 'Bar');
    
    const allSpans = doc.querySelectorAll('span');
    assert.strictEqual(allSpans.length, 1);
}

console.log("DOM Compatibility tests passed!");
