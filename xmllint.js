'use strict'

const xml2js = require('xml2js')

module.exports = {
    parse: async function (input) {
        let errors = []
        const parser = new xml2js.Parser()

        try {
            const xml = await parser.parseStringPromise(input)
            if (xml.component == null) {
                return {}
            }

            const root = xml.component
            let component = root.$

            if (root.interface) {
                component.fields = (root.interface[0].field || [])
                    .reduce((r,i) => {
                        r.set(i.$.id.toLowerCase(), objToLowerKeyMap(i.$))
                        return r
                    } , new Map())
                component.functions = (root.interface[0].function || []).
                    reduce((r,i) => {
                        r.set(i.$.name.toLowerCase(), objToLowerKeyMap(i.$))
                        return r
                    }, new Map())
            } else {
                component.fields = new Map()
                component.functions = new Map()
            }

            component.scripts = (root.script || []).map(_ => Object.assign({_:_._}, _.$))

            if (root.children) {
                component.children = root.children[0]
            }

            return { component: component, errors: errors }
        }
        catch (error) {
            const regex = /\nLine: (\d+)\nColumn: (\d+)\n/i
            let loc = ''
            let match = null
            if (match = regex.exec(error.message)) {
                loc = parseInt(match[1]) + 1 + ',' + match[2]
            }
            let message = error.message.replace(regex, '. ')
            errors.push({ level: 0, message: message, loc: loc })
            return { errors: errors }
        }        
    },

    lint: function (component, scopedFunctions) {
        if (!component) return []
        scopedFunctions = scopedFunctions || new Map()

        let errors = []

        if (!component.name) {
            errors.push({ level: 1, message: '<component> must have "name" attribute', loc: '1' })
        }

        if (!component.extends) {
            errors.push({ level: 1, message: '<component> must have "extends" attribute', loc: '1' })
        }

        for (const field of component.fields.values()) {
            if (!field.has('id')) {
                errors.push({ level: 1, message: '<field> must have "id" attribute', loc: '1' })
            }
            if (!field.has('type')) {
                errors.push({ level: 1, message: '<field> must have "type" attribute', loc: '1' })
            }
            if (field.has('onchange') && !scopedFunctions.has(field.get('onchange').toLowerCase())) {
                errors.push({ level: 1, message: 'Undefined function `' + field.get('onchange') + '` in "onChange" attribute', loc: '1' })
            }
        }

        for (const func of component.functions.values()) {
            if (!func.has('name')) {
                errors.push({ level: 1, message: '<function> must have "name" attribute', loc: '1' })
            } else if (!scopedFunctions.has(func.get('name').toLowerCase())) {
                errors.push({ level: 1, message: 'Undefined function `' + func.get('name') + '` in <function> "name" attribute', loc: '1' })
            }
        }

        return errors
    }
}

function objToLowerKeyMap(obj) {
    return new Map(Object.entries(obj).map(a => [a[0].toLowerCase(), a[1]]))
}