'use strict'

const rule = defaultLevel => class {
    constructor() {
        this.level = defaultLevel
    }
    static get level() {
        return defaultLevel
    }
    get message() {
        return this._message
    }
}


class function_too_big extends rule(3) {
    constructor() {
        super()
        this.node = 'function'
        this.lines = 100
        this._message = `function longer than ${this.lines} lines`
    }

    check(node) {
        const last = node.tokens.length - 1
        const lines = node.tokens[last][0].line - node.tokens[0].line
        if (lines > this.lines) {
            return location(node.tokens[0])
        }
    }
}

class end_if extends rule(4) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "`if` should end with `end if`"
    }

    check(node) {
        const last = node.tokens[node.tokens.length - 1]
        if (match(last, ['endif']) || 
            match(last, ['end',,'if']) && last[1].value != ' ') {
            return location(node.tokens[7][0])
        }
    }
}

class no_empty_then extends rule(3) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "`if` should not have empty `then`"
    }

    check(node) {
        if (node.then.length === 0) {
            return location(node.tokens[4][0][0])
        }
    }
}

class then extends rule(4) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "`if` must have `then`"
    }

    check(node) {
        if (!node.tokens[3]) {
            return location(node.tokens[0])
        }
    }
}

class then_space extends rule(4) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "Must have single space before `then`"
    }

    check(node) {
        const then = node.tokens[3]
        //then is present, but space is missing or not one space
        if (then && (!then[0] || then[0].value !== ' ')) {
            return location(then[0] || then[1])
        }
    }
}

class no_empty_else extends rule(3) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "`if` should not have empty `else`"
    }

    check(node) {
        if (node.tokens[6] &&
            node.tokens[6][1].length === 1) {
            return location(node.tokens[6][0])
        }
    }
}

class if_parentheses extends rule(3) {
    constructor() {
        super()
        this.node = 'if'
        this._message = "`if` condition should not be enclosed in parentheses"
    }

    check(node) {
        let first_token = node.tokens[2][0] || {}
        let last_token = node.tokens[2][4] || {}
        if (first_token.value === '(' &&
            last_token.value === ')') {
            return location(first_token)
        }
    }
}

// Requires functions to declare return type only if they have `return something` statement
// Less strict than requiring all functions to declare return type
class return_type extends rule(4) {
    constructor() {
        super()
        this.node = 'function'
        this._message = "functions returning values should have return type"
    }

    check(node) {
        for (const [s] of statements(node)) {
            if (s.node == 'return' && s.val) {
                return location(node.tokens[0])
            }
        }
    }
}

class function_type extends rule(3) {
    constructor() {
        super()
        this.node = 'function'
        this._message = "functions must declare return type"
    }

    check(node) {
        if (!node.return) {
            return location(node.tokens[0])
        }
    }
}

class sub_with_return extends rule(3) {
    constructor() {
        super()
        this.node = 'sub'
        this._message = `sub with return type`
    }

    check(node) {
        if (node.return) {
            return location(node.tokens[0])
        }
    }
}

const classRules = [
    function_too_big,
    end_if,
    no_empty_then, then, then_space,
    no_empty_else, if_parentheses,
    return_type,
    function_type,
    sub_with_return
]

module.exports = (config, level) => {
    level = level || 3
    if (!config || !config.include) {
        return defaultRules(level)
    }
    
    return selectRules(config.include, level)
}

function selectRules(names, level) {
    return classRules.filter(_ => _.level <= level && names.includes(_.name))
        .map(_ => Reflect.construct(_, []))
}

function defaultRules(level) {
    return classRules.filter(_ => _.level <= level)
        .map(_ => Reflect.construct(_, []))
}

function location(t) {
    if (Array.isArray(t)) return location(t[0])
    return t.line + "," + t.col
}


function* statements(node, depth) {
    if (Array.isArray(node)) {
        for (let s of node) {
            yield* statements(s, depth)
        }
    } else {
        yield [node, depth]

        if (node.statements) {
            yield* statements(node.statements, depth + 1)
        }
        if (node.then) {
            yield* statements(node.then, depth + 1)
        }
        if (node.else) {
            yield* statements(node.else, depth + 1)
        }
    }
}

function match(target, ...patterns) {
    if (!target) return false

    if (Array.isArray(target)) {
        target = target.map(_ => _.value)
    } else {
        target = target.value
    }

    for (const pattern of patterns) {
        if (sameAs(target, pattern)) {
            return true
        }
    }
    return false
}

function sameAs(a, b) {
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (b[i] !== undefined && a[i] !== b[i]) {
            return false
        }
    }
    return true
}