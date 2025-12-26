class Tag {
  constructor(kind, name, attrs = {}, selfClosing = false) {
    this.kind = kind;
    this.name = name;
    this.attrs = attrs;
    this.selfClosing = selfClosing;
  }
}

Tag.START = 0;
Tag.END = 1;

class CharacterToken {
  constructor(data) {
    this.data = data;
  }
}

class CommentToken {
  constructor(data) {
    this.data = data;
  }
}

class Doctype {
  constructor(name = null, publicId = null, systemId = null, forceQuirks = false) {
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
    this.forceQuirks = forceQuirks;
  }
}

class DoctypeToken {
  constructor(doctype) {
    this.doctype = doctype;
  }
}

class EOFToken {}

module.exports = {
  Tag,
  CharacterToken,
  CommentToken,
  Doctype,
  DoctypeToken,
  EOFToken
};
