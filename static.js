const { 
    Type, ObjectType, BooleanType, StringType,
    NumberType, IntegerType, LongIntegerType,
    FloatType, DoubleType, ArrayType, TupleType,
    NamedType, UndefinedType, InvalidType, EnumType,
    Function, InterfaceType
} = require('./types')

class static_a {
    warnings = []
    vars = new Map()
    calls = []
    returns = []
    constructor() {
        this.types = null
    }

    warning(token, message, level) {
        this.warnings.push({level: level || 3, message: message, loc: location(token) })
    }

    check(node, ctx) {
        for (const param of node.params) {
            let type = typeFromNode(param.xtype) || makeBasicType(param.type || 'object')
            ctx.set(param.name.toLowerCase(), type)
        }
        const returnType = makeBasicType(node.return || 'void')
        ctx.set('return', returnType)

        const c = this.checkContext(node.statements, ctx)
        if (c && returnType != null)
            this.warning(node.tokens, "not all path return value", 1)
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
                    if (!type instanceof NumberType) {
                        //error
                        this.warning(x.token, 'expecting number')
                    }
                } catch (x) {
                    //error
                    this.warning(x.token, x.error)
                }
            }
            ctx.set(v.name.toLowerCase(), new ArrayType(ObjectType()))
        }
        if (s.node === '=') {
            const declaration = s.lval.node == 'id' && !s.lval.accessors
            if (this.scoped.get(s.lval.val.toLowerCase())) {
                //err no global lval
            }
            let type = ctx.get(s.lval.val.toLowerCase())
            let rtype = this.verifyExpr(s.rval, ctx)

            if (declaration) {
                if (type && !type.eq(rtype)) {
                    this.warning(s.lval, 'type missmatch', 3)
                }
                ctx.set(s.lval.val.toLowerCase(), rtype)
            } else {
                if (!type) {
                    this.warning(s.lval, 'undefined local variable', 1)
                } else {
                    let [ltype, tstack] = this.validateAccess(s.lval, type, ctx)
                    if (tstack.length == 2 && type.name == 'm') {
                        type.add(s.lval.accessors[0].name, rtype)
                    }

                    if (!rtype instanceof ltype.constructor) {
                        //type missmatch. strict warning?
                        this.warning(s.lval, `${s.lval.val} type missmatch `, 3)
                    }
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
        if (s.node == 'for') {
            ctx.set(s.var.val.toLowerCase(), this.verifyExpr(s.start, ctx))
            const to = this.verifyExpr(s.to, ctx)
            if (s.step) {
                const step = this.verifyExpr(s.step, ctx)
            }
            //to and step should be numbers. Ints?
            this.checkContext(s.statements, ctx)
        } else if (s.node == 'foreach') {
            const coll = this.verifyExpr(s.in, ctx)
            if (coll.elementType) {
                ctx.set(s.var.val.toLowerCase(), coll.elementType)
            } else {
                ctx.set(s.var.val.toLowerCase(), new ObjectType())
            }
            this.checkContext(s.statements, ctx)
        } else if (s.node == 'while') {
            const condition = this.verifyExpr(s.condition, ctx)
            if (!condition instanceof BooleanType) {
                this.warning(s.condition, `expecting boolean got ${condition.desc()}`, 3)
            }
            this.checkContext(s.statements, ctx)
        }
        if (s.node == 'return') {
            try {
                if (!s.val && !ctx.get('return')) return null
                if (!s.val && ctx.get('return')) {
                    this.warning(s.tokens, `return should return ${ctx.get('return')}`, 1)
                    return null
                }

                let t = this.verifyExpr(s.val, ctx)
                this.returns.push(t)

                if (!ctx.get('return')) {
                    this.warning(s.tokens, `void function returns ${t.desc()}`, 3)
                } else if (!this.typesComparable(t, ctx.get('return'))) {
                    this.warning(s.tokens, `return type missmatch ${ctx.get('return')} ${t}`)
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

        let keys = Array.from(new Set(c2.keys(), c1.keys()))
        let c = new Map()
        // for (const k of keys) {
        //     if (c1[k] && c2[k] && Object.is(c1[k].type, c2[k].type)) {
        //         c[k] = c1[k]
        //     } else {
        //         let t1 = c1[k] ? c1[k].type : 'undefined'
        //         let t2 = c2[k] ? c2[k].type : 'undefined'
        //         c[k] = c1[k] || c2 [k]
        //         c[k].type = this.mergeArrays(t1, t2)
        //     }
        // }
        return c1
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
        case 'function': //anonimous
            ctx = new Map()
            ctx.set('m', new InterfaceType())
            let context = new static_a()
            context.types = this.types
            context.scoped = this.scoped
            context.check(ex, ctx)
            let rt = context.returns[0]

            // move to typeFromNode
            const params = ex.params.map(a => typeFromNode(a.xtype) || makeBasicType(a.type || 'object'))
            const returnType = typeFromNode(ex.type) || makeBasicType(ex.return || 'void')
            const funcType = new Function(ex.name, params, returnType, false)
            return funcType
        case 'array':
            const values = ex.values.map(a => this.verifyExpr(a, ctx))
            return new TupleType(values)
        case 'object':
            let interfac = new InterfaceType(null, false)
            for (const prop of ex.properties) {
                const propName = prop.name.toLowerCase().replace(/^"|"$/g, '')
                interfac.add(propName, this.verifyExpr(prop.value, ctx))
            }
            return interfac
        case 'string':
            return new StringType(ex.val)
        case 'number':
            return new NumberType(Number(ex.val))
        case 'const':
            return ex.val == 'invalid' ? new InvalidType() : new BooleanType(ex.val)
        case 'bop':
            if (ex.op == '+') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (tl instanceof NumberType && tr instanceof NumberType) {
                    return new NumberType()
                }
                if (tl instanceof StringType && tr instanceof StringType) {
                    return new StringType()
                }
                if (tl.eq(ObjectType) || tr.eq(ObjectType)) {
                    this.warning(ex.token || ex.tokens, 'unsafe cast of object to number/string', 2)
                    return new ObjectType()
                }
                throw { error: `expecting numbers or strings, got ${tl} ${tr}`, token: ex.tokens }
            } else if (ex.op == '-' || ex.op == '*' || ex.op == '\\' || ex.op == '/' || ex.op == 'mod') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (!tl instanceof NumberType) {
                    throw { error: 'expecting number got' + tl, token: ex.left.tokens || ex.left.token }
                }
                if (!tr instanceof NumberType) {
                    throw { error: 'expecting number, got '+tr, token: ex.right.tokens || ex.right.token}
                }
                return new NumberType()
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
                if (tl.value && tr.value) {
                    return BooleanType(tl.value && tr.value)
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
            } else if (ex.op == '-') {
                let t = this.verifyExpr(ex.right, ctx)
                if (!t instanceof NumberType) {
                    throw { error: 'expecting number got ' + t, token: ex.right.tokens }
                }
                if (t.value != null) {
                    return new NumberType(-t.value)
                }
                return t
            }
        case 'access':
            //access validation here
            let t = this.verifyExpr(ex.expr, ctx)
            return 'dynamic'
        case 'id':
            const type = this.scoped.get(ex.val.toLowerCase()) || ctx.get(ex.val.toLowerCase())
            this.vars.set(ex.val, type)

            if (type) {
                return this.validateAccess(ex, type, ctx)[0]
            } else {
                throw { error: `undefined variable ${ex.val}`, token: ex.token }
            }
        }
    }

    resolveNamedType(type) {
        if (!(type instanceof NamedType))
            return type

        const genericParams = type.generic
        const optional = type.optional
        while (type instanceof NamedType) {
            const lookupName = type.name.toLowerCase()
            type = this.types.get(lookupName)
            if (!type) {
                this.warning(type, `undefined type ${lookupName}, 2`)
                return new ObjectType()
            }
        }

        if (type.generic) {
            let newType = new InterfaceType(type.extends, type.optional)
            newType.members = new Map(type.members)
            let genericMap = type.generic.map((a,i)=>[a.val, typeFromNode(genericParams[i])])
            for (const genericKV of genericMap) {
                for (const member of newType.members.values()) {
                    if (member.returnType.name == genericKV[0]) {
                        member.returnType = genericKV[1]
                    }
                }
            }
            type = newType
        }
        type.optional = optional
        return type
    }

    validateAccess(node, type, ctx) {
        if (!node.accessors) {
            return [type, [type]]
        }

        type = this.resolveNamedType(type)
        let typeStack = [type]
        let distype = type
        for (const accessor of node.accessors) {
            switch (accessor.node) {
            case 'prop': //no prop check yet
                if (distype instanceof InterfaceType) {
                    distype = distype.member(accessor.name)
                    distype = this.resolveNamedType(distype)
                    if (!distype) {
                        // warning, not valid property access (or error)
                        // fallback to object. Make fallback conditional?
                        distype = new ObjectType()
                    }
                } else if (distype.eq(ObjectType)) {
                    // no property check for raw object? use property name to guess?
                    distype = new ObjectType()
                } else {
                    if (distype.interface) {
                        const inface = this.types.get(distype.interface.toLowerCase())
                        if (inface) {
                            const member = inface.member(accessor.name)
                            if (member) {
                                distype = member
                            } else {
                                this.warning(accessor, `no ${accessor.name} exists on ${distype.desc()}`, 2)
                            }
                        }
                    } else {
                        // error. no other types allowed property access
                        // throw?
                        this.warning(accessor, `type ${distype.desc()} doesn't allow property access (${accessor.name})`, 1)
                        distype = new ObjectType()
                    }
                }
                break
            case 'call':
                distype = this.validateCall(distype, accessor.args, accessor, ctx, typeStack[typeStack.length-2])
                distype = this.resolveNamedType(distype)
                this.calls.push({o:typeStack[typeStack.length-2],f:typeStack[typeStack.length-1], a:accessor.args, t:distype})
                
                if (!distype) {
                    distype = new ObjectType()
                }
                break
            case 'index':
                if (distype instanceof ArrayType) {
                    if (accessor.indexes.length > 1) {
                    }
                } else if (distype instanceof TupleType) {
                    if (accessor.indexes.length > 1) {
                    }
                    const indexType = this.verifyExpr(accessor.indexes[0], ctx)
                    if (indexType instanceof NumberType && indexType.value) {
                        distype = distype.types[indexType.value]
                    }
                } else if (distype instanceof InterfaceType) {
                    if (accessor.indexes.length > 1) {
                        this.warning(accessor.indexes[1].token, `property access should have only one argument`, 3)
                    }
                    const indexType = this.verifyExpr(accessor.indexes[0], ctx)
                    if (indexType instanceof StringType) {
                        if (indexType.value) {
                            const propType = distype.member(indexType.value.replace(/^"|"$/g, '').toLowerCase())
                            if (propType) {
                                distype = propType
                            } else {
                                this.warning(accessor.indexes[0].token, `can't find property ${indexType.value}`, 2)
                                distype = new ObjectType()
                            }
                        } else {
                            // warn here?
                            distype = new ObjectType()
                        }
                    } else {
                        this.warning(accessor.indexes[0].token, `expecting string got ${indexType.desc()}`, 2)
                    }
                } else if (distype.eq(ObjectType)) {
                    //simply check index expressions. nothing else can be done here 
                    this.warning(accessor.indexes[0].token, `index access on object`, 3)
                    for (const index of accessor.indexes) {
                        const type = this.verifyExpr(index, ctx)
                        if (type instanceof StringType && type.value) {
                            this.warning(index, `use property access '.${type.value}'`, 3)
                        }
                    }
                    distype = new ObjectType()
                } else {
                    // error. non indexable type
                    this.warning(accessor.indexes[0].token, `unexpected property access []`, 2)
                    distype = new ObjectType()
                }
                break
            case 'xmlattr':
                distype = new StringType()
            }
            typeStack.push(distype)
        }
        return [distype, typeStack]
    }

    validateCall(fn, args, node, ctx, self) {
        if (fn.name && fn.name.toLowerCase() == 'createobject') {
            if (args.length < 1) {
                this.warning(node.token, `${fn.name} should have at least one argument`)
                return new ObjectType() //should be read only?
            }
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warnings.push( this.warning(node.token, `${name} first argument should be string`))
                return new ObjectType()
            } else if (arg0.value){
                const componentName = arg0.value.slice(1, -1).toLowerCase()
                if (componentName == 'rosgnode') {
                    let arg1 = this.verifyExpr(args[1], ctx)
                    if (arg1 instanceof StringType && arg1.value) {
                        const nodeType = arg1.value.slice(1, -1).toLowerCase()
                        if (! this.types.get(nodeType)) {
                            console.log(`unrecognized node type ${nodeType}`)
                        }
                        return this.types.get(nodeType) || new NamedType('Node')
                    } else {
                        return new NamedType('Node')
                    }
                } else {
                    if (!this.types.get(componentName)) {
                        console.log(`unrecognized component ${componentName}`)
                    }
                    return this.types.get(componentName) || new ObjectType()
                }
            } else {
                return new ObjectType()
            }
        }
        if (fn.name && fn.name.toLowerCase() == 'createchild') {
            if (args.length < 1) {
                this.warning(node.token, `${fn.name} should have at least one argument`)
                return new NamedType('Node')
            }
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warnings.push( this.warning(node.token, `${name} first argument shoul be string`))
                return new NamedType('Node')
            } else if (arg0.value){
                const nodeType = arg0.value.slice(1, -1).toLowerCase()
                if (! this.types.get(nodeType)) {
                    console.log(`unrecognized node type ${nodeType}`)
                }
                return this.types.get(nodeType) || new NamedType('Node')
            } else {
                return new NamedType('Node')
            }
        }
        if (self instanceof InterfaceType && fn.name && fn.name.toLowerCase() == 'findnode') {
            if (args.length < 1) {
                this.warning(node.token, `${fn.name} should have at least one argument`)
                return new NamedType('Node')
            }
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warning(node, `${arg0.desc()} first argument of findNode should be string`)
                return new NamedType('Node')
            } else if (arg0.value){
                const nodeId = arg0.value.slice(1, -1).toLowerCase()
                if (! self.ids.get(nodeId)) {
                    console.log(`unrecognized node id ${nodeId}`)
                    return new NamedType('Node')
                }
                return self.ids.get(nodeId)
            } else {
                return new NamedType('Node')
            }
        }

        if (fn instanceof Function) {
            for (let i = 0; i < args.length; i++) {
                let type = this.verifyExpr(args[i], ctx)
                if (!type instanceof fn.params[i].constructor) {
                    this.warning(node.tokens, `expecting ${fn.params[i].desc()} got ${type.desc()}`, 2)
                }
            }
            if (args.length < fn.params.length) {
                this.warning(node.tokens, 'not enough arguments')
            }
            if (args.length > fn.params.length) {
                this.warning(node.tokens, 'too many arguments')
            }
            return fn.returnType
        } else if (fn.eq(ObjectType)) {
            this.warning(node.tokens[1], 'function call on object', 3)
            for (let arg of args) {
                const t = this.verifyExpr(arg, ctx)
            }
            return new ObjectType()
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
    if (Array.isArray(t)) return location(t[0] || t[1] || t[2])
    if (t.line) { 
        return t.line + "," + t.col
    } else if (t.li) {
        return t.li.line + "," + t.li.col
    } else if (t.token || t.tokens) {
        location(t.token || t.tokens)
    }
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

function makeBasicType(typeString, optional) {
    switch (typeString.toLowerCase()) {
        case 'boolean':
            return new BooleanType()
        case 'string':
            return new StringType()
        case 'float':
            return new FloatType()
        case 'double':
            return new DoubleType()
        case 'integer':
            return new IntegerType()
        case 'longinteger':
            return new LongIntegerType()
        case 'dynamic':
        case 'object':
            return new ObjectType()
        case 'function':
            //consider using AnyFunction type
            return new ObjectType()
        case 'void':
            return null
        default:
            return null
    }
}

function makeType(typeString) {
    switch (typeString.toLowerCase()) {
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
            return new StringType() // named datetime?
        case 'uri':
            return new StringType()
        default:
            return new NamedType(typeString)
    }
}

function buildTypeFromComponent(component) {

    let interface = new InterfaceType(component.extends.toLowerCase(), false)
    interface.name = component.name
    for (const field of component.fields) {
        interface.members.set(field[0], makeType(field[1].get('type')))
    }

    if (component.children) {
        let ids = childIds(component.children)
        interface.ids = new Map(ids)
    }

//    for (const func of component.functions) {
//        interface.members.set(func[0], new Function(func[0], [new ObjectType()], null))
//    }
    return interface
}

function childIds(xmlNode) {
    let ids = []
    for (const child of Object.entries(xmlNode)) {
        if (!Array.isArray(child[1])) continue

        for (const entry of child[1]) {
            if (entry.$.id) {
                ids.push([entry.$.id.toLowerCase(), new NamedType(child[0], false)])
            }
            ids.push(...childIds(entry))
        }
    }
    return ids
}

function typeFromNode(node) {
    if (!node) return null

    switch (node.node) {
    case 'tupleType':
        const types = node.typeList.map(a => typeFromNode(a))
        return new TupleType(types, node.optional)
    case 'functionType':
        const types2 = node.typeList.map(a => typeFromNode(a))
        return new Function(node.name, types2, typeFromNode(node.type), node.optional)
    case 'arrayType':
        return new ArrayType(typeFromNode(node.type), node.optional)
    case 'namedType':
        let type = makeBasicType(node.name, node.optional)
        if (!type) {
            type = new NamedType(node.name, node.optional)
            type.generic = node.generic
        }
        return type
    case 'string':
        return new StringType(node.val)
    case 'number':
        return new NumberType(node.val)
    case 'array':
        const values = node.values.map(a => typeFromNode(a))
        return new TupleType(values)
    case 'object':
        let interface = new InterfaceType(null, false)
        for (const prop of node.properties) {
            const propName = prop.name.toLowerCase().replace(/^"|"$/g, '')
            interface.add(propName, typeFromNode(prop.value))
        }
        return interface
    case 'interface':
        let interfacen = new InterfaceType(node.extends, node.optional)
        for (const member of node.members) {
            if (member.node == 'function') {
                const params = member.params.map(a => typeFromNode(a.xtype))
                const type = new Function(member.name, params, typeFromNode(member.type))
                interfacen.members.set(member.name.toLowerCase(), type)
            } else if (member.node == 'property') {
                const type = typeFromNode(member.type)
                interfacen.members.set(member.name.toLowerCase(), type)
            }
        }
        interfacen.generic = node.generic
        interfacen.name = node.name
        return interfacen
    case 'const':
        return node.val == 'invalid' ? new InvalidType() : new BooleanType(node.val)
    default:
        return null
    }
}

module.exports = {
    check: (componentEntry) => {
        let mtype = new InterfaceType()
        mtype.name = 'm'
        mtype.members.set('top', componentEntry.types.get(componentEntry.component.name.toLowerCase()))
        mtype.members.set('global', componentEntry.types.get('node'))
        mtype.optional = false

        for (const func of componentEntry.functions.values()) {
            const checker = new static_a()
            checker.types = componentEntry.types
            checker.scoped = componentEntry.scopedFunctions
    
            let ctx = new Map()
            ctx.set('m', mtype)

            //console.log('func ', func.name)
            let w = checker.check(func, ctx)

            if (checker.returns.length < 1) continue
            const returnType = checker.returns.reduce((previous, current) => {
                if (previous.eq(current)) {
                    if (previous.value == current.value) {
                        return previous
                    } else {
                        previous.value = null
                        return previous
                    }
                } else if (previous instanceof InvalidType) {
                    current.optional = true
                    return current
                } else if (current instanceof InvalidType) {
                    previous.optional = true
                    return previous
                } else if (previous instanceof current.constructor) {
                    return current
                } else if (current instanceof previous.constructor) {
                    return previous
                } else {
                    err = 1
                }
            })

            let rtxt = ''
            if (returnType instanceof InterfaceType) {
                rtxt = (returnType.name||'') + [...returnType.members.entries()].map(b=>{
                    return '\n   - ' + b[0] + ' as ' + b[1].desc()
                })
            } else if (returnType) {
                rtxt = returnType.desc() + (returnType.value? '('+returnType.value+')' : '')
            }
            console.log("***", func.name, rtxt)

            // for (const ww of w) {
            //     console.log(ww, func.file)
            // }
        }
    },
    typeFromComponent: (component) => {
        return buildTypeFromComponent(component)
    },
    typesFromAST: (ast) => {
        let types = new Map()
        for (const typeAST of ast) {
            const lookupName = typeAST.name.toLowerCase()
            switch (typeAST.node) {
                case 'interface':
                    types.set(lookupName, typeFromNode(typeAST))
                    break
                case 'typedef':
                    types.set(lookupName, typeFromNode(typeAST.type))
                    break
                case 'enum': 
                    types.set(lookupName, new EnumType(typeAST.cases))
                    break
                case 'function':
                    const params = typeAST.params.map(a => typeFromNode(a.xtype) || makeBasicType(a.type || 'object'))
                    const returnType = typeFromNode(typeAST.type) || makeBasicType(typeAST.return || 'void')
                    const funcType = new Function(typeAST.name, params, returnType, false)
                    types.set(lookupName, funcType)
                    break
            }
        }
        return types
    }
}

class Context {
    values = new Map()

    add(value) {
        this.values.set(value.name.toLowerCase(), value)
    }
}

class ContextValue {
    name = null
    type = null
    value = null
    accessed = false
    readonly = false

    constructor(name, type, value) {
        this.name = name
        this.type = type
        this.value = value
    }
}