// Preprocessor removes all preprocessor instructions 
// and code inside conditionals eveluating to false
// If constant's value is unknown both if and else blocks 
// are passed through. 

function preprocessor(input, consts) {
    consts = consts || {}

    const line = /^.*?(\r\n|\n|$)/gm
    const pre = /^[ \t]*#/
    const pif = /^[ \t]*#[ \t]*if[ \t]+(true|false|[a-zA-Z_][\w]*)[ \t\n\r]*$/i
    const eif = /^[ \t]*#[ \t]*else[ \t]*if[ \t]+(true|false|[a-zA-Z_][\w]*)[ \t\n\r]*$/i
    const els = /^[ \t]*#[ \t]*else[ \t\n\r]*$/i
    const eni = /^[ \t]*#[ \t]*end[ \t]*if[ \t\n\r]*$/i
    const cc =  /^[ \t]*#[ \t]*const[ \t]+([a-zA-Z_][\w]*)[ \t]*=[ \t]*(true|false)[ \t\n\r]*$/i
    const err = /^[ \t]*#[ \t]*error(.*?)[ \t\n\r]*$/i
    const any = /^/i

    const setState = (t) => {
        let c = t.toLowerCase()
        let v = consts[c]
        if (c === 'true' || v === true) 
            state = 'true'
        else if (c === 'false' || v === false)
            state = 'false'
        else
            state = 'unknown'
    }

    const statements = [
        { regx: cc, match: (m) => {
            consts[m[1].toLowerCase()] = m[2] === 'true'? true : false
        }},
        { regx: pif, match: (m) => {
            setState(m[1])
        }},
        { regx: eif, match: (m) => {
            if (state === 'nope')
                return 'Unexpected #else if'
            if (state !== 'true') {
                setState(m[1])
            }
        }},
        { regx: els, match: (m) => {
            if (state === 'nope')
                return 'Unexpected #else'
            if (state === 'true')
                state = 'false'
            else if (state === 'false')
                state = 'true'
        }},
        { regx: eni, match: (m) => {
            if (state === 'nope')
                return 'Unexpected #end if'
            state = 'nope'
        }},
        { regx: err, match: (m) => {
            return m[1]
        }},
        { regx: any, match: (m) => {
            return 'Unrecognized preprocessor instruction'
        }}
    ]

    let state = 'nope'
    let currentLine = 0
    let i = null
    while ((i = line.exec(input)) !== null) {
        currentLine += 1
        if (i.index === input.length)
            break

        let str = i[0]
        let start = i.index
        let end = line.lastIndex
        if (!pre.test(str)) {
            if (state === 'false') {
                input = input.slice(0, start) + i[1] + input.slice(end)
                line.lastIndex = start + i[1].length
            }
            continue
        }
        input = input.slice(0, start) + i[1] + input.slice(end)
        line.lastIndex = start + i[1].length

        for (const statement of statements) {
            const r = statement.regx.exec(str)
            if (r) {
                const ex = statement.match(r)
                if (ex) throw new Error(ex + ' @' + currentLine + ',1')
                break
            }
        }
    }

    return input
}

module.exports = preprocessor