'use strict'

const nearley = require('nearley'),
      grammar = require('./brx'),
      preprocessor = require('./preprocessor'),
      Print = require('./print').Print,
      fs = require('fs'),
      paths = require('path')

const { InterfaceType } = require('./types')

const compiledGrammar = nearley.Grammar.fromCompiled(grammar)


module.exports = {
    parse: function (input, options) {
        options = options || {}
        let errors = []
        try {
            if (options.preprocessor) {
                input = preprocessor(input, options.consts)
            }

            let parser = new nearley.Parser(compiledGrammar, { keepHistory: options.debug })
            parser.feed(input)

            if (parser.results.length > 1) {
                console.log('Ambiguity detected!', parser.results.length)
            } else if (parser.results.length == 0) {
                return { errors: [{ level:0, message: 'Unable to parse input', loc:'0'}]}
            }

            if (options.ast != null) {
                console.log(JSON.stringify(parser.results[0]))
            }

            return { ast: parser.results[0], types: null, errors: errors }
        }
        catch (x) {
            const regex = / at line (\d+) col (\d+):\n\n\s*/i
            let loc = x.token.line + ',' + x.token.col
            let message = x.message.replace(regex, ': `')
            message = message.replace(/\n\s*\^\n/, '`. ').replace(/\n/, '')
            errors.push({ level: 0, message: message, loc: loc})
            return { errors: errors }
        }
    },
    rewriteAst: rewriteAst,
    generate: function(ast, path) {
        if (!fs.existsSync(paths.dirname(path))) {
            fs.mkdirSync(paths.dirname(path))
        }
        if (ast.component) {
            let libs = ast.libs.map(a => a.name.replace(/^"|"$/g, ''))
            
            const code = generateCode(ast.component, libs)
            if (code.length > 0) {
                fs.writeFileSync(path + '.brs', code)
            }

            const xml = generateXml(ast.component, libs, paths.basename(path + '.brs'))
            fs.writeFileSync(path + '.xml', xml)
        }
    }
}

function rewriteAst(ast, types) {
    
}

function generateXml(component, libs, codePath) {
    let o = '    '
    let oo = o + o
    let out = '<?xml version="1.0" encoding="utf-8" ?>\n'
    out += `<component name="${component.name}" extends="${component.extends}">\n`
    out += o + '<interface>\n'
    for (const member of component.members) {
        if (member.public) {
            switch (member.node) {
            case 'property':
                let type = componentType(member.xtype)
                let attributes = ''
                let onChange = member.attributes.find(a=>a.name == 'onChange')
                let alwaysNotify = member.attributes.find(a=>a.name == 'alwaysNotify')
                if (onChange) {
                    attributes += `onChange="${onChange.expressions[0].val}" `
                }
                if (alwaysNotify) {
                    attributes += `alwaysNotify="true" `
                }
                out += oo + `<field id="${member.name}" type="${type}" ${attributes}/>\n`
                break
            case 'function':
            case 'sub':
                out += oo + `<function name="${member.name}" />\n`
                break
            }
        }
    }
    out += o + '</interface>\n'

    if (codePath) {
        out += o + `<script type="text/brightscript" uri="${codePath}" />\n`
    }

    for (const lib of libs) {
        if (/^(\w+:|\.\/)/.test(lib)) {
            out += o + `<script type="text/brightscript" uri="${lib}" />\n`
        }
    }

    out += '</component>\n'
    return out
}

function generateCode(component, libs) {
    let fns = component.members.filter(a => a.node == 'sub' || a.node == 'function')
    let print = new Print(component.interface)
    let out = ''

    rewrite
    for (const lib of libs) {
        if (!/^(\w+:|\.\/)/.test(lib)) {
            out += `Library "${lib}"\n\n`
        }
    }

    for (const fn of fns) {
        out += print.printFunction(fn, fn.xtype) + '\n'
    }
    return out
}

function componentType(type) {
    switch(type.constructor.name) {
        case 'BooleanType':
            return 'boolean'
        case 'StringType':
            return 'string'
        case 'FloatType':
            return 'float'
        case 'DoubleType':
            return 'double'
        case 'IntegerType':
            return 'integer'
        case 'LongIntegerType':
            return 'longinteger'
        case 'TupleType':
            // if (type.types.length == 4 && type.types.every(a => a instanceof NumberType)) {
            //     return 'rect2d'
            // }
            // if (type.types.length == 2 && type.types.every(a => a instanceof NumberType)) {
            //     return 'vector2d'
            // }
            return 'array'
        case 'ArrayType':
            switch (type.elementType.constructor.name) {
                case 'IntegerType':
                    return 'intarray'
                case 'FloatType':
                    return 'floatarray'
                case 'BooleanType':
                    return 'boolarray'
                case 'StringType':
                    return 'stringarray'
                default:
                    if (type.elementType instanceof InterfaceType && type.elementType.basedOn('Node')) {
                        return 'nodearray'
                    }
                    return 'array'
            }
        case 'InterfaceType':
            if (type.basedOn('Node')) {
                return 'node'
            }
        default:
            return 'assocarray'
    }
}
