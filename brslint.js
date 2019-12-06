'use strict'

const nearley = require("nearley")
const grammar = require("./brs")
const preprocessor = require("./preprocessor")

let warnings = [], globals = [], scoped = {}
const compiledGrammar = nearley.Grammar.fromCompiled(grammar)

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

function parseComments(ast) {
    for (const func of ast.functions) {
        parseDocuComment(func)
    }

    const trailingComments = ast.tokens[2][0]
    const results = [...ast.libs, ...ast.functions]
        .flatMap(a => a.comments)
        .concat(trailingComments || [])
        .filter(b => b.node === 'codeComment')
        .map(c => parseCodeComment(c))
    let types = new Map()
    let errors = []
    for (const result of results) {
        for (const type of result.ast || []) {
            types.set(type.name, type)
        }
        errors.push(...result.errors)
    }

    return { types: types, errors: errors }
}

function parseDocuComment(func) {
    let errors = []
    const docuComment = func.comments.filter(b => b.node === 'docuComment').pop()
    if (!docuComment) return

    const grammar = Object.assign(Object.create(Object.getPrototypeOf(compiledGrammar)), compiledGrammar, { start: "xparam" })
    const params = docuComment.text.match(/@param.*/gm)
    for (const param of params || []) {
        const parser = new nearley.Parser(grammar)
        try {
            parser.feed(param.replace(/@param\s*/, ''))
            let xparam = parser.results[0]
            let fparam = func.params.find(a => a.name == xparam.name)
            fparam.xtype = xparam
        } catch (error) {
            console.log(error)
        }
    }
}

function parseCodeComment(codeComment) {
    // crazy way to clone compiledGrammar 8O
    const grammar = Object.assign(Object.create(Object.getPrototypeOf(compiledGrammar)), compiledGrammar, { start: "xdeclaration" })
    let parser = new nearley.Parser(grammar)
    parser.feed(codeComment.text)

    if (parser.results.length > 1) {
        console.log('Ambiguity detected!', parser.results.length)
    } else if (parser.results.length == 0) {
        console.log('Unable to parse input')
        return { errors: [{level: 1, message: 'Unable to parse code comment', loc: codeComment.li.line }] }
    }

    return { ast: parser.results[0], errors: [] }
}

module.exports = {
    parse: function (input, options) {
        options = options || {}
        let errors = []
        try {
            if (options.preprocessor) {
                input = preprocessor(input, options.consts)
            }

            let parser = new nearley.Parser(compiledGrammar, { keepHistory: options.debug })
            parser.feed(input)

            if (parser.results.length > 1) {
                console.log('Ambiguity detected!', parser.results.length)
            } else if (parser.results.length == 0) {
                return { errors: [{ level:0, message: 'Unable to parse input', loc:'0'}]}
            }

            if (options.ast != null) {
                console.log(JSON.stringify(parser.results[0]))
            }

            const result = parseComments(parser.results[0])
            errors.push(...result.errors)

            return { ast: parser.results[0], types: result.types, errors: errors }
        }
        catch (x) {
            console.log(x)
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
