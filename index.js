/* ==========================================================================
   Compile EJS to HTML post webpack build
   ========================================================================== */
var ejs = require('ejs');
var fs = require('fs');
var path = require('path');

/**
 * @param  {regex} Regex to test against
 * @param  {array} An array of filenames
 * @return {array} An array of filenames passing the provided test
 */
function testFiles(regex, files) {

    var passed = [];

    // Loop files and test against regex
    for (var i = files.length - 1; i >= 0; i--) {
        var filename = files[i];
        if(regex.exec(filename)) {
            passed.push(filename);
        }
    };

    return passed;
}

/**
 * @param  {string} The root dir of the templates
 * @param  {array} An array of EJS template filenames
 * @param  {array} The user provided data
 * @return {array} Objects containing EJS compiled strings and their filenames
 */
function compileEJS(context, files, data) {

    var ejsCompiled = [];

    for (var i = files.length - 1; i >= 0; i--) {

        var filePath,
            fileContents,
            template,
            templateStr;

        // Define the file path
        filePath = path.join(context, files[i]);

        // Read the file contents
        fileContents = fs.readFileSync(filePath, 'utf8');

        // Create the EJS template
        template = ejs.compile(fileContents, {
            context: context,
            filename: path.join('src', 'templates', files[i])
        });

        // Create the template string
        templateStr = template(data);

        // Add template to object
        ejsCompiled.push({
            name: files[i],
            htmlString: templateStr
        });
    };

    return ejsCompiled;
}

/**
 * @param  {array} A list of template objects containing name and htmlString
 * @param  {string} The output path
 * @return {null}
 */
function writeFiles(templates, outputPath) {

    // Loop the templates and write to disk
    for (var i = templates.length - 1; i >= 0; i--) {

        // Update from .ejs to .html
        var htmlFilename = templates[i].name.replace('.ejs', '.html');
        var htmlPath = path.join(outputPath, htmlFilename);

        // Write the file
        fs.writeFile(htmlPath, templates[i].htmlString, function(err) {
            if(err) {
                return console.log(err);
            }
            console.log(htmlPath + ' written');
        });
    };
}

/**
 * @param  {object} The user options passed in at webpack.config
 * @param  {object} The webpack compiler object
 * @return {null}
 */
function apply(options, compiler) {

    var ejsFiles,
        compiledTemplates;

    // Force webpack to watch all files in templates folder
    // @Note: Needs to be updated to fs-readdir-recursive so that sub-templates
    // recompile correctly on watch
    compiler.plugin('emit', function(compiler, callback) {
        fs.readdir(options.context, function(err, files) {
            for (var i = files.length - 1; i >= 0; i--) {
                var filePath = path.join(options.context, files[i]);
                compiler.fileDependencies.push(filePath);
            };
            callback();
        });
    });

    // The compiler has finished emitting its files
    compiler.plugin('after-emit', function(compilation, callback) {

        // Read the files in provided directory and test
        fs.readdir(options.context, function(err, files) {

            // Test the files against the provided config test
            ejsFiles = testFiles(options.test, files);

            // Compile each of the files against the provided data
            compiledTemplates = compileEJS(options.context, ejsFiles, options.data);

            //Write the files to the chosen location
            writeFiles(compiledTemplates, options.output);

            // Continue Webpack build
            callback();
        })
    });
}

/**
 * @param  {object} User defined options
 * @return {object} The apply method run during build process
 */
module.exports = function(options) {

    // If the element is an array
    // wrao it in the options include object
    if (options instanceof Array) {
        options = {
            include: options
        };
    }

    // If the element is not an array
    // wrap it in one and define it in the options include object
    if (!Array.isArray(options.include)) {
        options.include = [ options.include ];
    }

    // Bind the apply function to 'this' and return to Webpack for use
    return {
        apply: apply.bind(this, options)
    };
};
