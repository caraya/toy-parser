const { test, expect } = require('@playwright/test');
const JustHTML = require('../src/index');

test.describe('JustHTML API', () => {
  test('should parse simple HTML', () => {
    const parser = new JustHTML('<div>Hello</div>');
    const root = parser.root;
    expect(root.childNodes.length).toBe(1);
    expect(root.childNodes[0].nodeName).toBe('HTML');
    
    const body = root.querySelector('body');
    expect(body).not.toBeNull();
    expect(body.innerHTML).toBe('<div>Hello</div>');
  });

  test('should handle streaming input', () => {
    const parser = new JustHTML();
    parser.write('<div>');
    parser.write('Hello');
    parser.write('</div>');
    parser.end();

    const body = parser.root.querySelector('body');
    expect(body.innerHTML).toBe('<div>Hello</div>');
  });

  test('should serialize to text', () => {
    const parser = new JustHTML('<div>Hello <span>World</span></div>');
    // root is #document, child is html, child is body, child is div
    // toText on document calls toText on children.
    // html -> body -> div
    // div is block tag, so it adds newline.
    // text content is "Hello World"
    expect(parser.root.toText().trim()).toBe('Hello World');
  });
});
