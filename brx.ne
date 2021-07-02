# reserved words
# And, Box, CreateObject, Dim, Each, Else, ElseIf, End, EndFunction, EndIf, EndSub, EndWhile, Eval, Exit, ExitWhile,
# False, For, Function, GetGlobalAA, GetLastRunCompileError, GetLastRunRunTimeError, Goto, If, Invalid, Let, LINE_NUM,
# Next, Not, ObjFun, Or, Pos, Print, Rem, Return, Run, Step, Stop, Sub, Tab, Then, To, True, Type, While

# lexer clenup regex: \(lexer\.has\(".*?"\) \? (\{.*?\}).*?\)

@{%
const moo = require('./moo/moo')
const ast = require('./ast')

const caseInsensitiveKeywords = map => {
  const transform = moo.keywords(map)
  return text => transform(text.toLowerCase())
}

let lexer = moo.compile({
    comment:    { match: /(?:[ \t]*(?:REM(?![\w!#$%])|').*(?:\r?\n[ \t]*|))+/, lineBreaks: true },
    NL:         { match: /(?:[ \t]*\r?\n[ \t]*)+/, lineBreaks: true },
    ws:         { match: /[ \t]+/ },
    IDENTIFIER: { match: /[a-zA-Z_][\w]*[$%!#&]?/, value: x=>x.toLowerCase(),
        type: caseInsensitiveKeywords({
            true: ['true'], false: ['false'], invalid: ['invalid'],
            and: ['and'], dim: ['dim'], each: ['each'], else: ['else'], elseif: ['elseif'], end: ['end'], endfunction: ['endfunction'],
            endfor: ['endfor'], endif: ['endif'], endsub: ['endsub'], endwhile: ['endwhile'], exit: ['exit'], exitwhile: ['exitwhile'],
            for: ['for'], function: ['function'], goto: ['goto'], if: ['if'], let: ['let'], next: ['next'], not: ['not'], or: ['or'],
            print: ['print'], return: ['return'], step: ['step'], stop: ['stop'], sub: ['sub'], //tab: ['tab'],
            then: ['then'], to: ['to'], while: ['while'], mod: ['mod'],
            // non reserved keywords can be used as variable names
            library: ['library'], boolean: ['boolean'], object: ['object'], dynamic: ['dynamic'], void: ['void'], integer: ['integer'],
        	longinteger: ['longinteger'], float: ['float'], double: ['double'], string: ['string'], in: ['in'], as: ['as']
        })
    },
    numberLit:  /\d+[%&]|\d*\.?\d+(?:[edED][+-]?\d+)?[!#]?|&[hH][0-9ABCDEFabcdef]+[%&]?/,
    stringLit:  /"(?:[^"\n\r]*(?:"")*)*"/,
    op:         /<>|<=|>=|<<|>>|\+=|-=|\*=|\/=|\\=|<<=|>>=/,
    arrow:      /->/,
    othr:       /./
})

const u = d => d[0][0]
const l = (s) => (d) => s   // return constant value: `l('a')`
const flat = d => {          // flaten list of tokens and lists
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
const list = (l,s) => (d) => {
    return d[l].map(a=>a[s])
}
const tailList = (f,l,s) => (d) => {
    return [d[f]].concat(d[l].map(a=>a[s]))
}
%}

@lexer lexer


program -> (NL:+ | _) libs declarations (functions | component):?                {% ast.xprogram %}

libs -> null 
|   library (NL:+ library):*  NL:+                                               {% tailList(0, 1, 1) %}

library -> %library __ string                                                    {% ast.lib %}

functions -> (function NL:+):+                                                   {% list(0, 1) %}
|            component NL:+                                                      {% id %}

function -> func {%id%} | sub {%id%}

func ->
    %function __ NAME _ "(" params ")" __ %as __ xtype
    statement_list %end __ %function                                            {% ast.xfunc %} 
  
sub ->
    %sub __ NAME _ "(" params ")" 
    statement_list (%end __ %sub)                                               {% ast.xfunc %}

anonymous_function ->
    %function _ "(" params ")" __ %as __ xtype statement_list %end __ %function   {% ast.xfunc %}
|   %sub _ "(" params ")" statement_list %end __ %sub                             {% ast.xfunc %}

params -> _ param (_ "," _ param):* _                                           {% ast.params %}
| _                                                                             {% ast.params %}                               

param -> IDENTIFIER param_default:? param_type:?                                {% ast.param %}

param_default -> _ "=" _ rval                                                   

param_type -> _ %as __ xtype                                                   


statement_list -> 
  (statement_separators statement):* statement_separators                       {% ast.statements %}

statement_separators -> statement_separator:+ _                                 {% ast.statement_separators %}
statement_separator -> NL | _ ":"

statement -> 
    if_statement
|   dim_statement
|   for_loop
|   for_each
|   while_loop
|   exit_loop
|   return_statement
|   stop_statement
|   end_statement
# do we ever want goto?
#|   goto_label
#|   goto_statement
|   assign_statement
|   call_statement
|   print_statement


oneline_statement ->
    oneline_if    
|   return_statement
|   stop_statement
|   end_statement
#|   goto_statement
|   exit_loop
|   assign_statement
|   call_statement
|   print_statement

# if ------------------------
if_statement -> 
    %if if_body 
    else_if:*
    (%else statement_list_or_space):?
    endif                                   {% ast.if %}
|   oneline_if                              {% id %}

else_if -> elseif if_body
# using EXPR for conditional because while roku allows to have literal arrays and
# objects and functions in conditions, during complilation they allways fail at runtime
# so it is better to use EXPR and catch those errors early.
if_body -> _ EXPR (_ %then):? statement_list

elseif -> %else __ %if
       |  %elseif
endif -> %end __ %if
       | %endif

# space in "else if" below is important! Will error on %elseif
oneline_if -> %if _ EXPR (_ %then):? _ oneline_statement
              (_ %else __ oneline_statement):?                                 {% ast.oneline_if %}

# enables following "valid" BRS code 
#   if bool then op()
#   else endif 
# notice that there is no statement separator between else and endif
statement_list_or_space -> statement_list {% id %} | __ {% id %}

# end if -------------------

dim_statement -> %dim __ IDENTIFIER _ "[" _ expression_list _ "]"              {% ast.dim %}
expression_list -> (EXPR _ "," _):* EXPR                                       {% ast.expr_list %}

for_loop ->
    %for __ IDENTIFIER _ "=" _ EXPR _ %to _ EXPR (_ %step _ EXPR):? 
    statement_list end_for                                                     {% ast.for %}
end_for -> %end __ %for | %endfor | %next (__ IDENTIFIER):?
# `endfor :` <- results in error, `next :` is ok :(

for_each ->
    (%for __ %each) __ IDENTIFIER __ 
    %in _ rval statement_list end_for_each                                     {% ast.foreach %}
end_for_each -> %end __ %for | %endfor | %next {% id %}

while_loop ->
    %while _ EXPR statement_list (%end __ %while | %endwhile)                  {% ast.while %}

# `exitfor` not allowed, must be `exit for` 
exit_loop -> %exit __ %while                                                   {% ast.exit %}
          | %exitwhile                                                         {% ast.exit %}
          | %exit __ %for                                                      {% ast.exit %}

return_statement -> %return (_ rval):?                                         {% ast.return %}

stop_statement -> %stop                                                        {% ast.stop %}

end_statement -> %end                                                          {% ast.end %}

goto_label -> IDENTIFIER _ ":"

goto_statement -> %goto __ IDENTIFIER

print_statement -> print print_items                                            {% ast.print %}
print -> %print                                                                 {% id %}
       | "?"                                                                    {% id %}
print_items -> 
    psep:*                                                                      {% id %} 
  | psep:* EXPR (_ PEXPR | pxsp EXPR):* (psep:* ppp):?                          {% ast.print_items %}
psep-> ";" {%id%} | "," {%id%} | __ {%id%}
ppp-> ";" {%id%} | "," {%id%}
pxsp-> _ ppp psep:*                                                             {% flat %}

call_statement -> IDENTIFIER access_or_call:* call                              {% ast.lval %}

assign_statement -> lval _ assign_op _ rval                                     {% ast.assign %}
                  | lval _ incdec                                               {% ast.incdec %}
assign_op -> "=" | "+=" | "-=" | "*=" | "/=" | "\\=" | "<<=" | ">>="
incdec -> "+" "+"                                                               {% l('++') %} 
        | "-" "-"                                                               {% l('--') %}

lval ->
    IDENTIFIER                                                                  {% id %}
|   IDENTIFIER access_or_call:* access                                          {% ast.lval %}
access -> 
    _ "." _ PROP_NAME                                                           {% ast.prop %}
|   _ "[" _ EXPR (_ "," _ EXPR):* _ "]"                                         {% ast.index %}
call -> _ "(" _ rval (_ "," _ rval):* _ ")"                                     {% ast.call %}
      | _ "(" _ ")"                                                             {% ast.call %}        
xmlattr -> _ "@" _ ATTR_NAME                                                    {% ast.xmlattr %}

PROP_NAME ->
    IDENTIFIER          {% ast.name %}
|   RESERVED            {% ast.name %}
|   constant            {% ast.name %}
|   string              {% ast.name %}
ATTR_NAME ->
    IDENTIFIER          {% ast.name %}
|   RESERVED            {% ast.name %}          
access_or_call ->
    access              {% id %}
|   call                {% id %}
# property, index, call or xml attribute: picx  `a.prop[5]@attr.toInt()`
picx ->
    access              {% id %}
|   call                {% id %}
|   xmlattr             {% id %}

rval -> EXPR            {% id %}
|   object_literal      {% id %}
|   array_literal       {% id %}
|   anonymous_function  {% id %}

object_literal ->
    "{" _NL (prop lisep):* prop (_ | lisep) "}"                                 {% ast.object %} 
|   "{" _NL "}"                                                                 {% ast.object %}
array_literal ->
    "[" _NL (rval lisep):* rval (_ | lisep) "]"                                 {% ast.array %}
|   "[" _NL "]"                                                                 {% ast.array %}
prop -> PROP_NAME _ ":" _ rval                                                  {% ast.propdef %}
lisep -> _ "," _NL | NL:+


val -> 
    IDENTIFIER    {% id %}
|   number        {% id %}
|   string        {% id %}
|   constant      {% id %}
# Keeping array_literal and object_literal out of val because they are not valid in expressions
# I.e. `[5] + 5`, `[1] + [2,3]`, `{ t:5 } * a` etc. not allowed
# Roku compiler allows [], {} and func in if condition, but it allways fails at runtime with Type Missmatch error
#  ax = []
#  if ax = [] ? "ok"     <- runtime error
#  ax = {}
#  if ax = {} ? "ok"     <- runtime error
#  ax = function () : end function
#  if ax = function () : end function ? "<O_O>"   <- runtime error

EXPR -> O               {% ast.expr %}
P -> "(" _ O _ ")"      {% ast.parenthesis %}
   | val                {% id %}
AOP -> P picx:+         {% ast.access %} 
   | P                  {% id %}
U -> ("-"|"+") _ U      {% ast.uop %}
   | AOP                {% id %}
E -> U _ "^" _ E        {% ast.bop %}
   | U                  {% id %}
M -> M _ mul_op _ E     {% ast.bop %}
   | E                  {% id %}
A -> A _ add_op _ M     {% ast.bop %}
   | M                  {% id %}
S -> S _ shft_op _ A    {% ast.bop %}
   | A                  {% id %}
C -> C _ comp_op _ S    {% ast.bop %}
   | S                  {% id %}
N -> %not _ N           {% ast.uop %}
   | C                  {% id %}
D -> D _ %and _ N       {% ast.bop %}
   | N                  {% id %}
O -> O _ %or _ D        {% ast.bop %}
   | D                  {% id %}

# resolve ambiguity in print statment ie `? 1 -1` is it ?(1-1) or ?(1), (-1)
# by disallowing left unary op and enclosing parenthesis.
# Alaso `? bar (1)` can only mean function bar called with 1
PEXPR -> PO             {% ast.expr %}   # PEXP can not start with -|+ or (
PAOP -> val picx:+      {% ast.access %}
   | val                {% id %}
PE -> PAOP _ "^" _ E    {% ast.bop %}
   | PAOP               {% id %}
PM -> PM _ mul_op _ E   {% ast.bop %}
   | PE                 {% id %}
PA -> PA _ add_op _ M   {% ast.bop %}
   | PM                 {% id %}
PS -> PS _ shft_op _ A  {% ast.bop %}
   | PA                 {% id %}
PC -> PC _ comp_op _ S  {% ast.bop %}
   | PS                 {% id %}
PN -> %not _ N          {% ast.uop %}
   | PC                 {% id %}
PD -> PD _ %and _ N     {% ast.bop %}
   | PN                 {% id %}
PO -> PO _ %or _ D      {% ast.bop %}
   | PD                 {% id %}
###########

add_op -> "+" | "-"
mul_op -> "*" | "/" | "\\" | %mod
shft_op -> ">>" | "<<"
comp_op -> "=" | "<>" | "<" | ">" | "<=" | ">=" 


_ -> %ws:?                      {% id %}
__ -> %ws                       {% id %}
comment    -> %comment          {% ast.comment %}
NAME       -> %IDENTIFIER       {% ast.identifier %}
|             UNRESERVED        {% ast.identifier %}
IDENTIFIER -> %IDENTIFIER       {% ast.identifier %}
|             UNRESERVED        {% ast.identifier %}
number     -> %numberLit        {% ast.number %}
string     -> %stringLit        {% ast.string %}
constant   -> %true             {% ast.constant %}
|             %false            {% ast.constant %}
|             %invalid          {% ast.constant %}
ANYID      -> IDENTIFIER        {% id %}
|             constant          {% id %}
|             RESERVED          {% id %}
NL         -> comment           {% id %}
            | %NL               {% id %}
_NL        -> _ | NL:+

RESERVED   ->
            %and        {%id%} | %dim       {%id%} | %each       {%id%} | %else      {%id%} |
            %elseif     {%id%} | %end       {%id%} | %endfunction {%id%} | %endif    {%id%} |
            %endsub     {%id%} | %endwhile  {%id%} | %for        {%id%} | %function  {%id%} |
            %goto       {%id%} | %if        {%id%} | %let        {%id%} | %next      {%id%} |
            %not        {%id%} | %or        {%id%} | %print      {%id%} | %return    {%id%} |
            %step       {%id%} | %stop      {%id%} | %sub        {%id%} | 
            %then       {%id%} | %to        {%id%} | %while      {%id%} | %exit      {%id%} |
            %exitwhile  {%id%} | %mod       {%id%} | %endfor     {%id%}

UNRESERVED ->
            %library {%id%} | %boolean {%id%} | %object {%id%} | %dynamic {%id%} | %void {%id%} | %integer {%id%} |
        	%longinteger {%id%} | %float {%id%} | %double {%id%} | %string {%id%} | %in {%id%} | %as {%id%}


#######################################
# custom extensions (code comments)
#######################################
declarations -> ((interface | enum | typedef | func_decl) NL:+):*                 {% list(0, 0) %}

interface -> "interface" __ NAME ("<" templates ">"):? (__ "extends" __ NAME):?
             interface_members
             "end" __ "interface"                                                 {% ast.interface %}

templates -> template_param ("," _ template_param):*                              {% tailList(0, 1, 2) %}
template_param -> IDENTIFIER (_ ":" _ xtype):?                                    {% ast.templateParam %}

interface_members -> (NL:+ interface_member):* NL:+

interface_member  -> 
            ("readonly" __):? NAME __ "as" __ xtype                               {% ast.iproperty %}
|           func_decl                                                             {% id %}

xparams ->   _ xparam (_ "," _ xparam):* _                                        {% ast.params %}
|            _                                                                    {% ast.params %}

xparam -> IDENTIFIER "?":? __ "as" __ xtype                                       {% ast.xparam %}                                                 

func_decl -> "function" __ NAME _ "(" xparams ")" (__ "as" __ xtype):?            {% ast.ifunction %}

enum      -> "enum" __ NAME
             enum_members
             "end" __ "enum"                                                      {% ast.enum %}

enum_members -> (NL:+ enum_member):* NL:+
enum_member  -> ANYID (_ "=" _ (string | number)):?                               {% ast.enummember %}

xtype_list   -> _ xtype ("," _ xtype):* _                                         {% tailList(1, 2, 2) %}
xtype_list2  -> _ xtype ("," _ xtype):+ _                                         {% tailList(1, 2, 2) %}
xtype_list0  -> xtype_list {%id%}  | _  {% l([]) %}

xtype       ->  otype                               {%id%}
|               otype "!"                           {% ast.nonOptional %}
|               otype "?"                           {% ast.optional %}
|               func_type                           {%id%}
|               "(" func_type ")" "!"               {% ast.nonOptional %}
|               named_type "<" xtype_list ">"       {% ast.genericType %}

otype       ->  named_type {%id%} | array_type {%id%} 
|               tuple_type {%id%} | obj_type   {%id%}

named_type  ->  IDENTIFIER                                                        {% ast.namedType %}
array_type  ->  "[" _ xtype _ "]"                                                 {% ast.arrayType %}
tuple_type  ->  "[" xtype_list2 "]"                                               {% ast.tupleType %}
func_type   ->  "(" xtype_list0 ")" _ "->" _ xtype                                {% ast.funcType  %}
obj_type    ->  "{" __NL obj_prop ((NL | "," __) obj_prop):* __NL "}"             {% ast.objType %}
obj_prop    ->  PROP_NAME ":" __ xtype                                            {% ast.objProp %}

__NL        -> __ | NL:+
# void function introduces ambiguity with: (func_type)!
# () -> void should be used instead
#func_void   ->  "(" xtype_list0 ")"                                               {% ast.funcType  %}

typedef ->  "typedef" __ NAME _ "=" _ xtype                                       {% ast.typedef %}

component -> "component" __ NAME __ "extends" __ NAME
              component_members
             "end" __ "component"                                                 {% ast.component %}

component_members -> (NL:+ component_member):* NL:+

attribute -> "@" NAME (_ "(" _ expression_list _ ")"):?                           {% ast.attribute %}
attributes -> (attribute NL:+):*                                                    {% list(0, 0) %}

component_member  -> 
            attributes ("public" __):? ("readonly" __):? NAME __ "as" __ xtype             {% ast.cproperty %}
|           attributes ("public" __):? function                                            {% ast.cfunc %}