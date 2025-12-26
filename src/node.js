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
    // Basic implementation for the prototype
    if (this.type === '#text') return this.text;
    if (this.type === '#document') {
        return this.children.map(c => c.toHtml(options)).join('');
    }
    
    let html = `<${this.name}`;
    for (const [key, value] of Object.entries(this.attrs)) {
        html += ` ${key}="${value}"`;
    }
    html += '>';
    
    for (const child of this.children) {
        html += child.toHtml(options);
    }
    
    html += `</${this.name}>`;
    return html;
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
