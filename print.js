class Print {
    offset = ''
    showTypes = false
    increase() {
        this.offset += '    '
    }
    decrease() {
        this.offset = this.offset.slice(0,-4)
    }

    printComponent(componentEntry) {
        let out = ''
        // for (const script of componentEntry.component.scripts) {
        //     this.printFile(script)
        // }
        for (const func of componentEntry.functions.values()) {
            const signature = componentEntry.scopedFunctions.get(func.name.toLowerCase())
            out += this.offset
            out += this.printFunction(func, signature)
            out += '\n'
        }
        return out
    }

    printLibs(ast) {

    }

    printFunction(ast, signature) {
        let out = ''
        if (ast.reads && ast.reads.length > 0) {
            out += this.offset
            out += `'' reads:\n`
            for (const dep of ast.reads) {
                out += this.offset
                out += `''  ${dep}\n`
            }
        }
        if (ast.writes && ast.writes.length > 0) {
            out += this.offset
            out += `'' writes:\n`
            for (const dep of ast.writes) {
                out += this.offset
                out += `''  ${dep}\n`
            }
        }

        let params = ast.params.map((p,i) => {
            return p.name + ' as ' + signature.params[i].type
        }).join(', ')

        if (signature.returnType) {
            out += `function ${ast.name}(${params}) as ${signature.returnType}\n`
        } else {
            out += `sub ${ast.name}(${params})\n`
        }

        if (ast.statements) {
            out += this.statements(ast.statements)
            out += this.offset
            out += 'end ' + ast.node + '\n'
        }

        return out
    }

    statements(sts) {
        let out = ''
        this.increase()
        for (const st of sts) {
            out += this.offset
            out += this.statement(st) + '\n'
        }
        this.decrease()
        return out
    }
    statement(st) {
        switch(st.node) {
        case 'id':
            return this.call(st)
        case '=':
            return this.assignop(st)
        case 'if':
        case 'assignop':
        case 'dim':
        case 'for':
        case 'foreach':
        case 'while':
        case 'return':
        case 'exitfor':
        case 'exitwhile':
        case 'stop':
        case 'end':
        case 'print':
            return this[st.node](st)
        }
    }

    call(st) {
        return this.accessor(st)
    }
    print(st) {
        return 'print ...'
    }
    dim (st) {  
        return `dim ...`
    }
    assignop(st) {
        return `${this.accessor(st.lval)} ${st.op} ${this.expression(st.rval)}`
    }
    assign(st) {
        return `${this.accessor(st.lval)} = ${this.expression(st.rval)}`
    }
    if(st) {
        let out = ''
        const cond = this.expression(st.condition)
        out += `if ${cond} then\n`
        if (st.then) {
            out += this.statements(st.then)
        }
        if (st.else) {
            out += this.offset
            out += 'else\n'
            out += this.statements(st.else)
        }
        out += this.offset
        out += 'end if'
        return out
    }
    for(loop) {
        let step = loop.step? ' ' + this.expression(loop.step) : ''
        let out = `for ${this.accessor(loop.var)} to ${this.expression(loop.to)} ${step}\n`
        out += this.statements(loop.statements)
        out += this.offset
        out += `end for`
        return out
    }
    foreach(foreach) {
        let out = `for each ${this.accessor(foreach.var)} in ${this.expression(foreach.in)}\n`
        out += this.statements(foreach.statements)
        out += this.offset
        out += `end for`
        return out
    }
    while(st) {
        let out = `while ${this.expression(st.condition)}\n`
        out += this.statements(st.statements)
        out += this.offset
        out += 'end while'
        return out
    }
    return(st) {
        const val = st.val?  ' ' + this.expression(st.val) : ''
        return 'return' + val
    }
    end(st) {
        return 'end'
    }
    stop(st) {
        return 'stop'
    }
    exitfor (st) {
        return 'exit for'
    }
    exitwhile(st) {
        return 'exit while'
    }

    accessor(id) {
        let out = id.val
        for (const a of id.accessors || []) {
            switch(a.node) {
            case 'prop':
                out += '.' + a.name
                break
            case 'call':
                let args = a.args.map((arg) => {
                    return this.expression(arg)
                }).join(', ')
                out += '(' + args + ')'
                break
            case 'index':
                let indexes = a.indexes.map((arg) => {
                    return this.expression(arg)
                }).join(', ')
                out += '[' + indexes + ']'
                break
            }
        }
        if (id.xtype && this.showTypes) {
            let o = (id.xtype.optional)? '?' : ''
            out += `<${id.xtype}${o}>`
        }
        return out
    }

    expression(exp) {
        switch (exp.node) {
            case 'bop':
                return `${this.expression(exp.left)} ${exp.op} ${this.expression(exp.right)}`
            case 'uop':
                return `${exp.op} ${this.expression(exp.right)} `
            case 'id':
                return this.accessor(exp)
            case 'const':
                return exp.val
            case 'string':
                return exp.val
            case 'number':
                return exp.val
            case 'object':
                return this.object(exp)
            case 'array':
                return '[]'
            case 'function':
            case 'sub':
                return this.printFunction(exp, exp.xtype)
        }
        return 'expr...'
    }

    object(o) {
        if (o.properties.length == 0) {
            return '{}'
        }

        let out = '{\n'
        this.increase()
        for (const prop of o.properties) {
            out += this.offset
            out += prop.name + ': ' + this.expression(prop.value) + '\n'
        }
        this.decrease()
        out += this.offset
        out += '}'
        return out
    }

    printType(type) {
        let str = type.toString()

        return 'as ' + type 
    }
}

module.exports = {
    Print: Print
}