#!/usr/bin/env node

'use strict'

const lint = require('./brslint.js'),
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

function main() {
    if (args.debug) {
        console.log(args)
    }

    let start = process.hrtime()
    let totalErrors = 0
    let allFunctions = []

    const config = (args._[0]) ?
        defaultConfig(args) :
        readconfig(args)

    let files = readdir(config, '.brs', args.recursive)

    if (files.length === 0) {
        console.log(color.yellow('Warning') + ": Couldn't find any BrightScript files to lint")
        process.exit(0)
    }

    files.forEach(file => {
        const input = fs.readFileSync(file, 'utf8')
        const result = lint.parse(input, { preprocessor: args.preprocessor, debug: args.debug, ast: args.ast })
        const name = pth.basename(file)

        if (args.message !== 'silent') {
            if (args.message !== 'errors' || result.errors.length > 0) {
                console.log(color.black(name) + ' '.repeat(Math.max(30 - name.length, 1)) + color.blackBright(pth.dirname(file)))
            }
            showErrors(result.errors, file)
        }

        totalErrors += result.errors.length

        if (result.ast) {
            if (!args.p) {
                const globalFnNames = result.ast.functions.map(func => func.name)
                result.ast.functions.forEach(func => {
                    func.file = file
                    allFunctions.push(func)
                    showWarnings(lint.style(func, globalFnNames))
                })
                
                const rules = require('./rules')(config.rules, parseInt(args.warning))
                totalErrors += showWarnings(lint.lint(result.ast, globalFnNames, rules))
            } else {
                let out = print.pretty(result.ast)

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
    })

    var processingTime = process.hrtime(start)[0]*1000 + Math.round(process.hrtime(start)[1]/1000000)
    if (totalErrors > 0) {
        if (args.message !== 'silent') {
            console.log('\nFinished with ' + totalErrors + color.redBright(' errors') + ' in ' + files.length + ' files')
        }
        process.exit(1)
    } else if (args.message !== 'silent') {
        console.log("\nProcessed %d files, %d functions in %dms  =^..^=\n", files.length, allFunctions.length, processingTime)
    }
}


function showErrors(errors, file) {
    errors.forEach(error => {
        console.log(color.redBright('  Error: ') + error + (args.format == 'robot' ? ' ' + file : ''))
    })
}

function showWarnings(warnings) {
    const errorLevel = parseInt(args.error) || 1
    let errorCount = 0
    warnings.sort(warningOrder)

    if (args.message == 'all') {
        for (const warning of warnings) {
            if (warning.level <= errorLevel) {
                console.log(color.redBright('  Error: ') + warning.message + ' @' + warning.loc)
                errorCount += 1
            } else {
                console.log(color.yellowBright('  Warning: ') + warning.message + ' @' + warning.loc)
            }
        }
    }

    return errorCount
}

function readdir(config, ext, recursive) {
    let files = []
    let paths = config.paths.include || ['.']
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
    const aa = a.loc.split(',')[0]
    const bb = b.loc.split(',')[0]
    if (aa.length > bb.length) {
        return 1
    } else if (aa.length < bb.length) {
        return -1
    }
    return  aa.localeCompare(bb)
}

function readconfig(args) {
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
