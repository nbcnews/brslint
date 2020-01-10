
const { 
    Type, ObjectType, BooleanType, StringType,
    NumberType, IntegerType, LongIntegerType,
    FloatType, DoubleType, ArrayType, TupleType,
    NamedType, UndefinedType, InvalidType, EnumType,
    Function, InterfaceType
} = require('./types')

class DGraph {

    constructor(types, functions, m) {
        this.types = types
        this.scoped = functions
        this.m = m

        this.out = new Map()
        this.in = new Map()
    }

    functionDependencies(node) {
        const c = this.iterateStatments(node.statements)
    }

    iterateStatments(statements) {
        if (!Array.isArray(statements)) statements = [statements]
        for (const s of statements) {
            this.checkStatement(s)
        }
    }

    accessorDependencies(node) {
        let deps = []
        let name = node.val
        for (const accessor of node.accessors || []) {
            switch (accessor.node) {
            case 'prop': 
                name += '.' + accessor.name
                break
            case 'call':
                deps.push(name);name=''
                for (const arg of accessor.args) {
                    deps.push(... this.expressionDeps(arg))
                }
                break
            case 'index':
                deps.push(name);name=''
                for (const arg of accessor.indexes) {
                    deps.push(... this.expressionDeps(arg))
                }
                break
            }
        }
        deps.push(name)
        return deps
    }

    sym(node) {
        let name = node.val
        for (const accessor of node.accessors || []) {
            switch (accessor.node) {
            case 'prop': //props are constants. ignore
                name += '.' + accessor.name
                break
            case 'call':
                return name
            case 'index':
                return name
            }
        }
        return name
    }

    checkStatement(s, ctx) {
        switch(s.node) {
        case 'id':
            let o = {name: this.sym(s)}
            this.in.set(o.name, o)
            o.dep = this.accessorDependencies(s)
            break
        case '+=': //.. -=, ...
            break
        case '=':
            let o1 = {name: this.sym(s.lval)}
            this.out.set(o1.name, o1)
            o1.dep = this.accessorDependencies(s.lval)
            for (const a of this.expressionDeps(s.rval)) {
                this.in.set(a, a)
            }
            //o1.dep.push(...this.expressionDeps(s.rval))
            break
        case 'if':
//            s.condition
            this.iterateStatments(s.then)
            if (s.else) this.iterateStatments(s.else)
            break
        case 'for':
            //this.verifyExpr(s.start, ctx))
            //this.verifyExpr(s.to, ctx)
            //this.verifyExpr(s.step, ctx)
            //this.checkContext(s.statements, ctx)
        case 'foreach':
            //this.verifyExpr(s.in, ctx)
            //this.checkContext(s.statements, ctx)
        case 'while':
            //this.verifyExpr(s.condition, ctx)
            //this.checkContext(s.statements, ctx)
            break
        case 'return':
            for (const a of this.expressionDeps(s.val)) {
                this.out.set(a, a)
            }
            break
        default:
            console.log(s.node)
        }
        return ctx
    }

    expressionDeps(ex) {
        if (!ex) return []
        let deps = []
        switch (ex.node) {
        case 'array':
            deps.push(... ex.values.map(a => this.expressionDeps(a)))
            break
        case 'object':
            for (const prop of ex.properties) {
                deps.push(... this.expressionDeps(prop.value))
            }
            break
        case 'bop':
            deps.push(... this.expressionDeps(ex.left))
            deps.push(... this.expressionDeps(ex.right))
            break
        case 'uop':
            deps.push(... this.expressionDeps(ex.right))
            break
        case 'id':
            deps.push(... this.accessorDependencies(ex))
        }

        return deps
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

module.exports = {
    DGraph: DGraph
}