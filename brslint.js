'use strict'

const nearley = require("nearley")
const grammar = require("./brs")
const preprocessor = require("./preprocessor")

let errors = [], warnings = [], globals = []

function traverse(node, callback, ctx) {
    if (!node) return

    let cx = callback(node, ctx) || ctx

    for (const key in node) {
        if (node.hasOwnProperty(key)) {
            const prop = node[key];
            if (Array.isArray(prop)) {
                for (const el of prop) {
                    traverse(el, callback, cx)
                }
            } else if (typeof(prop) === 'object') {
                traverse(prop, callback, cx)
            }
        }
    }
}

function unassignedVar(node, vars) {

    if (node.node === 'function' || node.node === 'sub') {
        return [ 'm', 'true', 'false' ]
    }
    if (node.node == 'param') {
        vars.push(node.name.toLowerCase())
    }
    if (node.node == '=' && node.lval) {
        if (!node.lval.accessors) {
            vars.push(node.lval.val.toLowerCase())
        }
    }
    if (node.node == 'dim') {
        vars.push(node.name.val.toLowerCase())
    }
    if (node.node == 'foreach') {
        vars.push(node.var.val.toLowerCase())
    }
    if (node.node == 'for') {
        vars.push(node.var.val.toLowerCase())
    }
    if (node.node == 'id' && (node.accessors == null || node.accessors[0].node != 'call')) {
        if (vars.indexOf(node.val.toLowerCase()) < 0 && globals.indexOf(node.val) < 0) {
            warnings.push({ msg: 'Undefined variable \'' + node.val + '\'', loc: node.li.line+','+node.li.col, s: 1 })
            return
        }
    }
}

let parser
module.exports = {
    parse: function (input, options) {
        options = options || {}
        errors = []
        try {
            if (options.preprocessor) {
                input = preprocessor(input, options.consts)
            }

            parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar),{ keepHistory: options.debug })
            parser.feed(input)

            if (parser.results.length > 1) {
                console.log('Ambiguity detected!', parser.results.length)
            }

            if (options.ast != null) {
                console.log(JSON.stringify(parser.results[0]))
            }
        }
        catch (x) {
            errors.push(x.message)
            return { success: false, errors: errors }
        }

        return { success: true, ast: parser.results[0], errors: errors }
    },
    style: function (f, g) {
        warnings = []
        globals = g
        traverse(f, unassignedVar)
        return warnings
    },
}

