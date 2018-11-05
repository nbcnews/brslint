#!/usr/bin/env node

'use strict'

var lint = require('./brslint.js'),
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

main(args._[0])

function main(path)
{
    if (args.debug) {
        console.log(args)
    }

    path = path || '.'
    var start = process.hrtime()
    var totalErrors = 0
    var allFunctions = []
    var files = readdir(path, '.brs')

    if (files.length === 0) {
        console.log(color.yellow('Warning') + ": Couldn't find any BrightScript files in '%s'\n", path)
        process.exit(0)
    }

    files.sort(pathSort)

    files.forEach(function (file) {
        var input = fs.readFileSync(file, 'utf8')
        var result = lint.parse(input, {preprocessor: args.preprocessor, debug: args.debug, ast: args.ast})
        var name = pth.basename(file)

        if (args.message !== 'silent') {
            if (args.message !== 'errors' || result.errors.length > 0) {
                console.log(color.black(name) + color.move(30 - name.length,0) + color.blackBright(pth.dirname(pth.relative(path, file))))
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
            } else {
                let out = print.pretty(result.ast)

                let writePath = pth.join(process.cwd(), args.p.trim(), pth.dirname(pth.relative(path, file)), name)
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
            if (warning.s <= parseInt(args.warning)) {
                console.log(color.yellowBright('  Warning: ') + warning.msg + ' @' + warning.loc)
            }
        })
    }
}

function readdir(path, ext) {
    var files = []
    var paths = [path]

    while (paths.length > 0) {
        path = paths.pop()
        try {
            var stat = fs.statSync(path)

            if (stat.isDirectory()) {
                fs.readdirSync(path).forEach(function (f) {
                    paths.push(pth.join(path, f))
                })
            }
            else if (stat.isFile() && pth.extname(path) === ext) {
                files.push(path)
            }
        }
        catch (x) {
        }
    }

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
