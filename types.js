
class Type {
    constructor() {
        this.optional = true
    }

    toString() {
        return this.constructor.name
    }

    eq(type) {
        const thisTypeName = this.constructor.name
        return thisTypeName === type.name || thisTypeName === type.constructor.name
    }

    subtypeOf(type) {
        return this instanceof type.constructor
    }

    isGeneric() {
        return false
    }

    generize(generics) {
        return this
    }

    static aggregate(type1, type2) {
        if (!type1) return type2
        if (!type2) return type1
        if (type1.eq(type2)) {
            let type = type1.clone()
            type.value = null
            return type
        } else if (type1 instanceof InvalidType) {
            let type = type2.clone()
            type.optional = true
            return type
        } else if (type2 instanceof InvalidType) {
            let type = type1.clone()
            type.optional = true
            return type
        } else if (type1 instanceof NumberType && type2 instanceof NumberType) {
            let optional = type1.optional || type2.optional || false
            return new NumberType(null, optional)
        } else if (type1 instanceof InterfaceType && type2 instanceof InterfaceType) {
            if (type1.subtypeOf(type2)) {
                return type2 //clone? optional?
            } else if (type2.subtypeOf(type1)) {
                return type1 //clone?
            } else if (!type1.base && !type2.base) {
                let optional = type1.optional || type2.optional
                // intersection of members
                let iface = new InterfaceType(null, optional, false)
                const memberNames = new Set([...type2.members.keys(), ...type1.members.keys()])
                for (const name of memberNames) {
                    let t1 = type1.member(name)
                    let t2 = type2.member(name)
                    let t = Type.aggregate(t1,t2)
                    iface.add(name, t)
                }
                return iface
            } else {
                // common base
                let b1 = type1.derivedFrom()
                let b2 = type2.derivedFrom()
                let to = Math.min(b1.length, b2.length)
                let commonBase = null
                for (let index = 0; index < to; index++) {
                    if (b1[index].eq(b2[index])) {
                        commonBase = b1[index]
                    } else {
                        break
                    }
                }
                if (commonBase) {
                    return commonBase
                }
            }
            return new ObjectType(null, )
        } else {
            let optional = type1.optional || type2.optional
            return new ObjectType(null, optional)
        }
    }
}

class ObjectType extends Type {
    estimatedType = null
    interface = 'toString'

    constructor(value, optional) {
        super()
        this.value = value || null
        if (optional != undefined) this.optional = optional
    }

    clone() {
        return new ObjectType(this.value, this.optional)
    }
}

class BooleanType extends ObjectType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }

    clone() {
        return new BooleanType(this.value, this.optional)
    }
}

class StringType extends ObjectType {
    constructor(value, optional) {
        super()
        this.interface = 'roString'
        this.optional = (optional != undefined) ? optional : false
        this.value = value || null
    }

    clone() {
        return new StringType(this.value, this.optional)
    }
}

class NumberType extends ObjectType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }

    clone() {
        return new this.constructor(this.value, this.optional)
    }

    bop(type, op) {
        let result = null
        if (this instanceof DoubleType || type instanceof DoubleType) {
            result = new DoubleType()
        } else if (this instanceof FloatType || type instanceof FloatType) {
            result = new FloatType()
        } else if (this instanceof LongIntegerType || type instanceof LongIntegerType) {
            result = new LongIntegerType()
        } else {
            result = new IntegerType()
        }

        // Special type rules for operators. Verified on Roku 9.2
        switch(op) {
        case '/':
            // if either operands is Long result is Long! Even Double/Long! Bug?
            if (this instanceof LongIntegerType || type instanceof LongIntegerType) {
                result = new LongIntegerType()
            } else if (result instanceof IntegerType) {
                result = new FloatType()
            }
            break
        case '\\':
            if (!(result instanceof LongIntegerType)) {
                result = new IntegerType()
            }
            break
        case '^':
            if (result instanceof LongIntegerType) {
                result = new DoubleType()
            }
            break
        case '<<':
        case '>>':
            if (result instanceof FloatType || result instanceof DoubleType) {
                // Float,Double args converted to int by truncation: 2.9 << 2.9 -> 2 << 2 -> 8
                result = new IntegerType()
            }
        }

        if (this.value && type.value) {
            switch(op) {
            case '+':
                result.value = this.value + type.value
                break
            case '-':
                result.value = this.value - type.value
                break
            case '*':
                result.value = this.value * type.value
                break
            case '/':
                result.value = this.value / type.value
                break
            case '\\':
                result.value = Math.trunc(this.value / type.value)
                break
            case 'mod':
                result.value = this.value % type.value
                break
            case '^':
                result.value = this.value ** type.value
                break
            case '<<':
                result.value = Math.trunc(this.value) << Math.trunc(type.value)
            case '>>':
                result.value = Math.trunc(this.value) >> Math.trunc(type.value)
            }
        }

        return result
    }
}

class IntegerType extends NumberType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }
}

class LongIntegerType extends NumberType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }
}

class FloatType extends NumberType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }
}

class DoubleType extends NumberType {
    constructor(value, optional) {
        super()
        this.interface = 'toString'
        this.optional = (optional != undefined) ? optional : false
        this.value = (value != undefined) ? value : null
    }
}

class ArrayType extends ObjectType {
    optional = true
    constructor(elementType, optional) {
        super()
        this.interface = 'roArray'
        this.elementType = elementType
        if (optional != undefined) this.optional = optional
    }

    toString() {
        return `[${this.elementType}]`
    }

    clone() {
        return new ArrayType(this.elementType.clone(), this.optional)
    }

    eq(type) {
        return super.eq(type) &&
            this.elementType.eq(type.elementType)
    }

    subtypeOf(type) {
        if (type instanceof ArrayType) {
            // arrays invariant. need to know about read/write access 
            return this.elementType.eq(type.elementType)
        }
        return super.subtypeOf(type)
    }

    generize(generics) {
        const nt = this.elementType.generize(generics)
        if (this.elementType !== nt) {
            return new ArrayType(nt, this.optional)
        }
        return this
    }
}

class TupleType extends ObjectType {
    optional = true
    constructor(types, optional) {
        super()
        this.interface = 'roArray'
        this.types = types
        if (optional != undefined) this.optional = optional
    }

    clone() {
        return new TupleType(this.types.map(t => t.clone()), this.optional)
    }

    eq(type) {
        return super.eq(type) && 
            this.types.length == type.types.length &&
            this.types.every((a,i) => a.eq(type.types[i]))
    }

    subtypeOf(type) {
        if (type instanceof TupleType) {
            return this.types.length == type.types.length &&
                // tuples are covariant with expectation that tuples are read only
                this.types.every((a,i) => a.subtypeOf(type.types[i]))
        }
        if (type instanceof ArrayType) {
            // arrays are covariant with expectation of read only access or
            // tuple no longer accessed as tuple
            return this.types.every(a => a.subtypeOf(type.elementType))
        }
        return super.subtypeOf(type)
    }

    generize(generics) {
        const nt = this.types.map(type => {
            return type.generize(generics)
        })
        const same = this.types.every((a,i) => a === nt[i])
        if (!same) {
            return new TupleType(nt, this.optional)
        }
        return this
    }
}

class NamedType extends Type {
    constructor(name, optional) {
        super()
        this.name = name
        if (optional != undefined) this.optional = optional
    }

    clone() {
        return new NamedType(this.name, this.optional)
    }

    generize(generics) {
        for (const generic of generics) {
            if (this.name == generic[0]) {
                return generic[1] //optional passthrough
            }
        }
        return this
    }
}

class UndefinedType extends Type {
}
class InvalidType extends ObjectType {
    clone() {
        return new InvalidType()
    }
}

class InterfaceType extends ObjectType {
    open = true
    base = null
    constructor(extend, optional, open) {
        super()
        this.extends = extend
        this.members = new Map()
        if (optional != undefined) this.optional = optional
        if (open != undefined) this.open = open
    }

    clone() {
        let clone = new InterfaceType(this.extends, this.optional, this.open)
        clone.name = this.name
        clone.base = this.base
        clone.members = new Map([...this.members.entries()].map(m => [m[0], m[1].clone()]))
        return clone
    }

    add(name, type) {
        this.members.set(name.toLowerCase(), type)
    }
    baseMember(name) {
        if (!this.base) return null
        return this.base.member(name)
    }
    member(name) {
        name = name.toLowerCase()
        return this.members.get(name) || this.baseMember(name)
    }
    membersInclude(members) {
        // just comparing names. Is is enough or full type check is better?
        return [...this.members.keys()].every(name => members.has(name))
    }

    derivedFrom() {
        if (!this.base) {
            return []
        }
        return [...this.base.derivedFrom(), this.base]
    }

    basedOn(name) {
        if (this.name == name) {
            return true
        }
        if (this.base) {
            return this.base.basedOn(name)
        }
        return false
    }

    toString() {
        return this.name ? this.name : 'Interface'
    }

    eq(type) {
        return super.eq(type) && this.extends == type.extends && this.membersInclude(type.members)
    }

    subtypeOf(type) {
        if (type instanceof InterfaceType) {
            if (type.name == 'ifAssociativeArray') {
                //TD: check members against generic param
                return true
            }
            if (this.base && this.base.subtypeOf(type)) {
                return true
            }
            // interfaces are invariant for now
            return this.eq(type)
        }
        return super.subtypeOf(type)
    }

    isGeneric() {
        return this.generic || (this.base && this.base.isGeneric())
    }

    generics() {
        return this.generic || (this.base ? this.base.generics() : null)
    }

    generize(generics) {
        let newMembers = new Map()
        let same = true
        for (const member of this.members) {
            const nm = member[1].generize(generics)
            newMembers.set(member[0], nm)
            if (nm !== member[1]) {
                same = false
            }
        }
        let newBase = this.base ? this.base.generize(generics) : null
        if (!same || this.base !== newBase) {
            let newType = new InterfaceType(this.extends, this.optional, this.open)
            newType.name = this.name
            newType.members = newMembers
            newType.base = newBase
            return newType
        }
        return this
    }
}

class EnumType extends ObjectType {
    optional = false
    constructor(cases, optional) {
        super()
        if (optional != undefined) this.optional = optional
        this.cases = new Map(cases.map(a => [a.name.toLowerCase(), a]))
    }

    clone() {
        return new EnumType(this.cases.values(), this.optional)
    }

    eq(type) {
        return super.eq(type) &&
            this.cases.length == type.cases.length &&
            this.cases.every((a,i) => a.name == type.case[i].name)
    }

    match(type) {
        let value
        if (type instanceof StringType) {
            value = type.value.toLowerCase().substr(1, type.value.length - 2)
        } else if (type instanceof NumberType) {
            value = type.value
        } else {
            return false
        }

        return [...this.cases.values()].some(a => (a.value || a.name) === value)
    }
}

class Property {
    constructor(name, type) {
        this.name = name
        this.type = type
    }
}

class Function extends ObjectType {
    ast = null
    optional = true
    constructor(name, params, returnType, optional, ast) {
        super()
        this.name = name
        this.params = params
        this.returnType = returnType
        if (optional != undefined) this.optional = optional
        if (ast != undefined) this.ast = ast
    }

    clone() {
        return new Function(this.name, this.params, this.returnType, this.optional, this.ast)
    }

    eq(type) {
        const eqReturns = !(this.returnType || type.returnType) ||
            this.returnType && type.returnType && this.returnType.eq(type.returnType)
        const eqParams = this.params.length == type.params.length &&
            // ignoring params optionality
            this.params.every((a,i) => a.type.eq(type.params[i].type))
        return super.eq(type) && eqReturns && eqParams  
    }

    generize(generics) {
        const newTypes = this.params.map(param => {
            return {
                type: param.type.generize(generics),
                optional: param.optional
            }
        })
        const same = this.params.every((a,i) => a.type === newTypes[i].type)
        const newReturn = this.returnType ? this.returnType.generize(generics) : null
        if (!same || this.returnType !== newReturn) {
            return new Function(this.name, newTypes, newReturn, this.optional)
        }
        return this
    }
}

class AlternativeType extends Type {
    types = []
    constructor(types) {
        this.types = types
    }
    combine(types) {
        for (const type of types) {
            if (this.types.every(a => !type.eq(a))) {
                this.types.push(type)
            }
        }
    }
}

module.exports = {
    Type: Type,
    ObjectType: ObjectType,
    BooleanType: BooleanType,
    StringType: StringType,
    NumberType: NumberType,
    IntegerType: IntegerType,
    LongIntegerType: LongIntegerType,
    FloatType: FloatType,
    DoubleType: DoubleType,
    ArrayType: ArrayType,
    TupleType: TupleType,
    NamedType: NamedType,
    UndefinedType: UndefinedType,
    InvalidType: InvalidType,
    InterfaceType: InterfaceType,
    EnumType: EnumType,
    Function: Function,
    AlternativeType: AlternativeType
}