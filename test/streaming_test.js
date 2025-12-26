const Tokenizer = require('../src/tokenizer');
const { Tag, CharacterToken, EOFToken } = require('../src/tokens');
const assert = require('assert');

class TestSink {
  constructor() {
    this.tokens = [];
  }
  process(token) {
    this.tokens.push(token);
  }
}

console.log("Running streaming tests...");

// Test 1: Split tag
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    
    tokenizer.write("<di");
    assert.strictEqual(sink.tokens.length, 0); // Should be in TAG_NAME state
    
    tokenizer.write("v>hello");
    // Should have StartTag(div) and chars h,e,l,l,o
    // StartTag(div) + 5 chars = 6 tokens
    assert.strictEqual(sink.tokens.length, 6);
    assert.strictEqual(sink.tokens[0].name, 'div');
    assert.strictEqual(sink.tokens[5].data, 'o');
    
    tokenizer.write("</div>");
    // Should have EndTag(div)
    // 6 + 1 = 7
    assert.strictEqual(sink.tokens.length, 7);
    assert.strictEqual(sink.tokens[6].name, 'div');
    
    tokenizer.end();
    // Should have EOF
    assert.strictEqual(sink.tokens.length, 8);
    assert.strictEqual(sink.tokens[7] instanceof EOFToken, true);
}

// Test 2: Split attribute
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    
    tokenizer.write("<div cla");
    tokenizer.write("ss='fo");
    tokenizer.write("o'>");
    
    assert.strictEqual(sink.tokens.length, 1);
    const tag = sink.tokens[0];
    assert.strictEqual(tag.name, 'div');
    assert.strictEqual(tag.attrs.class, 'foo');
    
    tokenizer.end();
}

// Test 3: Split entities
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    
    tokenizer.write("&am");
    assert.strictEqual(sink.tokens.length, 0); // Should be in NAMED_CHARACTER_REFERENCE state
    
    tokenizer.write("p;");
    assert.strictEqual(sink.tokens.length, 1);
    assert.strictEqual(sink.tokens[0].data, '&');
    
    tokenizer.end();
}

// Test 4: Split numeric entities
{
    const sink = new TestSink();
    const tokenizer = new Tokenizer(sink);
    
    tokenizer.write("&#");
    assert.strictEqual(sink.tokens.length, 0);
    
    tokenizer.write("60;");
    assert.strictEqual(sink.tokens.length, 1);
    assert.strictEqual(sink.tokens[0].data, '<');
    
    tokenizer.end();
}

console.log("Streaming tests passed!");
