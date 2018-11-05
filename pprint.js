'use strict'

let dpth = 0
let tab = 4
let NL = '\n'

function indent() {
    return '\n' + ' '.repeat(dpth * tab)
}
function space() {
    return ' '.repeat(dpth * tab)
}

function fmt(a, f, sep, post, pre) {
    if (!a) return ''
    sep = sep || ''
    post = post || ''
    pre = pre || ''
    return pre + a.map(e=>f(e)).join(sep) + post
}

function top(n) {
    let out = fmt(n.libs, lib, indent(), NL, space())
    out += fmt(n.functions, fn, NL+indent(), NL)
    return out
}

function lib(n) {
    return `Library ${n.name}`
}

function fn(n) {
    let r = `function ${n.name}(${fmt(n.params, param, ', ')})`
    if (n.return) r += ` as ${n.return}`
    dpth += 1
    r += fmt(n.statements, statement, indent(), '', indent())
    dpth -= 1
    return r += indent() + 'end function'
}

function param(n) {
    let out = n.name
    if (n.default) out += ` = ${exp(n.default)}`
    if (n.type) out += ` as ${n.type}`
    return out
}

function statement(n) {
    switch (n.node) {
    case '=':
        return assign(n)
    case '++':
        return exp(n.lval) + '++'
    case '--':
        return exp(n.lval) + '--'
    case 'assignop':
        return assign(n)
    case 'dim':
        return dim(n)
    case 'id':
        return exp(n)
    case 'return':
        return stret(n)
    case 'if':
        return stif(n)
    case 'for':
        return forloop(n)
    case 'foreach':
        return foreach(n)
    case 'while':
        return whileloop(n)
    case 'exitfor':
        return 'exit for'
    case 'exitwhile':
        return 'exit while'
    case 'stop':
        return 'stop'
    case 'end':
        return 'end'
    case 'print':
        return print(n)
    }
}

function assign(n) {
    return `${exp(n.lval)} ${n.op} ${exp(n.rval)}`
}

function stret(n) {
    return 'return' + (n.val ? ' ' + exp(n.val) : '')
}

function exp_access(n) {
    if (n.expr.left || n.expr.right) {
        return `(${exp(n.expr)})${fmt(n.accessors, access)}`
    }
    return exp(n.expr) + fmt(n.accessors, access)
}

function stif(n, noif) {
    let r = `if ${exp(n.condition)} then`
    dpth += 1
    r += fmt(n.then, statement, indent(), '', indent())
    dpth -= 1
    if (n.else) {
        if (n.else[0].node == 'if' && n.else.length == 1) {
            r += indent() + 'else '
            r += stif(n.else[0])
        }
        else {
            r += indent() + 'else'
            dpth += 1
            r += fmt(n.else, statement, indent(), '', indent())
            dpth -= 1
            r += indent() + 'end if'
        }
    } else {
        r += indent() + 'end if'
    }
    
    return r
}

function forloop(n) {
    var r = 'for ' + n.var.val + ' = ' + exp(n.start) + ' to ' + exp(n.to) + (n.step ? ' step ' + exp(n.step) : '')
    dpth += 1
    r += fmt(n.statements, statement, indent(), '', indent())
    dpth -= 1
    return r + indent() + 'end for'
}

function foreach(n) {
    var r = 'for each ' + n.var.val + ' in ' + exp(n.in)
    dpth += 1
    r += fmt(n.statements, statement, indent(), '', indent())
    dpth -= 1
    return r + indent() + 'end for'
}

function whileloop(n) {
    var r = 'while ' + exp(n.condition)
    dpth += 1
    r += fmt(n.statements, statement, indent(), '', indent())
    dpth -= 1
    return r + indent() + 'end while'
}

function print(n) {
    var r = 'print '
    let a = fmt(n.items, e => {
        if (e.node == 'separator')
            return e.val
        else 
            return exp(e)
    })
    return r + a
}

function dim(n) {
    return 'dim ' + n.name.val + '[' + fmt(n.dimentions, exp, ', ') + ']'
}

function exp(e, nextop, right) {
    nextop = nextop || { p: 0, right: false }
    right = right || false
    if (e.node == 'id')
        return e.val + fmt(e.accessors, access)
    if (e.node == 'access')
        return exp_access(e)
    if (e.node == 'const' || e.node == 'string' || e.node == 'number')
        return e.val
    if (e.node == 'bop') {
        let op = bop[e.op]
        let x = `${exp(e.left, op)} ${e.op} ${exp(e.right, op, true)}`
        let parentheses = nextop.p > op.p || (nextop.p === op.p && right != op.a)
        return parentheses ? '(' + x + ')' : x
    }
    if (e.node == 'uop') {
        let op = uop[e.op]
        return e.op + (op.sp?' ':'') + exp(e.right, op)
    }
    if (e.node == 'object') {
        let t = obj_init_1l(e)
        if (t.length < 37)
            return t
        else
            return obj_init(e)
    }
    if (e.node == 'array') {
        if (e.values.length < 3)
            return '[' + fmt(e.values, exp, ', ') + ']'
        else
            return array_init(e)
    }
    if (e.node == 'function' || e.node == 'sub')
        return fn(e)
}

function access(n) {
    switch (n.node) {
    case 'prop':
        return `.${n.name}`
    case 'index':
        return `[${fmt(n.indexes, exp, ', ')}]`
    case 'call':
        return `(${fmt(n.args, exp, ', ')})`
    case 'xmlattr':
        return `@${n.name.val}`
    }
}

// precedence, and right assosiativity
const bop = {
    'or' :  { p: 1, a: false },
    'and' : { p: 2, a: false },
    '=':    { p: 4, a: false }, '<>': { p: 4, a: false }, '<': { p: 4, a: false },
    '>':    { p: 4, a: false }, '<=': { p: 4, a: false }, '>=': { p: 4, a: false },
    '>>':   { p: 5, a: false }, '<<': { p: 5, a: false },
    '+':    { p: 6, a: false }, '-': { p: 6, a: false },
    '*':    { p: 7, a: false }, '/': { p: 7, a: false }, '\\': { p: 7, a: false }, 'mod': { p: 7, a: false },
    '^':    { p: 8, a: true },
    '.':    { p: 10, a: false }
}
const uop = {
    'not' : { p: 3, a: true, sp: true },
    '-': { p: 9, a: true, sp: false }
}

function array_init(a) {
    let r = '['
    dpth += 1
    r += fmt(a.values, exp, indent())
    dpth -= 1
    return r + indent() + ']'
}

function obj_init(o) {
    let r = '{'
    dpth += 1
    r += fmt(o.properties, e => `${e.name}: ${exp(e.value)}`, indent())
    dpth -= 1
    r += indent() + '}'
    return r
}
function obj_init_1l(o) {
    return fmt(o.properties, e => `${e.name}: ${exp(e.value)}`, ', ', ' }', '{ ')
}

module.exports = {
    print: f => {
        console.log(fn(f))
    },

    pretty: f => top(f) + '\n\n'
}
