

###  Suman-Watch

# About
Suman watch can run test files on changes, transpile/compile code on changes, or both. By default, suman-watch
will both transpile and run files. To prevent transpilation, use the `--nt` flag (no-transpile). To prevent running files, 
use the `--nr` (no-run) flag. If you use both the `--nr` and `--nt` flags, suman-watch does not have much to do :)

Just like with running suman at the command line, suman-watch uses the @transform.sh and @run.sh files,
where they exist. Transpilation will happen by default, if a @transform.sh file exists for that file, 
and the file is in a @src directory, otherwise no transpilation step will occur and the test will only be run.
In order to transpile/compile, a @transform.sh file must exist. And if a @transform.sh file exists, a
@run.sh file must also exist, otherwise suman will have no idea how to execute your transpiled tests. 
However, a @run.sh file can exist without a @transform.sh file. 
The @run.sh and @transform.sh files will be applied to any sibling or child file in the filesystem tree.


# Common Usage 
Suman provides some sensible defaults for the two most common patterns when using watch features for testing -

1. When test files change, we run the changed file. This can speed up test development, so you don't have to switch between
editor and command line. If a @transform.sh/@run.sh exists for this file, we run those instead of executing the changed
file directly.

2. Running a set or subset of tests, when project files change. This will watch for files outside of your test directory,
essentially the inverse of the above. This means you get can get quick feedback when developing new features
on common code paths.


Suman allows you to define your own scripts to use when files change, using watch scripts defined in
your suman.conf.js file. In order to accomplish 2. above, you should use a watch script.

# Examples

Here are some example commands, with a description of what each command does.

### Command:
```bash
suman --watch
```
### Explanation:

This will watch your testSrcDir (defined in your suman.conf.js file) for changes to any file in that directory
that matches a runnable test, and transform and run it when it changes. The source file will only be transformed
if there is relevant @transform.sh file.


### Command:
```bash
suman --watch --nr
```
### Explanation:

This will watch your `testSrcDir` (defined in your `suman.conf.js` file) for changes to any file in any `@src` directory,
and run the nearest `@transform.sh` for that file, with the path of the changed file represented by the `${SUMAN_TEST_FILE_PATH}`
env variable.


### Command:
```bash
suman --watch --nt
```
### Explanation:

This is probably not a common choice, but is supported. This will watch your `testSrcDir` 
(defined in your `suman.conf.js` file), but will only watch files for changes for which there is no relevant
@tranform.sh file. So what will happen is files may change, and they will be executed directly. This will
allow you to rapidly develop tests which do not require compilation/transpilation. Note using the `--nt` option
is exactly the same as omitting the option, if there are no @transform.sh files in your test directory.


# Suman watch scripts

You can define watch scripts in your `suman.conf.js` file, like so:

<br>

A complete list of options is here:
```javascript
{
  watch: {
    
 
     per: {
 
       foo: {
         exec: ''
         include: [],
         exclude: [],
         confOverride: {
 
         }
       },
 
       bar: {
           exec: ''
           include: [],
           exclude: [],
           confOverride: {
          
          }
       },
 
       baz: {
          exec: ''
          include: [],
          exclude: [],
          confOverride: {
         
         }
       }
 
     }
 
   }
}

```

