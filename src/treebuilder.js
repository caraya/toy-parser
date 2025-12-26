const { InsertionMode } = require('./constants');
const { Tag, CharacterToken, CommentToken, DoctypeToken, EOFToken } = require('./tokens');
const Node = require('./node');
const Tokenizer = require('./tokenizer');

const Marker = { type: 'marker' };

class TreeBuilder {
  constructor(tokenizer, options = {}) {
    this.tokenizer = tokenizer;
    this.options = options;
    this.document = new Node('#document', '#document');
    this.openElements = []; // Stack of open elements
    this.mode = InsertionMode.INITIAL;
    this.originalMode = null;
    this.headElement = null;
    this.formElement = null;
    this.framesetOk = true;
    this.fosterParenting = false;
    this.activeFormattingElements = [];
  }

  process(token) {
    // Main dispatch loop
    let result = this._processToken(token);
    while (result && result.reprocess) {
        result = this._processToken(result.token);
    }
  }

  _processToken(token) {
    // Dispatch based on current mode
    switch (this.mode) {
        case InsertionMode.INITIAL:
            return this._modeInitial(token);
        case InsertionMode.BEFORE_HTML:
            return this._modeBeforeHtml(token);
        case InsertionMode.BEFORE_HEAD:
            return this._modeBeforeHead(token);
        case InsertionMode.IN_HEAD:
            return this._modeInHead(token);
        case InsertionMode.AFTER_HEAD:
            return this._modeAfterHead(token);
        case InsertionMode.IN_BODY:
            return this._modeInBody(token);
        case InsertionMode.IN_TABLE:
            return this._modeInTable(token);
        case InsertionMode.IN_TABLE_BODY:
            return this._modeInTableBody(token);
        case InsertionMode.IN_ROW:
            return this._modeInRow(token);
        case InsertionMode.IN_CELL:
            return this._modeInCell(token);
        case InsertionMode.IN_CAPTION:
            return this._modeInCaption(token);
        case InsertionMode.IN_COLUMN_GROUP:
            return this._modeInColumnGroup(token);
        case InsertionMode.IN_SELECT:
            return this._modeInSelect(token);
        case InsertionMode.IN_SELECT_IN_TABLE:
            return this._modeInSelectInTable(token);
        case InsertionMode.IN_TEMPLATE:
            return this._modeInTemplate(token);
        case InsertionMode.IN_FRAMESET:
            return this._modeInFrameset(token);
        case InsertionMode.AFTER_FRAMESET:
            return this._modeAfterFrameset(token);
        case InsertionMode.TEXT:
            return this._modeText(token);
        case InsertionMode.AFTER_BODY:
            return this._modeAfterBody(token);
        case InsertionMode.AFTER_AFTER_BODY:
            return this._modeAfterAfterBody(token);
        default:
            // TODO: Implement other modes
            console.warn(`Mode ${this.mode} not implemented yet`);
            return null;
    }
  }

  // --- Mode Handlers ---

  _modeInitial(token) {
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        return null; // Ignore whitespace
    }
    if (token instanceof CommentToken) {
        this.document.appendChild(this._createComment(token.data));
        return null;
    }
    if (token instanceof DoctypeToken) {
        // TODO: Handle DOCTYPE validation and quirks mode
        const doctypeNode = new Node(token.doctype.name || "", "#doctype");
        // Add publicId/systemId if needed to Node
        this.document.appendChild(doctypeNode);
        this.mode = InsertionMode.BEFORE_HTML;
        return null;
    }
    
    // If we get here, it's anything else -> switch to BEFORE_HTML and reprocess
    // TODO: Parse error (expected-doctype-but-got-...)
    this.mode = InsertionMode.BEFORE_HTML;
    return { reprocess: true, token };
  }

  _modeBeforeHtml(token) {
    if (token instanceof DoctypeToken) {
        // Parse error
        return null; // Ignore
    }
    if (token instanceof CommentToken) {
        this.document.appendChild(this._createComment(token.data));
        return null;
    }
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        return null; // Ignore whitespace
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        const element = this._createElement(token);
        this.document.appendChild(element);
        this.openElements.push(element);
        this.mode = InsertionMode.BEFORE_HEAD;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && !['head', 'body', 'html', 'br'].includes(token.name)) {
        // Parse error
        return null; // Ignore
    }
    
    // Anything else: create html element and reprocess
    const htmlElement = new Node('html', '#element');
    this.document.appendChild(htmlElement);
    this.openElements.push(htmlElement);
    this.mode = InsertionMode.BEFORE_HEAD;
    return { reprocess: true, token };
  }

  _modeBeforeHead(token) {
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        return null; // Ignore whitespace
    }
    if (token instanceof CommentToken) {
        this._insertComment(token);
        return null;
    }
    if (token instanceof DoctypeToken) {
        // Parse error
        return null; // Ignore
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        return this._modeInBody(token); // Process "in body" (which handles html start tag)
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'head') {
        const element = this._createElement(token);
        this.headElement = element;
        this._insertNode(element);
        this.openElements.push(element);
        this.mode = InsertionMode.IN_HEAD;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && !['head', 'body', 'html', 'br'].includes(token.name)) {
        // Parse error
        return null; // Ignore
    }
    
    // Anything else: create head and reprocess
    const headElement = new Node('head', '#element');
    this.headElement = headElement;
    this._insertNode(headElement);
    this.openElements.push(headElement);
    this.mode = InsertionMode.IN_HEAD;
    return { reprocess: true, token };
  }

  _modeInHead(token) {
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        this._insertCharacter(token);
        return null;
    }
    if (token instanceof CommentToken) {
        this._insertComment(token);
        return null;
    }
    if (token instanceof DoctypeToken) {
        // Parse error
        return null; // Ignore
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        return this._modeInBody(token);
    }
    if (token instanceof Tag && token.kind === Tag.START && ['base', 'basefont', 'bgsound', 'link'].includes(token.name)) {
        this._insertElement(token);
        this.openElements.pop(); // Immediately pop (void element)
        // TODO: Acknowledge self-closing flag
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'meta') {
        this._insertElement(token);
        this.openElements.pop(); // Immediately pop
        // TODO: Handle charset
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'title') {
        this._genericRcdataElement(token);
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && ['noscript', 'noframes', 'style'].includes(token.name)) {
        this._genericRawTextElement(token);
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'script') {
        // TODO: Handle script execution/preparation
        const element = this._insertElement(token);
        this.tokenizer.state = Tokenizer.SCRIPT_DATA; // Or RAWTEXT/RCDATA depending on spec? Script is special.
        // Actually script switches to SCRIPT_DATA state in tokenizer.
        // But for now let's treat as RAWTEXT for simplicity in this milestone if we don't have full script support.
        // Spec says: switch tokenizer to script data state.
        // My tokenizer doesn't have SCRIPT_DATA yet, let's use RAWTEXT for now or add it.
        // Let's use RAWTEXT logic for now.
        this.tokenizer.state = Tokenizer.RAWTEXT; 
        this.originalMode = this.mode;
        this.mode = InsertionMode.TEXT;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && token.name === 'head') {
        this.openElements.pop();
        this.mode = InsertionMode.AFTER_HEAD;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && ['body', 'html', 'br'].includes(token.name)) {
        this.openElements.pop();
        this.mode = InsertionMode.AFTER_HEAD;
        return { reprocess: true, token };
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'template') {
        // TODO: Template support
        this._insertElement(token);
        this.activeFormattingElements.push(Marker);
        this.framesetOk = false;
        this.mode = InsertionMode.IN_TEMPLATE;
        this.templateInsertionModes.push(InsertionMode.IN_TEMPLATE);
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && token.name === 'template') {
        // TODO
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END) {
        // Parse error
        return null; // Ignore
    }
    
    // Anything else: pop head and reprocess
    this.openElements.pop();
    this.mode = InsertionMode.AFTER_HEAD;
    return { reprocess: true, token };
  }

  _modeAfterHead(token) {
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        this._insertCharacter(token);
        return null;
    }
    if (token instanceof CommentToken) {
        this._insertComment(token);
        return null;
    }
    if (token instanceof DoctypeToken) {
        // Parse error
        return null; // Ignore
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        return this._modeInBody(token);
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'body') {
        this._insertElement(token);
        this.framesetOk = false;
        this.mode = InsertionMode.IN_BODY;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'frameset') {
        this._insertElement(token);
        this.mode = InsertionMode.IN_FRAMESET;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && ['base', 'basefont', 'bgsound', 'link', 'meta', 'noframes', 'script', 'style', 'template', 'title'].includes(token.name)) {
        // Parse error
        // Push head back onto stack
        this.openElements.push(this.headElement);
        const result = this._modeInHead(token);
        this.openElements.splice(this.openElements.indexOf(this.headElement), 1); // Remove head
        return result;
    }
    if (token instanceof Tag && token.kind === Tag.END && ['template'].includes(token.name)) {
        return this._modeInHead(token);
    }
    if (token instanceof Tag && token.kind === Tag.END && ['body', 'html', 'br'].includes(token.name)) {
        // Anything else
        this._insertElement(new Tag(Tag.START, 'body'));
        this.mode = InsertionMode.IN_BODY;
        return { reprocess: true, token };
    }
    
    // Anything else
    this._insertElement(new Tag(Tag.START, 'body'));
    this.mode = InsertionMode.IN_BODY;
    return { reprocess: true, token };
  }

  _modeInBody(token) {
    if (token instanceof CharacterToken) {
        if (token.data === '\0') {
            // Parse error
            return null;
        }
        this._reconstructActiveFormattingElements();
        this._insertCharacter(token);
        if (!/[\t\n\f ]/.test(token.data)) {
            this.framesetOk = false;
        }
        return null;
    }
    if (token instanceof CommentToken) {
        this._insertComment(token);
        return null;
    }
    if (token instanceof DoctypeToken) {
        // Parse error
        return null; // Ignore
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        // Parse error
        // Add attributes to html element
        // TODO
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && ['base', 'basefont', 'bgsound', 'link', 'meta', 'noframes', 'script', 'style', 'template', 'title'].includes(token.name)) {
        return this._modeInHead(token);
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'body') {
        // Parse error
        // Add attributes to body element
        // TODO
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'frameset') {
        // Parse error
        // TODO
        return null;
    }
    if (token instanceof EOFToken) {
        // Stop parsing
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && token.name === 'body') {
        if (!this._isElementInScope('body')) {
            // Parse error
            return null;
        }
        // TODO: Check for other errors
        this.mode = InsertionMode.AFTER_BODY;
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.END && token.name === 'html') {
        if (!this._isElementInScope('body')) {
            // Parse error
            return null;
        }
        // TODO: Check for other errors
        this.mode = InsertionMode.AFTER_BODY;
        return null;
    }
    
    if (token instanceof Tag && token.kind === Tag.START) {
        if (['address', 'article', 'aside', 'blockquote', 'center', 'details', 'dialog', 'dir', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'header', 'hgroup', 'main', 'menu', 'nav', 'ol', 'p', 'section', 'summary', 'ul'].includes(token.name)) {
            if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            this._insertElement(token);
            return null;
        }
        if (/^h[1-6]$/.test(token.name)) {
            if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(this._currentNode().name)) {
                // Parse error
                this.openElements.pop();
            }
            this._insertElement(token);
            return null;
        }
        if (['pre', 'listing'].includes(token.name)) {
             if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            this._insertElement(token);
            // TODO: ignore next newline
            this.framesetOk = false;
            return null;
        }

        if (['caption', 'col', 'colgroup', 'frame', 'head', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr'].includes(token.name)) {
            // Parse error
            return null;
        }

        if (token.name === 'form') {
             if (this.formElement) {
                 // Parse error
                 return null;
             }
             if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            const element = this._insertElement(token);
            this.formElement = element;
            return null;
        }
        
        if (token.name === 'table') {
            if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            this._insertElement(token);
            this.framesetOk = false;
            this.mode = InsertionMode.IN_TABLE;
            return null;
        }

        if (token.name === 'hr') {
            if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            this._insertElement(token);
            this.openElements.pop();
            this.framesetOk = false;
            return null;
        }

        if (token.name === 'image') {
            // Parse error
            token.name = 'img';
            return { reprocess: true, token };
        }

        if (token.name === 'textarea') {
            this._insertElement(token);
            // TODO: ignore next newline
            this.tokenizer.state = Tokenizer.RCDATA;
            this.framesetOk = false;
            this.originalMode = this.mode;
            this.mode = InsertionMode.TEXT;
            return null;
        }

        if (['li', 'dd', 'dt'].includes(token.name)) {
            this.framesetOk = false;
            const nodeName = token.name;
            const stopNames = (nodeName === 'li') ? ['li'] : ['dd', 'dt'];
            
            for (let i = this.openElements.length - 1; i >= 0; i--) {
                const node = this.openElements[i];
                if (stopNames.includes(node.name)) {
                    this._generateImpliedEndTags(node.name);
                    if (this._currentNode().name !== node.name) {
                        // Parse error
                    }
                    while (this.openElements.length > i) {
                        this.openElements.pop();
                    }
                    break;
                }
                if (this._isSpecial(node) && !['address', 'div', 'p'].includes(node.name)) {
                    break;
                }
            }
            
            if (this._isElementInButtonScope('p')) {
                this._closePElement();
            }
            this._insertElement(token);
            return null;
        }

        if (['optgroup', 'option'].includes(token.name)) {
            if (this._currentNode().name === 'option') {
                this._generateImpliedEndTags('option');
                if (this._currentNode().name !== 'option') {
                    // Parse error
                }
                while (this._currentNode().name === 'option') {
                    this.openElements.pop();
                }
            }
            this._reconstructActiveFormattingElements();
            this._insertElement(token);
            return null;
        }

        if (token.name === 'select') {
            // console.log('Entering IN_SELECT mode');
            this._reconstructActiveFormattingElements();
            this._insertElement(token);
            this.framesetOk = false;
            
            const tableModes = [
                InsertionMode.IN_TABLE,
                InsertionMode.IN_CAPTION,
                InsertionMode.IN_TABLE_BODY,
                InsertionMode.IN_ROW,
                InsertionMode.IN_CELL
            ];
            
            if (tableModes.includes(this.mode)) {
                 this.mode = InsertionMode.IN_SELECT_IN_TABLE;
            } else {
                 this.mode = InsertionMode.IN_SELECT;
            }
            // console.log('Switched to mode:', this.mode);
            return null;
        }

        // Handle void elements
        if (['area', 'br', 'embed', 'img', 'keygen', 'wbr', 'input', 'base', 'link', 'meta', 'param', 'source', 'track'].includes(token.name)) {
             this._reconstructActiveFormattingElements();
             this._insertElement(token);
             this.openElements.pop(); // Immediately pop void elements
             // TODO: Acknowledge self-closing flag
             return null;
        }

        if (['applet', 'marquee', 'object'].includes(token.name)) {
            this._reconstructActiveFormattingElements();
            this._insertElement(token);
            this.activeFormattingElements.push(Marker);
            this.framesetOk = false;
            return null;
        }

        if (token.name === 'a') {
            const activeA = this._getActiveFormattingElement('a');
            if (activeA) {
                // console.log('Found active A, calling adoption agency');
                // Parse error
                this._callAdoptionAgency(token);
                this._removeFromActiveFormattingElements(activeA);
                this._removeFromOpenElements(activeA);
            }
            this._reconstructActiveFormattingElements();
            const element = this._insertElement(token);
            this._pushActiveFormattingElement(element);
            return null;
        }

        if (['b', 'big', 'code', 'em', 'font', 'i', 'nobr', 's', 'small', 'strike', 'strong', 'tt', 'u'].includes(token.name)) {
            this._reconstructActiveFormattingElements();
            const element = this._insertElement(token);
            this._pushActiveFormattingElement(element);
            return null;
        }
        
        // ... lots more tags
        
        // Generic handling for now
        this._reconstructActiveFormattingElements();
        this._insertElement(token);
        return null;
    }

    if (token instanceof Tag && token.kind === Tag.END) {
        if (['applet', 'marquee', 'object'].includes(token.name)) {
            if (!this._isElementInScope(token.name)) {
                // Parse error
                return null;
            }
            this._generateImpliedEndTags();
            if (this._currentNode().name !== token.name) {
                // Parse error
            }
            this._popUntil(token.name);
            this._clearActiveFormattingElementsUpToLastMarker();
            return null;
        }
        if (['address', 'article', 'aside', 'blockquote', 'button', 'center', 'details', 'dialog', 'dir', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'header', 'hgroup', 'listing', 'main', 'menu', 'nav', 'ol', 'pre', 'section', 'summary', 'ul'].includes(token.name)) {
            if (!this._isElementInScope(token.name)) {
                // Parse error
                return null;
            }
            this._generateImpliedEndTags();
            if (this._currentNode().name !== token.name) {
                // Parse error
            }
            this._popUntil(token.name);
            return null;
        }
        if (token.name === 'br') {
             this._reconstructActiveFormattingElements();
             this._insertElement(new Tag(Tag.START, 'br'));
             this.openElements.pop();
             return null;
        }
        if (token.name === 'form') {
            // TODO: complex form handling
            return null;
        }
        if (token.name === 'p') {
            if (!this._isElementInButtonScope('p')) {
                // Parse error
                this._insertElement(new Tag(Tag.START, 'p'));
            }
            this._closePElement();
            return null;
        }
        if (/^h[1-6]$/.test(token.name)) {
             if (!this._isElementInScope(token.name)) { // TODO: check scope properly (heading content)
                 // Actually spec says check for any heading
                 // For now simplified
                 return null;
             }
             this._generateImpliedEndTags();
             if (this._currentNode().name !== token.name) {
                 // Parse error
             }
             this._popUntil(token.name);
             return null;
        }

        if (['a', 'b', 'big', 'code', 'em', 'font', 'i', 'nobr', 's', 'small', 'strike', 'strong', 'tt', 'u'].includes(token.name)) {
            this._callAdoptionAgency(token);
            return null;
        }
        
        // Generic handling
        // Iterate up the stack
        for (let i = this.openElements.length - 1; i >= 0; i--) {
            if (this.openElements[i].name === token.name) {
                this._generateImpliedEndTags(token.name);
                if (this.openElements[i] !== this._currentNode()) {
                    // Parse error
                }
                this._popUntil(token.name);
                break;
            }
            if (this._isSpecial(this.openElements[i])) {
                // Parse error
                break;
            }
        }
        return null;
    }
    
    return null;
  }

  _modeText(token) {
      if (token instanceof CharacterToken) {
          this._insertCharacter(token);
          return null;
      }
      if (token instanceof EOFToken) {
          // Parse error
          if (this._currentNode().name === 'script') {
              // Already started script execution?
          }
          this.openElements.pop();
          this.mode = this.originalMode;
          return { reprocess: true, token };
      }
      if (token instanceof Tag && token.kind === Tag.END && token.name === 'script') {
          // TODO: Script execution
          this.openElements.pop();
          this.mode = this.originalMode;
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          this.openElements.pop();
          this.mode = this.originalMode;
          return null;
      }
      return null;
  }

  _modeAfterBody(token) {
    if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
        return this._modeInBody(token);
    }
    if (token instanceof CommentToken) {
        const comment = this._createComment(token.data);
        this.openElements[0].appendChild(comment);
        return null;
    }
    if (token instanceof DoctypeToken) {
        // Parse error
        return null;
    }
    if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
        return this._modeInBody(token);
    }
    if (token instanceof EOFToken) {
        // Stop parsing
        return null;
    }
    
    // Parse error
    this.mode = InsertionMode.IN_BODY;
    return { reprocess: true, token };
  }

  _modeAfterAfterBody(token) {
      if (token instanceof CommentToken) {
          this.document.appendChild(this._createComment(token.data));
          return null;
      }
      if (token instanceof DoctypeToken || (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) || (token instanceof Tag && token.kind === Tag.START && token.name === 'html')) {
          return this._modeInBody(token);
      }
      if (token instanceof EOFToken) {
          return null;
      }
      // Parse error
      this.mode = InsertionMode.IN_BODY;
      return { reprocess: true, token };
  }

  // --- Helpers ---

  _currentNode() {
    return this.openElements[this.openElements.length - 1];
  }

  _createElement(token) {
    const node = new Node(token.name, '#element');
    node.attrs = token.attrs;
    return node;
  }

  _createComment(data) {
      const node = new Node('#comment', '#comment');
      node.data = data; // Or text? Node class uses text for text nodes.
      // Let's use text for comment data too for now or add data prop.
      // Node class in node.js has `text` property.
      node.text = data;
      return node;
  }

  _insertNode(node) {
    if (this.fosterParenting && ['table', 'tbody', 'tfoot', 'thead', 'tr'].includes(this._currentNode().name)) {
        let tableElement = null;
        for (let i = this.openElements.length - 1; i >= 0; i--) {
            if (this.openElements[i].name === 'table') {
                tableElement = this.openElements[i];
                break;
            }
        }
        if (tableElement && tableElement.parent) {
            const parent = tableElement.parent;
            const index = parent.children.indexOf(tableElement);
            parent.children.splice(index, 0, node);
            node.parent = parent;
            return;
        }
    }
    const parent = this._currentNode();
    parent.appendChild(node);
  }

  _insertElement(token) {
    const element = this._createElement(token);
    if (!element) {
        console.error("Created undefined element for token:", token);
    }
    this._insertNode(element);
    this.openElements.push(element);
    // console.log(`Inserted ${element.name}. Stack: ${this.openElements.map(n => n.name).join(', ')}`);
    return element;
  }

  _insertCharacter(token) {
    if (this.fosterParenting && ['table', 'tbody', 'tfoot', 'thead', 'tr'].includes(this._currentNode().name)) {
        let tableElement = null;
        for (let i = this.openElements.length - 1; i >= 0; i--) {
            if (this.openElements[i].name === 'table') {
                tableElement = this.openElements[i];
                break;
            }
        }
        if (tableElement && tableElement.parent) {
            const parent = tableElement.parent;
            const index = parent.children.indexOf(tableElement);
            const prevSibling = parent.children[index - 1];
            if (prevSibling && prevSibling.type === '#text') {
                prevSibling.text += token.data;
                return;
            }
            const textNode = new Node('#text', '#text');
            textNode.text = token.data;
            parent.children.splice(index, 0, textNode);
            textNode.parent = parent;
            return;
        }
    }

    const parent = this._currentNode();
    // Check if last child is text node, if so append
    const lastChild = parent.children[parent.children.length - 1];
    if (lastChild && lastChild.type === '#text') {
        lastChild.text += token.data;
    } else {
        const textNode = new Node('#text', '#text');
        textNode.text = token.data;
        parent.appendChild(textNode);
    }
  }

  _insertComment(token) {
      const comment = this._createComment(token.data);
      this._insertNode(comment);
  }

  _genericRcdataElement(token) {
      this._insertElement(token);
      this.tokenizer.state = Tokenizer.RCDATA;
      this.originalMode = this.mode;
      this.mode = InsertionMode.TEXT;
  }

  _genericRawTextElement(token) {
      this._insertElement(token);
      this.tokenizer.state = Tokenizer.RAWTEXT;
      this.originalMode = this.mode;
      this.mode = InsertionMode.TEXT;
  }

  _reconstructActiveFormattingElements() {
      if (this.activeFormattingElements.length === 0) return;
      
      let entryIndex = this.activeFormattingElements.length - 1;
      let entry = this.activeFormattingElements[entryIndex];
      
      if (entry === Marker || this.openElements.includes(entry)) return;

      while (entryIndex > 0) {
          entry = this.activeFormattingElements[entryIndex - 1];
          if (entry === Marker || this.openElements.includes(entry)) {
              break;
          }
          entryIndex--;
      }

      while (entryIndex < this.activeFormattingElements.length) {
          entry = this.activeFormattingElements[entryIndex];
          const token = new Tag(Tag.START, entry.name);
          token.attrs = JSON.parse(JSON.stringify(entry.attrs)); // Deep copy attributes
          
          const newElement = this._insertElement(token);
          this.activeFormattingElements[entryIndex] = newElement;
          entryIndex++;
      }
  }

  _clearActiveFormattingElementsUntilMarker() {
      while (this.activeFormattingElements.length > 0) {
          const entry = this.activeFormattingElements.pop();
          if (entry === Marker) break;
      }
  }

  _pushActiveFormattingElement(element) {
      let count = 0;
      for (let i = this.activeFormattingElements.length - 1; i >= 0; i--) {
          const entry = this.activeFormattingElements[i];
          if (entry === Marker) break;
          if (entry.name === element.name && this._attributesEqual(entry, element)) {
              count++;
          }
      }
      if (count >= 3) {
          return;
      }
      this.activeFormattingElements.push(element);
  }

  _attributesEqual(a, b) {
      const keysA = Object.keys(a.attrs);
      const keysB = Object.keys(b.attrs);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
          if (a.attrs[key] !== b.attrs[key]) return false;
      }
      return true;
  }

  _getActiveFormattingElement(name) {
      for (let i = this.activeFormattingElements.length - 1; i >= 0; i--) {
          const entry = this.activeFormattingElements[i];
          if (entry === Marker) break;
          if (entry.name === name) return entry;
      }
      return null;
  }

  _removeFromActiveFormattingElements(element) {
      const index = this.activeFormattingElements.indexOf(element);
      if (index !== -1) {
          this.activeFormattingElements.splice(index, 1);
      }
  }

  _getFurthestBlock(formattingElementIndex) {
      for (let i = formattingElementIndex + 1; i < this.openElements.length; i++) {
          const node = this.openElements[i];
          if (this._isSpecial(node)) return node;
      }
      return null;
  }

  _callAdoptionAgency(token) {
      const subject = token.name;
      // console.log('Adoption Agency for:', subject);
      for (let i = 0; i < 8; i++) {
          const formattingElement = this._getActiveFormattingElement(subject);
          if (!formattingElement) {
              // console.log('No formatting element found');
              return this._processInBodyGenericEndTag(token);
          }
          
          if (!this.openElements.includes(formattingElement)) {
              // console.log('Formatting element not in open elements');
              this._removeFromActiveFormattingElements(formattingElement);
              return; // Parse error
          }
          
          if (!this._isElementInScope(formattingElement.name)) {
              // console.log('Formatting element not in scope');
              return; // Parse error
          }
          
          if (formattingElement !== this._currentNode()) {
              // Parse error
          }
          
          const formattingElementIndex = this.openElements.indexOf(formattingElement);
          const furthestBlock = this._getFurthestBlock(formattingElementIndex);
          
          if (!furthestBlock) {
              // console.log('No furthest block');
              this._popUntil(formattingElement.name);
              this._removeFromActiveFormattingElements(formattingElement);
              return;
          }
          // console.log('Furthest block:', furthestBlock.name);
          
          const commonAncestor = this.openElements[formattingElementIndex - 1];
          let bookmark = this.activeFormattingElements.indexOf(formattingElement);
          
          let node = furthestBlock;
          let lastNode = furthestBlock;
          
          let innerLoopCounter = 0;
          const furthestBlockIndex = this.openElements.indexOf(furthestBlock);
          let index = furthestBlockIndex;
          
          while (innerLoopCounter < 3) {
              innerLoopCounter++;
              index--;
              node = this.openElements[index];
              if (this.activeFormattingElements.indexOf(node) === -1) {
                  this.openElements.splice(index, 1);
                  continue;
              }
              if (node === formattingElement) break;
              
              const token = new Tag(Tag.START, node.name);
              token.attrs = JSON.parse(JSON.stringify(node.attrs));
              const newElement = this._createElement(token);
              
              this.activeFormattingElements[this.activeFormattingElements.indexOf(node)] = newElement;
              this.openElements[index] = newElement;
              node = newElement;
              
              if (lastNode === furthestBlock) {
                  bookmark = this.activeFormattingElements.indexOf(node) + 1;
              }
              
              if (lastNode.parent) lastNode.parent.removeChild(lastNode);
              node.appendChild(lastNode);
              lastNode = node;
          }
          
          if (lastNode.parent) lastNode.parent.removeChild(lastNode);
          commonAncestor.appendChild(lastNode);
          
          const newFormattingElement = this._createElement(new Tag(Tag.START, formattingElement.name));
          newFormattingElement.attrs = JSON.parse(JSON.stringify(formattingElement.attrs));
          
          while (furthestBlock.children.length > 0) {
              const child = furthestBlock.children[0];
              furthestBlock.removeChild(child);
              newFormattingElement.appendChild(child);
          }
          furthestBlock.appendChild(newFormattingElement);
          
          this._removeFromActiveFormattingElements(formattingElement);
          this.activeFormattingElements.splice(bookmark, 0, newFormattingElement);
          
          this._removeFromOpenElements(formattingElement);
          this.openElements.splice(this.openElements.indexOf(furthestBlock) + 1, 0, newFormattingElement);
      }
  }

  _removeFromOpenElements(element) {
      const index = this.openElements.indexOf(element);
      if (index !== -1) {
          this.openElements.splice(index, 1);
      }
  }
  
  _processInBodyGenericEndTag(token) {
        for (let i = this.openElements.length - 1; i >= 0; i--) {
            if (this.openElements[i].name === token.name) {
                this._generateImpliedEndTags(token.name);
                if (this.openElements[i] !== this._currentNode()) {
                    // Parse error
                }
                while (this.openElements.length > i) {
                    this.openElements.pop();
                }
                break;
            }
            if (this._isSpecial(this.openElements[i])) {
                // Parse error
                break;
            }
        }
  }

  _isElementInScope(target) {
      const scopingElements = ['applet', 'caption', 'html', 'table', 'td', 'th', 'marquee', 'object', 'template', 'mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml', 'foreignObject', 'desc', 'title'];
      for (let i = this.openElements.length - 1; i >= 0; i--) {
          const node = this.openElements[i];
          if (node.name === target) return true;
          if (scopingElements.includes(node.name)) return false;
      }
      return false;
  }

  _isElementInButtonScope(target) {
      const scopingElements = ['applet', 'caption', 'html', 'table', 'td', 'th', 'marquee', 'object', 'template', 'mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml', 'foreignObject', 'desc', 'title', 'button'];
      for (let i = this.openElements.length - 1; i >= 0; i--) {
          const node = this.openElements[i];
          if (node.name === target) return true;
          if (scopingElements.includes(node.name)) return false;
      }
      return false;
  }

  _closePElement() {
      this._generateImpliedEndTags('p');
      if (this._currentNode().name !== 'p') {
          // Parse error
      }
      this._popUntil('p');
  }

  _generateImpliedEndTags(exclude = null) {
      if (this.openElements.length === 0) return;
      let node = this._currentNode();
      if (!node) {
          console.error("Stack corrupted in _generateImpliedEndTags. OpenElements:", this.openElements);
          return;
      }
      while (this.openElements.length > 0 && ['dd', 'dt', 'li', 'optgroup', 'option', 'p', 'rb', 'rp', 'rt', 'rtc'].includes(this._currentNode().name) && this._currentNode().name !== exclude) {
          this.openElements.pop();
      }
  }

  _popUntil(name) {
      // console.log('PopUntil:', name);
      while (this.openElements.length > 0) {
          const node = this.openElements.pop();
          // console.log('Popped:', node.name);
          if (node.name === name) break;
      }
  }

  _clearActiveFormattingElementsUpToLastMarker() {
      while (this.activeFormattingElements.length > 0) {
          const entry = this.activeFormattingElements.pop();
          if (entry === Marker) {
              break;
          }
      }
  }

  _modeInBodyWithFosterParenting(token) {
      this.fosterParenting = true;
      const result = this._modeInBody(token);
      this.fosterParenting = false;
      return result;
  }

  _modeInTable(token) {
      if (token instanceof CommentToken) {
          this._insertComment(token);
          return null;
      }
      if (token instanceof CharacterToken) {
          if (['table', 'tbody', 'tfoot', 'thead', 'tr'].includes(this._currentNode().name)) {
              if (/^[\t\n\f ]+$/.test(token.data)) {
                  this._insertCharacter(token);
                  return null;
              }
              return this._modeInBodyWithFosterParenting(token);
          }
          if (/^[\t\n\f ]+$/.test(token.data)) {
              this._insertCharacter(token);
              return null;
          }
          return this._modeInBodyWithFosterParenting(token);
      }
      if (token instanceof Tag && token.kind === Tag.START) {
          if (token.name === 'caption') {
              this._clearStackBackToTableContext();
              this._insertElement(token);
              this.mode = InsertionMode.IN_CAPTION;
              this.activeFormattingElements.push(Marker);
              return null;
          }
          if (token.name === 'colgroup') {
              this._clearStackBackToTableContext();
              this._insertElement(token);
              this.mode = InsertionMode.IN_COLUMN_GROUP;
              return null;
          }
          if (token.name === 'col') {
              this._clearStackBackToTableContext();
              this._insertElement(new Tag(Tag.START, 'colgroup'));
              this.mode = InsertionMode.IN_COLUMN_GROUP;
              return { reprocess: true, token };
          }
          if (['tbody', 'tfoot', 'thead'].includes(token.name)) {
              this._clearStackBackToTableContext();
              this._insertElement(token);
              this.mode = InsertionMode.IN_TABLE_BODY;
              return null;
          }
          if (['td', 'th', 'tr'].includes(token.name)) {
              this._clearStackBackToTableContext();
              this._insertElement(new Tag(Tag.START, 'tbody'));
              this.mode = InsertionMode.IN_TABLE_BODY;
              return { reprocess: true, token };
          }
          if (token.name === 'table') {
              if (!this._isElementInTableScope('table')) {
                  return null;
              }
              this._popUntil('table');
              this._resetInsertionMode();
              return { reprocess: true, token };
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (token.name === 'table') {
              if (!this._isElementInTableScope('table')) {
                  return null;
              }
              this._popUntil('table');
              this._resetInsertionMode();
              return null;
          }
      }
      // Anything else: Foster parenting
      return this._modeInBodyWithFosterParenting(token);
  }

  _modeInTableBody(token) {
      if (token instanceof Tag && token.kind === Tag.START) {
          if (token.name === 'tr') {
              this._clearStackBackToTableBodyContext();
              this._insertElement(token);
              this.mode = InsertionMode.IN_ROW;
              return null;
          }
          if (['th', 'td'].includes(token.name)) {
              this._clearStackBackToTableBodyContext();
              this._insertElement(new Tag(Tag.START, 'tr'));
              this.mode = InsertionMode.IN_ROW;
              return { reprocess: true, token };
          }
          if (['caption', 'col', 'colgroup', 'tbody', 'tfoot', 'thead'].includes(token.name)) {
              if (!this._isElementInTableScope('tbody') && !this._isElementInTableScope('thead') && !this._isElementInTableScope('tfoot')) {
                  return null;
              }
              this._clearStackBackToTableBodyContext();
              this.openElements.pop(); // Pop tbody/thead/tfoot
              this.mode = InsertionMode.IN_TABLE;
              return { reprocess: true, token };
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (['tbody', 'tfoot', 'thead'].includes(token.name)) {
              if (!this._isElementInTableScope(token.name)) {
                  return null;
              }
              this._clearStackBackToTableBodyContext();
              this.openElements.pop();
              this.mode = InsertionMode.IN_TABLE;
              return null;
          }
          if (token.name === 'table') {
              if (!this._isElementInTableScope('tbody') && !this._isElementInTableScope('thead') && !this._isElementInTableScope('tfoot')) {
                  return null;
              }
              this._clearStackBackToTableBodyContext();
              this.openElements.pop();
              this.mode = InsertionMode.IN_TABLE;
              return { reprocess: true, token };
          }
      }
      return this._modeInTable(token);
  }

  _modeInRow(token) {
      if (token instanceof Tag && token.kind === Tag.START) {
          if (['th', 'td'].includes(token.name)) {
              this._clearStackBackToTableRowContext();
              this._insertElement(token);
              this.mode = InsertionMode.IN_CELL;
              this.activeFormattingElements.push(Marker);
              return null;
          }
          if (['caption', 'col', 'colgroup', 'tbody', 'tfoot', 'thead', 'tr'].includes(token.name)) {
              if (!this._isElementInTableScope('tr')) {
                  return null;
              }
              this._clearStackBackToTableRowContext();
              this.openElements.pop(); // Pop tr
              this.mode = InsertionMode.IN_TABLE_BODY;
              return { reprocess: true, token };
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (token.name === 'tr') {
              if (!this._isElementInTableScope('tr')) {
                  return null;
              }
              this._clearStackBackToTableRowContext();
              this.openElements.pop();
              this.mode = InsertionMode.IN_TABLE_BODY;
              return null;
          }
          if (token.name === 'table') {
              if (!this._isElementInTableScope('tr')) {
                  return null;
              }
              this._clearStackBackToTableRowContext();
              this.openElements.pop();
              this.mode = InsertionMode.IN_TABLE_BODY;
              return { reprocess: true, token };
          }
          if (['tbody', 'tfoot', 'thead'].includes(token.name)) {
               if (!this._isElementInTableScope(token.name)) {
                   return null;
               }
               if (!this._isElementInTableScope('tr')) {
                   return null;
               }
               this._clearStackBackToTableRowContext();
               this.openElements.pop();
               this.mode = InsertionMode.IN_TABLE_BODY;
               return { reprocess: true, token };
          }
      }
      return this._modeInTable(token);
  }

  _modeInCell(token) {
      if (token instanceof Tag && token.kind === Tag.START) {
          if (['caption', 'col', 'colgroup', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr'].includes(token.name)) {
              if (!this._isElementInTableScope('td') && !this._isElementInTableScope('th')) {
                  // Parse error
                  return null;
              }
              this._closeCell();
              return { reprocess: true, token };
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (['td', 'th'].includes(token.name)) {
              if (!this._isElementInTableScope(token.name)) {
                  return null;
              }
              this._generateImpliedEndTags();
              if (this._currentNode().name !== token.name) {
                  // Parse error
              }
              this._popUntil(token.name);
              this._clearActiveFormattingElementsUntilMarker();
              this.mode = InsertionMode.IN_ROW;
              return null;
          }
          if (['body', 'caption', 'col', 'colgroup', 'html'].includes(token.name)) {
              return null;
          }
          if (['table', 'tbody', 'tfoot', 'thead', 'tr'].includes(token.name)) {
              if (!this._isElementInTableScope(token.name)) {
                  return null;
              }
              this._closeCell();
              return { reprocess: true, token };
          }
      }
      return this._modeInBody(token);
  }

  _closeCell() {
      if (this._isElementInTableScope('td')) {
          this._popUntil('td');
      } else {
          this._popUntil('th');
      }
      this._clearActiveFormattingElementsUntilMarker();
      this.mode = InsertionMode.IN_ROW;
  }

  _isElementInTableScope(target) {
      for (let i = this.openElements.length - 1; i >= 0; i--) {
          const node = this.openElements[i];
          if (node.name === target) return true;
          if (['html', 'table', 'template'].includes(node.name)) return false;
      }
      return false;
  }

  _clearStackBackToTableContext() {
      while (true) {
          const node = this._currentNode();
          if (['table', 'template', 'html'].includes(node.name)) break;
          this.openElements.pop();
      }
  }

  _clearStackBackToTableBodyContext() {
      while (true) {
          const node = this._currentNode();
          if (['tbody', 'tfoot', 'thead', 'template', 'html'].includes(node.name)) break;
          this.openElements.pop();
      }
  }

  _clearStackBackToTableRowContext() {
      while (true) {
          const node = this._currentNode();
          if (['tr', 'template', 'html'].includes(node.name)) break;
          this.openElements.pop();
      }
  }

  _resetInsertionMode() {
      let last = false;
      for (let i = this.openElements.length - 1; i >= 0; i--) {
          let node = this.openElements[i];
          if (i === 0) {
              last = true;
          }
          
          if (node.name === 'select') {
              this.mode = InsertionMode.IN_SELECT;
              return;
          }
          if (['td', 'th'].includes(node.name) && !last) {
              this.mode = InsertionMode.IN_CELL;
              return;
          }
          if (node.name === 'tr') {
              this.mode = InsertionMode.IN_ROW;
              return;
          }
          if (['tbody', 'thead', 'tfoot'].includes(node.name)) {
              this.mode = InsertionMode.IN_TABLE_BODY;
              return;
          }
          if (node.name === 'caption') {
              this.mode = InsertionMode.IN_CAPTION;
              return;
          }
          if (node.name === 'colgroup') {
              this.mode = InsertionMode.IN_COLUMN_GROUP;
              return;
          }
          if (node.name === 'table') {
              this.mode = InsertionMode.IN_TABLE;
              return;
          }
          if (node.name === 'head') {
              this.mode = InsertionMode.IN_BODY;
              return;
          }
          if (node.name === 'body') {
              this.mode = InsertionMode.IN_BODY;
              return;
          }
          if (node.name === 'frameset') {
              // ...
          }
          if (node.name === 'html') {
              this.mode = InsertionMode.IN_BODY;
              return;
          }
          if (last) {
              this.mode = InsertionMode.IN_BODY;
              return;
          }
      }
  }

  _createMarker() {
      return { type: 'marker' };
  }

  _clearActiveFormattingElementsUntilMarker() {
      while (this.activeFormattingElements.length > 0) {
          const entry = this.activeFormattingElements.pop();
          if (entry === Marker) {
              break;
          }
      }
  }

  _isSpecial(node) {
      // TODO: Full list
      return ['address', 'applet', 'area', 'article', 'aside', 'base', 'basefont', 'bgsound', 'blockquote', 'body', 'br', 'button', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dir', 'div', 'dl', 'dt', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'iframe', 'img', 'input', 'isindex', 'li', 'link', 'listing', 'main', 'marquee', 'menu', 'meta', 'nav', 'noembed', 'noframes', 'noscript', 'object', 'ol', 'p', 'param', 'plaintext', 'pre', 'script', 'section', 'select', 'source', 'style', 'summary', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul', 'wbr', 'xmp'].includes(node.name);
  }
  _modeInCaption(token) {
      if (token instanceof Tag && token.kind === Tag.END && token.name === 'caption') {
          if (!this._isElementInTableScope('caption')) {
              return null;
          }
          this._generateImpliedEndTags();
          if (this._currentNode().name !== 'caption') {
              // Parse error
          }
          this._popUntil('caption');
          this._clearActiveFormattingElementsUntilMarker();
          this.mode = InsertionMode.IN_TABLE;
          return null;
      }
      // TODO: Complete implementation
      return this._modeInBody(token);
  }

  _modeInColumnGroup(token) {
      if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
          this._insertCharacter(token);
          return null;
      }
      if (token instanceof CommentToken) {
          this._insertComment(token);
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.START && token.name === 'html') {
          return this._modeInBody(token);
      }
      if (token instanceof Tag && token.kind === Tag.START && token.name === 'col') {
          this._insertElement(token);
          this.openElements.pop(); // Immediately pop col
          // Acknowledge self-closing
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.END && token.name === 'colgroup') {
          if (this._currentNode().name !== 'colgroup') {
              // Parse error
              return null;
          }
          this.openElements.pop();
          this.mode = InsertionMode.IN_TABLE;
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.END && token.name === 'col') {
          // Parse error
          return null;
      }
      
      // Anything else
      if (this._currentNode().name !== 'colgroup') {
          // Parse error
          return null;
      }
      this.openElements.pop();
      this.mode = InsertionMode.IN_TABLE;
      return { reprocess: true, token };
  }

  _modeInSelect(token) {
      // console.log('In _modeInSelect', token.type, token.name);
      if (token instanceof CharacterToken) {
          if (token.data === '\0') {
              // Parse error
              return null;
          }
          this._insertCharacter(token);
          return null;
      }
      if (token instanceof CommentToken) {
          this._insertComment(token);
          return null;
      }
      if (token instanceof DoctypeToken) {
          // Parse error
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.START) {
          if (token.name === 'html') {
              return this._modeInBody(token);
          }
          if (token.name === 'option') {
              if (this._currentNode().name === 'option') {
                  this.openElements.pop();
              }
              this._insertElement(token);
              return null;
          }
          if (token.name === 'optgroup') {
              if (this._currentNode().name === 'option') {
                  this.openElements.pop();
              }
              if (this._currentNode().name === 'optgroup') {
                  this.openElements.pop();
              }
              this._insertElement(token);
              return null;
          }
          if (token.name === 'select') {
              // Parse error
              if (!this._isElementInTableScope('select')) {
                  // Ignore
                  return null;
              }
              this._popUntil('select');
              this._resetInsertionMode();
              return null;
          }
          if (['input', 'keygen', 'textarea'].includes(token.name)) {
              // Parse error
              if (!this._isElementInTableScope('select')) {
                  return null;
              }
              this._popUntil('select');
              this._resetInsertionMode();
              return { reprocess: true, token };
          }
          if (token.name === 'script') {
              return this._modeInHead(token);
          }
          if (token.name === 'template') {
              return this._modeInHead(token);
          }
          
          const FORMATTING_ELEMENTS = ['a', 'b', 'big', 'code', 'em', 'font', 'i', 'nobr', 's', 'small', 'strike', 'strong', 'tt', 'u'];
          if (FORMATTING_ELEMENTS.includes(token.name)) {
              this._reconstructActiveFormattingElements();
              const element = this._insertElement(token);
              this._pushActiveFormattingElement(element);
              return null;
          }

          if (token.name === 'hr') {
              if (this._currentNode().name === 'option') this.openElements.pop();
              if (this._currentNode().name === 'optgroup') this.openElements.pop();
              this._reconstructActiveFormattingElements();
              this._insertElement(token);
              this.openElements.pop(); 
              return null;
          }
          
          if (['p', 'div', 'span', 'button', 'datalist', 'selectedcontent'].includes(token.name)) {
              this._reconstructActiveFormattingElements();
              this._insertElement(token);
              return null;
          }
          
          if (['br', 'img'].includes(token.name)) {
              this._reconstructActiveFormattingElements();
              this._insertElement(token);
              this.openElements.pop();
              return null;
          }
          
          if (token.name === 'plaintext') {
              this._reconstructActiveFormattingElements();
              this._insertElement(token);
              this.tokenizer.state = Tokenizer.PLAINTEXT;
              return null;
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (token.name === 'optgroup') {
              if (this._currentNode().name === 'option' && this.openElements[this.openElements.length - 2] && this.openElements[this.openElements.length - 2].name === 'optgroup') {
                  this.openElements.pop();
              }
              if (this._currentNode().name === 'optgroup') {
                  this.openElements.pop();
              } else {
                  // Parse error
              }
              return null;
          }
          if (token.name === 'option') {
              if (this._currentNode().name === 'option') {
                  this.openElements.pop();
              } else {
                  // Parse error
              }
              return null;
          }
          if (token.name === 'select') {
              if (!this._isElementInTableScope('select')) {
                  // Parse error
                  return null;
              }
              this._popUntil('select');
              this._resetInsertionMode();
              return null;
          }
      }
      if (token instanceof EOFToken) {
          return this._modeInBody(token);
      }
      
      // Anything else: Parse error. Ignore.
      return null;
  }

  _modeInSelectInTable(token) {
      // TODO
      return this._modeInBody(token);
  }

  _modeInTemplate(token) {
      // TODO
      return this._modeInBody(token);
  }

  _modeInFrameset(token) {
      if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
          this._insertCharacter(token);
          return null;
      }
      if (token instanceof CommentToken) {
          this._insertComment(token);
          return null;
      }
      if (token instanceof DoctypeToken) {
          // Parse error
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.START) {
          if (token.name === 'html') {
              return this._modeInBody(token);
          }
          if (token.name === 'frameset') {
              this._insertElement(token);
              return null;
          }
          if (token.name === 'frame') {
              this._insertElement(token);
              this.openElements.pop(); // Immediately pop frame (void element)
              return null;
          }
          if (token.name === 'noframes') {
              return this._modeInHead(token);
          }
      }
      if (token instanceof Tag && token.kind === Tag.END) {
          if (token.name === 'frameset') {
              if (this._currentNode().name === 'html') {
                  // Parse error
                  return null;
              }
              this.openElements.pop();
              if (this._currentNode().name !== 'frameset') {
                  this.mode = InsertionMode.AFTER_FRAMESET;
              }
              return null;
          }
      }
      if (token instanceof EOFToken) {
          if (this._currentNode().name !== 'html') {
              // Parse error
          }
          return null;
      }
      
      // Parse error
      return null;
  }

  _modeAfterFrameset(token) {
      if (token instanceof CharacterToken && /[\t\n\f ]/.test(token.data)) {
          this._insertCharacter(token);
          return null;
      }
      if (token instanceof CommentToken) {
          this._insertComment(token);
          return null;
      }
      if (token instanceof DoctypeToken) {
          // Parse error
          return null;
      }
      if (token instanceof Tag && token.kind === Tag.START) {
          if (token.name === 'html') {
              return this._modeInBody(token);
          }
          if (token.name === 'noframes') {
              return this._modeInHead(token);
          }
      }
      if (token instanceof EOFToken) {
          return null;
      }
      // Parse error
      return null;
  }
}

module.exports = TreeBuilder;
