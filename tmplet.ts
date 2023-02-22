// deno-lint-ignore-file no-explicit-any
import { resolve } from "https://deno.land/std@0.177.0/path/mod.ts";

/**
 * Tmplet: A compact, high-performance and full-featured template engine
 * Licensed under the MIT license.
 * @link https://github.com/metadream/tmplet
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
    KEYWORDS: /\b(abstract|arguments|async|await|boolean|break|byte|case|catch|char|class|const|continue|debugger|default|delete|do|double|else|enum|eval|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|let|long|native|new|null|of|package|private|protected|public|return|short|static|super|switch|synchronized|then|this|throw|throws|transient|true|try|typeof|undefined|var|void|volatile|while|with|yield|parseInt|parseFloat|decodeURI|decodeURIComponent|encodeURI|encodeURIComponent|isFinite|isNaN|Array|ArrayBuffer|Object|Function|Math|Date|Boolean|String|RegExp|Map|Set|JSON|Promise|Reflect|Number|BigInt|Infinity|Error|NaN)\b/g,
    NUMBER: /^\d[^,]*|,\d[^,]*/g,
    BOUNDARY: /^,+|,+$/g,
    SPLIT2: /^$|,+/
}

interface Map {
    [key: string]: any;
}

interface Options {
    root: string;
    imports: any;
}

// Template engine options
const options: Options = {
    root: "",
    imports: {}
}

// Cache template file and compiled function
const compiledCache: Map = {};

/**
 * Initialize custom options
 * @param {object} _options
 */
function init(_options: Options) {
    Object.assign(options, _options);
}

/**
 * Compile the template to a function
 * @param {string} tmpl
 * @returns {Function}
 */
function compile(tmpl: string) {
    const codes: string[] = [];
    tmpl = block(tmpl);
    tmpl = escape(reduce(tmpl))
        .replace(syntax.INTERPOLATE, (_: string, code: string) => {
            code = unescape(code);
            codes.push(code);
            return "'+(" + code + ")+'";
        })
        .replace(syntax.CONDITIONAL, (_: string, elseCase: string, code: string) => {
            if (!code) return output(elseCase ? "}else{" : "}");
            code = unescape(code);
            codes.push(code);
            return output(elseCase ? "}else if(" + code + "){" : "if(" + code + "){");
        })
        .replace(syntax.ITERATIVE, (_: string, arrName: string, valName: string, idxName: string) => {
            if (!arrName) return output("}}");
            codes.push(arrName);
            const defI = idxName ? "let " + idxName + "=-1;" : "";
            const incI = idxName ? idxName + "++;" : "";
            return output("if(" + arrName + "){" + defI + "for (let " + valName + " of " + arrName + "){" + incI + "");
        })
        .replace(syntax.EVALUATE, (_: string, code: string) => {
            code = unescape(code);
            codes.push(code);
            return output(code + ";");
        });

    let source = ("let out='" + tmpl + "';return out;");
    source = declare(codes) + source;

    try {
        const fn = new Function("data", source);
        return (data: any) => {
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
function render(tmpl: string, data: any) {
    return compile(tmpl)(data);
}

/**
 * Render the template file with cache
 * @param {string} file
 * @param {object} data
 * @returns
 */
async function view(file: string, data: any) {
    let render = compiledCache[file];
    if (!render) {
        render = compiledCache[file] = compile(await include(file));
    }
    return render(data);
}

/**
 * Load template file recursively
 * @param {string} file
 * @returns
 */
async function include(file: string) {
    let tmpl = await Deno.readTextFile(resolve(options.root, file));
    const replacement: any = async (_: string, _file: string) => {
        return await Deno.readTextFile(resolve(options.root, _file));
    }
    while (syntax.PARTIAL.test(tmpl)) {
        tmpl = tmpl.replace(syntax.PARTIAL, replacement);
    }
    return tmpl;
}

/**
 * Replace block holders with block defines
 * @param {string} tmpl
 * @returns
 */
function block(tmpl: string) {
    const blocks: Map = {};
    return tmpl
        .replace(syntax.BLOCK_DEFINE, (_, name: string, block) => { blocks[name] = block; return ""; })
        .replace(syntax.BLOCK_HOLDER, (_, name: string) => blocks[name] || "");
}

/**
 * Parse variables as declares in function body header
 * @param {Array} codes
 * @returns {string}
 */
function declare(codes: string[]) {
    const varNames = codes.join(',')
        .replace(variable.REMOVE, '')
        .replace(variable.SPLIT, ',')
        .replace(variable.KEYWORDS, '')
        .replace(variable.NUMBER, '')
        .replace(variable.BOUNDARY, '')
        .split(variable.SPLIT2);

    const unique: Map = {};
    const prefixVars = [];
    for (const name of varNames) {
        if (!unique[name]) {
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
 * Reduce template text
 * @param {string} tmpl
 * @returns {string}
 */
function reduce(tmpl: string) {
    return tmpl.trim()
        .replace(/<!--[\s\S]*?-->/g, "") // remove html comments
        .replace(/\/\*[\s\S]*?\*\//g, "") // remove js comments in multiline
        .replace(/\n\s*\/\/.*/g, "") // remove js comments inline
        .replace(/(\r|\n)[\t ]+/g, "") // remove leading spaces
        .replace(/[\t ]+(\r|\n)/g, "") // remove trailing spaces
        .replace(/\r|\n|\t/g, "") // remove breaks and tabs
}

/**
 * Escape backslash and single quotes
 * @param {string} tmpl
 * @returns {string}
 */
function escape(tmpl: string) {
    return tmpl.replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
}

/**
 * Unescape single quotes
 * @param {string} tmpl
 * @returns {string}
 */
function unescape(tmpl: string) {
    return tmpl.replace(/\\'/g, '\'');
}

function output(code: string) {
    return "';" + code + "out+='";
}

export { init, compile, render, view };