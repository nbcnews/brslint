const { 
    Type, ObjectType, BooleanType, StringType,
    NumberType, IntegerType, LongIntegerType,
    FloatType, DoubleType, ArrayType, TupleType,
    NamedType, UndefinedType, InvalidType, EnumType,
    Function, InterfaceType
} = require('./types')

const { DGraph } = require('./dgraph'),
      { Print } = require('./print')

class Context {
    warnings = []
    vars = new Map()
    calls = []
    returns = []
    reads = new Set()
    xreads = new Set()
    writes = new Set()
    lookup = new Map()
    constructor(component, m) {
        this.component = component
        this.types = component.types
        this.scoped = component.scopedFunctions
        this.m = m

        //reverse type lookup
        for (const t of this.types.values()) {
            if (t instanceof InterfaceType) {
                for (const member of t.members) {
                    let e = this.lookup.get(member[0]) || []
                    e.push({ type: member[1], of: t })
                    this.lookup.set(member[0], e)
                }
            }
        }
    }

    addType(type) {
        if (type.name.length > 0) {
            this.component.types.set(type.name.toLowerCase(), type)
        }
    }
    warning(token, message, level) {
        this.warnings.push({level: level || 3, message: message, loc: location(token) })
    }

    checkFunction(fn, args) {
        let ctx = new Map()
        ctx.set('m', this.m) //? clone
        const node = fn.ast

        if (args) {
            node.params.forEach((param, i) => {
                ctx.set(param.name.toLowerCase(), args[i]? args[i] : this.resolveNamedType(fn.params[i].type))
            })
        } else {
            node.params.forEach((param, i) => {
                ctx.set(param.name.toLowerCase(), this.resolveNamedType(fn.params[i].type))
            })
        }
        this.return = this.resolveNamedType(typeFromNode(node.type)) || makeBasicType(node.return || 'void')

        const c = this.checkContext(node.statements, ctx)
        if (c && this.return != null)
            this.warning(node.tokens, "not all paths return value", 1)
        
        if (this.returns.length > 0) {
            const rt = this.returns.reduce(Type.aggregate)
            if (rt instanceof InterfaceType && !rt.name) {
                rt.name = node.name
                this.addType(rt)
            }
        }
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
        if (s.node === 'id') { //function call
            const type = ctx.get(s.val.toLowerCase()) || this.scoped.get(s.val.toLowerCase())
            let rtype = this.validateAccess(s, type, ctx)
            if (rtype[0]) {
                //this.warning(s, 'discarding return type', 3)
            }
        }
        if (s.node === 'dim') {
            let v = {
                name: s.name.val,
                type: { type: 'array', dim: s.dimentions, types: [], accessed: false },
            }
            for (let x of s.dimentions) {
                const type = this.verifyExpr(x, ctx)
                if (!type instanceof NumberType) {
                    this.warning(x.token, 'expecting number')
                }
            }
            ctx.set(v.name.toLowerCase(), new ArrayType(ObjectType()))
        }
        if (s.node === '+=' || s.node === '-=' || s.node === '/=' || s.node === '*=' || s.node === '\\=') {
            let type = ctx.get(s.lval.val.toLowerCase())
        }
        if (s.node === '=') {
            const declaration = s.lval.node == 'id' && !s.lval.accessors
            let type = ctx.get(s.lval.val.toLowerCase())
            let rtype = this.verifyExpr(s.rval, ctx)

            if (declaration) {
                if (this.scoped.get(s.lval.val.toLowerCase())) {
                    this.warning(s.lval, `local variable ${s.lval.val} collides with function name`, 1)
                }
                if (type && !type.eq(rtype)) {
                    this.warning(s.lval, `type missmatch redeclaration ${type} to ${rtype}`, 3)
                }
                ctx.set(s.lval.val.toLowerCase(), rtype)
                this.vars.set(s.lval.val, rtype)
            } else {
                type = type || this.scoped.get(s.lval.val.toLowerCase())
                if (!type) {
                    this.warning(s.lval, `undefined local variable ${s.lval.val}`, 1)
                } else {
                    let [ltype, tstack] = this.validateAccess(s.lval, type, ctx, true)
                    if (tstack.length == 2 && type.name == 'm') {
                        const name = s.lval.accessors[0].name
                        let comb = Type.aggregate(type.member(name), rtype)
                        type.add(name, comb)
                    }
                    this.reads.add(accessorToString(s.lval, -1))
                    this.writes.add(accessorToString(s.lval))

                    if (ltype instanceof UndefinedType || ltype instanceof ObjectType ||
                        (ltype instanceof EnumType && ltype.match(rtype)) ||
                        (ltype instanceof ArrayType && rtype instanceof TupleType && rtype.types.every(a => a instanceof ltype.elementType.constructor)) ||
                        (ltype instanceof NumberType && rtype instanceof NumberType) || //consider numbers castable
                        (ltype.optional && rtype instanceof InvalidType) ||
                        rtype instanceof ltype.constructor) {
                        // ok
                    } else {
                        //type missmatch. strict warning?
                        this.warning(s.lval, `${s.lval.val} type missmatch expecting ${ltype} got ${rtype}`, 3)
                    }
                }
            }
        }
        if (s.node == 'if') {
            const ctype = this.verifyExpr(s.condition, ctx)
            if (!ctype instanceof BooleanType) {
                this.warning(s.tokens, `should be bool, got ${ctype}`)
            }

            let rr = this.resolveConditionTypes(s.condition, ctx)

            let c1,c2
            if (s.then) {
                let cpy = new Map(ctx) //Object.assign({}, ctx)
                if (rr && !rr[0].accessors) {
                    cpy.set(rr[0].val, rr[1])
                }
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
                this.warning(s.condition, `expecting boolean got ${condition}`, 3)
            }
            this.checkContext(s.statements, ctx)
        }
        if (s.node == 'return') {
            if (!s.val && !this.return) return null
            if (!s.val && this.return) {
                this.warning(s.tokens, `return should return ${this.return}`, 1)
                return null
            }

            let t = this.verifyExpr(s.val, ctx)
            this.returns.push(t)

            if (!this.return) {
                this.warning(s.tokens, `void function returns ${t}`, 3)
            } else if (!this.typesComparable(t, this.return)) {
                this.warning(s.tokens, `return type missmatch expecting ${this.return} got ${t}`)
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

    typeOf(expr) {
        if (expr.node == 'id' && expr.val == 'type') {
            if (expr.accessors.length > 0) {
                const arg = expr.accessors[0].args[0]
                return arg
            }
        }
        return null
    }
    resolveConditionTypes(ex, ctx) {
        switch (ex.node) {
        case 'bop':
            if (ex.op == '=') {// || ex.op == '<>') {
                if (this.typeOf(ex.left)) {
                    let tr = this.verifyExpr(ex.right, ctx)
                    if (tr instanceof StringType && tr.value) {
                        return [this.typeOf(ex.left), this.resolveNamedType(new NamedType(tr.value))]
                    }
                } else if (this.typeOf(ex.right)) {
                    let tl = this.verifyExpr(ex.left, ctx)
                    if (tl instanceof StringType && tl.value) {
                        return [this.typeOf(ex.right), this.resolveNamedType(new NamedType(tl.value))]
                    }
                }
                return null
            }
            if (ex.op == 'and') {
                let ll = this.resolveConditionTypes(ex.left, ctx)
                let rr = this.resolveConditionTypes(ex.right, ctx)
                if (ll || rr) {
                    return ll || rr
                }
            }
            if (ex.op == 'or') {
                let ll = this.resolveConditionTypes(ex.left, ctx)
                let rr = this.resolveConditionTypes(ex.right, ctx)
                if (ll || rr) {
                    //bad
                    return null
                }
            }
            return null
        case 'uop':
            if (ex.op == 'not') {
                let rr = this.resolveConditionTypes(ex.right, ctx)
                if (rr) {
                    //ouch
                    console.log('unexpected negation of type check')
                }
            }
        }
        return null
    }
    verifyExpr(ex, ctx) {
        switch (ex.node) {
        case 'sub':
        case 'function': //anonimous
            // let context = new Context(this.types, this.scoped, new InterfaceType())
            // //should run type cherck after context is built
            // context.checkFunction(ex)
            // let rt = context.returns[0]

            // move to typeFromNode?
            const params = ex.params.map(a => {
                return {
                    type: typeFromNode(a.xtype) || makeBasicType(a.type || 'object'),
                    optional: a.optional
                }
            })
            const returnType = typeFromNode(ex.type) || makeBasicType(ex.return || 'void')
            const funcType = new Function(ex.name, params, returnType, false, ex)
            ex.xtype = funcType
            let context = new Context(this.component, ctx.get('m'))
            context.checkFunction(funcType)
            this.warnings.concat(context.warnings)
            return funcType
        case 'array':
            const values = ex.values.map(a => this.verifyExpr(a, ctx))
            return new TupleType(values)
        case 'object':
            let interfac = new InterfaceType(null, false)
            for (const prop of ex.properties) {
                const propName = prop.name.toLowerCase().replace(/^"|"$/g, '')
                const expr = this.verifyExpr(prop.value, ctx)
                interfac.add(propName, expr)
                if (expr instanceof Function) {
                    expr.name = propName
                }
            }
            for (const member of interfac.members.values()) {
                if (member instanceof Function) {
                    // reference to local var or named function? ie. node == 'id'
                    let context = new Context(this.component, interfac)
                    context.checkFunction(member)
                    this.warnings.concat(context.warnings)
                }
            }
            return interfac
        case 'string':
            return new StringType(ex.val.replace(/^"|"$/g, ''))
        case 'number':
            switch(ex.type) {
                case 'integer':
                    return new IntegerType(ex.number)
                case 'longinteger':
                    return new LongIntegerType(ex.number)
                case 'float':
                    return new FloatType(ex.number)
                case 'double':
                    return new DoubleType(ex.number)
            }
            return new NumberType(ex.val)
        case 'const':
            return ex.val == 'invalid' ? new InvalidType() : new BooleanType(ex.val)
        case 'bop':
            if (ex.op == '+') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (tl instanceof NumberType && tr instanceof NumberType) {
                    return tl.bop(tr, ex.op)
                }
                if (tl instanceof StringType && tr instanceof StringType) {
                    return new StringType()
                }
                if (tl.eq(ObjectType) || tr.eq(ObjectType)) {
                    this.warning(ex.token || ex.tokens, 'unsafe cast of object to number/string', 2)
                    return new ObjectType()
                }
                this.warning(ex, `expecting numbers or strings, got ${tl} ${tr}`, 2)
                return new ObjectType()
            } else if (ex.op == '-' || ex.op == '*' || ex.op == '\\' || ex.op == '/' 
                    || ex.op == 'mod' || ex.op == '^' || ex.op == '>>' || ex.op == '<<') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (!(tl instanceof NumberType)) {
                    this.warning(ex.left, `expecting number got ${tl}`, 2)
                }
                if (!(tr instanceof NumberType)) {
                    this.warning(ex.right, `expecting number got ${tr}`, 2)
                }
                if (tl instanceof NumberType && tr instanceof NumberType) {
                    return tl.bop(tr, ex.op)
                }
                return new NumberType()
            } else if (ex.op == '=' || ex.op == '<>') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (this.typesComparable(tl,tr))
                    return new BooleanType()
                else {
                    this.warning(ex, `type missmatch comparing ${tl} ${tr}`, 2)
                    return new BooleanType()
                }
            } else if (ex.op === '>' || ex.op == '<' || ex.op == '<=' || ex.op == '>=') {  
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (tl instanceof NumberType && tr instanceof NumberType) {
                    return new BooleanType()
                }
                this.warning(ex, `type missmatch comparing ${tl} ${tr}`, 2)
                return new BooleanType()
            } else if (ex.op == 'and' || ex.op == 'or') {
                let tl = this.verifyExpr(ex.left, ctx)
                let tr = this.verifyExpr(ex.right, ctx)
                if (!tl instanceof BooleanType) {
                    this.warning(ex.left, `expecting boolean got ${tl}`, 2)
                    return new BooleanType()
                }
                if (!tr instanceof BooleanType) {
                    this.warning(ex.right, `expecting boolean got ${tr}`, 2)
                    return new BooleanType()
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
                    this.warning(ex.right, `expecting boolean got ${t}`, 2)
                    return new BooleanType()
                }
                return t
            } else if (ex.op == '-') {
                let t = this.verifyExpr(ex.right, ctx)
                if (!t instanceof NumberType) {
                    this.warning(ex.right, `expecting number got ${t}`, 2)
                    return new NumberType()
                }
                if (t.value != null) {
                    return new NumberType(-t.value)
                }
                return t
            }
        case 'id':
            const type = this.scoped.get(ex.val.toLowerCase()) || ctx.get(ex.val.toLowerCase())
            this.reads.add(accessorToString(ex))
            if (ex.val.toLowerCase() == 'm' && !this.writes.has(accessorToString(ex,-1))) {
                this.xreads.add(accessorToString(ex))
            }

            if (type) {
                return this.validateAccess(ex, type, ctx)[0]
            } else {
                this.warning(ex, `undefined variable ${ex.val}`, 1)
                return new ObjectType()
            }
        }
    }

    resolveNamedType(type) {
        if (!(type instanceof NamedType))
            return type

        const genericParams = type.generic || []
        const optional = type.optional
        while (type instanceof NamedType) {
            const lookupName = type.name.toLowerCase()
            type = this.types.get(lookupName)
            if (!type) {
                const basic = makeBasicType(lookupName, optional)
                if (basic) {
                    return basic
                } else {
                    this.warning(type, `undefined type ${lookupName}`, 2)
                    return new ObjectType()
                }
            }
        }

        if (type.isGeneric()) {
            let genericMap = type.generics().map((a,i)=>[a.name.val, typeFromNode(genericParams[i] || a.default)])
            type = type.generize(genericMap)
            type.genericTypes = genericMap.map(a => a[1])
        }

        type.optional = optional
        return type
    }

    validateAccess(node, type, ctx, lval) {
        if (!node.accessors) {
            node.xtype = type
            return [type, [type]]
        }

        type = this.resolveNamedType(type)
        let typeStack = [type]
        let distype = type
        let path = node.val
        for (const accessor of node.accessors) {
            switch (accessor.node) {
            case 'prop':
                path += `.${accessor.name}`
                if (distype instanceof InterfaceType) {
                    let distypeHuh = distype.member(accessor.name)
                    distypeHuh = this.resolveNamedType(distypeHuh)
                    if (!distypeHuh) {
                        if (lval == true && typeStack.length == node.accessors.length && typeStack[typeStack.length-1].open) {
                            distypeHuh = new UndefinedType()
                        } else {
                            if (distype.estimatedType) {
                                distypeHuh = distype.estimatedType.member(accessor.name)
                                distypeHuh = this.resolveNamedType(distypeHuh)
                                if (!distypeHuh) {
                                    distype.estimatedType = null
                                }
                            }
                            let typeOptions = this.lookup.get(accessor.name.toLowerCase())
                            if (typeOptions) {
                                typeOptions = typeOptions.filter(a=>a.of.basedOn(distype))
                                if (typeOptions.length > 0) {
                                    let aggType = typeOptions.map(a=>a.of).reduce(Type.aggregate)
                                    if (aggType.subtypeOf(distype)) {
                                        distype.estimatedType = aggType
                                        distypeHuh = aggType.member(accessor.name)
                                        distypeHuh = this.resolveNamedType(distypeHuh)
                                    }
                                }
                            }

                            this.warning(accessor, `unexpected property '${accessor.name}' of ${typeStack[typeStack.length-1]}`, 2)
                            distypeHuh = new ObjectType()
                        }
                    }
                    distype = distypeHuh

                } else if (distype.eq(ObjectType)) {
                    // no property check for raw object? use property name to guess?
                    let typeOptions = this.lookup.get(accessor.name.toLowerCase())
                    if (typeOptions) {
                        let aggType = typeOptions.map(a=>a.of).reduce(Type.aggregate)
                        if (aggType instanceof InterfaceType) {
                            distype.estimatedType = aggType
                        }
                        distype = typeOptions.map(a=>a.type).reduce(Type.aggregate)
                    } else {
                        distype = new ObjectType()
                    }
                } else {
                    if (distype.interface) {
                        const inface = this.types.get(distype.interface.toLowerCase())
                        if (inface) {
                            const member = inface.member(accessor.name)
                            if (member) {
                                distype = member
                            } else {
                                this.warning(accessor, `no ${accessor.name} exists on ${distype}`, 2)
                            }
                        }
                    } else {
                        this.warning(accessor, `type ${distype} doesn't allow property access (${accessor.name})`, 1)
                        distype = new ObjectType()
                    }
                }
                break
            case 'call':
                path += '(...)'
                distype = this.validateCall(distype, accessor.args, accessor, ctx, typeStack[typeStack.length-2])
                distype = this.resolveNamedType(distype)
                this.calls.push({o:typeStack[typeStack.length-2],
                    f:typeStack[typeStack.length-1], a:accessor.args.map(a=>this.verifyExpr(a,ctx)), t:distype})
                break
            case 'index':
                path += '[]'
                if (distype instanceof ArrayType) {
                    if (accessor.indexes.length > 1) {
                        // multiple indexes are [1,2,3] [1][2][3]
                    }
                    distype = this.resolveNamedType(distype.elementType)
                } else if (distype instanceof TupleType) {
                    if (accessor.indexes.length > 1) {

                    }
                    const indexType = this.verifyExpr(accessor.indexes[0], ctx)
                    if (indexType instanceof IntegerType && indexType.value != null) {
                        distype = distype.types[indexType.value]
                    } else {
                        distype = distype.types.reduce(Type.aggregate)
                    }
                } else if (distype instanceof InterfaceType) {
                    if (accessor.indexes.length > 1) {
                        this.warning(accessor.indexes[1].token, `property access should have only one argument`, 3)
                    }
                    const indexType = this.verifyExpr(accessor.indexes[0], ctx)
                    if (!(indexType instanceof StringType)) {
                        this.warning(accessor.indexes[0].token, `expecting string got ${indexType}`, 2)
                    }
                    if (indexType instanceof StringType && indexType.value) {
                        const propType = distype.member(indexType.value.replace(/^"|"$/g, ''))
                        if (propType) {
                            distype = propType
                        } else {
                            if (distype.name == 'ifAssociativeArray') {
                                distype = distype.genericTypes[0]
                            } else {
                                this.warning(accessor.indexes[0].token, `can't find property ${indexType.value}`, 2)
                                distype = new ObjectType()
                            }
                        }
                    } else {
                        if (distype.name == 'ifAssociativeArray') {
                            distype = distype.genericTypes[0].clone()
                            distype.optional = true
                        } else if (distype.members.size > 0) {
                            distype = [...distype.members.values()].reduce(Type.aggregate)
                            distype.optional = true
                        } else {
                            distype = new ObjectType()
                        }
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

        node.xtype = distype
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
                const componentName = arg0.value.toLowerCase()
                if (componentName == 'rosgnode') {
                    let arg1 = this.verifyExpr(args[1], ctx)
                    if (arg1 instanceof StringType && arg1.value) {
                        const nodeType = arg1.value.toLowerCase()
                        if (! this.types.get(nodeType)) {
                            console.log(`unrecognized node type ${nodeType}`)
                        }
                        const type = this.types.get(nodeType)
                        if (type) {
                            const clone = type.clone()
                            clone.optional = false
                            return clone
                        }
                        return new NamedType('Node', false)
                    } else {
                        return new NamedType('Node', false)
                    }
                } else {
                    const type = this.types.get(componentName)
                    if (type) {
                        const clone = type.clone()
                        clone.optional = false
                        return clone
                    } else {
                        console.log(`unrecognized component ${componentName}`)
                        return new ObjectType(null, false)
                    }
                }
            } else {
                return new ObjectType(null, false)
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
                const nodeType = arg0.value.toLowerCase()
                if (! this.types.get(nodeType)) {
                    console.log(`unrecognized node type ${nodeType}`)
                }
                return this.types.get(nodeType) || new NamedType('Node')
            } else {
                return new NamedType('Node')
            }
        }
        if (self instanceof InterfaceType && self.basedOn('Node') && fn.name && fn.name.toLowerCase() == 'findnode') {
            if (args.length < 1) {
                this.warning(node.token, `${fn.name} should have at least one argument`)
                return new NamedType('Node')
            }
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warning(node, `${arg0} first argument of findNode should be string`)
                return new NamedType('Node')
            } else if (arg0.value){
                const nodeId = arg0.value.toLowerCase()
                if (! self.ids.get(nodeId)) {
                    console.log(`unrecognized node id ${nodeId}`)
                    return new NamedType('Node')
                }
                return self.ids.get(nodeId)
            } else {
                return new NamedType('Node')
            }
        }
        if (self instanceof InterfaceType && self.basedOn('Node') && fn.name && (fn.name.toLowerCase() == 'observefield' || fn.name.toLowerCase() == 'observefieldscoped')) {
            if (args.length !== 2) {
                this.warning(node.token, `${fn.name} should have two arguments`)
                return new BooleanType()
            }
            let fieldType = null
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warning(node, `${arg0} first argument of ${fn.name} should be a string`)
            } else if (arg0.value) {
                fieldType = self.member(arg0.value)
                if (!fieldType) {
                    this.warning(node, `Field ${arg0.value} doesn't exist`)
                }
            }
            let arg1 = this.verifyExpr(args[1], ctx)
            if (arg1.name === 'roMessagePort') return new BooleanType()
            if (!arg1.eq(StringType)) {
                this.warning(node, `second argument of ${fn.name} should be a string or roMessagePort`)
            } else if (arg1.value){
                const functionName = arg1.value.toLowerCase()
                const fn = this.scoped.get(functionName)
                if (!fn) {
                    this.warning(node, `Function ${arg1.value} doesn't exist in component scope`)
                } else if (fn.params.length > 1) {
                    this.warning(node, `Function ${arg1.value} should have zerro or one argument`)
                } else if (fn.params.length == 1) {
                    let param = fn.params[0]
                    if (param.type.eq(ObjectType)) {
                        let event = new NamedType('roSGNodeEvent')
                        event.generic = [fieldType, self]
                        param.type = this.resolveNamedType(event)
                    }
                }
            }
            return new BooleanType()
        }
        if (self instanceof InterfaceType && self.basedOn('Node') && fn.name && fn.name.toLowerCase() == 'callfunc') {
            if (args.length < 1) {
                this.warning(node.token, `${fn.name} should have at least one argument`)
                return new ObjectType()
            }
            let arg0 = this.verifyExpr(args[0], ctx)
            if (!arg0.eq(StringType)) {
                this.warning(node, `${arg0} first argument of ${fn.name} should be a string`)
            } else if (arg0.value) {
                const fn = self.member(arg0.value)
                if (!fn) {
                    this.warning(node, `Function ${arg0.value} doesn't exist in ${self}`)
                    return new ObjectType()
                } else {
                    // check args
                }
                return fn.returnType
            }
            return new ObjectType()
        }

        if (fn instanceof Function) {
            const argsTypes = args.map(a => this.verifyExpr(a, ctx))
            for (const [i, param] of fn.params.entries()) {
                const paramType = this.resolveNamedType(param.type)
                const argType = argsTypes[i]
                if (!argType && !param.optional) {
                    this.warning(node.tokens, 'not enough arguments', 1)
                }
                if (argType && !argType.subtypeOf(paramType)) {
                    this.warning(args[i], `expecting argument of ${paramType} got ${argType}`, 2)
                }
            }
            if (args.length > fn.params.length) {
                this.warning(node.tokens, 'too many arguments', 3)
            }
            if (fn.ast && fn.returnType && argsTypes.length > 0) {
                this.checkFunction(fn, argsTypes)
                if (this.returns.length > 0) {
                    let agg = this.returns.reduce(Type.aggregate)
                    if (agg.subtypeOf(fn.returnType)) {
                        fn.returnType = agg
                    }
                }
                this.returns = []
            }
            return fn.returnType
        } else if (fn.eq(ObjectType)) {
            this.warning(node.tokens[1], 'function call on object', 3)
            for (let arg of args) {
                const t = this.verifyExpr(arg, ctx)
            }
            return new ObjectType()
        } else {
            this.warning(node, `function call on ${fn}`, 2)
            return new UndefinedType()
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
        if (t1 instanceof UndefinedType || t2 instanceof UndefinedType) {
            return false
        }
        return    t1.eq(t2)
               || (t1 instanceof InvalidType && t2.optional)
               || (t2 instanceof InvalidType && t1.optional)
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
        return location(t.token || t.tokens)
    }
}

function accessorToString(node, end) {
    return node.val +
    (node.accessors || []).slice(0,end).map(a=>{
        if (a.node == 'prop')
            return "." + a.name
        else if (a.node == 'index')
            return "[]"
        else 
            return "()"
    }).join('')
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

function makeBasicType(typeString) {
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
            return new NamedType('ifAssociativeArray')
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

function buildTypeFromComponent(component, functions) {

    let interface = new InterfaceType(component.extends.toLowerCase(), false)
    interface.name = component.name
    for (const field of component.fields) {
        interface.members.set(field[0], makeType(field[1].get('type')))
    }

    if (component.children) {
        let ids = childIds(component.children)
        interface.ids = new Map(ids)
    }

    for (const func of component.functions) {
        const fn = functions.get(func[0])
        if (fn) {
            interface.members.set(func[0], fn)
        }
    }
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
    if (node instanceof Type) return node

    switch (node.node) {
    case 'tupleType':
        const types = node.typeList.map(a => typeFromNode(a))
        return new TupleType(types, node.optional)
    case 'functionType':
        const types2 = node.typeList.map(a => { return { type: typeFromNode(a), optional: false }})
        return new Function(node.name, types2, typeFromNode(node.type), node.optional)
    case 'arrayType':
        return new ArrayType(typeFromNode(node.type), node.optional)
    case 'namedType':
        let type = makeBasicType(node.name)
        if (!type) {
            type = new NamedType(node.name)
            type.generic = node.generic
        }
        if (node.optional !== null) {
            type.optional = node.optional
        }
        return type
    case 'string':
        return new StringType(node.val.replace(/^"|"$/g, ''))
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
        let interfacen = new InterfaceType(node.extends, node.optional, false)
        for (const member of node.members) {
            if (member.node == 'function') {
                const params = member.params.map(a => { return { type: typeFromNode(a.xtype), optional: a.optional }})
                const type = new Function(member.name, params, typeFromNode(member.type), member.optional)
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
        let errors = []
        let mtype = new InterfaceType('ifAssociativeArray', false, true)
        mtype.base = componentEntry.types.get('ifassociativearray')
        mtype.name = 'm'
        mtype.members.set('top', componentEntry.types.get(componentEntry.component.name.toLowerCase()))
        mtype.members.set('global', componentEntry.types.get('node'))

        let compot = {
            name: componentEntry.component.name,
            fn: []
        }

        console.log(`component ${componentEntry.component.name}`)

        let callz = []
        for (const func of componentEntry.functions.values()) {
            const context = new Context(componentEntry, mtype)

            const fn = componentEntry.scopedFunctions.get(func.name.toLowerCase())
            let w = context.checkFunction(fn)
            let calls = context.calls.filter(a=>!a.o && componentEntry.functions.has(a.f.name.toLowerCase())).map(a => a.f)
            compot.fn.push({ name: func.name, calls: calls, ast: func })
            let reads = Array.from(context.reads).filter(a=>a.startsWith('m.'))
            let writes = Array.from(context.writes).filter(a=>a.startsWith('m.'))
            func.reads = reads
            func.writes = writes
            for (const p of func.params) {
                p.out = Array.from(context.writes).filter(a=>a.startsWith(p.name + '.')).length > 0
            }

            callz.push(...context.calls.filter(a=>a.f.name && componentEntry.functions.has(a.f.name.toLowerCase())))
        }

        let fns = [...compot.fn.map(a=>{return {name:a.name,ast:a.ast,calls:[...a.calls]}})]
        while (fns.length > 0) {
            let mifun = fns.filter(a => a.calls.length == 0)[0]
            let func = mifun.ast

            const context = new Context(componentEntry, mtype)
            const fn = componentEntry.scopedFunctions.get(func.name.toLowerCase())
            context.checkFunction(fn)
            for (const warning of context.warnings) {
                warning.file = func.file
                errors.push(warning)
            }

            fns = fns.filter(a => a.name !== mifun.name)
            fns.forEach(e => {
                e.calls = e.calls.filter(a => a.name !== mifun.name)
            })

            if (context.returns < 1) continue
            const returnType = context.returns.reduce(Type.aggregate)
            let funtype = componentEntry.scopedFunctions.get(mifun.name.toLowerCase())
            funtype.returnType = returnType
        }
        const print = new Print()
        console.log(print.printComponent(componentEntry))
        //console.log(JSON.stringify(compot))
        return errors
    },
    typeFromComponent: (component, functions) => {
        return buildTypeFromComponent(component, functions)
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
                case 'sub':
                    const params = typeAST.params.map(a => { return { type: typeFromNode(a.xtype) || makeBasicType(a.type || 'object'), optional: a.optional }})
                    const returnType = typeFromNode(typeAST.type) || makeBasicType(typeAST.return || 'void')
                    const ast = typeAST.statements? typeAST : null
                    const funcType = new Function(typeAST.name, params, returnType, false, ast)
                    types.set(lookupName, funcType)
                    break
            }
        }
        return types
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