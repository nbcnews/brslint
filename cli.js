#!/usr/bin/env node

'use strict'

const lint = require('./brslint.js'),
    xlint = require('./xmllint.js'),
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

    const config = (args._[0]) ?
        defaultConfig(args) :
        readConfig(args)

    const rules = require('./rules')(config.rules, parseInt(args.warning))
    const xmlFiles = readdir(config, '.xml', args.recursive)
    const files = readdir(config, '.brs', args.recursive)

    if (files.length === 0) {
        console.log(color.yellow('Warning') + ": Couldn't find any BrightScript files to lint")
        process.exit(0)
    }

    const componentsByFile = await parseComponentFiles(xmlFiles)
    const codeByFile = parseBrightScriptFiles(files)
    const embeddedByFile = parseEmbeddedBrightScript(componentsByFile)
    Object.assign(codeByFile, embeddedByFile)

    lintUnscoped(codeByFile, rules)
    lintComponents(componentsByFile, codeByFile)
    if (args.g) {
        lintGlobalScope(codeByFile)
    }

    const processingTime = process.hrtime(start)[0]*1000 + Math.round(process.hrtime(start)[1]/1000000)

    let errorCount = reportErrors(componentsByFile)
    errorCount += reportErrors(codeByFile)

    console.log("\nProcessed %d files in %dms  =^..^=\n", files.length, processingTime)
    process.exit(errorCount > 0 ? 1 : 0)
}

async function parseComponentFiles(xmlFiles) {
    let parsedFiles = {}
    for (const file of xmlFiles) {
        const input = fs.readFileSync(file, 'utf8')
        const result = await xlint.parse(input)

        if (result.component || result.errors) {
            parsedFiles[file] = result
        }
    }

    return parsedFiles
}

function parseBrightScriptFiles(files, component) {
    let parsedFiles = {}
    for (const file of files) {
        try {
            const input = fs.readFileSync(file, 'utf8')
            const result = lint.parse(input, { preprocessor: args.preprocessor, debug: args.debug, ast: args.ast })
            parsedFiles[file] = result
        } catch (error) {
            if (component) {
                component.errors.push({ level: 0, message: 'Unable to read ' + file, loc:'1' })
            } else {
                parsedFiles[file] = { errors: [{ level: 0, message: 'Unable to read ' + file, loc:'1' }] }
            }
        }
    }

    return parsedFiles
}

function parseEmbeddedBrightScript(components) {
    let parsedFiles = {}

    for (const file of Object.keys(components)) {
        const component = components[file].component
        if (!component) continue
        let code = component.scripts.reduce((result, script) => result + (script._ || ""), "")

        if (code.length > 0) {
            const result = lint.parse(code, { preprocessor: args.preprocessor, debug: args.debug, ast: args.ast })
            parsedFiles[file] = result
        }
    }

    return parsedFiles
}

function lintUnscoped(codeFiles, rules) {
    for (const file of Object.keys(codeFiles)) {
        const result = codeFiles[file]

        if (result.ast) {
            const errors = lint.lint(result.ast, rules)
            result.errors.push(...errors)
        }
    }
}

function lintComponents(components, codeFiles) {
    resolveComponentFunctions(components, codeFiles)
    resolveInheritedFunctions(components)
    lintComponentsXml(components)

    const globalFunctions = new Map(Object.entries(require('./global.json')))

    for (const component of Object.values(components)) {
        if (!component) continue

        for (const func of component.functions.values()) {
            const errors = lint.check(func, component.functions, globalFunctions)
            if (errors.length > 0) {
                codeFiles[func.file].errors.push(...errors)
            }
        }
    }
}

function lintComponentsXml(components) {
    for (const file of Object.keys(components)) {
        const componentEntry = components[file]
        componentEntry.errors.push(... xlint.lint(componentEntry.component, componentEntry.functions))
    }
}

function resolveComponentFunctions(components, codeFiles) {
    for (const file of Object.keys(components)) {
        const componentEntry = components[file]
        const component = componentEntry.component
        if (!component) continue

        const scriptPaths = component.scripts.filter(a => a.uri).map(a => scriptPath(a.uri, pth.dirname(file)))
        const unparsedScripts = scriptPaths.filter(path => !codeFiles[path])
        const parsedFiles = parseBrightScriptFiles(unparsedScripts, componentEntry)
        Object.assign(codeFiles, parsedFiles)

        if (codeFiles[file]) scriptPaths.push(file)
        const ast = a => codeFiles[a] ? codeFiles[a].ast : null
        let asts = scriptPaths.map(path => [ast(path), path])
        if (asts.filter(a => !a[0]).length > 0) continue

        const globalFunctions = new Map(Object.entries(require('./global.json')))
        let scopedFunctions = new Map()

        for (const [ast, path] of asts) {
            for (const lib of ast.libs) {
                if (lib.name.toLowerCase() === '"roku_ads.brs"') {
                    scopedFunctions = new Map([...scopedFunctions, ...Object.entries(require('./roku_ads.json').functions)])
                }
            }

            for (const func of ast.functions) {
                const lookupName = func.name.toLowerCase()
                if (scopedFunctions.has(lookupName)) {
                    codeFiles[path].errors.push({level: 1, message: 'Redefining function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else if (globalFunctions.has(lookupName)) {
                    codeFiles[path].errors.push({level: 1, message: 'Redefining global function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else {
                    func.file = path
                    scopedFunctions.set(lookupName, func)
                }
            }
        }

        componentEntry.functions = scopedFunctions
    }
}

function resolveInheritedFunctions(components) {
    for (const componentEntry of Object.values(components)) {
        copyFunctionsFromBase(components, componentEntry)
    }
}

function copyFunctionsFromBase(components, componentEntry) {
    if (!componentEntry.component || !componentEntry.component.extends) return

    const baseEntry = Object.values(components).find(a => a.component.name.toLowerCase() == componentEntry.component.extends.toLowerCase())
    if (baseEntry && baseEntry.component) {
        copyFunctionsFromBase(components, baseEntry)
        componentEntry.functions = new Map([...baseEntry.functions, ...componentEntry.functions])
    }
}

function scriptPath(path, base) {
    if (/^pkg:\//i.test(path)) {
        return path.replace(/^pkg:\//i, '')
    } else {
        return pth.join(base, path)
    }
}

function lintGlobalScope(codeFiles) {
    // replace with maps
    const globalFunctions = Object.assign(Object.create(null), require('./global.json'))
    let scopedFunctions = Object.create(null)
    for (const file of Object.keys(codeFiles)) {
        if (!/^source\//i.test(file)) continue

        const entry = codeFiles[file]

        if (entry.ast) {
            for (const lib of entry.ast.libs) {
                if (lib.name.toLowerCase() === '"roku_ads.brs"') {
                    Object.assign(scopedFunctions, require('./roku_ads.json').functions)
                }
            }

            for (const func of entry.ast.functions) {
                const lookupName = func.name.toLowerCase()
                if (scopedFunctions[lookupName]) {
                    codeFiles[file].errors.push({level: 1, message: 'Redefining function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else if (globalFunctions[lookupName]) {
                    codeFiles[file].errors.push({level: 1, message: 'Redefining global function `' + func.name + '`', loc: func.tokens[0].line + ',' + func.tokens[0].col})
                } else {
                    func.file = file
                    scopedFunctions[lookupName] = func
                }
            }
        }
    }

    for (const func of Object.values(scopedFunctions)) {
        const errors = lint.check(func, scopedFunctions, globalFunctions)
        if (errors.length > 0) {
            codeFiles[func.file].errors.push(...errors)
        }
    }
}

function reportErrors(files) {
    let totalErrors = 0
    const paths = Object.keys(files).sort(pathSort)

    for (const path of paths) {
        const result = files[path]
        const name = pth.basename(path)

        if (result.errors.length > 0) {
            if (args.format !== 'robot') {
                console.log(color.black(name) + ' '.repeat(Math.max(30 - name.length, 1)) + color.blackBright(pth.dirname(path)))
            }

            totalErrors += showWarnings(result.errors, path)
        }
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
    const ad = a.split(pth.sep).length
    const bd = b.split(pth.sep).length
    if (ad > bd)
        return 1
    else if (ad < bd)
        return -1
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
