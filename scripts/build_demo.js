const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const OUT_DIR = path.join(__dirname, '../demo');
const OUT_FILE = path.join(OUT_DIR, 'rohan.bundle.js');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

const files = [
    'constants.js',
    'index.js',
    'node.js',
    'tokenizer.js',
    'tokens.js',
    'treebuilder.js'
];

const jsonFiles = [
    'entities.json'
];

let bundle = `(function(global) {
  const modules = {};
  
  function require(moduleId) {
    if (moduleId.startsWith('./')) {
      moduleId = moduleId.slice(2);
    }
    if (moduleId.endsWith('.js')) {
      moduleId = moduleId.slice(0, -3);
    }
    if (moduleId.endsWith('.json')) {
        // keep .json extension for json files if that's how they are keyed
    }
    
    if (!modules[moduleId]) {
      throw new Error('Module ' + moduleId + ' not found');
    }
    
    const module = { exports: {} };
    modules[moduleId](module, module.exports, require);
    return module.exports;
  }
`;

// Add JS files
files.forEach(file => {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const moduleName = file.replace('.js', '');
    
    bundle += `
  modules['${moduleName}'] = function(module, exports, require) {
${content}
  };
`;
});

// Add JSON files
jsonFiles.forEach(file => {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // The require call in tokenizer.js is require('./entities.json')
    // My simple require implementation above strips ./ but keeps .json if present?
    // Actually tokenizer.js does: const entities = require('./entities.json');
    // So moduleId will be 'entities.json' after stripping './'
    
    bundle += `
  modules['${file}'] = function(module, exports, require) {
    module.exports = ${content};
  };
`;
});

// Expose main module
bundle += `
  global.JustHTML = require('index');
})(typeof window !== 'undefined' ? window : this);
`;

fs.writeFileSync(OUT_FILE, bundle);
console.log(`Bundle created at ${OUT_FILE}`);
