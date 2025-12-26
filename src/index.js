const Node = require('./node');
const Tokenizer = require('./tokenizer');
const TreeBuilder = require('./treebuilder');

class JustHTML {
  constructor(html = null, options = {}) {
    this.options = options;
    this.tokenizer = new Tokenizer(null, this.options);
    this.treeBuilder = new TreeBuilder(this.tokenizer, this.options);
    this.tokenizer.sink = this.treeBuilder; // Connect tokenizer to tree builder
    this.root = this.treeBuilder.document;

    if (html !== null) {
        this.tokenizer.initialize(html);
        this.tokenizer.end();
    }
  }

  write(chunk) {
      this.tokenizer.write(chunk);
  }

  end() {
      this.tokenizer.end();
  }
}

module.exports = JustHTML;
