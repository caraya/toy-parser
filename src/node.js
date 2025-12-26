const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

class Node {
  constructor(name, type) {
    this.name = name;
    this.type = type; // '#document', '#text', '#comment', '#element'
    this.attrs = {};
    this.children = [];
    this.parent = null;
    this.text = "";
  }

  appendChild(node) {
    node.parent = this;
    this.children.push(node);
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index !== -1) {
      this.children.splice(index, 1);
      node.parent = null;
    }
  }

  toHtml(options = { indent: 2 }) {
    if (this.type === '#text') return this.text; // TODO: Escape text?
    if (this.type === '#comment') return `<!--${this.text}-->`;
    if (this.type === '#doctype') return `<!DOCTYPE ${this.name}>`;
    if (this.type === '#document') {
        return this.children.map(c => c.toHtml(options)).join('');
    }
    
    let html = `<${this.name}`;
    for (const [key, value] of Object.entries(this.attrs)) {
        // TODO: Escape attribute values
        html += ` ${key}="${value}"`;
    }
    html += '>';
    
    if (VOID_TAGS.has(this.name)) {
        return html;
    }
    
    for (const child of this.children) {
        html += child.toHtml(options);
    }
    
    html += `</${this.name}>`;
    return html;
  }

  toText() {
    if (this.type === '#text') return this.text;
    if (this.type === '#comment' || this.type === '#doctype') return '';
    // Skip script and style content for text extraction usually
    if (this.name === 'script' || this.name === 'style') return '';
    if (this.name === 'br') return '\n';
    
    let text = this.children.map(c => c.toText()).join('');
    
    const BLOCK_TAGS = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'tr', 'blockquote', 'pre']);
    if (BLOCK_TAGS.has(this.name)) {
        return text + '\n';
    }
    return text;
  }

  toMarkdown() {
      // Basic implementation
      if (this.type === '#text') return this.text;
      if (this.type === '#document') return this.children.map(c => c.toMarkdown()).join('');
      if (this.type !== '#element') return '';

      let content = this.children.map(c => c.toMarkdown()).join('');

      switch (this.name) {
          case 'h1': return `# ${content}\n\n`;
          case 'h2': return `## ${content}\n\n`;
          case 'h3': return `### ${content}\n\n`;
          case 'p': return `${content}\n\n`;
          case 'b':
          case 'strong': return `**${content}**`;
          case 'i':
          case 'em': return `*${content}*`;
          case 'a': return `[${content}](${this.attrs.href || ''})`;
          case 'ul': return this.children.map(c => c.name === 'li' ? `* ${c.toMarkdown().trim()}\n` : '').join('') + '\n';
          case 'ol': return this.children.map((c, i) => c.name === 'li' ? `${i+1}. ${c.toMarkdown().trim()}\n` : '').join('') + '\n';
          case 'li': return content; // Handled by parent
          case 'br': return '\n';
          case 'hr': return '---\n\n';
          case 'code': return `\`${content}\``;
          case 'pre': return `\`\`\`\n${content}\n\`\`\`\n\n`;
          default: return content;
      }
  }

  query(selector) {
      // Very basic selector engine
      // Supports: tag, #id, .class
      if (this._matches(selector)) return this;
      for (const child of this.children) {
          const found = child.query(selector);
          if (found) return found;
      }
      return null;
  }

  queryAll(selector) {
      let results = [];
      if (this._matches(selector)) results.push(this);
      for (const child of this.children) {
          results = results.concat(child.queryAll(selector));
      }
      return results;
  }

  _matches(selector) {
      if (this.type !== '#element') return false;
      
      if (selector.startsWith('#')) {
          return this.attrs.id === selector.slice(1);
      }
      if (selector.startsWith('.')) {
          const className = selector.slice(1);
          return this.attrs.class && this.attrs.class.split(/\s+/).includes(className);
      }
      return this.name === selector;
  }

  toTestFormat(indent = 0) {
    let output = "";
    // html5lib test format uses "| " followed by 2 spaces per indent level
    const prefix = "| " + "  ".repeat(indent);

    if (this.type === '#document') {
        for (const child of this.children) {
            output += child.toTestFormat(indent);
        }
        return output;
    }

    if (this.type === '#text') {
        return `${prefix}"${this.text}"\n`;
    }

    if (this.type === '#comment') {
        return `${prefix}<!-- ${this.text} -->\n`;
    }

    if (this.type === '#doctype') {
        // TODO: Handle public/system IDs if we store them
        return `${prefix}<!DOCTYPE ${this.name}>\n`;
    }

    if (this.type === '#element') {
        output += `${prefix}<${this.name}>\n`;
        
        // Attributes
        const sortedKeys = Object.keys(this.attrs).sort();
        for (const key of sortedKeys) {
            output += `${prefix}  ${key}="${this.attrs[key]}"\n`;
        }

        for (const child of this.children) {
            output += child.toTestFormat(indent + 1);
        }
        return output;
    }

    return "";
  }
}

module.exports = Node;
