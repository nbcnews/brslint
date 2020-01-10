#!/usr/bin/env node

'use strict'

const lint = require('./brslint.js'),
    xlint = require('./xmllint.js'),
    statica = require('./static'),
    print = require('./pprint.js'),
    fs = require('fs'),
    pth = require('path'),
    color = require('cli-color'),
    args = require('minimist')(process.argv.slice(2), {
        alias: { 'm': 'message', 'f': 'format', 'w': 'warning', 'e': 'error', '#': 'preprocessor', 'd': 'debug' },
        string: ['message', 'format', 'warning', 'ast', 'error'],
        boolean: ['recursive', 'preprocessor', 'debug'],
        default: {
            recursive: true,
            preprocessor: true,
            debug: false,
            message: 'all',
            format: 'pretty',
            warning: null,
            error: '1'
        }
    })

main()

async function main() {
    if (args.debug) {
        console.log(args)
    }

    let start = process.hrtime()

    let errors = []
    const config = (args._[0]) ?
        defaultConfig(args) :
        readConfig(args)

    const rules = require('./rules')(config.rules, parseInt(args.warning))
    const xmlFiles = readdir(config, '.xml', args.recursive)
    const brsFiles = readdir(config, '.brs', args.recursive)
    const brxFiles = readdir(config, '.brx', args.recursive)

    if (brsFiles.length === 0) {
        console.log(color.yellow('Warning') + ": Couldn't find any BrightScript files to lint")
        process.exit(0)
    }

    const components = await parseComponentFiles(xmlFiles, errors)
    const codeByFile = parseBrightScriptFiles(brsFiles, errors)
    const embeddedByFile = parseEmbeddedBrightScript(components, errors)
    const brxByFile = parseBRXFiles(brxFiles, errors)
    Object.assign(codeByFile, embeddedByFile)

    resolveComponentFunctions(components, codeByFile, errors)
    resolveInheritedFunctions(components)

    typeCheck(components, codeByFile, brxByFile, errors)

//    lintUnscoped(codeByFile, rules, errors)
    lintComponentsXml(components, errors)

    const processingTime = process.hrtime(start)[0]*1000 + Math.round(process.hrtime(start)[1]/1000000)

    let errorCount = reportErrors(errors)

    const totalFiles = brsFiles.length + brxFiles.length + xmlFiles.length
    console.log("\nProcessed %d files in %dms  =^..^=\n", totalFiles, processingTime)
    process.exit(errorCount > 0 ? 1 : 0)
}

async function parseComponentFiles(xmlFilePaths, errors) {
    let parsedComponents = []
    for (const file of xmlFilePaths) {
        const input = fs.readFileSync(file, 'utf8')
        const result = await xlint.parse(input)

        if (result.component) {
            result.file = file
            parsedComponents.push(result)
        }
        if (result.errors) {
            errors.push(...result.errors.map(a => {
                a.file = file
                return a
            }))
        }
    }

    return parsedComponents
}

function parseBrightScriptFiles(files, errors) {
    let parsedFiles = {}
    for (const file of files) {
        try {
            const input = fs.readFileSync(file, 'utf8')
            const result = lint.parse(input, { preprocessor: args.preprocessor, debug: args.debug, ast: args.ast })
            if (result.ast) {
                parsedFiles[file] = result
            }
            errors.push(...result.errors.map(a => {
                a.file = file
                return a
            }))
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EACCES') {
                errors.push({ level: 0, message: `Unable to read (${error.code}) ` + file, loc:'1', file: file })
            } else {
                console.log(error)
            }
        }
    }

    return parsedFiles
}

function parseEmbeddedBrightScript(components, errors) {
    let parsedFiles = {}

    for (const componentEntry of components) {
        const component = componentEntry.component
        let code = component.scripts.reduce((result, script) => result + (script._ || ""), "")

        if (code.length > 0) {
            const result = lint.parse(code, { preprocessor: args.preprocessor, debug: args.debug, ast: args.ast })
            if (result.ast) {
                parsedFiles[componentEntry.file] = result
            }
            errors.push(...result.errors.map(a => {
                a.file = componentEntry.file
                return a
            }))
        }
    }

    return parsedFiles
}

function parseBRXFiles(files, errors) {
    let parsedFiles = []
    for (const file of files) {
        try {
            const input = fs.readFileSync(file, 'utf8')
            const result = lint.parseExtensions(input)
            if (result.ast) {
                result.file = file
                parsedFiles.push(result)
            }
            errors.push(...result.errors.map(a => {
                a.file = file
                return a
            }))
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EACCES') {
                console.log(`Unable to read (${error.code}) ` + file)
            } else {
                console.log(error)
            }
        }
    }

    return parsedFiles
}

function lintUnscoped(codeFiles, rules, errors) {
    for (const file of Object.keys(codeFiles)) {
        const result = codeFiles[file]
        errors.push(...lint.lint(result.ast, rules).map(a => {
            a.file = file
            return a
        }))
    }
}

function lintComponents(components, codeFiles) {
    lintComponentsXml(components, errors)

    // const globalFunctions = new Map()

    // for (const component of Object.values(components)) {
    //     if (!component) continue

    //     for (const func of component.functions.values()) {
    //         const errors = lint.check(func, component.functions, globalFunctions)
    //         if (errors.length > 0) {
    //             codeFiles[func.file].errors.push(...errors)
    //         }
    //     }
    // }
}

function lintComponentsXml(components, errors) {
    for (const componentEntry of components) {
        errors.push(... xlint.lint(componentEntry.component, componentEntry.functions).map(a => {
            a.file = componentEntry.file
            return a
        }))
    }
}

function resolveComponentFunctions(components, codeFiles, errors) {
    for (const componentEntry of components) {
        const component = componentEntry.component
        const file = componentEntry.file

        const scriptPaths = component.scripts.filter(a => a.uri).map(a => scriptPath(a.uri, pth.dirname(file)))
        const unparsedScripts = scriptPaths.filter(path => !codeFiles[path])
        const parsedFiles = parseBrightScriptFiles(unparsedScripts, errors)
        Object.assign(codeFiles, parsedFiles)

        if (codeFiles[file]) scriptPaths.push(file)
        //const ast = a => codeFiles[a] ? codeFiles[a].ast : null
        let componentScripts = scriptPaths.map(path => [codeFiles[path], path])
        if (componentScripts.filter(a => !a[0]).length > 0) {
            componentEntry.functions = new Map()
            continue
        }

        let scopedFunctions = new Map()
        let types = new Map()
        for (const [script, path] of componentScripts) {
            types = new Map([...types, ...script.types])

            for (const lib of script.ast.libs) {
                if (lib.name.toLowerCase() === '"roku_ads.brs"') {
                }
            }

            for (const func of script.ast.functions) {
                const lookupName = func.name.toLowerCase()
                if (scopedFunctions.has(lookupName)) {
                    errors.push({
                        level: 1, message: `Redefining function '${func.name}'`,
                        loc: `${func.li.line},${func.li.col}`,
                        file: path
                    })
                } else {
                    func.file = path
                    scopedFunctions.set(lookupName, func)
                }
            }
        }

        componentEntry.functions = scopedFunctions
        componentEntry.types = types
    }
}

function resolveInheritedFunctions(components) {
    for (const componentEntry of components) {
        copyFunctionsFromBase(components, componentEntry)
    }
}

function copyFunctionsFromBase(components, componentEntry) {
    if (!componentEntry.component.extends) return

    const baseEntry = components.find(a => a.component.name.toLowerCase() == componentEntry.component.extends.toLowerCase())
    if (baseEntry) {
        copyFunctionsFromBase(components, baseEntry)
        componentEntry.functions = new Map([...baseEntry.functions, ...componentEntry.functions])
    }
}

function typeCheck(components, codeFiles, brxFiles, errors) {
    let globalTypes = parseInterfaceFile('./types.brx')
    let globalFunctions = parseInterfaceFile('./functions.brx')

    //component interfaces
    for (const componentEntry of components) {
        const component = componentEntry.component

        // check for collisions with global names... maybe
        const componentFunctions = statica.typesFromAST(componentEntry.functions.values())
        let scopedFunctions = new Map([...globalFunctions, ...componentFunctions])
        componentEntry.scopedFunctions = scopedFunctions

        globalTypes.set(component.name.toLowerCase(), statica.typeFromComponent(component, componentFunctions))
    }

    // types from brx files will override component interfaces with same name
    for (const brx of brxFiles) {
        globalTypes = new Map([...globalTypes, ...statica.typesFromAST(brx.ast)])
    }

    for (const componentEntry of components) {
        const component = componentEntry.component

        if (component.extends) {
            const baseType = globalTypes.get(component.extends.toLowerCase())
            if (!baseType) {
                console.log(`Unknown base type ${component.extends} in component ${component.name}` )
            }
            component.base = baseType
        }

        for (const type of globalTypes.values()) {
            if (type.extends) {
                const baseType = globalTypes.get(type.extends.toLowerCase())
                type.base = baseType
            }
        }

        const types = new Map([...globalTypes, ...statica.typesFromAST(componentEntry.types.values())])
        componentEntry.types = types
        errors.push(...statica.check(componentEntry))
    }
}

function parseInterfaceFile(path) {
    const input = fs.readFileSync(require.resolve(path), 'utf8')
    const result = lint.parseExtensions(input)
    return statica.typesFromAST(result.ast)
}

function scriptPath(path, base) {
    if (/^pkg:\//i.test(path)) {
        return path.replace(/^pkg:\//i, '')
    } else {
        return pth.join(base, path)
    }
}

function lintGlobalScope(codeFiles) {
    const globalFunctions = global
    let scopedFunctions = new Map()
    for (const file of Object.keys(codeFiles)) {
        if (!/^source\//i.test(file)) continue
        const entry = codeFiles[file]

        if (entry.ast) {
            for (const lib of entry.ast.libs) {
                if (lib.name.toLowerCase() === '"roku_ads.brs"') {
                    scopedFunctions = new Map([...scopedFunctions, ...Object.entries(require('./roku_ads.json').functions)])
                }
            }

            for (const func of entry.ast.functions) {
                const lookupName = func.name.toLowerCase()
                if (scopedFunctions.has(lookupName)) {
                    codeFiles[file].errors.push({level: 1, message: 'Redefining function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else if (globalFunctions.has(lookupName)) {
                    codeFiles[file].errors.push({level: 1, message: 'Redefining global function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else {
                    func.file = file
                    scopedFunctions.set(lookupName, func)
                }
            }
        }
    }

    for (const func of scopedFunctions.values()) {
        const errors = lint.check(func, scopedFunctions, globalFunctions)
        if (errors.length > 0) {
            codeFiles[func.file].errors.push(...errors)
        }
    }
}

function reportErrors(errors) {
    let totalErrors = 0

    const gropedByFile = errors.reduce((result, error) => {
        let group = result.get(error.file) || []
        group.push(error)
        result.set(error.file, group)
        return result
    }, new Map())

    const paths = [...gropedByFile.keys()].sort(pathSort)

    for (const path of paths) {
        const name = pth.basename(path)

        console.log(color.black(name) + ' '.repeat(Math.max(30 - name.length, 1)) + color.blackBright(pth.dirname(path)))
        totalErrors += showWarnings(gropedByFile.get(path), path)
}

    return totalErrors
}

function showWarnings(warnings, path) {
    const errorLevel = parseInt(args.error) || 1
    let errorCount = 0
    warnings.sort(warningOrder)
    warnings = dedupeWarnings(warnings)

    const showPath = (args.format == 'robot') ? ' ' + path : ''

    for (const warning of warnings) {
        if (warning.level <= errorLevel) {
            console.log(color.redBright('  Error: ') + warning.message + ' @' + warning.loc + showPath)
            errorCount += 1
        } else {
            console.log(color.yellowBright('  Warning: ') + warning.message + ' @' + warning.loc + showPath)
        }
    }

    return errorCount
}

function prettyPrint(codeFiles) {
    for (const file of codeFiles) {
        let out = print.pretty(file.ast)

        const name = pth.basename(file)
        let writePath = pth.join(process.cwd(), args.p.trim(), pth.dirname(file), name)
        try {
            fs.mkdirSync(pth.dirname(writePath))
        } catch(x) { }
        try {
            fs.writeFileSync(writePath, out)
        } catch(x) {
            console.log(`Can't write to ${writePath}`)
        }
    }
}

function readdir(config, ext, recursive) {
    let files = []
    let paths = [].concat(config.paths.include || ['.'])
    const exclude = config.paths.exclude || []
    let nodups = {}

    while (paths.length > 0) {
        let path = paths.pop()
        try {
            let stat = fs.statSync(path)

            if (stat.isDirectory() && recursive) {
                for (let entry of fs.readdirSync(path)) {
                    const e = pth.join(path, entry)
                    if (!exclude.includes(e)) {
                        paths.push(e)
                    }
                }
            } else if (stat.isFile() && pth.extname(path) === ext) {
                if (!nodups[path]) {
                    files.push(path)
                    nodups[path] = true
                }
            }
        }
        catch (x) {
        }
    }
    files.sort(pathSort)
    return files
}

function pathSort(a, b) {
    // const ad = a.split(pth.sep)
    // const bd = b.split(pth.sep)
    // if (ad > bd)
    //     return 1
    // else if (ad < bd)
    //     return -1
    return a.localeCompare(b)
}

function warningOrder(a, b) {
    if (a.level > b.level) {
        return 1
    } else if (a.level < b.level) {
        return -1
    }
    const aa = parseInt(a.loc.split(',')[0])
    const bb = parseInt(b.loc.split(',')[0])
    if (aa > bb) {
        return 1
    } else if (aa < bb) {
        return -1
    }
    if (aa.message > bb.message) {
        return 1
    } else if (aa.message < bb.message) {
        return -1
    }
    if (a.loc > b.loc) {
        return 1
    } else if (a.loc < b.loc) {
        return -1
    }
    return  0
}

function dedupeWarnings(array) {
    const same = (a,b) => a.message === b.message && a.loc === b.loc
    return array.filter((val, index) => !same(array[index - 1] || {}, val))
}

function readConfig(args) {
    try {
        let configString = fs.readFileSync('brslint.config', 'utf8')
        let config = JSON.parse(configString)
        config.paths = config.paths || {}
        return config
    } catch (x) {
        return defaultConfig(args)
    }
}

function defaultConfig(args) {
    let config = {
        paths: {
            include: [args._[0] || '.'],
            exclude: []
        },
        recursive: args.recursive || true
    }

    return config
}
