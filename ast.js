function program(t) {
    return {
        libs:       t[0],
        functions:  t[1]
    }
}

function libs(t) {
    let l = [t[1]]
    l.concat(t[2].map(l => l[1]))
    return l
}

function lib(t) {
    return {
        node: t[0].value,
        name: t[2].val
    }
}

function functions(t) {
    let fns = t[0]
    return fns.map(f => { check_fn(f); return f[1] })
}

function func(t) {
    const ret = t[7]? t[7][3][0].value : null
    const statements = t[8]

    return {
        node: t[0].value,
        name: t[2].val,
        params: t[5],
        return: ret,
        statements: statements
    }
}

function afunc(t) {
    const ret = t[5]? t[5][3][0].value : null
    const statements = t[6]

    return {
        node: t[0].value,
        name: '',
        params: t[3],
        return: ret,
        statements: statements
    }
}

function params(t) {
    if (t.length == 1) return []
    let p = [t[1], ...t[2].map(e => e[3])]
    return p
}

function param(t) {
    return {
        node: 'param',
        name: t[0].val,
        type: t[2] ? t[2][0].value : null,
        default: t[1]
    }
}

function statements(t) {
    const sep = t[1][0]
    const s = t[0].map(e => e[1][0])
    return s
}

function forloop(t) {
    const id = t[2]
    const start = t[6]
    const to = t[10]
    const step = t[11]? t[11][3] : null
    const statements = t[12]
    return {
        node: 'for',
        var: id,
        start: start,
        to: to,
        step: step,
        statements: statements
    }
}
function foreach(t) {
    return {
        node: 'foreach',
        var: t[4],
        in: t[8],
        statements: t[10]
    }
}
function whileloop(t) {
    return {
        node: 'while',
        condition: t[2],
        statements: t[4]
    }
}

function print(t) {
    return {
        node: 'print',
        items: t[1] // expressions and separataros
    }
}

function assign(t) {
    const op = t[2][0].value

    if (op === '=')
        return {
            node: '=',
            op: op,
            lval: t[0],
            rval: t[4]
        }
    else
        return {
            node: 'assignop',
            op: op,
            lval: t[0],
            rval: t[4]
        }
}

function incdec(t) {
    return {
        node: t[2],
        lval: t[0]
    }
}

function returnst(t) {
    return {
        node: 'return',
        val:  t[1] ? t[1][1] : null
    }
}

function ifst(t) {
    check_if(t[0])
    check_endif(t[4])
    check_condition(t[1])
    const condition = t[1][1]
    let node = {
        node: 'if',
        condition: condition,
        then: t[1][3],
    }
    let last = node
    for (let e of t[2].map(elseif)) {
        last.else = [e]
        last = e
    }
    if (t[3]) last.else = t[3][1][0]
    return node
}
function elseif(t) {
    return {
        node: 'if',
        condition: t[2],
        then: t[4]
    }
}

function oneline_if(t) {
    const cond = t[2]
    const then = t[5]
    const els = t[6]? t[6][3] : null
    return {
        node: 'if',
        condition: cond,
        then: then,
        else: els
    }
}

function comment(t) {
    return t[0].text
}

function expr(t) {
    return t[0]
}

function uop(t) {
    return {
        node: 'uop',
        op: t[0].value || t[0][0].value,
        right: t[2]
    }
}

function bop(t) {
    return {
        node: 'bop',
        op: t[2].value || t[2][0].value,
        left: t[0],
        right: t[4]
    }
}

function parenthesis(t) {
    return t[2]
    return {
        node: '()',
        expr: t[2]
    }
}

function lval(t) {
    if (t.length == 1) return t[0]
    return Object.assign({accessors: t[1].concat(t[2])}, t[0])
}

function access(t) {
// IDENTIFIER access_or_call:* xmlattr:?
    if (t[0].node === 'id') {
        return Object.assign({accessors: t[1]}, t[0])
    }
    let a = t[1]
    if (t[2]) a.push(t[2])
    return { node: 'access', expr: t[0], accessors: a }
}
function prop(t) {
//_ "." _ PROP_NAME
    return { node: 'prop', name: t[3].name }
}
function index(t) {
//    _ "[" _ EXPR (_ "," _ EXPR):* _ "]" 
    //console.log('index:', t)
    let ix = [t[3]]
    ix.push(...t[4].map(e => e[3]))
    return { node: 'index', indexes: ix }
}
function xmlattr(t) {
    return { node: 'xmlattr', name: t[3]}
}
function call(t) {
//_ "(" call_args ")"
    return { node: 'call', args: t[2] }
}
function callargs(t) {
//_ (rval _ "," _):* rval _ | _
    if (t.length == 1) return []
    let a = t[1].map(v => v[0])
    a.push(t[2])
    return a
}

function string(t) {
    t = t[0]
    return {node: 'string', val: t.text, li: {line: t.line, col: t.col}}
}
function number(t) {
    t = t[0]
    return {node: 'number', val: t.text, li: {line: t.line, col: t.col}}
}
function identifier(t) {
    t = t[0]
    let n = {node: 'id', val: t.text, li: {line: t.line, col: t.col}}
    return n
}
function constant(t) {
    t = t[0]
    return {node: 'const', val: t.text, li: {line: t.line, col: t.col}}
}

function name(t) {
    return {
        node: 'name',
        name: t[0].val,
        li: t[0].li
    }
}
function dim(t) {
    return {
        node: 'dim',
        name: t[2],
        // array of expressions
        dimentions: t[6]
    }
}
function expr_list(t) {
    let exs = t[0].map(e => e[0])
    exs.push(t[1])
    return exs
}
function exit(t) {
    let node = (t.length === 3 && t[2].value === 'for') ?
        'exitfor' :
        'exitwhile'

    return {
        node: node
    }
}
function stop(t) {
    return {
        node: 'stop'
    }
}
function end(t) {
    return {
        node: 'end'
    }
}

function object(t) {
    if (t.length === 3) return { node: 'object', properties: [] }
    
    return {
        node: 'object',
        properties: t[2].map(e => e[0]).concat([t[3]])
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
        value: t[4]
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
    return t.filter(f=>f).map(e => {
        return {
            node: 'separator',
            val: e.text
        }
    })
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
    'callargs': callargs,
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
    'constant': constant
}

function check_if(t) {
    if (t.text != 'if') {
        //style warning about if 
    }
}
function check_endif(t) {
    if (t.text != 'end if') {
        //style warning about end if spacing
        //or capitalization
    }
}
function check_condition(t) {
    if (t[0] == null) {
        //console.log("  W: no space after if" )
        return
    }
    if (t[1].node == '()') {
        //console.log("  W: () around condition", t[0].line, t[0].col)
    }
}

function check_fn(t) {
    let cmts = t[0]? t[0][0] : null
    const reducer = (a, v) => {
        v = v[0]
        if (typeof(v) === "string" && v.substr(0,2) === "''") {
            return a + v.substring(2)
        }
        return a
    }
    //console.log(cmts.reduce(reducer, ''))
}