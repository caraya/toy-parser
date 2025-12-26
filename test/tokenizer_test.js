const Tokenizer = require('../src/tokenizer');
const { Tag, CharacterToken, CommentToken, EOFToken } = require('../src/tokens');
const assert = require('assert');

class TestSink {
  constructor() {
    this.tokens = [];
  }
  process(token) {
    this.tokens.push(token);
  }
}

console.log("Running tokenizer tests...");

// Test 1: Basic tags
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    tokenizer.initialize("<div>hello</div>");
    tokenizer.end();

    // My implementation emits char tokens one by one for now.
    // "hello" is 5 chars.
    // Tokens: StartTag(div), Char(h), Char(e), Char(l), Char(l), Char(o), EndTag(div), EOF
    // Total: 1 + 5 + 1 + 1 = 8
    assert.strictEqual(sink.tokens.length, 8); 
    assert.strictEqual(sink.tokens[0] instanceof Tag, true);
    assert.strictEqual(sink.tokens[0].name, 'div');
    assert.strictEqual(sink.tokens[0].kind, Tag.START);
    
    assert.strictEqual(sink.tokens[1] instanceof CharacterToken, true);
    assert.strictEqual(sink.tokens[1].data, 'h');
    // Let's verify that.
}

// Test 2: Attributes
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    tokenizer.initialize('<div class="foo" id=\'bar\'>');
    tokenizer.end();
    
    const startTag = sink.tokens[0];
    assert.strictEqual(startTag.name, 'div');
    assert.deepStrictEqual(startTag.attrs, { class: 'foo', id: 'bar' });
}

// Test 3: Comments
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    tokenizer.initialize('<!-- comment -->');
    tokenizer.end();
    
    const comment = sink.tokens[0];
    assert.strictEqual(comment instanceof CommentToken, true);
    assert.strictEqual(comment.data, ' comment ');
}

// Test 4: Self-closing
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    tokenizer.initialize('<br/>');
    tokenizer.end();
    
    const tag = sink.tokens[0];
    assert.strictEqual(tag.name, 'br');
    assert.strictEqual(tag.selfClosing, true);
}

console.log("Tokenizer tests passed!");
