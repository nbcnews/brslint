const rules = [
    {
        name: 'end_if',
        check: (node) => {
            if (node.tokens[7].length !== 3) {
                return location(node.tokens[7][0])
            }    
        },
        node: 'if',
        tokens: 8,
        message: "Must use `end if`",
        level: 4
    },

    {
        name: 'empty_then',
        check: (node) => {
            if (node.then.length === 0) {
                return location(node.tokens[4][0][0])
            }
        },
        node: 'if',
        message: "`if` should not have empty `then`",
        level: 3
    },

    {
        name: 'then',
        check: (node) => {
            if (!node.tokens[3]) {
                return location(node.tokens[0])
            }
        },
        node: 'if',
        tokens: 8,
        message: "`if` must have `then`",
        level: 4
    },

    {
        name: 'then_space',
        check: (node) => {
            const then = node.tokens[3]
            //then is present, but space is missing or not one space
            if (then && (!then[0] || then[0].value !== ' ')) {
                return location(then[0] || then[1])
            }     
        },
        node: 'if',
        message: "Must have single space before `then`",
        level: 4
    },

    {
        name: 'empty_else',
        check: (node) => {
            if (node.else && node.else.length === 0) {
                return location(node.tokens[6][0])
            }
        },
        node: 'if',
        tokens: 8,
        message: "`if` should not have empty `else`",
        level: 3
    },

    {
        name: 'if()',
        check: (node) => {
            let first_token = node.tokens[2][0] || {}
            let last_token = node.tokens[2][4] || {}
            if (first_token.value === '(' &&
                last_token.value === ')') {
                return location(first_token)
            }
        },
        node: 'if',
        message: "`if` condition should not be in ()",
        level: 4
    },

    {
        name: 'function_too_big',
        check: (node) => {
            const l = node.tokens.length
            const lines = node.tokens[l-1][0].line - node.tokens[0].line
            if (lines > 100) {
                return location(node.tokens[0])
            }
        },
        node: 'function',
        lines: 100,
        message: "function longer than 100 lines",
        level: 3
    },

    {
        name: 'return_type',
        check: (node) => {
            let ret = null
            traverseStatements(node, n => {
                if (n.node == 'return' && n.val) {
                    ret = n
                    return true
                }
            })
            if (ret) {
                return location(node.tokens[0])
            }
        },
        node: 'function',
        message: "function returning values should have return type",
        level: 3
    },
]

module.exports = (config) => {
    if (!config || !config.enabled) {
        return defaultRules()
    }
    
    return selectRules(config.enabled)
}

function selectRules(names) {
    rules.filter(_ => names.includes(_.name))
}

function defaultRules() {
    return rules.filter(_ => _.level < 4)
}

function location(t) {
    return "@" + t.line + "," + t.col
}

function traverseStatements(node, check) {
    if (Array.isArray(node)) {
        for (st of node) {
            if (traverseStatements(st, check))
                return
        }
    } else if (check(node)) {
        return
    }

    if (node.statements && traverseStatements(node.statements, check)) {
        return
    }
    if (node.then && traverseStatements(node.then, check)) {
        return
    }
    if (node.else && traverseStatements(node.else, check)) {
        return
    }
}