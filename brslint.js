'use strict'

const nearley = require("nearley")
const grammar = require("./brs")
const preprocessor = require("./preprocessor")

let warnings = [], globals = [], scoped = {}

function traverse(node, callback, ctx) {
    if (!node) return

    let cx = callback(node, ctx) || ctx

    for (const key in node) {
        if (key != 'tokens' && node.hasOwnProperty(key)) {
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

function traverseRule(node, rule, warnings) {
    if (!node) return

    if (!rule.node || node.node === rule.node) {
        let warn = rule.check(node)
        if (warn) {
            if (Array.isArray(warn)) {
                warnings.push(...warn)
            } else {
                warnings.push(warn)
            }
        } 
    }

    for (const key in node) {
        if (node.hasOwnProperty(key)) {
            const prop = node[key];
            if (Array.isArray(prop)) {
                for (const el of prop) {
                    traverseRule(el, rule, warnings)
                }
            } else if (typeof(prop) === 'object') {
                traverseRule(prop, rule, warnings)
            }
        }
    }
}

function unassignedVar(node, vars) {
    const defineVar = (name, node) => {
        const lookupName = name.toLowerCase()
        // User defined functions collide with local variables, global functions do not
        if (scoped.has(lookupName)) {
            const token = node.token || node.tokens[0]
            warnings.push({ message: 'Name `' + name + '` is used by function in ' + scoped.get(lookupName).file, loc: token.line+','+token.col, level: 1 })
        }
        vars.push(lookupName)
    }

    if (node.node === 'function' || node.node === 'sub') {
        return [ 'm', 'true', 'false' ]
    }
    if (node.node == 'param') {
        defineVar(node.name, node)
    }
    if (node.node == '=' && node.lval) {
        if (!node.lval.accessors) {
            defineVar(node.lval.val, node.lval)
        }
    }
    if (node.node == 'dim') {
        defineVar(node.name.val, node.name)
    }
    if (node.node == 'foreach') {
        defineVar(node.var.val, node.var)
    }
    if (node.node == 'for') {
        defineVar(node.var.val, node.var)
    }
    if (node.node == 'id') {
        const lookupName = node.val.toLowerCase()
        if (vars.indexOf(lookupName) < 0 && !globals.has(lookupName) && !scoped.has(lookupName)) {
            if (node.accessors && node.accessors[0].node == 'call') {
                warnings.push({ message: 'Undefined function \'' + node.val + '\'', loc: node.li.line+','+node.li.col, level: 1 })
            } else {
                warnings.push({ message: 'Undefined variable \'' + node.val + '\'', loc: node.li.line+','+node.li.col, level: 1 })
            }
        }
    }
}

module.exports = {
    parse: function (input, options) {
        options = options || {}
        let errors = []
        try {
            if (options.preprocessor) {
                input = preprocessor(input, options.consts)
            }

            let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar),{ keepHistory: options.debug })
            parser.feed(input)

            if (parser.results.length > 1) {
                console.log('Ambiguity detected!', parser.results.length)
            }

            if (options.ast != null) {
                console.log(JSON.stringify(parser.results[0]))
            }

            return { ast: parser.results[0], errors: errors }
        }
        catch (x) {
            const regex = / at line (\d+) col (\d+):\n\n\s*/i
            let loc = x.token.line + ',' + x.token.col
            let message = x.message.replace(regex, ': `')
            message = message.replace(/\n\s*\^\n/, '`. ').replace(/\n/, '')
            errors.push({ level: 0, message: message, loc: loc})
            return { errors: errors }
        }
    },

    check: function (ast, scopedFunctions, globalFunctions) {
        warnings = []
        globals = globalFunctions
        scoped = scopedFunctions
        traverse(ast, unassignedVar)
        return warnings
    },

    lint: (ast, rules) => {
        let warnings = []
        for (let rule of rules) {
            traverseRule(ast, rule, warnings)
        }
        return warnings
    }
}
