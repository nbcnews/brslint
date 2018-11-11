# Brslint
Parsing and linting tool for Roku's BrightScript language


## Installation

```
npm i brslint -g
```

## Usage

```
brslint [path] [options]
```

If path is a directory brslint will lint *.brs* files in that directory and all of it's subdirectories. 

```
brslint source                     

brslint source/main.brs
```

If path is not provided brslint will first look for brslint.config in current directory.
If config is not found brslint will run as if `.` path was provided

### brslint.config

brslint.config can be used to customise what file or directories should be linted as well as which rules should
be applied.

In the follwing example files in `directory1`, `directory2/subdirectory`, their subdirectories 
and `directory/file.brs` will be linted. While files in `directory1/subdirectory` will be excluded

```
{
    "paths": {
        "include": [
            "directory1",
            "directory2/subdirectory",
            "directory/file.brs"
        ],
        "exclude": [
            "directory1/subdirectory"
        ]
    }
}
```

You can select custom set of rules as shown below  

```
{
    "rules": {
        "include": [
            "no_empty_then",
            "no_empty_else",
            "function_too_big",
            "function_type",
        ]
    }
}
```
