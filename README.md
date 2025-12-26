# Rohan Parser

A zero-dependency, specification-compliant HTML parser for JavaScript.

Rohan is a direct port of the [justhtml](https://github.com/EmilStenstrom/justhtml) Python library to JavaScript. It implements the official HTML5 tokenization and tree construction algorithms, making it robust enough to handle real-world "tag soup" HTML.

## Features

- 🚀 **Zero Dependencies**: No external runtime dependencies.
- 🌊 **Streaming Support**: Parse HTML chunks as they arrive.
- 🌳 **DOM Compatibility**: Implements a lightweight DOM-like API (`querySelector`, `textContent`, `nodeType`, etc.).
- 📦 **Universal**: Works in Node.js and the Browser.
- 🛠 **CLI Tool**: Includes a command-line interface for quick parsing and conversion.
- 📝 **TypeScript Support**: Includes first-class type definitions.

## Installation

```bash
npm install @elrond25/rohan
```

## Usage

### Node.js

**Basic Parsing**

```javascript
const JustHTML = require('@elrond25/rohan');

const html = '<div id="main">Hello <span>World</span></div>';
const parser = new JustHTML(html);

// Access the tree
const root = parser.root;
console.log(root.toHtml()); 
// Output: <html><head></head><body><div id="main">Hello <span>World</span></div></body></html>

// Query elements
const span = root.querySelector('span');
console.log(span.textContent); // "World"

// Convert to other formats
console.log(root.toMarkdown());
```

**Streaming API**

```javascript
const JustHTML = require('@elrond25/rohan');
const parser = new JustHTML(); // No input initially

parser.write('<div>Hel');
parser.write('lo</div>');
parser.end();

console.log(parser.root.querySelector('div').textContent); // "Hello"
```

### Browser

You can use the bundled version in the browser.

1.  Include the script:
    ```html
    <script src="path/to/rohan.bundle.js"></script>
    ```
2.  Use the global `JustHTML` class:
    ```javascript
    const parser = new JustHTML('<h1>Hello Browser</h1>');
    console.log(parser.root.firstChild.tagName); // "HTML"
    ```

### CLI Tool

Rohan comes with a CLI for quick operations.

```bash
$ rohan --help

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
```

#### Common Operations

**Convert HTML to Markdown**
```bash
echo "<h1>Title</h1><p>Content</p>" | rohan --format markdown
```

**Extract text from a specific element**
```bash
cat index.html | rohan --select "#content" --format text
```

**View the tree structure**
```bash
rohan index.html --format tree
```

## Testing

Rohan uses `@playwright/test` for unit testing and `html5lib-tests` for compliance testing.

```bash
# Run unit tests
npm test

# Run compliance tests
npm run test:compliance
```

## DOM Compatibility

The parser implements a subset of the standard DOM API, making it familiar to use:

- **Properties**: `nodeType`, `nodeName`, `tagName`, `textContent`, `childNodes`, `parentNode`, `firstChild`, `lastChild`, `nextSibling`, `previousSibling`.
- **Methods**: `getAttribute()`, `hasAttribute()`, `querySelector()`, `querySelectorAll()`.

## How it was built

This library was built by meticulously porting the `justhtml` Python library. The process involved:

1.  **Tokenizer**: Implementing the HTML5 state machine to handle character references, comments, DOCTYPEs, and CDATA/RCDATA states.
2.  **Tree Construction**: Implementing the "Open Elements" stack and "Insertion Modes" to handle complex nesting rules and "adoption agency" algorithms.
3.  **Testing**: Validating against the official `html5lib-tests` suite to ensure compliance with the HTML specification.

## Attribution

This project is a JavaScript port of [justhtml](https://pypi.org/project/justhtml/). All credit for the original architecture and logic goes to the authors of that library.

## License

MIT
