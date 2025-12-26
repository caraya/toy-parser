const Node = require('./node');
const Tokenizer = require('./tokenizer');
const TreeBuilder = require('./treebuilder');

class JustHTML {
  constructor(html, options = {}) {
    this.html = html;
    this.options = options;
    this._parse();
  }

  _parse() {
    const tokenizer = new Tokenizer(null, this.options);
    const treeBuilder = new TreeBuilder(tokenizer, this.options);
    tokenizer.sink = treeBuilder; // Connect tokenizer to tree builder
    
    tokenizer.initialize(this.html);
    tokenizer.run();
    
    this.root = treeBuilder.document;
  }
}

module.exports = JustHTML;
