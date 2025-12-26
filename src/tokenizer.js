const { Tag, CharacterToken, CommentToken, Doctype, DoctypeToken, EOFToken } = require('./tokens');

class Tokenizer {
  constructor(sink, options = {}) {
    this.sink = sink;
    this.options = options;
    this.state = Tokenizer.DATA;
    this.buffer = "";
    this.pos = 0;
    this.reconsume = false;
    this.currentTag = null;
    this.currentComment = null;
    this.currentDoctype = null;
    this.tempBuffer = "";
    this.lastChar = null;
  }

  initialize(html) {
    this.buffer = html || "";
    this.pos = 0;
    this.state = Tokenizer.DATA;
    this.reconsume = false;
    this.lastChar = null;
  }

  getNextChar() {
    if (this.pos >= this.buffer.length) return null;
    return this.buffer[this.pos++];
  }

  peekNextChar() {
    if (this.pos >= this.buffer.length) return null;
    return this.buffer[this.pos];
  }

  commitAttribute() {
    if (this.currentAttribute && this.currentAttribute.name) {
        if (!Object.prototype.hasOwnProperty.call(this.currentTag.attrs, this.currentAttribute.name)) {
            this.currentTag.attrs[this.currentAttribute.name] = this.currentAttribute.value;
        }
    }
    this.currentAttribute = { name: "", value: "" };
  }

  run() {
    while (true) {
      const char = this.reconsume ? this.lastChar : this.getNextChar();
      this.lastChar = char;
      this.reconsume = false;

      if (char === null && this.state === Tokenizer.DATA) {
        this.sink.process(new EOFToken());
        return;
      }

      switch (this.state) {
        case Tokenizer.DATA:
          if (char === '&') {
            // TODO: Character reference
            this.sink.process(new CharacterToken(char));
          } else if (char === '<') {
            this.state = Tokenizer.TAG_OPEN;
          } else if (char === '\0') {
            // TODO: Parse error
            this.sink.process(new CharacterToken(char));
          } else {
            this.sink.process(new CharacterToken(char));
          }
          break;

        case Tokenizer.TAG_OPEN:
          if (char === '!') {
            this.state = Tokenizer.MARKUP_DECLARATION_OPEN;
          } else if (char === '/') {
            this.state = Tokenizer.END_TAG_OPEN;
          } else if (char !== null && /[a-zA-Z]/.test(char)) {
            this.currentTag = new Tag(Tag.START, char.toLowerCase());
            this.state = Tokenizer.TAG_NAME;
          } else if (char === '?') {
            // TODO: Parse error, bogus comment
            this.currentComment = new CommentToken("?");
            this.state = Tokenizer.BOGUS_COMMENT;
          } else {
            // TODO: Parse error
            this.sink.process(new CharacterToken('<'));
            this.reconsume = true;
            this.state = Tokenizer.DATA;
          }
          break;

        case Tokenizer.END_TAG_OPEN:
          if (char !== null && /[a-zA-Z]/.test(char)) {
            this.currentTag = new Tag(Tag.END, char.toLowerCase());
            this.state = Tokenizer.TAG_NAME;
          } else if (char === '>') {
            // TODO: Parse error
            this.state = Tokenizer.DATA;
          } else if (char === null) { // EOF
             // TODO: Parse error
             this.sink.process(new CharacterToken('<'));
             this.sink.process(new CharacterToken('/'));
             this.reconsume = true; // Re-process EOF in DATA state
             this.state = Tokenizer.DATA;
          } else {
            // TODO: Parse error, bogus comment
            this.currentComment = new CommentToken("");
            this.reconsume = true;
            this.state = Tokenizer.BOGUS_COMMENT;
          }
          break;

        case Tokenizer.TAG_NAME:
          if (/[\t\n\f ]/.test(char)) {
            this.state = Tokenizer.BEFORE_ATTRIBUTE_NAME;
          } else if (char === '/') {
            this.state = Tokenizer.SELF_CLOSING_START_TAG;
          } else if (char === '>') {
            this.state = Tokenizer.DATA;
            this.sink.process(this.currentTag);
          } else if (char === null) { // EOF
             // TODO: Parse error
             this.state = Tokenizer.DATA; // Will re-process EOF
             this.reconsume = true;
          } else {
            this.currentTag.name += char.toLowerCase();
          }
          break;
        
        case Tokenizer.BEFORE_ATTRIBUTE_NAME:
            if (/[\t\n\f ]/.test(char)) {
                // Ignore whitespace
            } else if (char === '/' || char === '>') {
                this.reconsume = true;
                this.state = Tokenizer.AFTER_ATTRIBUTE_NAME;
            } else if (char === '=') {
                // TODO: Parse error
                this.currentAttribute = { name: char, value: "" };
                this.state = Tokenizer.ATTRIBUTE_NAME;
            } else {
                this.currentAttribute = { name: "", value: "" };
                this.reconsume = true;
                this.state = Tokenizer.ATTRIBUTE_NAME;
            }
            break;

        case Tokenizer.ATTRIBUTE_NAME:
            if (/[\t\n\f />=]/.test(char) || char === null) {
                this.reconsume = true;
                this.state = Tokenizer.AFTER_ATTRIBUTE_NAME;
            } else if (char === '=') {
                this.state = Tokenizer.BEFORE_ATTRIBUTE_VALUE;
            } else {
                this.currentAttribute.name += char.toLowerCase();
            }
            break;

        case Tokenizer.AFTER_ATTRIBUTE_NAME:
            if (/[\t\n\f ]/.test(char)) {
                // Ignore
            } else if (char === '/') {
                this.commitAttribute();
                this.state = Tokenizer.SELF_CLOSING_START_TAG;
            } else if (char === '=') {
                this.state = Tokenizer.BEFORE_ATTRIBUTE_VALUE;
            } else if (char === '>') {
                this.commitAttribute();
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else {
                this.commitAttribute();
                this.currentAttribute = { name: "", value: "" };
                this.reconsume = true;
                this.state = Tokenizer.ATTRIBUTE_NAME;
            }
            break;

        case Tokenizer.BEFORE_ATTRIBUTE_VALUE:
            if (/[\t\n\f ]/.test(char)) {
                // Ignore
            } else if (char === '"') {
                this.state = Tokenizer.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
            } else if (char === "'") {
                this.state = Tokenizer.ATTRIBUTE_VALUE_SINGLE_QUOTED;
            } else if (char === '>') {
                // TODO: Parse error
                this.commitAttribute();
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else {
                this.reconsume = true;
                this.state = Tokenizer.ATTRIBUTE_VALUE_UNQUOTED;
            }
            break;

        case Tokenizer.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
            if (char === '"') {
                this.state = Tokenizer.AFTER_ATTRIBUTE_VALUE_QUOTED;
            } else if (char === '&') {
                // TODO: Character reference
                this.currentAttribute.value += char;
            } else if (char === null) {
                // TODO: Parse error
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentAttribute.value += char;
            }
            break;

        case Tokenizer.ATTRIBUTE_VALUE_SINGLE_QUOTED:
            if (char === "'") {
                this.state = Tokenizer.AFTER_ATTRIBUTE_VALUE_QUOTED;
            } else if (char === '&') {
                // TODO: Character reference
                this.currentAttribute.value += char;
            } else if (char === null) {
                // TODO: Parse error
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentAttribute.value += char;
            }
            break;

        case Tokenizer.ATTRIBUTE_VALUE_UNQUOTED:
            if (/[\t\n\f >]/.test(char)) {
                this.commitAttribute();
                this.reconsume = true;
                this.state = Tokenizer.BEFORE_ATTRIBUTE_NAME;
            } else if (char === '&') {
                // TODO: Character reference
                this.currentAttribute.value += char;
            } else if (char === null) {
                this.commitAttribute();
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentAttribute.value += char;
            }
            break;

        case Tokenizer.AFTER_ATTRIBUTE_VALUE_QUOTED:
            if (/[\t\n\f ]/.test(char)) {
                this.commitAttribute();
                this.state = Tokenizer.BEFORE_ATTRIBUTE_NAME;
            } else if (char === '/') {
                this.commitAttribute();
                this.state = Tokenizer.SELF_CLOSING_START_TAG;
            } else if (char === '>') {
                this.commitAttribute();
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else {
                // TODO: Parse error
                this.commitAttribute();
                this.reconsume = true;
                this.state = Tokenizer.BEFORE_ATTRIBUTE_NAME;
            }
            break;

        case Tokenizer.SELF_CLOSING_START_TAG:
          if (char === '>') {
            this.currentTag.selfClosing = true;
            this.state = Tokenizer.DATA;
            this.sink.process(this.currentTag);
          } else {
            // TODO: Parse error
            this.reconsume = true;
            this.state = Tokenizer.BEFORE_ATTRIBUTE_NAME;
          }
          break;

        case Tokenizer.MARKUP_DECLARATION_OPEN:
            if (char === '-' && this.peekNextChar() === '-') {
                this.pos++; // Consume second '-'
                this.currentComment = new CommentToken("");
                this.state = Tokenizer.COMMENT_START;
            } else if (this.buffer.substring(this.pos - 1, this.pos + 6).toUpperCase() === 'DOCTYPE') {
                 this.pos += 6; // Consume OCTYPE
                 this.state = Tokenizer.BEFORE_DOCTYPE_NAME;
                 this.currentDoctype = new Doctype();
            } else {
                this.state = Tokenizer.BOGUS_COMMENT;
                if (char === null) {
                    this.currentComment = new CommentToken("");
                    this.reconsume = true;
                } else {
                    this.currentComment = new CommentToken(char);
                }
            }
            break;

        case Tokenizer.BEFORE_DOCTYPE_NAME:
            if (/[\t\n\f ]/.test(char)) {
                // Ignore whitespace
            } else if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(new DoctypeToken(this.currentDoctype));
            } else if (char === null) {
                this.sink.process(new DoctypeToken(this.currentDoctype));
                this.sink.process(new EOFToken());
                return;
            } else {
                this.currentDoctype.name = char.toLowerCase();
                this.state = Tokenizer.DOCTYPE_NAME;
            }
            break;

        case Tokenizer.DOCTYPE_NAME:
            if (/[\t\n\f ]/.test(char)) {
                this.state = Tokenizer.AFTER_DOCTYPE_NAME;
            } else if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(new DoctypeToken(this.currentDoctype));
            } else if (char === null) {
                this.sink.process(new DoctypeToken(this.currentDoctype));
                this.sink.process(new EOFToken());
                return;
            } else {
                this.currentDoctype.name += char.toLowerCase();
            }
            break;

        case Tokenizer.AFTER_DOCTYPE_NAME:
            if (/[\t\n\f ]/.test(char)) {
                // Ignore
            } else if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(new DoctypeToken(this.currentDoctype));
            } else if (char === null) {
                this.sink.process(new DoctypeToken(this.currentDoctype));
                this.sink.process(new EOFToken());
                return;
            } else {
                // TODO: PUBLIC/SYSTEM identifiers
                // For now, just force quirks or ignore
                this.currentDoctype.forceQuirks = true;
                this.state = Tokenizer.BOGUS_DOCTYPE;
            }
            break;

        case Tokenizer.BOGUS_DOCTYPE:
            if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(new DoctypeToken(this.currentDoctype));
            } else if (char === null) {
                this.sink.process(new DoctypeToken(this.currentDoctype));
                this.sink.process(new EOFToken());
                return;
            }
            break;
        
        case Tokenizer.COMMENT_START:
            if (char === '-') {
                this.state = Tokenizer.COMMENT_START_DASH;
            } else if (char === '>') {
                // TODO: Parse error
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentComment);
            } else {
                this.currentComment.data += char;
                this.state = Tokenizer.COMMENT;
            }
            break;
        
        case Tokenizer.COMMENT_START_DASH:
            if (char === '-') {
                this.state = Tokenizer.COMMENT_END;
            } else if (char === '>') {
                // TODO: Parse error
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentComment);
            } else {
                this.currentComment.data += '-' + char;
                this.state = Tokenizer.COMMENT;
            }
            break;

        case Tokenizer.COMMENT:
            if (char === '<') {
                this.currentComment.data += char;
                // Check for bang? Spec is complex here.
            } else if (char === '-') {
                this.state = Tokenizer.COMMENT_END_DASH;
            } else if (char === null) {
                // TODO: Parse error
                this.sink.process(this.currentComment);
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentComment.data += char;
            }
            break;

        case Tokenizer.COMMENT_END_DASH:
            if (char === '-') {
                this.state = Tokenizer.COMMENT_END;
            } else {
                this.currentComment.data += '-' + char;
                this.state = Tokenizer.COMMENT;
            }
            break;

        case Tokenizer.COMMENT_END:
            if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentComment);
            } else if (char === '!') {
                this.state = Tokenizer.COMMENT_END_BANG;
            } else if (char === '-') {
                this.currentComment.data += '-';
            } else {
                this.currentComment.data += '--' + char;
                this.state = Tokenizer.COMMENT;
            }
            break;

        case Tokenizer.COMMENT_END_BANG:
            if (char === '-') {
                this.currentComment.data += '--!';
                this.state = Tokenizer.COMMENT_END_DASH;
            } else if (char === '>') {
                // TODO: Parse error
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentComment);
            } else {
                this.currentComment.data += '--!' + char;
                this.state = Tokenizer.COMMENT;
            }
            break;

        case Tokenizer.BOGUS_COMMENT:
            if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentComment);
            } else if (char === null) {
                this.sink.process(this.currentComment);
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentComment.data += char;
            }
            break;

        case Tokenizer.RCDATA:
            if (char === '&') {
                // TODO: Character reference
                this.sink.process(new CharacterToken(char));
            } else if (char === '<') {
                this.state = Tokenizer.RCDATA_LESS_THAN_SIGN;
            } else if (char === null) {
                this.sink.process(new EOFToken());
                return;
            } else {
                this.sink.process(new CharacterToken(char));
            }
            break;

        case Tokenizer.RCDATA_LESS_THAN_SIGN:
            if (char === '/') {
                this.state = Tokenizer.RCDATA_END_TAG_OPEN;
            } else {
                this.sink.process(new CharacterToken('<'));
                this.reconsume = true;
                this.state = Tokenizer.RCDATA;
            }
            break;

        case Tokenizer.RCDATA_END_TAG_OPEN:
            if (char !== null && /[a-zA-Z]/.test(char)) {
                this.currentTag = new Tag(Tag.END, char.toLowerCase());
                this.state = Tokenizer.RCDATA_END_TAG_NAME;
            } else {
                this.sink.process(new CharacterToken('<'));
                this.sink.process(new CharacterToken('/'));
                this.reconsume = true;
                this.state = Tokenizer.RCDATA;
            }
            break;

        case Tokenizer.RCDATA_END_TAG_NAME:
            if (/[\t\n\f ]/.test(char)) {
                // If appropriate end tag...
                // Simplified: just emit tag if it matches
                this.state = Tokenizer.DATA; // Should check if it matches current open element
                this.sink.process(this.currentTag);
            } else if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else if (char === null) {
                this.sink.process(new CharacterToken('<'));
                this.sink.process(new CharacterToken('/'));
                // TODO: emit tag name chars
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentTag.name += char.toLowerCase();
            }
            break;

        case Tokenizer.RAWTEXT:
            if (char === '<') {
                this.state = Tokenizer.RAWTEXT_LESS_THAN_SIGN;
            } else if (char === null) {
                this.sink.process(new EOFToken());
                return;
            } else {
                this.sink.process(new CharacterToken(char));
            }
            break;

        case Tokenizer.RAWTEXT_LESS_THAN_SIGN:
            if (char === '/') {
                this.state = Tokenizer.RAWTEXT_END_TAG_OPEN;
            } else {
                this.sink.process(new CharacterToken('<'));
                this.reconsume = true;
                this.state = Tokenizer.RAWTEXT;
            }
            break;

        case Tokenizer.RAWTEXT_END_TAG_OPEN:
            if (char !== null && /[a-zA-Z]/.test(char)) {
                this.currentTag = new Tag(Tag.END, char.toLowerCase());
                this.state = Tokenizer.RAWTEXT_END_TAG_NAME;
            } else {
                this.sink.process(new CharacterToken('<'));
                this.sink.process(new CharacterToken('/'));
                this.reconsume = true;
                this.state = Tokenizer.RAWTEXT;
            }
            break;

        case Tokenizer.RAWTEXT_END_TAG_NAME:
            if (/[\t\n\f ]/.test(char)) {
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else if (char === '>') {
                this.state = Tokenizer.DATA;
                this.sink.process(this.currentTag);
            } else if (char === null) {
                this.sink.process(new CharacterToken('<'));
                this.sink.process(new CharacterToken('/'));
                // TODO: emit tag name chars
                this.reconsume = true;
                this.state = Tokenizer.DATA;
            } else {
                this.currentTag.name += char.toLowerCase();
            }
            break;

        default:
          // Should not happen
          break;
      }
    }
  }
}

// States
Tokenizer.DATA = 0;
Tokenizer.TAG_OPEN = 1;
Tokenizer.END_TAG_OPEN = 2;
Tokenizer.TAG_NAME = 3;
Tokenizer.BEFORE_ATTRIBUTE_NAME = 4;
Tokenizer.ATTRIBUTE_NAME = 5;
Tokenizer.AFTER_ATTRIBUTE_NAME = 6;
Tokenizer.BEFORE_ATTRIBUTE_VALUE = 7;
Tokenizer.ATTRIBUTE_VALUE_DOUBLE_QUOTED = 8;
Tokenizer.ATTRIBUTE_VALUE_SINGLE_QUOTED = 9;
Tokenizer.ATTRIBUTE_VALUE_UNQUOTED = 10;
Tokenizer.AFTER_ATTRIBUTE_VALUE_QUOTED = 11;
Tokenizer.SELF_CLOSING_START_TAG = 12;
Tokenizer.MARKUP_DECLARATION_OPEN = 13;
Tokenizer.COMMENT_START = 14;
Tokenizer.COMMENT_START_DASH = 15;
Tokenizer.COMMENT = 16;
Tokenizer.COMMENT_END_DASH = 17;
Tokenizer.COMMENT_END = 18;
Tokenizer.COMMENT_END_BANG = 19;
Tokenizer.BOGUS_COMMENT = 20;
Tokenizer.RCDATA = 21;
Tokenizer.RCDATA_LESS_THAN_SIGN = 22;
Tokenizer.RCDATA_END_TAG_OPEN = 23;
Tokenizer.RCDATA_END_TAG_NAME = 24;
Tokenizer.RAWTEXT = 25;
Tokenizer.RAWTEXT_LESS_THAN_SIGN = 26;
Tokenizer.RAWTEXT_END_TAG_OPEN = 27;
Tokenizer.RAWTEXT_END_TAG_NAME = 28;
Tokenizer.BEFORE_DOCTYPE_NAME = 29;
Tokenizer.DOCTYPE_NAME = 30;
Tokenizer.AFTER_DOCTYPE_NAME = 31;
Tokenizer.BOGUS_DOCTYPE = 32;

module.exports = Tokenizer;
