function program(t) {
    return {
        libs:       t[0],
        functions:  t[1],
        tokens: xtok(t)
    }
}

function libs(t) {
    t[1].comments = t[0].filter(a => a.node)
    let libs = t[2].map(lib => {
        lib[1].comments = lib[0].filter(a => a.node)
        return lib[1]
    })
    return [t[1]].concat(libs)
}

function lib(t) {
    return {
        node: t[0].value,
        name: t[2].val
    }
}

function functions(t) {
    return t[0].map(f => {
        f[1].comments = (f[0] || []).filter(a => a.node)
        return f[1]
    })
}

function func(t) {
    const ret = t[7]? t[7][3].value : null
    const statements = t[8].statements

    return {
        node: t[0].value,
        name: t[2].val,
        params: t[5].params,
        return: ret,
        statements: statements,

        tokens: xtok(t)
    }
}

function afunc(t) {
    const ret = t[5]? t[5][3].value : null
    const statements = t[6]

    return {
        node: t[0].value,
        name: '',
        params: t[3].params,
        return: ret,
        statements: statements,

        tokens: xtok(t)
    }
}

function params(t) {
    if (t.length == 1) return {node: 'params', params:[], token: t[0]}
    let p = [t[1], ...t[2].map(e => e[3])]
    return {
        node: 'params',
        params: p,
        tokens: xtok(t)
    }
}

function param(t) {
    return {
        node: 'param',
        name: t[0].val,
        type: t[2] ? t[2][3].value : null,
        default: t[1]? t[1][3] : null,

        tokens: xtok(t)
    }
}

function xtok(t) {
    if (!t) return null
    if (Array.isArray(t)) {
        return t.map(_ => xtok(_))
    }
    if (t.token) return t.token
    if (t.tokens) return t.tokens
    return t
}

function statements(t) {
    const tok = []
    for (let e of t[0]) {
        tok.push(e[0], xtok(e[1][0]))
    }
    tok.push(t[1])
    const s = t[0].map(e => e[1][0])
    return {
        node: 'statements',
        statements: s,
        tokens: tok
    }
}

function statement_separators(t) {
    let x = []
    for (let a of t[0]) {
        x.push(...a)
    }
    if (t[1]) x.push(t[1])
    return x.filter(_ => _)
}

function forloop(t) {
    const id = t[2]
    const start = t[6]
    const to = t[10]
    const step = t[11]? t[11][3] : null
    const statements = t[12].statements
    return {
        node: 'for',
        var: id,
        start: start,
        to: to,
        step: step,
        statements: statements,

        tokens: xtok(t)
    }
}
function foreach(t) {
    return {
        node: 'foreach',
        var: t[2],
        in: t[6],
        statements: t[7].statements,

        tokens: xtok(t)
    }
}
function whileloop(t) {
    return {
        node: 'while',
        condition: t[2],
        statements: t[3].statements,

        tokens: xtok(t)
    }
}

function print(t) {
    return {
        node: 'print',
        items: t[1], // expressions and separataros
        tokens: xtok(t)
    }
}

function assign(t) {
    const op = t[2][0].value
    let tok = xtok(t)
    tok[2] = tok[2][0]

    if (op === '=')
        return {
            node: '=',
            op: op,
            lval: t[0],
            rval: t[4],
            tokens: tok
        }
    else
        return {
            node: 'assignop',
            op: op,
            lval: t[0],
            rval: t[4],
            tokens: tok
        }
}

function incdec(t) {
    return {
        node: t[2],
        lval: t[0],
        tokens: xtok(t)
    }
}

function returnst(t) {
    return {
        node: 'return',
        val:  t[1] ? t[1][1] : null,
        tokens: xtok(t)
    }
}

function ifst(t) {
    t.splice(1,1, ...t[1])
    const condition = t[2]
    let node = {
        node: 'if',
        condition: condition,
        then: t[4].statements,
        tokens: xtok(t)
    }
    let last = node
    for (let e of t[5].map(elseif)) {
        last.else = [e]
        last = e
    }
    if (t[6]) {
        if (t[6][1].statements)
            last.else = t[6][1].statements
        else
            last.else = []
    }
    return node
}
function elseif(t) {
    return {
        node: 'if',
        condition: t[1][1],
        then: t[1][3].statements,
        tokens: xtok([t[0], ...t[1]])
    }
}

function oneline_if(t) {
    const cond = t[2]
    const then = t[5][0]
    const els = t[6]? t[6][3][0] : null
    let tok = xtok(t)
    tok[5] = tok[5][0]
    return {
        node: 'if',
        condition: cond,
        then: then,
        else: els,

        tokens: tok
    }
}

function comment(t) {
    let comment = t[0].text
    if (/^'```/.test(comment)) {
        let code = comment.replace(/^'```.*\r?\n/gm, '')
                          .replace(/^'/gm, '')
        return {
            node: 'codeComment',
            text: code,
            li: {line: t[0].line, col: t[0].col}
        }
    } else if ((/^'\*/.test(comment))) {
        return {
            node: 'docuComment',
            text: comment.replace(/^'\*+/gm, ''),
            li: {line: t[0].line, col: t[0].col}
        }
    }
    return t[0]
}

function expr(t) {
    return t[0]
}

function uop(t) {
    let tok = xtok(t)
    if (Array.isArray(tok[0])) tok[0] = tok[0][0]

    return {
        node: 'uop',
        op: tok[0].value,
        right: t[2],
        tokens: tok
    }
}

function bop(t) {
    let tok = xtok(t)
    if (Array.isArray(tok[2])) tok[2] = tok[2][0]

    return {
        node: 'bop',
        op: tok[2].value,
        left: t[0],
        right: t[4],

        tokens: tok
    }
}

function parenthesis(t) {
    t[2].tokens = xtok(t) 
    return t[2]
}

function lval(t) {
    if (t.length == 1) return t[0]
    let node = Object.assign({}, t[0])
    node.token = null
    node.accessors = t[1].concat(t[2])
    node.tokens = xtok([t[0], t[1].concat(t[2])])
    return node
}

function access(t) {
// IDENTIFIER access_or_call:* xmlattr:?
    if (t[0].node === 'id') {
        return Object.assign({accessors: t[1], tokens:xtok(t), token:null}, t[0])
    }
    let a = t[1]
    if (t[2]) a.push(t[2])
    return { node: 'access', expr: t[0], accessors: a, tokens:xtok(t) }
}
function prop(t) {
//_ "." _ PROP_NAME
    return { node: 'prop', name: t[3].name,
        
        tokens: xtok(t)
    }
}
function index(t) {
//    _ "[" _ EXPR (_ "," _ EXPR):* _ "]" 
    let ix = [t[3]]
    ix.push(...t[4].map(e => e[3]))
    return { node: 'index', indexes: ix, tokens: xtok(t) }
}
function xmlattr(t) {
    return { node: 'xmlattr', name: t[3], tokens: xtok(t)}
}
function call(t) {
    if (t.length === 4)
        return {
            node: 'call',
            args: [],
            tokens: xtok(t)
        }
    let args = [t[3]]
    args.push(...t[4].map(e => e[3]))
    return { 
        node: 'call',
        args: args,
        tokens: xtok(t)
    }
}


function string(t) {
    t = t[0]
    return {node: 'string', val: t.text, li: {line: t.line, col: t.col}, token:t}
}
function number(t) {
    t = t[0]
    return {node: 'number', val: t.text, li: {line: t.line, col: t.col}, token:t}
}
function identifier(t) {
    t = t[0]
    let n = {node: 'id', val: t.text, li: {line: t.line, col: t.col}, token:t}
    return n
}
function constant(t) {
    t = t[0]
    return {node: 'const', val: t.text, li: {line: t.line, col: t.col}, token:t}
}

function name(t) {
    return {
        node: 'name',
        name: t[0].val,
        li: t[0].li,

        token: xtok(t[0])
    }
}
function dim(t) {
    return {
        node: 'dim',
        name: t[2],
        // array of expressions
        dimentions: t[6].expressions,
        tokens: xtok(t)
    }
}
function expr_list(t) {
    let exs = t[0].map(e => e[0])
    exs.push(t[1])
    return {
        node: 'expressions',
        expressions: exs,
        tokens: xtok(flat(t).filter(_=>_))
    }
}
function exit(t) {
    let node = (t.length === 3 && t[2].value === 'for') ?
        'exitfor' :
        'exitwhile'

    return {
        node: node,
        token: xtok(t)
    }
}
function stop(t) {
    return {
        node: 'stop',
        token: xtok(t[0])
    }
}
function end(t) {
    return {
        node: 'end',
        token: xtok(t[0])
    }
}

function object(t) {
    if (t.length === 3) return { node: 'object', properties: [], tokens: xtok(flat(t).filter(_=>_)) }
    
    return {
        node: 'object',
        properties: t[2].map(e => e[0]).concat([t[3]]),
        tokens: xtok(flat(t).filter(_=>_))
    }
}
function array(t) {
    if (t.length === 3) return { node: 'array', values: [] }

    return {
        node: 'array',
        values: t[2].map(e => e[0]).concat([t[3]])
    }
}
function propdef(t) {
    return {
        node: 'property',
        name: t[0].name,
        value: t[4],
        tokens: xtok(flat(t).filter(_=>_))
    }
}

function print_items(t) {
    if (t.length == 1) return []
    let items = print_separators(t[0])
    items.push(t[1])
    items = items.concat(t[2].map( e => {
        if (e[0] == null || e[0].type == 'ws') {
            return [...print_separators([e[0]]), e[1]]
        } else {
            return [...print_separators(e[0]), e[1]]
        }
    }).reduce((a, v) => a.concat(v), []))
    return items.concat(print_separators(t[3]))
}
function print_separators(t) {
    return (t||[]).filter(f=>f).map(e => {
        return {
            node: 'separator',
            val: e.text,

            token: e
        }
    })
}


// extensions
function declarations(t) {
    return t[0].map(a => a[1][0])
}
function interface(t) {
    return {
        name: t[2].val,
        extends: t[3] ? t[3][3].val : null,
        members: t[4][0].map(a => a[1]),
        li: { line: t[0].line, col: t[0].col }
    }
}
function iproperty(t) {
    return {
        node: 'property',
        name: t[2].val,
        type: t[6],
        li: { line: t[0].line, col: t[0].col }
    }
}
function ifunction(t) {
    return {
        node: 'function',
        name: t[2].val,
        params: t[5].params,
        type: t[7] ? t[7][3] : "void",
        li: { line: t[0].line, col: t[0].col }
    }
}
function xparam(t) {
    return {
        nade: 'param',
        name: t[0].val,
        type: t[4],
        li: t[0].li
    }
}
function denum(t) {
    return {
        node: 'enum',
        name: t[2].val,
        cases: t[3][0].map(a => a[1]),
        li: { line: t[0].line, col: t[0].col }
    }
}
function enummember(t) {
    return {
        node: 'case',
        name: t[0].val,
        value: t[1] ? t[1][3][0].val : null,
        li: { line: t[0].line, col: t[0].col }
    }
}
function typeList(t) {
    return [t[1]].concat(t[2].map(a => a[3]))
}
function namedType(t) {
    let name = t[0].val
    let optional = true
    if (/\!$/.test(name)) {
        optional = false
        name = name.substr(0, name.length - 1)
    }
    return {
        node: 'namedType',
        name: name,
        optional: optional,
        li: t[0].li
    }
}
function arrayType(t) {
    return {
        node: 'arrayType',
        type: t[2],
        optional: true,
        li: { line: t[0].line, col: t[0].col }
    }
}
function funcType(t) {
    return {
        node: 'functionType',
        typeList: t[1],
        type: t[6] || null,
        optional: true,
        li: { line: t[0].line, col: t[0].col }
    }
}
function tupleType(t) {
    return {
        node: 'tupleType',
        typeList: t[1],
        optional: true,
        li: { line: t[0].line, col: t[0].col }
    }
}
function typedef(t) {
    return {
        node: 'typedef',
        name: t[2].val,
        type: t[6]
    }
}
function nonOptional(t) {
    if (t[0].text != '(') {
        t[0].optional = false
        return t[0]
    } else {
        t[1].optional = false
        return t[1]
    }
}

module.exports = {
    'program': program,
    'libs': libs,
    'lib': lib,
    'functions': functions,
    'func': func,
    'afunc': afunc,
    'params': params,
    'param': param,
    'statements': statements,
    'statement_separators': statement_separators,
    'dim': dim,
    'for': forloop,
    'foreach': foreach,
    'while': whileloop,
    'exit': exit,
    'stop': stop,
    'end': end,
    'expr_list': expr_list,
    'print': print,
    'print_items': print_items,
    'lval': lval,
    'prop': prop,
    'index': index,
    'xmlattr': xmlattr,
    'call': call,
    'access': access,
    'expr': expr,
    'assign': assign,
    'incdec': incdec,
    'return': returnst,
    'if': ifst,
    'oneline_if': oneline_if,
    'comment': comment,
    'uop': uop,
    'bop': bop,
    'parenthesis': parenthesis,
    'object': object,
    'array': array,
    'propdef': propdef,
    'name': name,
    'string': string,
    'number': number,
    'identifier': identifier,
    'constant': constant,

    //type extensions
    'declarations': declarations,
    'interface': interface,
    'iproperty': iproperty,
    'ifunction': ifunction,
    'xparam': xparam,
    'enum': denum,
    'enummember': enummember,
    'typeList': typeList,
    'namedType': namedType,
    'arrayType': arrayType,
    'funcType': funcType,
    'tupleType': tupleType,
    'nonOptional': nonOptional,
    'typedef': typedef
}


const flat = d => {
    let a = []
    for (const e of d) {
        if (Array.isArray(e)) {
            a.push(...flat(e))
        } else {
            a.push(e)
        }
    }
    return a
}