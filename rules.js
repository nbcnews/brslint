'use strict'

const rule = defaultLevel => class {
    constructor() {
        this.level = defaultLevel
    }
    static get level() {
        return defaultLevel
    }
    static createWithProps(props) {
        let inst = Reflect.construct(this, [])
        for (const prop in props) {
            if (typeof inst[prop] === typeof props[prop] && prop.substring(0,0) !== '_') {
                inst[prop] = props[prop]
            }
        }
        return inst
    }

    get node() {
        return this._node
    }

    warning(token, message) {
        return {
            message: message || this.message,
            level: this.level,
            loc: location(token)
        }
    }
}


class function_too_big extends rule(3) {
    constructor() {
        super()
        this._node = 'function'
        this.lines = 100
        this.message = `function longer than ${this.lines} lines`
    }

    check(node) {
        const last = node.tokens.length - 1
        const lines = node.tokens[last][0].line - node.tokens[0].line
        if (lines > this.lines) {
            return this.warning(node.tokens[0])
        }
    }
}

class end_if extends rule(4) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "`if` should end with `end if`"
    }

    check(node) {
        const last = node.tokens[node.tokens.length - 1]
        if (match(last, ['endif']) || 
            match(last, ['end',,'if']) && last[1].value != ' ') {
            return this.warning(node.tokens[7][0])
        }
    }
}

class no_empty_then extends rule(3) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "`if` should not have empty `then`"
    }

    check(node) {
        if (node.then.length === 0) {
            return this.warning(node.tokens[4][0][0])
        }
    }
}

class must_have_then extends rule(4) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "`if` must have `then`"
    }

    check(node) {
        if (!node.tokens[3]) {
            return this.warning(node.tokens[0])
        }
    }
}

class then_space extends rule(4) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "Must have single space before `then`"
    }

    check(node) {
        const then = node.tokens[3]
        //then is present, but space is missing or not one space
        if (then && (!then[0] || then[0].value !== ' ')) {
            return this.warning(then[0] || then[1])
        }
    }
}

class no_empty_else extends rule(3) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "`if` should not have empty `else`"
    }

    check(node) {
        if (node.tokens[6] &&
            node.tokens[6][1].length === 1) {
            return this.warning(node.tokens[6][0])
        }
    }
}

class if_parentheses extends rule(3) {
    constructor() {
        super()
        this._node = 'if'
        this.message = "`if` condition should not be enclosed in parentheses"
    }

    check(node) {
        let first_token = node.tokens[2][0] || {}
        let last_token = node.tokens[2][4] || {}
        if (first_token.value === '(' &&
            last_token.value === ')') {
            return this.warning(first_token)
        }
    }
}

// Requires functions to declare return type only if they have `return something` statement
// Less strict than requiring all functions to declare return type
class return_type extends rule(4) {
    constructor() {
        super()
        this._node = 'function'
        this.message = "functions returning values should have return type"
    }

    check(node) {
        for (const [s] of statements(node)) {
            if (s.node == 'return' && s.val) {
                return this.warning(node.tokens[0])
            }
        }
    }
}

class function_type extends rule(3) {
    constructor() {
        super()
        this._node = 'function'
        this.message = "functions must declare return type"
    }

    check(node) {
        if (!node.return) {
            return this.warning(node.tokens[0])
        }
    }
}

class sub_with_return extends rule(3) {
    constructor() {
        super()
        this._node = 'sub'
        this.message = `sub with return type`
    }

    check(node) {
        if (node.return) {
            return this.warning(node.tokens[0])
        }
    }
}

class yoda_condition extends rule(3) {
    constructor() {
        super()
        this._node = 'bop'
        this.message = `in conditional expression constant should be on the right`
    }

    check(node) {
        const compareOp = /^[>=<]{1,2}$/.test(node.op)
        const leftConst = /const|number|string/.test(node.left.node)
        if (compareOp && leftConst) {
            return this.warning(node.tokens)
        }
    }
}

class object_formatting extends rule(4) {
    constructor() {
        super()
        this._node = 'object'
        this.message = ``
        this.spaces_after_colon = 1
        this.spaces_before_colon = 0
        this.trailing_commas = 'no' // 'no', 'required'
        this.max_properties = 4
        this.key_in_quotes = 'consistent' // 'required', 'consistent'
    }

    check(node) {
        let warnings = []
        let quotedKeys = 0

        const newlineCount = (token) => {
            if (token.type != 'NL') return 0
            return (token.value.match(/\n/g) || []).length
        }
        const spaceCount = (token) => {
            if (token.type != 'ws') return 0
            return (token.value.match(/ /g) || []).length
        }

        const multiline = node.tokens.findIndex(item => newlineCount(item) > 0) > 0
        const secondToken = node.tokens[1]
        const secondToLast = node.tokens[node.tokens.length - 2]

        if (multiline) {
            if (newlineCount(secondToken) == 0) {
                warnings.push(this.warning(secondToken, '`{` must be on its own line'))
            }
            if (newlineCount(secondToLast) == 0) {
                warnings.push(this.warning(secondToLast, '`}` must be on new line'))
            }
        } else if (node.properties.length > 0) {
            if (spaceCount(secondToken) != 1) {
                warnings.push(this.warning(secondToken, '`{` must be followed by single space'))
            }
            if (spaceCount(secondToLast) != 1) {
                warnings.push(this.warning(secondToLast, '`}` must be preceded by single space'))
            }
        }

        if (multiline) {
            let pairs = node.tokens
                .map((e, i) => [e, node.tokens[i + 1]])
                .filter(e => e[0].value == ',')

            for (const item of pairs) {
                if (item[1].type == 'ws') {
                    warnings.push(this.warning(item[0], 'one property per line'))
                } else if (this.trailing_commas == 'no') {
                    warnings.push(this.warning(item[0], 'no trailing commas in object literals'))
                }
            }
        } else if (node.properties.length > this.max_properties) {
            warnings.push(this.warning(node.tokens, `object literals with more than ${this.max_properties} properties should be on multiple lines`))
        }

        for (const property of node.properties) {
            const keyInQuotes = /^".*"$/.test(property.name)
            if (keyInQuotes) quotedKeys += 1
            if (this.key_in_quotes == 'required' && !keyInQuotes) {
                warnings.push(this.warning(property.value.token, 'key must be in quotes'))
            }

            const colonIndex = property.tokens.findIndex(item => item.value == ':')
            const tokenBeforeColon = property.tokens[colonIndex - 1]

            if (this.spaces_before_colon == 0 && tokenBeforeColon.type == 'ws') {
                warnings.push(this.warning(tokenBeforeColon, 'spaces not allowed before `:`'))
            }
            if (this.spaces_before_colon > 0 && spaceCount(tokenBeforeColon) != this.spaces_before_colon) {
                warnings.push(this.warning(tokenBeforeColon, `expecting ${this.spaces_before_colon} spaces before \`:\``))
            }

            const tokenAfterColon = property.tokens[colonIndex + 1]
            if (this.spaces_after_colon == 0 && tokenAfterColon.type != 'ws') {
                warnings.push(this.warning(tokenAfterColon, 'spaces not allowed after `:`'))
            }
            if (this.spaces_after_colon > 0 && spaceCount(tokenAfterColon) != this.spaces_after_colon) {
                warnings.push(this.warning(tokenAfterColon, `expecting ${this.spaces_after_colon} spaces after \`:\``))
            }
        }

        if (this.key_in_quotes == 'consistent') {
            if (quotedKeys != node.properties.length && quotedKeys != 0) {
                warnings.push(this.warning(node.tokens, `all keys should be in quotes or without quotes`))
            }
        }

        return warnings
    }
}

class keyword_formatting extends rule(4) {
    constructor() {
        super()
        this.message = ``
        this.case = 'lower'    // 'lower', allcap', 'pascal', 'any'
        this.space = 'single'  // 'single, 'no', 'some', 'optional'
        this.keywords = {}
    }

    check(node) {
        switch (node.node) {
            case 'lib':
            case 'dim':
            case 'return':
            case 'print':
                return deNull(this.checkKeyword(node.tokens[0]))
            case 'function':
            case 'sub':
                return deNull([
                    ...this.checkKeyword(node.tokens[0]),
                    ...this.checkKeyword(node.tokens[node.tokens.length - 1])
                ])
            case 'param':
                return deNull(this.checkKeyword(nodeAt(node.tokens, 2, 1)))
            case 'if':
                return deNull([
                    ...this.checkKeyword(node.tokens[0]),
                    ...this.checkKeyword(nodeAt(node.tokens, 3, 1)),
                    ...this.checkKeyword(nodeAt(node.tokens, 6, 0)),
                    ...this.checkKeyword(node.tokens[7])
                ])
            case 'for':
                const isNext = node.tokens[13][0].value.toLowerCase() == 'next'
                return deNull([
                    ...this.checkKeyword(node.tokens[0]),
                    ...this.checkKeyword(node.tokens[8]),
                    ...this.checkKeyword(nodeAt(node.tokens, 11, 1)),
                    ...(isNext ?
                        this.checkKeyword(node.tokens[13][0]) :
                        this.checkKeyword(node.tokens[13]))
                ])
            case 'foreach':
                return deNull([
                    ...this.checkKeyword(node.tokens[0]),
                    ...this.checkKeyword(node.tokens[4]),
                    ...this.checkKeyword(node.tokens[8])
                ])
            case 'while':
                return deNull([
                    ...this.checkKeyword(node.tokens[0]),
                    ...this.checkKeyword(node.tokens[4])
                ])
            case 'uop':
                if (node.tokens[0].value === '(') {
                    return deNull(this.checkKeyword(node.tokens[2][0]))
                } else {
                    return deNull(this.checkKeyword(node.tokens[0]))
                }
            case 'bop':
                if (node.tokens[0].value === '(') {
                    return deNull(this.checkKeyword(node.tokens[2][2]))
                } else {
                    return deNull(this.checkKeyword(node.tokens[2]))
                }
            case 'exitfor':
            case 'exitwhile':
            case 'stop':
            case 'end':
                return deNull(this.checkKeyword(node.token))
        }
    }

    checkKeyword(keywordTokens) {
        if (!keywordTokens) return []

        let canHaveSpace = false
        if (Array.isArray(keywordTokens) && keywordTokens.length === 1) {
            keywordTokens = keywordTokens[0]
            canHaveSpace = true
        }
        if (Array.isArray(keywordTokens)) {
            const key = keywordTokens[0].value + keywordTokens[2].value
            const value = keywordTokens.map(_ => _.text).join('')
            const lookup = this.keywords[key]
            if (lookup) {
                if (lookup !== value) {
                    return [this.warning(keywordTokens, `keyword ${value} should be ${lookup}`)]
                } else {
                    return []
                }
            }
            if (this.space === 'no') {
                return [this.warning(keywordTokens, `keyword ${value} should not have a space`)]
            }
            if (this.space === 'single' && keywordTokens[1].value !== ' ') {
                return [this.warning(keywordTokens[1], `keyword ${value} should have a single space`)]
            }
            return [this.checkCase(keywordTokens[0]),
                    this.checkCase(keywordTokens[2])]
        } else {
            const value = keywordTokens.text
            const lookup = this.keywords[keywordTokens.value]
            if (lookup) {
                if (lookup !== value) {
                    return [this.warning(keywordTokens, `keyword ${value} should be ${lookup}`)]
                } else {
                    return []
                }
            }
            if (canHaveSpace && (this.space === 'single' || this.space === 'some')) {
                return [this.warning(keywordTokens, `keyword ${value} should have a space`)]
            }
            return [this.checkCase(keywordTokens)]
        }
    }

    checkCase(token) {
        const value = token.text
        if (this.case === 'lower' && value !== value.toLowerCase()) {
            return this.warning(token, `keyword ${value} should be in lower case`)
        } else if (this.case === 'allcap' && value !== value.toUpperCase()) {
            return this.warning(token, `keyword ${value} should be in upper case`)
        } else if (this.case === 'pascal' && value != toPascalCase(value)) {
            return this.warning(token, `keyword ${value} should start with upper case letter`)
        }
    }
}

const classRules = [
    function_too_big,
    end_if,
    no_empty_then, must_have_then, then_space,
    no_empty_else, if_parentheses,
    return_type,
    function_type,
    sub_with_return,
    yoda_condition,
    keyword_formatting,
    object_formatting
]

module.exports = (config, level) => {
    if (!config || !config.include || !config.custom) {
        return defaultRules(level || 3)
    }
    
    return selectRules(config, level || 4)
}

function selectRules(config, level) {
    let rulesConfig = {}
    for (const r of config.include || []) {
        rulesConfig[r] = {}
    }

    for (const r in config.custom || {}) {
        rulesConfig[r] = config.custom[r]
    }

    return prepareRules(rulesConfig, level)
}

function prepareRules(rulesConfig, level) {
    let rules = []
    for (const key in rulesConfig) {
        const cls = classRules.find(_ => _.name === key)
        if (cls && cls.level <= level) {
            const instance = cls.createWithProps(rulesConfig[key])
            rules.push(instance)
        }
    }

    return rules
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

function toPascalCase(str) {
    if (str.length < 1) return str
    str = str.toLowerCase()
    return str[0].toUpperCase() + str.substring(1)
}

function deNull(array) {
    return array.filter(_=>_)
}

function nodeAt(node, ...ixs) {
    if (!node) return 
    for (let i of ixs) {
        if (node[i]) {
            node = node[i]
        } else {
            return
        }
    }

    return node
}
