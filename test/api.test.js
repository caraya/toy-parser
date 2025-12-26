const assert = require('assert');
const JustHTML = require('../src/index');

function testToHtml() {
    const parser = new JustHTML('<p>Hello <b>World</b></p><br><img src="foo.png">');
    const doc = parser.root;
    // Expect void tags to not have closing tags, and attributes to be quoted
    const html = doc.toHtml();
    // Note: The current parser might normalize input.
    // We expect something like: <html><head></head><body><p>Hello <b>World</b></p><br><img src="foo.png"></body></html>
    // But let's just check if the body content is serialized reasonably.
    console.log('toHtml output:', html);
    assert(html.includes('<p>Hello <b>World</b></p>'));
    assert(html.includes('<br>'));
    assert(!html.includes('</br>'));
    assert(html.includes('<img src="foo.png">'));
    assert(!html.includes('</img>'));
}

function testToText() {
    const parser = new JustHTML('<div><h1>Title</h1><p>Hello <br>World</p></div>');
    const doc = parser.root;
    const text = doc.toText();
    // Simple text concatenation
    assert.strictEqual(text.replace(/\s+/g, ' ').trim(), 'Title Hello World');
}

function testToMarkdown() {
    const parser = new JustHTML('<h1>Title</h1><p>Hello <b>World</b></p><ul><li>Item 1</li><li>Item 2</li></ul><a href="http://example.com">Link</a>');
    const doc = parser.root;
    const md = doc.toMarkdown();
    console.log('toMarkdown output:', md);
    assert(md.includes('# Title'));
    assert(md.includes('Hello **World**'));
    assert(md.includes('* Item 1'));
    assert(md.includes('[Link](http://example.com)'));
}

function testQuery() {
    const parser = new JustHTML('<div id="main" class="container"><p class="text">Hello</p><span class="text">World</span></div>');
    const doc = parser.root;
    
    const main = doc.query('#main');
    assert(main);
    assert.strictEqual(main.attrs.id, 'main');

    const texts = doc.queryAll('.text');
    assert.strictEqual(texts.length, 2);
    assert.strictEqual(texts[0].name, 'p');
    assert.strictEqual(texts[1].name, 'span');

    const div = doc.query('div');
    assert.strictEqual(div.name, 'div');
}

try {
    testToHtml();
    console.log('testToHtml passed');
    testToText();
    console.log('testToText passed');
    testToMarkdown();
    console.log('testToMarkdown passed');
    testQuery();
    console.log('testQuery passed');
} catch (e) {
    console.error(e);
    process.exit(1);
}
