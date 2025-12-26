const { test, expect } = require('@playwright/test');
const JustHTML = require('../src/index');

test.describe('DOM Compatibility', () => {
  test('should support querySelector', () => {
    const parser = new JustHTML('<div id="test" class="foo"><span>Text</span></div>');
    const div = parser.root.querySelector('#test');
    expect(div).not.toBeNull();
    expect(div.getAttribute('class')).toBe('foo');
    
    const span = div.querySelector('span');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('Text');
  });

  test('should support nodeType', () => {
    const parser = new JustHTML('<div>Text</div>');
    const div = parser.root.querySelector('div');
    expect(div.nodeType).toBe(1); // ELEMENT_NODE
    expect(div.firstChild.nodeType).toBe(3); // TEXT_NODE
  });

  test('should support innerHTML', () => {
      const parser = new JustHTML('<div><span>Inner</span></div>');
      const div = parser.root.querySelector('div');
      expect(div.innerHTML).toBe('<span>Inner</span>');
  });

  test('should support textContent', () => {
      const parser = new JustHTML('<div>Hello <span>World</span></div>');
      const div = parser.root.querySelector('div');
      expect(div.textContent).toBe('Hello World');
  });
});
