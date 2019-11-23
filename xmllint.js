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
                        r[i.$.id] = i.$
                        return r
                    } , {})
                component.functions = (root.interface[0].function || []).
                    reduce((r,i) => {
                        r[i.$.name] = i.$
                        return r
                    }, {})
            } else {
                component.fields = {}
                component.functions = {}
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

    lint: function (component) {
        if (!component) return []

        let errors = []

        if (!component.name) {
            errors.push({ level: 1, message: '<component> must have "name" attribute', loc: '1' })
        }

        if (!component.extends) {
            errors.push({ level: 1, message: '<component> must have "extends" attribute', loc: '1' })
        }

        for (const field of Object.values(component.fields)) {
            if (!field.id) {
                errors.push({ level: 1, message: '<field> must have "id" attribute', loc: '1' })
            }
            if (!field.type) {
                errors.push({ level: 1, message: '<field> must have "type" attribute', loc: '1' })
            }
        }

        for (const func of Object.values(component.functions)) {
            if (!func.name) {
                errors.push({ level: 1, message: '<function> must have "name" attribute', loc: '1' })
            }
        }

        return errors
    }
}
