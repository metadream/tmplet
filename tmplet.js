const { readFileSync } = require("fs");
const { resolve } = require("path");

/**
 * Tmplet: A compact, high-performance and full-featured template engine
 * Licensed under the MIT license.
 * @Reference https://github.com/olado/doT
 * @Reference https://github.com/ushelp/EasyTemplateJS
 */

// Template syntax
const syntax = {
  PARTIAL: /\{\{@\s*(\S+?)\s*\}\}/g,
  BLOCK_HOLDER: /\{\{>\s*(\S+?)\s*\}\}/g,
  BLOCK_DEFINE: /\{\{<\s*(\S+?)\s*\}\}([\s\S]*?)\{\{<\s*\}\}/g,
  EVALUATE: /\{\{([\s\S]+?(\}?)+)\}\}/g,
  INTERPOLATE: /\{\{=([\s\S]+?)\}\}/g,
  CONDITIONAL: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
  ITERATIVE: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
}

// Variable patterns
const variable = {
  REMOVE: /\/\*[\w\W]*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|"(?:[^"\\]|\\[\w\W])*"|'(?:[^'\\]|\\[\w\W])*'|\s*\.\s*[$\w\.]+/g,
  SPLIT: /[^\w$]+/g,
  KEYWORDS: /\b(await|async|then|break|case|catch|continue|debugger|default|delete|do|else|false|finally|for|of|function|if|in|instanceof|new|null|return|switch|this|throw|true|try|typeof|var|void|while|with|abstract|boolean|byte|char|class|const|double|enum|export|extends|final|float|goto|implements|import|int|interface|long|native|package|private|protected|public|short|static|super|synchronized|throws|transient|volatile|arguments|let|yield|undefined)\b/g,
  NUMBER: /^\d[^,]*|,\d[^,]*/g,
  BOUNDARY: /^,+|,+$/g,
  SPLIT2: /^$|,+/
}

// Template engine options
const options = {
  compress: true,
  root: "",
  imports: {}
}

// Cache template file and compiled function
const compiledCache = {};

/**
 * Initialize custom options
 * @param {object} _options
 */
function init(_options) {
  Object.assign(options, _options);
}

/**
 * Compile the template to a function
 * @param {string} tmpl
 * @returns {Function}
 */
function compile(tmpl) {
  tmpl = block(tmpl);
  tmpl = options.compress ? compress(tmpl) : tmpl;
  tmpl = unescape(tmpl)
    .replace(syntax.INTERPOLATE, (_, code) => `'+(${code}===undefined?'':${code})+'`)
    .replace(syntax.CONDITIONAL, (_, elseCase, code) => code ?
      output(elseCase ? `}else if(${code}){` : `if(${code}){`) :
      output(elseCase ? "}else{" : "}")
    )
    .replace(syntax.ITERATIVE, (_, arr, vName, iName) => {
      if (!arr) return output("}}");
      const defI = iName ? `let ${iName}=-1;` : "";
      const incI = iName ? `${iName}++;` : "";
      return output(`if(${arr}){${defI}for (let ${vName} of ${arr}){${incI}`);
    })
    .replace(syntax.EVALUATE, (_, code) => `${output(code)}`);

  let source = ("let out='" + tmpl + "';return out;");
  source = declare(source) + source;

  try {
    const fn = new Function("data", source);
    return data => {
      data = Object.assign({ ...options.imports }, data);
      return fn.call(null, data);
    };
  } catch (e) {
    e.source = "function anonymous(data) {" + source + "}";
    throw e;
  }
}

/**
 * Render the template text with data
 * @param {string} tmpl
 * @param {object} data
 * @returns {string}
 */
function render(tmpl, data) {
  return compile(tmpl)(data);
}

/**
 * Render the template file with cache
 * @param {string} file
 * @param {object} data
 * @returns
 */
function view(file, data) {
  let render = compiledCache[file];
  if (!render) {
    render = compiledCache[file] = compile(include(file));
  }
  return render(data);
}

/**
 * Load template file recursively
 * @param {string} file
 * @returns
 */
function include(file) {
  let tmpl = readFileSync(resolve(options.root, file), "utf-8");
  while (syntax.PARTIAL.test(tmpl)) {
    tmpl = tmpl.replace(syntax.PARTIAL, (_, _file) => {
      return readFileSync(resolve(options, _file), "utf-8");
    });
  }
  return tmpl;
}

/**
 * Replace block holders with block defines
 * @param {string} tmpl
 * @returns
 */
function block(tmpl) {
  const blocks = {};
  return tmpl
    .replace(syntax.BLOCK_DEFINE, (_, name, block) => { blocks[name] = block; return ""; })
    .replace(syntax.BLOCK_HOLDER, (_, name) => blocks[name] || "");
}

/**
 * Parse variables as declares in function body header
 * @param {string} source
 * @returns {string}
 */
function declare(source) {
  const varNames = source
    .replace(variable.REMOVE, '')
    .replace(variable.SPLIT, ',')
    .replace(variable.KEYWORDS, '')
    .replace(variable.NUMBER, '')
    .replace(variable.BOUNDARY, '')
    .split(variable.SPLIT2);

  const unique = {};
  const prefixVars = [];
  for (const name of varNames) {
    if (name != "out" && !unique[name]) {
      unique[name] = true;
      prefixVars.push(name);
    }
  }

  if (prefixVars.length) {
    const varString = prefixVars.map(v => v + "=data." + v).join(",");
    return "let " + varString + ";";
  }
  return "";
}

/**
 * Strip breaks, tabs and comments
 * @param {string} tmpl
 * @returns {string}
 */
function compress(tmpl) {
  return tmpl.trim()
    .replace(/<!--[\s\S]*?-->/g, "") // remove html comments
    .replace(/\n\s*\/\/.*/g, "") // remove js comments inline
    .replace(/[\t ]+(\r|\n)/g, "\n") // remove trailing spaces
    .replace(/(\r|\n)[\t ]+/g, "") // remove leading spaces
    .replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g, "") // remove breaks, tabs and js comments
}

function unescape(text) {
  return text.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
}

function output(code) {
  return `';${code}out+='`;
}

module.exports = { init, compile, render, view };
