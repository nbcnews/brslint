//ahh maybe later

class Type {
    constructor() {
        this.optional = true
    }

    desc() {
        return this.constructor.name
    }

    eq(type) {
        const thisTypeName = this.constructor.name
        return thisTypeName === type.name || thisTypeName === type.constructor.name
    }
}

class ObjectType extends Type {
    constructor(value, optional) {
        super()
        this.interface = 'ifAssociativeArray' //is this right? do all objects support it?
        this.value = value || null
        if (optional != undefined) this.optional = optional
    }
}

class BooleanType extends ObjectType {
    constructor(value) {
        super()
        this.interface = 'toStr'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class StringType extends ObjectType {
    constructor(value) {
        super()
        this.interface = 'roString'
        this.optional = false
        this.value = value || null
    } 
}

class NumberType extends ObjectType {
    constructor(value) {
        super()
        this.interface = 'toString'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class IntegerType extends NumberType {
    constructor(value) {
        super()
        this.interface = 'toString'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class LongIntegerType extends NumberType {
    constructor(value) {
        super()
        this.interface = 'toString'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class FloatType extends NumberType {
    constructor(value) {
        super()
        this.interface = 'toString'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class DoubleType extends NumberType {
    constructor(value) {
        super()
        this.interface = 'toString'
        this.optional = false
        this.value = (value != undefined) ? value : null
    }
}

class ArrayType extends ObjectType {
    constructor(elementType, optional) {
        super()
        this.interface = 'roArray'
        this.elementType = elementType
        if (optional != undefined) this.optional = optional
    }
}

class TupleType extends ObjectType {
    constructor(types, optional) {
        super()
        this.interface = 'roArray'
        this.types = types
        if (optional != undefined) this.optional = optional
    }
}

class NamedType extends Type {
    constructor(name, optional) {
        super()
        this.name = name
        if (optional != undefined) this.optional = optional
    }
}

class UndefinedType extends Type {
}
class InvalidType extends ObjectType {
}

class InterfaceType extends Type {
    constructor(extend, optional) {
        super()
        this.extends = extend
        this.members = new Map()
        if (optional != undefined) this.optional = optional
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
        return Array(...this.members.keys()).every(name => members.has(name))
    }
    eq(type) {
        return super.eq(type) && this.extends == type.extends && this.membersInclude(type.members)
    }
}

class EnumType extends ObjectType {
    cases = new Map()
    constructor(cases) {
        super()
        this.optional = false
        this.cases = new Map(cases.map(a => [a.name.toLowerCase(), a]))
    }
}

class Property {
    constructor(name, type) {
        this.name = name
        this.type = type
    }
}

class Function extends ObjectType {
    constructor(name, params, returnType, optional) {
        super()
        this.name = name
        this.params = params
        this.returnType = returnType
        if (optional != undefined) this.optional = optional
    }
}

class AlternativeType extends Type {
    #types = []
    constructor(types) {
        this.#types = types
    }
    combine(types) {
        for (const type of types) {
            if (this.#types.every(a => !type.eq(a))) {
                this.#types.push(type)
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