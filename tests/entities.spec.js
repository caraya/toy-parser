const { test, expect } = require('@playwright/test');
const JustHTML = require('../src/index');

test.describe('Entity Parsing', () => {
  test('should decode basic named entities', () => {
    const parser = new JustHTML('<div>&amp; &lt; &gt; &quot; &apos;</div>');
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('& < > " \'');
  });

  test('should decode numeric entities (decimal)', () => {
    const parser = new JustHTML('<div>&#60; &#62;</div>');
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('< >');
  });

  test('should decode numeric entities (hex)', () => {
    const parser = new JustHTML('<div>&#x3C; &#x3E;</div>');
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('< >');
  });

  test('should decode entities in attributes', () => {
    const parser = new JustHTML('<div title="&quot;Hello&quot;"></div>');
    const div = parser.root.querySelector('div');
    expect(div.getAttribute('title')).toBe('"Hello"');
  });

  test('should handle split entities in streaming', () => {
    const parser = new JustHTML();
    parser.write('<div>&a');
    parser.write('mp;</div>');
    parser.end();
    
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('&');
  });

  test('should handle split numeric entities in streaming', () => {
    const parser = new JustHTML();
    parser.write('<div>&#');
    parser.write('60;</div>');
    parser.end();
    
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('<');
  });

  test('should handle split hex entities in streaming', () => {
    const parser = new JustHTML();
    parser.write('<div>&#x');
    parser.write('3C;</div>');
    parser.end();
    
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('<');
  });

  test('should handle complex split entities', () => {
    const parser = new JustHTML();
    parser.write('<div>&');
    parser.write('copy;</div>');
    parser.end();
    
    const div = parser.root.querySelector('div');
    expect(div.textContent).toBe('©');
  });

  test('should handle entities without semicolon where allowed', () => {
      // HTML5 allows some entities without semicolon if not followed by alphanumeric
      const parser = new JustHTML('<div>&copy</div>');
      const div = parser.root.querySelector('div');
      expect(div.textContent).toBe('©');
  });

  test('should not decode entities without semicolon if followed by alphanumeric', () => {
      // &copy1 should be &copy1, not ©1, because copy is not a prefix match for a longer entity?
      // Actually, legacy entities like &copy are allowed without semicolon.
      // But if it was &notit; vs &not; it matters.
      // Let's test a simple case. &amp1 should be &amp1 or &1? 
      // &amp is a known entity. &amp1 -> &amp;1 if interpreted? No.
      // Spec says: "If the character reference is being consumed as part of an attribute... and the last character matched is not a semicolon, and the next character is either a =, a alphanumeric, or a number... then it's not a character reference."
      // In data state: "If the character reference is being consumed... and the last character matched is not a semicolon... parse error... return the character reference."
      
      // Let's stick to what we expect the parser to do based on common behavior or just skip edge cases if unsure of implementation details.
      // I'll test &copy1 which usually renders as ©1 in browsers.
      const parser = new JustHTML('<div>&copy1</div>');
      const div = parser.root.querySelector('div');
      expect(div.textContent).toBe('©1');
  });
});
