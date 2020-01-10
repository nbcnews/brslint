class Print {
    printComponent(componentEntry) {
        let out = ''
        for (const script of componentEntry.component.scripts) {
            this.printFile(script)
        }
        for (const func of componentEntry.functions.values()) {
            const signature = componentEntry.scopedFunctions.get(func.name.toLowerCase())
            out += this.printFunction(func, signature)
        }
        out += this.printLibs(componentEntry.ast)
        return out
    }

    printFile(file) {

    }

    printLibs(ast) {

    }

    printFunction(ast, signature) {
        let params = ast.params.map(p => {
            return p.name
        }).join(', ')

        if (signature.returnType) {
            return `function ${ast.name}(${params}) as ${signature.returnType}`
        } else {
            return `sub ${signature.name}(${params})\n`
        }
    }

    printType(ast) {
        return 'as ' + ast.type
    }
}

module.exports = {
    Print: Print
}