const JustHTML = require('../src/index');
const assert = require('assert');

const html = "Line1<br>Line2";
const parser = new JustHTML(html);
console.log(parser.root.toTestFormat());
