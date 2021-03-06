// Generated automatically by nearley, version 2.19.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require('./moo/moo')
const ast = require('./ast')

const caseInsensitiveKeywords = map => {
  const transform = moo.keywords(map)
  return text => transform(text.toLowerCase())
}

let lexer = moo.compile({
    comment:    { match: /[ \t]*(?:REM(?![\w!#$%])|').*?(?:\r?\n[ \t]*|$)/, lineBreaks: true },
    NL:         { match: /(?:[ \t]*\r?\n[ \t]*)+/, lineBreaks: true },
    ws:         { match: /[ \t]+/ },
    IDENTIFIER: { match: /[a-zA-Z_][\w]*[$%!#]?/, value: x=>x.toLowerCase(),
        type: caseInsensitiveKeywords({
            true: ['true'], false: ['false'], invalid: ['invalid'],
            and: ['and'], dim: ['dim'], each: ['each'], else: ['else'], elseif: ['elseif'], end: ['end'], endfunction: ['endfunction'],
            endfor: ['endfor'], endif: ['endif'], endsub: ['endsub'], endwhile: ['endwhile'], exit: ['exit'], exitwhile: ['exitwhile'],
            for: ['for'], function: ['function'], goto: ['goto'], if: ['if'], let: ['let'], next: ['next'], not: ['not'], or: ['or'],
            print: ['print'], return: ['return'], step: ['step'], stop: ['stop'], sub: ['sub'], //tab: ['tab'],
            then: ['then'], to: ['to'], while: ['while'], mod: ['mod'], try: ['try'], catch: ['catch'], endtry: ['endtry'], throw: ['throw'],
            // non reserved keywords can be used as variable names
            library: ['library'], boolean: ['boolean'], object: ['object'], dynamic: ['dynamic'], void: ['void'], integer: ['integer'],
        	longinteger: ['longinteger'], float: ['float'], double: ['double'], string: ['string'], in: ['in'], as: ['as']
        })
    },
    numberLit:  /\d+%|\d*\.?\d+(?:[edED][+-]?\d+)?[!#&]?|&[hH][0-9ABCDEFabcdef]+/,
    stringLit:  /"(?:[^"\n\r]*(?:"")*)*"/,
    op:         /<>|<=|>=|<<|>>|\+=|-=|\*=|\/=|\\=|<<=|>>=/,
    othr:       /./
})
const u = d => d[0][0]
const l = (s) => (d) => s
const flat = d => {
    let a = []
    for (const e of d) {
        if (Array.isArray(e)) {
            a.push(...e)
        } else {
            a.push(e)
        }
    }
    return a
}

var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "program$subexpression$1", "symbols": ["statement_separators"]},
    {"name": "program$subexpression$1", "symbols": ["_"]},
    {"name": "program", "symbols": ["libs", "functions", "program$subexpression$1"], "postprocess": ast.program},
    {"name": "libs", "symbols": []},
    {"name": "libs$ebnf$1", "symbols": ["statement_separators"], "postprocess": id},
    {"name": "libs$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "libs$ebnf$2", "symbols": []},
    {"name": "libs$ebnf$2$subexpression$1", "symbols": ["statement_separators", "library"]},
    {"name": "libs$ebnf$2", "symbols": ["libs$ebnf$2", "libs$ebnf$2$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "libs", "symbols": ["libs$ebnf$1", "library", "libs$ebnf$2"], "postprocess": ast.libs},
    {"name": "library", "symbols": [{type: "library"}, "__", "string"], "postprocess": ast.lib},
    {"name": "functions$ebnf$1", "symbols": []},
    {"name": "functions$ebnf$1$subexpression$1$ebnf$1", "symbols": ["statement_separators"], "postprocess": id},
    {"name": "functions$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "functions$ebnf$1$subexpression$1", "symbols": ["functions$ebnf$1$subexpression$1$ebnf$1", "function"]},
    {"name": "functions$ebnf$1", "symbols": ["functions$ebnf$1", "functions$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "functions", "symbols": ["functions$ebnf$1"], "postprocess": ast.functions},
    {"name": "function", "symbols": ["func"], "postprocess": id},
    {"name": "function", "symbols": ["sub"], "postprocess": id},
    {"name": "func$ebnf$1$subexpression$1", "symbols": ["_", {type: "as"}, "__", "rtype"]},
    {"name": "func$ebnf$1", "symbols": ["func$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "func$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "func", "symbols": [{type: "function"}, "__", "NAME", "_", {"literal":"("}, "params", {"literal":")"}, "func$ebnf$1", "statement_list", "end_function"], "postprocess": ast.func},
    {"name": "end_function", "symbols": [{type: "end"}, "__", {type: "function"}]},
    {"name": "end_function", "symbols": [{type: "endfunction"}]},
    {"name": "sub$ebnf$1$subexpression$1", "symbols": ["_", {type: "as"}, "__", "rtype"]},
    {"name": "sub$ebnf$1", "symbols": ["sub$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "sub$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "sub$subexpression$1", "symbols": [{type: "end"}, "__", {type: "sub"}]},
    {"name": "sub$subexpression$1", "symbols": [{type: "endsub"}]},
    {"name": "sub", "symbols": [{type: "sub"}, "__", "NAME", "_", {"literal":"("}, "params", {"literal":")"}, "sub$ebnf$1", "statement_list", "sub$subexpression$1"], "postprocess": ast.func},
    {"name": "anonymous_function$ebnf$1$subexpression$1", "symbols": ["_", {type: "as"}, "__", "rtype"]},
    {"name": "anonymous_function$ebnf$1", "symbols": ["anonymous_function$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "anonymous_function$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "anonymous_function", "symbols": [{type: "function"}, "_", {"literal":"("}, "params", {"literal":")"}, "anonymous_function$ebnf$1", "statement_list", "end_function"], "postprocess": ast.afunc},
    {"name": "anonymous_function$ebnf$2$subexpression$1", "symbols": ["_", {type: "as"}, "__", "rtype"]},
    {"name": "anonymous_function$ebnf$2", "symbols": ["anonymous_function$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "anonymous_function$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "anonymous_function$subexpression$1", "symbols": [{type: "end"}, "_", {type: "sub"}]},
    {"name": "anonymous_function$subexpression$1", "symbols": [{type: "endsub"}]},
    {"name": "anonymous_function", "symbols": [{type: "sub"}, "_", {"literal":"("}, "params", {"literal":")"}, "anonymous_function$ebnf$2", "statement_list", "anonymous_function$subexpression$1"], "postprocess": ast.afunc},
    {"name": "params$ebnf$1", "symbols": []},
    {"name": "params$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "param"]},
    {"name": "params$ebnf$1", "symbols": ["params$ebnf$1", "params$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "params", "symbols": ["_", "param", "params$ebnf$1", "_"], "postprocess": ast.params},
    {"name": "params", "symbols": ["_"], "postprocess": ast.params},
    {"name": "param$ebnf$1", "symbols": ["param_default"], "postprocess": id},
    {"name": "param$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "param$ebnf$2", "symbols": ["param_type"], "postprocess": id},
    {"name": "param$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "param", "symbols": ["IDENTIFIER", "param$ebnf$1", "param$ebnf$2"], "postprocess": ast.param},
    {"name": "param_default", "symbols": ["_", {"literal":"="}, "_", "rval"]},
    {"name": "param_type", "symbols": ["_", {type: "as"}, "__", "ptype"]},
    {"name": "ptype", "symbols": ["type"], "postprocess": u},
    {"name": "rtype", "symbols": ["type"], "postprocess": u},
    {"name": "rtype", "symbols": [{type: "void"}], "postprocess": id},
    {"name": "type", "symbols": [{type: "boolean"}]},
    {"name": "type", "symbols": [{type: "integer"}]},
    {"name": "type", "symbols": [{type: "longinteger"}]},
    {"name": "type", "symbols": [{type: "float"}]},
    {"name": "type", "symbols": [{type: "double"}]},
    {"name": "type", "symbols": [{type: "string"}]},
    {"name": "type", "symbols": [{type: "object"}]},
    {"name": "type", "symbols": [{type: "dynamic"}]},
    {"name": "type", "symbols": [{type: "function"}]},
    {"name": "statement_list$ebnf$1", "symbols": []},
    {"name": "statement_list$ebnf$1$subexpression$1", "symbols": ["statement_separators", "statement"]},
    {"name": "statement_list$ebnf$1", "symbols": ["statement_list$ebnf$1", "statement_list$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "statement_list", "symbols": ["statement_list$ebnf$1", "statement_separators"], "postprocess": ast.statements},
    {"name": "statement_separators$ebnf$1", "symbols": ["statement_separator"]},
    {"name": "statement_separators$ebnf$1", "symbols": ["statement_separators$ebnf$1", "statement_separator"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "statement_separators", "symbols": ["statement_separators$ebnf$1", "_"], "postprocess": ast.statement_separators},
    {"name": "statement_separator", "symbols": ["NL"]},
    {"name": "statement_separator", "symbols": ["_", {"literal":":"}]},
    {"name": "statement", "symbols": ["if_statement"]},
    {"name": "statement", "symbols": ["dim_statement"]},
    {"name": "statement", "symbols": ["for_loop"]},
    {"name": "statement", "symbols": ["for_each"]},
    {"name": "statement", "symbols": ["while_loop"]},
    {"name": "statement", "symbols": ["try_catch"]},
    {"name": "statement", "symbols": ["throw"]},
    {"name": "statement", "symbols": ["exit_loop"]},
    {"name": "statement", "symbols": ["return_statement"]},
    {"name": "statement", "symbols": ["stop_statement"]},
    {"name": "statement", "symbols": ["end_statement"]},
    {"name": "statement", "symbols": ["assign_statement"]},
    {"name": "statement", "symbols": ["call_statement"]},
    {"name": "statement", "symbols": ["print_statement"]},
    {"name": "oneline_statement", "symbols": ["oneline_if"]},
    {"name": "oneline_statement", "symbols": ["return_statement"]},
    {"name": "oneline_statement", "symbols": ["stop_statement"]},
    {"name": "oneline_statement", "symbols": ["end_statement"]},
    {"name": "oneline_statement", "symbols": ["exit_loop"]},
    {"name": "oneline_statement", "symbols": ["assign_statement"]},
    {"name": "oneline_statement", "symbols": ["call_statement"]},
    {"name": "oneline_statement", "symbols": ["print_statement"]},
    {"name": "oneline_statement", "symbols": ["throw"]},
    {"name": "if_statement$ebnf$1", "symbols": []},
    {"name": "if_statement$ebnf$1", "symbols": ["if_statement$ebnf$1", "else_if"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "if_statement$ebnf$2$subexpression$1", "symbols": [{type: "else"}, "statement_list_or_space"]},
    {"name": "if_statement$ebnf$2", "symbols": ["if_statement$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "if_statement$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "if_statement", "symbols": [{type: "if"}, "if_body", "if_statement$ebnf$1", "if_statement$ebnf$2", "endif"], "postprocess": ast.if},
    {"name": "if_statement", "symbols": ["oneline_if"], "postprocess": id},
    {"name": "else_if", "symbols": ["elseif", "if_body"]},
    {"name": "if_body$ebnf$1$subexpression$1", "symbols": ["_", {type: "then"}]},
    {"name": "if_body$ebnf$1", "symbols": ["if_body$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "if_body$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "if_body", "symbols": ["_", "EXPR", "if_body$ebnf$1", "statement_list"]},
    {"name": "elseif", "symbols": [{type: "else"}, "__", {type: "if"}]},
    {"name": "elseif", "symbols": [{type: "elseif"}]},
    {"name": "endif", "symbols": [{type: "end"}, "__", {type: "if"}]},
    {"name": "endif", "symbols": [{type: "endif"}]},
    {"name": "oneline_if$ebnf$1$subexpression$1", "symbols": ["_", {type: "then"}]},
    {"name": "oneline_if$ebnf$1", "symbols": ["oneline_if$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "oneline_if$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "oneline_if$ebnf$2$subexpression$1", "symbols": ["_", {type: "else"}, "__", "oneline_statement"]},
    {"name": "oneline_if$ebnf$2", "symbols": ["oneline_if$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "oneline_if$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "oneline_if", "symbols": [{type: "if"}, "_", "EXPR", "oneline_if$ebnf$1", "_", "oneline_statement", "oneline_if$ebnf$2"], "postprocess": ast.oneline_if},
    {"name": "statement_list_or_space", "symbols": ["statement_list"], "postprocess": id},
    {"name": "statement_list_or_space", "symbols": ["__"], "postprocess": id},
    {"name": "dim_statement", "symbols": [{type: "dim"}, "__", "IDENTIFIER", "_", {"literal":"["}, "_", "expression_list", "_", {"literal":"]"}], "postprocess": ast.dim},
    {"name": "expression_list$ebnf$1", "symbols": []},
    {"name": "expression_list$ebnf$1$subexpression$1", "symbols": ["EXPR", "_", {"literal":","}, "_"]},
    {"name": "expression_list$ebnf$1", "symbols": ["expression_list$ebnf$1", "expression_list$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "expression_list", "symbols": ["expression_list$ebnf$1", "EXPR"], "postprocess": ast.expr_list},
    {"name": "for_loop$ebnf$1$subexpression$1", "symbols": ["_", {type: "step"}, "_", "EXPR"]},
    {"name": "for_loop$ebnf$1", "symbols": ["for_loop$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "for_loop$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "for_loop", "symbols": [{type: "for"}, "__", "IDENTIFIER", "_", {"literal":"="}, "_", "EXPR", "_", {type: "to"}, "_", "EXPR", "for_loop$ebnf$1", "statement_list", "end_for"], "postprocess": ast.for},
    {"name": "end_for", "symbols": [{type: "end"}, "__", {type: "for"}]},
    {"name": "end_for", "symbols": [{type: "endfor"}]},
    {"name": "end_for$ebnf$1$subexpression$1", "symbols": ["__", "IDENTIFIER"]},
    {"name": "end_for$ebnf$1", "symbols": ["end_for$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "end_for$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "end_for", "symbols": [{type: "next"}, "end_for$ebnf$1"]},
    {"name": "for_each$subexpression$1", "symbols": [{type: "for"}, "__", {type: "each"}]},
    {"name": "for_each", "symbols": ["for_each$subexpression$1", "__", "IDENTIFIER", "__", {type: "in"}, "_", "rval", "statement_list", "end_for_each"], "postprocess": ast.foreach},
    {"name": "end_for_each", "symbols": [{type: "end"}, "__", {type: "for"}]},
    {"name": "end_for_each", "symbols": [{type: "endfor"}]},
    {"name": "end_for_each", "symbols": [{type: "next"}], "postprocess": id},
    {"name": "while_loop$subexpression$1", "symbols": [{type: "end"}, "__", {type: "while"}]},
    {"name": "while_loop$subexpression$1", "symbols": [{type: "endwhile"}]},
    {"name": "while_loop", "symbols": [{type: "while"}, "_", "EXPR", "statement_list", "while_loop$subexpression$1"], "postprocess": ast.while},
    {"name": "exit_loop", "symbols": [{type: "exit"}, "__", {type: "while"}], "postprocess": ast.exit},
    {"name": "exit_loop", "symbols": [{type: "exitwhile"}], "postprocess": ast.exit},
    {"name": "exit_loop", "symbols": [{type: "exit"}, "__", {type: "for"}], "postprocess": ast.exit},
    {"name": "try_catch$ebnf$1$subexpression$1", "symbols": ["__", "IDENTIFIER"]},
    {"name": "try_catch$ebnf$1", "symbols": ["try_catch$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "try_catch$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "try_catch", "symbols": [{type: "try"}, "statement_list", {type: "catch"}, "try_catch$ebnf$1", "statement_list", "end_try"], "postprocess": ast.try},
    {"name": "end_try", "symbols": [{type: "end"}, "__", {type: "try"}]},
    {"name": "end_try", "symbols": [{type: "endtry"}]},
    {"name": "throw$subexpression$1", "symbols": ["string"]},
    {"name": "throw$subexpression$1", "symbols": ["object_literal"]},
    {"name": "throw$subexpression$1$ebnf$1", "symbols": []},
    {"name": "throw$subexpression$1$ebnf$1", "symbols": ["throw$subexpression$1$ebnf$1", "access_or_call"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "throw$subexpression$1", "symbols": ["IDENTIFIER", "throw$subexpression$1$ebnf$1"]},
    {"name": "throw", "symbols": [{type: "throw"}, "__", "throw$subexpression$1"], "postprocess": ast.throw},
    {"name": "return_statement$ebnf$1$subexpression$1", "symbols": ["_", "rval"]},
    {"name": "return_statement$ebnf$1", "symbols": ["return_statement$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "return_statement$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "return_statement", "symbols": [{type: "return"}, "return_statement$ebnf$1"], "postprocess": ast.return},
    {"name": "stop_statement", "symbols": [{type: "stop"}], "postprocess": ast.stop},
    {"name": "end_statement", "symbols": [{type: "end"}], "postprocess": ast.end},
    {"name": "goto_label", "symbols": ["IDENTIFIER", "_", {"literal":":"}]},
    {"name": "goto_statement", "symbols": [{type: "goto"}, "__", "IDENTIFIER"]},
    {"name": "print_statement", "symbols": ["print", "print_items"], "postprocess": ast.print},
    {"name": "print", "symbols": [{type: "print"}], "postprocess": id},
    {"name": "print", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "print_items$ebnf$1", "symbols": []},
    {"name": "print_items$ebnf$1", "symbols": ["print_items$ebnf$1", "psep"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "print_items", "symbols": ["print_items$ebnf$1"], "postprocess": id},
    {"name": "print_items$ebnf$2", "symbols": []},
    {"name": "print_items$ebnf$2", "symbols": ["print_items$ebnf$2", "psep"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "print_items$ebnf$3", "symbols": []},
    {"name": "print_items$ebnf$3$subexpression$1", "symbols": ["_", "PEXPR"]},
    {"name": "print_items$ebnf$3$subexpression$1", "symbols": ["pxsp", "EXPR"]},
    {"name": "print_items$ebnf$3", "symbols": ["print_items$ebnf$3", "print_items$ebnf$3$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "print_items$ebnf$4$subexpression$1$ebnf$1", "symbols": []},
    {"name": "print_items$ebnf$4$subexpression$1$ebnf$1", "symbols": ["print_items$ebnf$4$subexpression$1$ebnf$1", "psep"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "print_items$ebnf$4$subexpression$1", "symbols": ["print_items$ebnf$4$subexpression$1$ebnf$1", "ppp"]},
    {"name": "print_items$ebnf$4", "symbols": ["print_items$ebnf$4$subexpression$1"], "postprocess": id},
    {"name": "print_items$ebnf$4", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "print_items", "symbols": ["print_items$ebnf$2", "EXPR", "print_items$ebnf$3", "print_items$ebnf$4"], "postprocess": ast.print_items},
    {"name": "psep", "symbols": [{"literal":";"}], "postprocess": id},
    {"name": "psep", "symbols": [{"literal":","}], "postprocess": id},
    {"name": "psep", "symbols": ["__"], "postprocess": id},
    {"name": "ppp", "symbols": [{"literal":";"}], "postprocess": id},
    {"name": "ppp", "symbols": [{"literal":","}], "postprocess": id},
    {"name": "pxsp$ebnf$1", "symbols": []},
    {"name": "pxsp$ebnf$1", "symbols": ["pxsp$ebnf$1", "psep"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "pxsp", "symbols": ["_", "ppp", "pxsp$ebnf$1"], "postprocess": flat},
    {"name": "call_statement$ebnf$1", "symbols": []},
    {"name": "call_statement$ebnf$1", "symbols": ["call_statement$ebnf$1", "access_or_call"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "call_statement", "symbols": ["IDENTIFIER", "call_statement$ebnf$1", "call"], "postprocess": ast.lval},
    {"name": "assign_statement", "symbols": ["lval", "_", "assign_op", "_", "rval"], "postprocess": ast.assign},
    {"name": "assign_statement", "symbols": ["lval", "_", "incdec"], "postprocess": ast.incdec},
    {"name": "assign_op", "symbols": [{"literal":"="}]},
    {"name": "assign_op", "symbols": [{"literal":"+="}]},
    {"name": "assign_op", "symbols": [{"literal":"-="}]},
    {"name": "assign_op", "symbols": [{"literal":"*="}]},
    {"name": "assign_op", "symbols": [{"literal":"/="}]},
    {"name": "assign_op", "symbols": [{"literal":"\\="}]},
    {"name": "assign_op", "symbols": [{"literal":"<<="}]},
    {"name": "assign_op", "symbols": [{"literal":">>="}]},
    {"name": "incdec", "symbols": [{"literal":"+"}, {"literal":"+"}], "postprocess": l('++')},
    {"name": "incdec", "symbols": [{"literal":"-"}, {"literal":"-"}], "postprocess": l('--')},
    {"name": "lval", "symbols": ["IDENTIFIER"], "postprocess": id},
    {"name": "lval$ebnf$1", "symbols": []},
    {"name": "lval$ebnf$1", "symbols": ["lval$ebnf$1", "access_or_call"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "lval", "symbols": ["IDENTIFIER", "lval$ebnf$1", "access"], "postprocess": ast.lval},
    {"name": "access", "symbols": ["_", {"literal":"."}, "_", "PROP_NAME"], "postprocess": ast.prop},
    {"name": "access$ebnf$1", "symbols": []},
    {"name": "access$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "EXPR"]},
    {"name": "access$ebnf$1", "symbols": ["access$ebnf$1", "access$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "access", "symbols": ["_", {"literal":"["}, "_", "EXPR", "access$ebnf$1", "_", {"literal":"]"}], "postprocess": ast.index},
    {"name": "call$ebnf$1", "symbols": []},
    {"name": "call$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "rval"]},
    {"name": "call$ebnf$1", "symbols": ["call$ebnf$1", "call$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "call", "symbols": ["_", {"literal":"("}, "_", "rval", "call$ebnf$1", "_", {"literal":")"}], "postprocess": ast.call},
    {"name": "call", "symbols": ["_", {"literal":"("}, "_", {"literal":")"}], "postprocess": ast.call},
    {"name": "xmlattr", "symbols": ["_", {"literal":"@"}, "_", "ATTR_NAME"], "postprocess": ast.xmlattr},
    {"name": "PROP_NAME", "symbols": ["IDENTIFIER"], "postprocess": ast.name},
    {"name": "PROP_NAME", "symbols": ["RESERVED"], "postprocess": ast.name},
    {"name": "PROP_NAME", "symbols": ["constant"], "postprocess": ast.name},
    {"name": "PROP_NAME", "symbols": ["string"], "postprocess": ast.name},
    {"name": "ATTR_NAME", "symbols": ["IDENTIFIER"], "postprocess": ast.name},
    {"name": "ATTR_NAME", "symbols": ["RESERVED"], "postprocess": ast.name},
    {"name": "access_or_call", "symbols": ["access"], "postprocess": id},
    {"name": "access_or_call", "symbols": ["call"], "postprocess": id},
    {"name": "picx", "symbols": ["access"], "postprocess": id},
    {"name": "picx", "symbols": ["call"], "postprocess": id},
    {"name": "picx", "symbols": ["xmlattr"], "postprocess": id},
    {"name": "rval", "symbols": ["EXPR"], "postprocess": id},
    {"name": "rval", "symbols": ["object_literal"], "postprocess": id},
    {"name": "rval", "symbols": ["array_literal"], "postprocess": id},
    {"name": "rval", "symbols": ["anonymous_function"], "postprocess": id},
    {"name": "object_literal$ebnf$1", "symbols": []},
    {"name": "object_literal$ebnf$1$subexpression$1", "symbols": ["prop", "lisep"]},
    {"name": "object_literal$ebnf$1", "symbols": ["object_literal$ebnf$1", "object_literal$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "object_literal$subexpression$1", "symbols": ["_"]},
    {"name": "object_literal$subexpression$1", "symbols": ["lisep"]},
    {"name": "object_literal", "symbols": [{"literal":"{"}, "_NL", "object_literal$ebnf$1", "prop", "object_literal$subexpression$1", {"literal":"}"}], "postprocess": ast.object},
    {"name": "object_literal", "symbols": [{"literal":"{"}, "_NL", {"literal":"}"}], "postprocess": ast.object},
    {"name": "array_literal$ebnf$1", "symbols": []},
    {"name": "array_literal$ebnf$1$subexpression$1", "symbols": ["rval", "lisep"]},
    {"name": "array_literal$ebnf$1", "symbols": ["array_literal$ebnf$1", "array_literal$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "array_literal$subexpression$1", "symbols": ["_"]},
    {"name": "array_literal$subexpression$1", "symbols": ["lisep"]},
    {"name": "array_literal", "symbols": [{"literal":"["}, "_NL", "array_literal$ebnf$1", "rval", "array_literal$subexpression$1", {"literal":"]"}], "postprocess": ast.array},
    {"name": "array_literal", "symbols": [{"literal":"["}, "_NL", {"literal":"]"}], "postprocess": ast.array},
    {"name": "prop", "symbols": ["PROP_NAME", "_", {"literal":":"}, "_", "rval"], "postprocess": ast.propdef},
    {"name": "lisep", "symbols": ["_", {"literal":","}, "_NL"]},
    {"name": "lisep$ebnf$1", "symbols": ["NL"]},
    {"name": "lisep$ebnf$1", "symbols": ["lisep$ebnf$1", "NL"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "lisep", "symbols": ["lisep$ebnf$1"]},
    {"name": "val", "symbols": ["IDENTIFIER"], "postprocess": id},
    {"name": "val", "symbols": ["number"], "postprocess": id},
    {"name": "val", "symbols": ["string"], "postprocess": id},
    {"name": "val", "symbols": ["constant"], "postprocess": id},
    {"name": "EXPR", "symbols": ["O"], "postprocess": ast.expr},
    {"name": "P", "symbols": [{"literal":"("}, "_", "O", "_", {"literal":")"}], "postprocess": ast.parenthesis},
    {"name": "P", "symbols": ["val"], "postprocess": id},
    {"name": "AOP$ebnf$1", "symbols": ["picx"]},
    {"name": "AOP$ebnf$1", "symbols": ["AOP$ebnf$1", "picx"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "AOP", "symbols": ["P", "AOP$ebnf$1"], "postprocess": ast.access},
    {"name": "AOP", "symbols": ["P"], "postprocess": id},
    {"name": "U$subexpression$1", "symbols": [{"literal":"-"}]},
    {"name": "U$subexpression$1", "symbols": [{"literal":"+"}]},
    {"name": "U", "symbols": ["U$subexpression$1", "_", "U"], "postprocess": ast.uop},
    {"name": "U", "symbols": ["AOP"], "postprocess": id},
    {"name": "E", "symbols": ["U", "_", {"literal":"^"}, "_", "E"], "postprocess": ast.bop},
    {"name": "E", "symbols": ["U"], "postprocess": id},
    {"name": "M", "symbols": ["M", "_", "mul_op", "_", "E"], "postprocess": ast.bop},
    {"name": "M", "symbols": ["E"], "postprocess": id},
    {"name": "A", "symbols": ["A", "_", "add_op", "_", "M"], "postprocess": ast.bop},
    {"name": "A", "symbols": ["M"], "postprocess": id},
    {"name": "S", "symbols": ["S", "_", "shft_op", "_", "A"], "postprocess": ast.bop},
    {"name": "S", "symbols": ["A"], "postprocess": id},
    {"name": "C", "symbols": ["C", "_", "comp_op", "_", "S"], "postprocess": ast.bop},
    {"name": "C", "symbols": ["S"], "postprocess": id},
    {"name": "N", "symbols": [{type: "not"}, "_", "N"], "postprocess": ast.uop},
    {"name": "N", "symbols": ["C"], "postprocess": id},
    {"name": "D", "symbols": ["D", "_", {type: "and"}, "_", "N"], "postprocess": ast.bop},
    {"name": "D", "symbols": ["N"], "postprocess": id},
    {"name": "O", "symbols": ["O", "_", {type: "or"}, "_", "D"], "postprocess": ast.bop},
    {"name": "O", "symbols": ["D"], "postprocess": id},
    {"name": "PEXPR", "symbols": ["PO"], "postprocess": ast.expr},
    {"name": "PAOP$ebnf$1", "symbols": ["picx"]},
    {"name": "PAOP$ebnf$1", "symbols": ["PAOP$ebnf$1", "picx"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "PAOP", "symbols": ["val", "PAOP$ebnf$1"], "postprocess": ast.access},
    {"name": "PAOP", "symbols": ["val"], "postprocess": id},
    {"name": "PE", "symbols": ["PAOP", "_", {"literal":"^"}, "_", "E"], "postprocess": ast.bop},
    {"name": "PE", "symbols": ["PAOP"], "postprocess": id},
    {"name": "PM", "symbols": ["PM", "_", "mul_op", "_", "E"], "postprocess": ast.bop},
    {"name": "PM", "symbols": ["PE"], "postprocess": id},
    {"name": "PA", "symbols": ["PA", "_", "add_op", "_", "M"], "postprocess": ast.bop},
    {"name": "PA", "symbols": ["PM"], "postprocess": id},
    {"name": "PS", "symbols": ["PS", "_", "shft_op", "_", "A"], "postprocess": ast.bop},
    {"name": "PS", "symbols": ["PA"], "postprocess": id},
    {"name": "PC", "symbols": ["PC", "_", "comp_op", "_", "S"], "postprocess": ast.bop},
    {"name": "PC", "symbols": ["PS"], "postprocess": id},
    {"name": "PN", "symbols": [{type: "not"}, "_", "N"], "postprocess": ast.uop},
    {"name": "PN", "symbols": ["PC"], "postprocess": id},
    {"name": "PD", "symbols": ["PD", "_", {type: "and"}, "_", "N"], "postprocess": ast.bop},
    {"name": "PD", "symbols": ["PN"], "postprocess": id},
    {"name": "PO", "symbols": ["PO", "_", {type: "or"}, "_", "D"], "postprocess": ast.bop},
    {"name": "PO", "symbols": ["PD"], "postprocess": id},
    {"name": "add_op", "symbols": [{"literal":"+"}]},
    {"name": "add_op", "symbols": [{"literal":"-"}]},
    {"name": "mul_op", "symbols": [{"literal":"*"}]},
    {"name": "mul_op", "symbols": [{"literal":"/"}]},
    {"name": "mul_op", "symbols": [{"literal":"\\"}]},
    {"name": "mul_op", "symbols": [{type: "mod"}]},
    {"name": "shft_op", "symbols": [{"literal":">>"}]},
    {"name": "shft_op", "symbols": [{"literal":"<<"}]},
    {"name": "comp_op", "symbols": [{"literal":"="}]},
    {"name": "comp_op", "symbols": [{"literal":"<>"}]},
    {"name": "comp_op", "symbols": [{"literal":"<"}]},
    {"name": "comp_op", "symbols": [{"literal":">"}]},
    {"name": "comp_op", "symbols": [{"literal":"<="}]},
    {"name": "comp_op", "symbols": [{"literal":">="}]},
    {"name": "_$ebnf$1", "symbols": [{type: "ws"}], "postprocess": id},
    {"name": "_$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": id},
    {"name": "__", "symbols": [{type: "ws"}], "postprocess": id},
    {"name": "comment", "symbols": [{type: "comment"}], "postprocess": ast.comment},
    {"name": "NAME", "symbols": [{type: "IDENTIFIER"}], "postprocess": ast.identifier},
    {"name": "NAME", "symbols": ["UNRESERVED"], "postprocess": ast.identifier},
    {"name": "IDENTIFIER", "symbols": [{type: "IDENTIFIER"}], "postprocess": ast.identifier},
    {"name": "IDENTIFIER", "symbols": ["UNRESERVED"], "postprocess": ast.identifier},
    {"name": "number", "symbols": [{type: "numberLit"}], "postprocess": ast.number},
    {"name": "string", "symbols": [{type: "stringLit"}], "postprocess": ast.string},
    {"name": "constant", "symbols": [{type: "true"}], "postprocess": ast.constant},
    {"name": "constant", "symbols": [{type: "false"}], "postprocess": ast.constant},
    {"name": "constant", "symbols": [{type: "invalid"}], "postprocess": ast.constant},
    {"name": "NL", "symbols": [{type: "comment"}], "postprocess": ast.comment},
    {"name": "NL", "symbols": [{type: "NL"}], "postprocess": id},
    {"name": "_NL", "symbols": ["_"]},
    {"name": "_NL$ebnf$1", "symbols": ["NL"]},
    {"name": "_NL$ebnf$1", "symbols": ["_NL$ebnf$1", "NL"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_NL", "symbols": ["_NL$ebnf$1"]},
    {"name": "RESERVED", "symbols": [{type: "and"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "dim"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "each"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "else"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "elseif"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "end"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endfunction"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endif"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endsub"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endwhile"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "for"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "function"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "goto"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "if"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "let"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "next"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "not"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "or"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "print"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "return"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "step"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "stop"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "sub"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "then"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "to"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "while"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "exit"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "exitwhile"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "mod"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endfor"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "try"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "catch"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "endtry"}], "postprocess": id},
    {"name": "RESERVED", "symbols": [{type: "throw"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "library"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "boolean"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "object"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "dynamic"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "void"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "integer"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "longinteger"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "float"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "double"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "string"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "in"}], "postprocess": id},
    {"name": "UNRESERVED", "symbols": [{type: "as"}], "postprocess": id},
    {"name": "xdeclaration$ebnf$1", "symbols": []},
    {"name": "xdeclaration$ebnf$1$subexpression$1$subexpression$1", "symbols": ["interface"]},
    {"name": "xdeclaration$ebnf$1$subexpression$1$subexpression$1", "symbols": ["enum"]},
    {"name": "xdeclaration$ebnf$1$subexpression$1", "symbols": ["NL", "xdeclaration$ebnf$1$subexpression$1$subexpression$1"]},
    {"name": "xdeclaration$ebnf$1", "symbols": ["xdeclaration$ebnf$1", "xdeclaration$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "xdeclaration", "symbols": ["xdeclaration$ebnf$1", "NL"]},
    {"name": "interface", "symbols": [{"literal":"interface"}, "__", "NAME", "interface_members", {"literal":"end"}, "__", {"literal":"interface"}]},
    {"name": "interface_members$ebnf$1", "symbols": []},
    {"name": "interface_members$ebnf$1$subexpression$1", "symbols": ["NL", "interface_member"]},
    {"name": "interface_members$ebnf$1", "symbols": ["interface_members$ebnf$1", "interface_members$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "interface_members", "symbols": ["interface_members$ebnf$1", "NL"]},
    {"name": "interface_member", "symbols": [{"literal":"property"}, "__", "NAME", "__", {"literal":"as"}, "__", "IDENTIFIER"]},
    {"name": "interface_member$ebnf$1$subexpression$1", "symbols": ["__", {"literal":"as"}, "__", "IDENTIFIER"]},
    {"name": "interface_member$ebnf$1", "symbols": ["interface_member$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "interface_member$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "interface_member", "symbols": [{"literal":"function"}, "_", {"literal":"("}, "xparams", {"literal":")"}, "interface_member$ebnf$1"]},
    {"name": "xparams$ebnf$1", "symbols": []},
    {"name": "xparams$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "xparam"]},
    {"name": "xparams$ebnf$1", "symbols": ["xparams$ebnf$1", "xparams$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "xparams", "symbols": ["_", "xparam", "xparams$ebnf$1", "_"], "postprocess": ast.params},
    {"name": "xparams", "symbols": ["_"], "postprocess": ast.params},
    {"name": "xparam$ebnf$1", "symbols": ["param_default"], "postprocess": id},
    {"name": "xparam$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "xparam$ebnf$2", "symbols": ["xparam_type"], "postprocess": id},
    {"name": "xparam$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "xparam", "symbols": ["IDENTIFIER", "xparam$ebnf$1", "xparam$ebnf$2"], "postprocess": ast.param},
    {"name": "xparam_type", "symbols": ["_", {"literal":"as"}, "__", "IDENTIFIER"]},
    {"name": "enum", "symbols": [{"literal":"enum"}, "__", "NAME", "enum_members", {"literal":"end"}, "__", {"literal":"enum"}]},
    {"name": "enum_members$ebnf$1", "symbols": []},
    {"name": "enum_members$ebnf$1$subexpression$1", "symbols": ["NL", "enum_member"]},
    {"name": "enum_members$ebnf$1", "symbols": ["enum_members$ebnf$1", "enum_members$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "enum_members", "symbols": ["enum_members$ebnf$1", "NL"]},
    {"name": "enum_member$subexpression$1", "symbols": ["string"]},
    {"name": "enum_member$subexpression$1", "symbols": ["number"]},
    {"name": "enum_member", "symbols": ["NAME", "_", {"literal":"="}, "_", "enum_member$subexpression$1"]}
]
  , ParserStart: "program"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
