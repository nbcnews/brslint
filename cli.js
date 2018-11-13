#!/usr/bin/env node

'use strict'

const lint = require('./brslint.js'),
    print = require('./pprint.js'),
    fs = require('fs'),
    pth = require('path'),
    color = require('cli-color'),
    args = require('minimist')(process.argv.slice(2), {
        alias: { 'm': 'message', 'f': 'format', 'w': 'warning', '#': 'preprocessor', 'd': 'debug' },
        string: ['message', 'format', 'warning', 'ast'],
        boolean: ['recursive', 'warningsaserrors', 'preprocessor', 'debug'],
        default: {
            warningsaserrors: false,
            recursive: true,
            preprocessor: true,
            debug: false,
            message: 'all',
            format: 'pretty',
            warning: '4'
        }
    })

main()

function main()
{
    if (args.debug) {
        console.log(args)
    }

    let start = process.hrtime()
    let totalErrors = 0
    let allFunctions = []

    const config = (args._[0])?
        defaultConfig(args) :
        readconfig(args)

    var files = readdir(config, '.brs', args.recursive)

    if (files.length === 0) {
        console.log(color.yellow('Warning') + ": Couldn't find any BrightScript files to lint")
        process.exit(0)
    }

    files.forEach(function (file) {
        var input = fs.readFileSync(file, 'utf8')
        var result = lint.parse(input, {preprocessor: args.preprocessor, debug: args.debug, ast: args.ast})
        var name = pth.basename(file)

        if (args.message !== 'silent') {
            if (args.message !== 'errors' || result.errors.length > 0) {
                console.log(color.black(name) + ' '.repeat(Math.max(30 - name.length, 1)) + color.blackBright(pth.dirname(file)))
            }
            showErrors(result.errors, file)
        }

        totalErrors += result.errors.length

        if (result.ast) {
            if (!args.p) {
                const globalFnNames = result.ast.functions.map(f => f.name)
                result.ast.functions.forEach(function (f) {
                    f["file"] = file
                    allFunctions.push(f)
                    showWarnings(lint.style(f, globalFnNames))
                })
                
                const rules = require('./rules')(config.rules)
                showWarnings(lint.lint(result.ast, globalFnNames, rules))
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
    }
    else {
        if (args.message !== 'silent') {
            console.log("\nProcessed %d files, %d functions in %dms  =^..^=\n", files.length, allFunctions.length, processingTime)
        }
    }
}


function showErrors(errors, file) {
    errors.forEach( function (error) {
        console.log(color.redBright('  Error: ') + error + (args.format == 'robot' ? ' ' + file : ''))
    })
}

function showWarnings(warnings) {
    if (args.message == 'all') {
        warnings.forEach( function (warning) {
            if (warning.level <= parseInt(args.warning)) {
                console.log(color.yellowBright('  Warning: ') + warning.message + ' @' + warning.loc)
            }
        })
    }
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
    var ad = a.split(pth.sep).length
    var bd = b.split(pth.sep).length
    if (ad > bd)
        return 1
    else if (ad < bd)
        return -1
    return a.localeCompare(b)
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
        recursive: args.recursive || true,
    }

    return config
}
