
class static_a {
    #warnings = []
    constructor() {
        this.globals = {
            'createobject': { type: 'createobject', args: [
                {'type': 'string'},
                {'type': 'dynamic', default: 'invalid'},
                {'type': 'dynamic', default: 'invalid'},
                {'type': 'dynamic', default: 'invalid'}
            ]},
            'type': { type: 'string', args: [
                {'type': 'dynamic'}, {'type': 'integer', default: '2'}
            ]},
            'globalaa': {type: 'object', args: []},
            'parsejson': {type: 'object', args:[{type: 'string'}]}
        }
    }

    warning(token, message, level) {
        this.#warnings.push({level: level || 3, message: message, loc: token.li })
    }

    check(node, ctx) {
        this.#warnings = []
        for (const param of node.params) {
            let type = param.xtype || makeType(param.type)
            ctx.set(param.name, type)
        }
        ctx.set('return', makeType(node.return))

        const c = this.checkContext(node.statements, ctx)
        if (c && node.return != 'void')
            this.warnings.push(this.warning(node.tokens, "not all path return value"))
        return this.warnings
    }

    checkContext(statements, ctx) {
        if (!Array.isArray(statements)) statements = [statements]

        let lct = ctx
        for (const s of statements) {
            if (lct == null) {
                this.warnings.push(this.warning(s.tokens, "unreachable code"))
                return  //dead code
            }
            lct = this.checkStatement(s, lct)
        }
        return lct
    }

    checkStatement(s, ctx) {
        if (s.node === 'dim') {
            let v = {
                name: s.name.val,
                type: { type: 'array', dim: s.dimentions, types: [], accessed: false },
            }
            for (let x of s.dimentions) {
                try {
                    const type = this.verifyExpr(x, ctx)
                    if (!this.typeIs(type, 'number')) {
                        //error
                        this.warnings.push(this.warning(x.token, 'expecting number'))
                    }
                } catch (x) {
                    //error
                    this.warnings.push( this.warning(x.token, x.error) )
                }
            }
            ctx[v.name] = v
        }
        if (s.node === '=') {
            const declaration = s.lval.node == 'id' && !s.lval.accessors
            let type = ctx.get(s.lval.val)
            let ltype = this.validateAccess(s.lval, type)
            let rtype = this.verifyExpr(s.rval, ctx)

            if (declaration) {
                ctx[s.lval.val] = {
                    name: s.lval.val,
                    type: rtype,
                    accessed: false
                }
            } else {
                if (!ltype.eq(rtype)) {
                    //redeclaration. strict warning?
                    this.warning(s.lval, `${s.lval.val} redeclaration`, 3)
                }
            }
        }
        if (s.node == 'if') {
            try {
                const ctype = this.verifyExpr(s.condition, ctx)
                if (!ctype instanceof BooleanType) {
                    this.warning(s.tokens, `should be bool, got ${ctype}`)
                }
            } catch(x) {
                this.warning(x.token, x.error)
            }
            let c1,c2
            if (s.then) {
                let cpy = new Map(ctx) //Object.assign({}, ctx)
                c1 = this.checkContext(s.then, cpy)
            }
            if (s.else) {
                let cpy = new Map(ctx) //Object.assign({}, ctx)
                c2 = this.checkContext(s.else, cpy)
            } else {
                c2 = ctx
            }
            return this.merge(c1,c2)
        }
        if (s.node == 'return') {
            try {
                let t = s.val? this.verifyExpr(s.val, ctx) : 'void'
                if (!this.typesComparable(t, ctx.get('return'))) {
                    this.warning(s.tokens, `return type miss ${ctx['return']} ${t}`)
                }
            } catch (x) {
                this.warning(x.token, x.error)
            }
            return null//end execution path
        }

        return ctx
    }

    merge(c1,c2) {
        if (!c1) return c2
        if (!c2) return c1

        let keys = Array.from(new Set(Object.keys(c2).concat(Object.keys(c1))))
        let c = {}
        for (const k of keys) {
            if (c1[k] && c2[k] && Object.is(c1[k].type, c2[k].type)) {
                c[k] = c1[k]
            } else {
                let t1 = c1[k] ? c1[k].type : 'undefined'
                let t2 = c2[k] ? c2[k].type : 'undefined'
                c[k] = c1[k] || c2 [k]
                c[k].type = this.mergeArrays(t1, t2)
            }
        }
        return c
    }
    mergeArrays(t1,t2) {
        if (!Array.isArray(t1)) t1 = [t1]
        if (!Array.isArray(t2)) t2 = [t2]
        let c = t1.concat(t2)
        const a =  Array.from(new Set(c))
        if (a.length == 1) return a[0]
        return a
    }

    verifyExpr(ex, ctx) {
        switch (ex.node) {
        case 'function':
            return 'function'
        case 'array':
            return new ArrayType(new ObjectType())
        case 'object':
            return new ObjectType()
        case 'string':
            return new StringType()
        case 'number': 
            return new NumberType()
        case 'const':
            return ex.val == 'invalid' ? 'invalid' : new BooleanType()
        case 'bop':
            if (ex.op == '+') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (this.typesComparable(tl, 'number') && this.typesComparable(tr, 'number')) {
                    return 'number'
                }
                if (this.typesComparable(tl, 'string') && this.typesComparable(tr, 'string')) {
                    return 'string'
                }
                throw { error: `expecting numbers or strings, got ${tl} ${tr}`, token: ex.tokens }
            } else if (ex.op == '-' || ex.op == '*' || ex.op == '\\' || ex.op == '/' || ex.op == 'mod') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (!this.typesComparable(tl, 'number')) {
                    throw { error: 'expecting number got' + tl, token: ex.left.tokens || ex.left.token }
                }
                if (!this.typesComparable(tr, 'number')) {
                    throw { error: 'expecting number, got '+tr, token: ex.right.tokens || ex.right.token}
                }
                return 'number'
            } else if (ex.op == '=' || ex.op == '<>' || ex.op === '>' || ex.op == '<' || ex.op == '<=' || ex.op == '>=') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (this.typesComparable(tl,tr))
                    return new BooleanType()
                else
                    throw {error: `type missmatch comparing ${tl} ${tr}`, token: ex.tokens}
            } else if (ex.op == 'and' || ex.op == 'or') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (!tl instanceof BooleanType) {
                    throw { error: 'expecting bool got ' + tl, token: ex.left.tokens || ex.left.token }
                }
                if (!tr instanceof BooleanType) {
                    throw { error: 'expecting bool, got '+tr, token: ex.right.tokens || ex.right.token}
                }
                return new BooleanType()
            }
            return new UndefinedType()
        case 'uop':
            if (ex.op == 'not') {
                let t = this.verifyExpr(ex.right, ctx)
                if (!t.eq(BooleanType)) {
                    throw { error: 'expecting boolean got '+t, token: ex.right.tokens }
                }
                return t
            } else {
                let t = this.verifyExpr(ex.right, ctx)
                if (!t instanceof NumberType) {
                    throw { error: 'expecting number got ' + t, token: ex.right.tokens }
                }
                return t
            }
        case 'access':
            //access validation here
            let t = this.verifyExpr(ex.expr, ctx)
            return 'dynamic'
        case 'id':
            const global = this.globals[ex.val]
            const local = ctx.get(ex.val)

            if (global) {
                return this.validateAccess(ex, global)
            } else if (!local) {
                if (ex.accessors && ex.accessors[0].node == 'call') {
                    return this.validateCall('dynamic', ex.accessors[0].args)
                }
                throw { error: 'undefined', token: ex.token }
            } else {
                //deep analyse access if present
                if (!ex.accessors)
                    return local
                else {
                    let t = this.validateAccess(ex, local)
                    return t
                }
            }
        }
    }

    validateAccess(node, type) {
        if (!node.accessors) {
            return type
        }

        let distype = type
        for (const accessor of node.accessors) {
            switch (accessor.node) {
            case 'prop': //no prop check yet
                if (distype instanceof InterfaceType) {
                    distype = distype.members.get(accessor.name.toLowerCase())
                    if (!distype) {
                        // warning, not valid property access
                        // fallback to object. Make fallback conditional?
                        distype = new ObjectType()
                    }
                } else if (distype.eq(ObjectType)) {
                    // no property check for raw object
                } else {
                    // error. no other types allowed property access
                    // throw?
                    distype = new ObjectType()
                }
                break
            case 'call':
                distype = this.validateCall(distype, accessor.args, accessor)
                break
            case 'index':
                if (distype instanceof ArrayType) {

                } else if (distype instanceof TupleType) {

                } else if (distype.eq(ObjectType)) {
                    // strict warning
                } else {
                    // error. non indexable type
                }
                break
            case 'xmlattr':
                distype = new StringType()
            }
        }
        return distype
    }

    validateCall(fn, args, node) {
        if (fn == 'dynamic' || fn == 'object') {
            for (let arg of args) {
                const t = this.verifyExpr(arg)
                //can make assumptions based on arg types
            }
            return 'dynamic'
        }

        let len = Math.min(fn.args.length, args.length)
        for (let i = 0; i < len; i++) {
            const t = this.verifyExpr(args[i])
            if (!this.typesComparable(t, fn.args[i].type)) {
                this.warnings.push( this.warning(node.token, `expecting ${fn.args[i].type} got ${t}`))
            }
        }
        if (len < fn.args.length) {
            if (!fn.args.slice(len).every(_ => _.default)) {
                this.warnings.push( this.warning(node.token, `missing arguments`))
            }
        }
        if (fn.type == 'createobject') {
            if (args.length < 1) {
                this.warnings.push( this.warning(node.token, `${name} should have at least one argument`))
                return 'dynamic'
            } else if (args[0].node != 'string') {
                this.warnings.push( this.warning(node.token, `${name} first argument shoul be string`))
                return 'dynamic'
            } else {
                return args[0].val.slice(1, -1).toLowerCase()
            }
        }
        return fn.return
    }

    typesComparable(t1,t2) {
        if (Array.isArray(t2)) {
            return t2.any(_ => this.typesComparable(t1,_))
        }
        if (Array.isArray(t1)) {
            //all types shoulde be comparable to t2. ['number','object'] are comparable to 'number'.
            //['boolean','object'] are not
            return t1.every(_ => this.typesComparable(_,t2))
        }
        return    t1.eq(t2)
               || t1.eq(ObjectType) || t2.eq(ObjectType)
               || (t1 instanceof NumberType && t2 instanceof NumberType)
    }
}

function location(t) {
    if (!t) return "?,?"
    if (Array.isArray(t)) return location(t[0])
    return t.line + "," + t.col
}

function* expression(node) {
    switch (node.node) {
    case 'string':
    case 'number':
    case 'const':
    case 'id':
        return node
    case 'bop':
        yield* expression(node.left)
        yield* expression(node.right)
        return node
    case 'uop':
        yield* expression(node.right)
        return node
    case 'access':
        yield* expression(node.expr)
        return node
    }
}

function makeType(typeString) {
    switch (typeString) {
        case 'boolean':
        case 'bool':
            return new BooleanType()
        case 'string':
        case 'str':
            return new StringType()
        case 'float':
            return new FloatType()
        case 'double':
            return new DoubleType()
        case 'interer':
        case 'int':
            return new IntegerType()
        case 'longinteger':
            return new LongIntegerType()
        case 'rect2d':
            return new TupleType([new FloatType(), new FloatType(),
                new FloatType(), new FloatType()])
        case 'vector2d':
            return new TupleType([new FloatType(), new FloatType()])
        case 'assocarray':
            return new ObjectType()
        case 'node':
            return new NamedType('node')
        case 'array':
            return new ArrayType(new ObjectType())
        case 'intarray':
            return new ArrayType(new IntegerType())
        case 'floatarray':
            return new ArrayType(new FloatType())
        case 'boolarray':
            return new ArrayType(new BooleanType())
        case 'stringarray':
            return new ArrayType(new StringType())
        case 'nodearray':
            return new ArrayType(new NamedType('node'))
        case 'vector2darray':
            return new ArrayType(new TupleType([new FloatType(), new FloatType()]))
        case 'rect2darray':
            const rectType = new TupleType([new FloatType(), new FloatType(), new FloatType(), new FloatType()])
            return new ArrayType(rectType)
        case 'color':
            return new StringType() //colortype?
        case 'time':
            return new StringType() 
        case 'uri':
            return new StringType()
        default:
            return new ObjectType()
    }
}

function buildTypeFromComponent(component) {

    let interface = new InterfaceType()
    for (const field of component.fields) {
        interface.members.set(field[0], makeType(field[1].get('type')))
    }

//    for (const func of component.functions) {
//        interface.members.set(func[0], new Function(func[0], [new ObjectType()], null))
//    }
    return interface
}

module.exports = {
    check: (componentEntry) => {
        const k = new static_a()
        for (const func of componentEntry.functions.values()) {
            let componentInterface = buildTypeFromComponent(componentEntry.component)
            let mtype = new InterfaceType()
            mtype.members.set('top', componentInterface)
            let ctx = new Map()
            ctx.set('m', mtype)
            k.check(func, ctx)
        }
    }
}

class Type {
    constructor() {
        this.optional = true
    }

    eq(type) {
        return this.name === type.name || type.constructor.name
    }
}

class ObjectType extends Type {
    constructor() {
        super()
    }
}

class BooleanType extends ObjectType {
    constructor() {
        super()
        this.optional = false
    }
}

class StringType extends ObjectType {
    constructor() {
        super()
        this.optional = false
    } 
}

class NumberType extends ObjectType {
    constructor() {
        super()
        this.optional = false
    }
}

class IntegerType extends NumberType {
    constructor() {
        super()
        this.optional = false
    }
}

class LongIntegerType extends NumberType {
    constructor() {
        super()
        this.optional = false
    }
}

class FloatType extends NumberType {
    constructor() {
        super()
        this.optional = false
    }
}

class DoubleType extends NumberType {
    constructor() {
        super()
        this.optional = false
    }
}

class ArrayType extends ObjectType {
    constructor(elementType) {
        super()
        this.elementType = elementType
    }
}

class TupleType extends ObjectType {
    constructor(types) {
        super()
        this.types = types
    }
}

class NamedType extends Type {
    constructor(name) {
        super()
        this.name = name
    }
}

class UndefinedType extends Type {
    constructor() {
        super()
    }
}

class InterfaceType extends Type {
    constructor() {
        super()
        this.members = new Map()
    }

    membersInclude(members) {
        return this.members.every(member => member[1].eq(members.get(member[0])))
    }
    eq(type) {
        return super.eq(type) && this.membersInclude(type.members)
    }
}

class Property {
    constructor(name, type) {
        this.name = name
        this.type = type
    }
}

class Function {
    constructor(name, params, returnType) {
        this.name = name
        this.params = params
        this.returnType = returnType
    }
}