'```
' interface ICollection
'   property range as [Int,Int]!
'   property bbb as Boolean
''  property fff as (Object, Boolean) -> Node!
''  lol comments
'   function Count() as Int
'   function map(f as (Object)->Object) as ICollection
'   function reduce()
' end interface
' typedef IntsToStrings = (([int]!)->[string]!)!
' interface Booie extends Fooie
'    function ohhNoes(duo as [int, string]) as ([int]) -> [string]
'    function ohhYess(duo as [int, string]) as IntsToStrings!
' end interface
'
' enum HakaLaka
'   One = "one"
'   Two
'   Thee = 4
'   Four = 4
' end enum
'```

'**
'* just blah blah
'*

function xxx(x, y) as Object
end function

'**
'* blah blah
'*  @param x as Fooie
'*  @param y as IFormatter
'*  @returns IDontKnowWhat
'*
function fooie(x, y) as Object
end function

'**
'* Baz me a timber har har
'*  @param range as [int, int]
'*  @param mapper as ((int)->string)!
'*  @returns [string]!
'*
function baz(range, mapper) as Object
    items = []
    for i = range[0] to range[1]
        items.push(mapper(i))
    end for
    return items
end function

'```
' typedef Waka = Void
'