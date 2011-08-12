var url     = require('url');
var fs      = require('fs');
var path    = require("path");
var http    = require("http");
var net     = require("net");
var sys     = require("sys");
var fastcgi = require("fastcgi");

var NODEPHP_STATIC = 'static';
var NODEPHP_FCGI   = 'fcgi';

var params;

var FCGI_RESPONDER = fastcgi.constants.role.FCGI_RESPONDER;
var FCGI_BEGIN     = fastcgi.constants.record.FCGI_BEGIN;
var FCGI_STDIN     = fastcgi.constants.record.FCGI_STDIN;
var FCGI_STDOUT    = fastcgi.constants.record.FCGI_STDOUT;
var FCGI_PARAMS    = fastcgi.constants.record.FCGI_PARAMS;
var FCGI_END       = fastcgi.constants.record.FCGI_END;

/**
 * Make headers for FPM
 *
 * Some headers have to be modified to fit the FPM
 * handler and some others don't. For instance, the Content-Type
 * header, when received, has to be made upper-case and the 
 * hyphen has to be made into an underscore. However, the Accept
 * header has to be made uppercase, hyphens turned into underscores
 * and the string "HTTP_" has to be appended to the header.
 *
 * @param  array headers An array of existing user headers from Node.js
 * @param  array params  An array of pre-built headers set in serveFpm
 *
 * @return array         An array of complete headers.
 */
function makeHeaders(headers, params) {
    if (headers.length <= 0) {
        return params;
    }

    for (prop in headers) {
        head = headers[prop];
        prop = prop.replace(/-/, '_').toUpperCase();
        if (prop.indexOf('CONTENT_TYPE') < 0) {
            // Quick hack for PHP, might be more or less headers.
            prop = 'HTTP_' + prop;
        }

        params[params.length] = [prop, head]
    }

    return params;
};

/**
 * Interact with FPM
 *
 * This function is used to interact with the FastCGI protocol
 * using net.Stream and the fastcgi module.
 *
 * We pass the request, the response, some params and some options
 * that we then use to serve the response to our client.
 *
 * @param object Request  The HTTP Request object.
 * @param object Response The HTTP Response object to use.
 * @param array  Params   A list of parameters to pass to FCGI
 * @param array  options  A list of options like the port of the fpm server.
 *
 * @return void
 */
function server(request, response, params, options) {
    var connection = new net.Stream();
    connection.setNoDelay(true);

    var writer = null;
    var parser = null;

    var header = {
        "version": fastcgi.constants.version,
        "type": FCGI_BEGIN,
        "recordId": 0,
        "contentLength": 0,
        "paddingLength": 0
    };
    var begin = {
        "role": FCGI_RESPONDER,
        "flags": 0
    };

    function sendRequest (connection) {
        header.type = FCGI_BEGIN;
        header.contentLength = 8;
        writer.writeHeader(header);
        writer.writeBegin(begin);
        connection.write(writer.tobuffer());

        header.type = FCGI_PARAMS;
        header.contentLength = fastcgi.getParamLength(params);
        writer.writeHeader(header);
        writer.writeParams(params);
        connection.write(writer.tobuffer());

        header.type = FCGI_STDOUT;
        writer.writeHeader(header);
        connection.write(writer.tobuffer());

        connection.end();
    };

    connection.ondata = function (buffer, start, end) {
        parser.execute(buffer, start, end); 
    };

    connection.addListener("connect", function() {
        writer = new fastcgi.writer();
        parser = new fastcgi.parser();

        body="";

        parser.onRecord = function(record) {
            if (record.header.type == FCGI_STDOUT) {
                body = record.body;
                
                parts = body.split("\r\n\r\n");

                headers = parts[0];
                headerParts = headers.split("\r\n");

                body = parts[1];

                var responseStatus = 200;

                headers = [];
                try {
                    for(i in headerParts) {
                        header = headerParts[i].split(': ');
                        if (header[0].indexOf('Status') >= 0) {
                            responseStatus = header[1].substr(0, 3);
                            continue;
                        }

                        headers.push([header[0], header[1]]);
                    }
                } catch (err) {
                    //console.log(err);
                }

                headers.push(['X-Server' , 'Node.js-' + process.version]);
                response.writeHead(responseStatus, headers);
                response.end(body);

                console.log('  --> Request Response Status Code: "' + responseStatus + '"');
            }
        };

        parser.onHeader = function(header) {
            body = '';
        };

        parser.onError = function(err) {
            //console.log(err);
        };

        sendRequest(connection); 
    });

    connection.addListener("close", function() {
        connection.end();
    });

    connection.addListener("error", function(err) {
        sys.puts(sys.inspect(err.stack));
        connection.end();
    });

    connection.connect(options.fcgi.port, options.fcgi.host);
}

/**
 * Serve a static file.
 *
 * This function is used to serve static files back to the users. A static
 * file is determined by looking at the map of static files we have in the
 * function and the file is then read, served with it's associated 
 * content-type and then the response object is used to say: "We're done." Next.
 *
 * @param  string file     The request file to parse.
 * @param  string path     The path to the file to parse.
 * @param  object response The HTTP Response object.
 * @param  object request  The HTTP Request object.
 *
 * @return void 
 */
function serveStatic(file, path, response, request) {
   // List taken from djangode
   // @link https://github.com/simonw/djangode/blob/master/djangode.js
   var types = {
        ".3gp"   : "video/3gpp",
        ".a"     : "application/octet-stream",
        ".ai"    : "application/postscript",
        ".aif"   : "audio/x-aiff",
        ".aiff"  : "audio/x-aiff",
        ".asc"   : "application/pgp-signature",
        ".asf"   : "video/x-ms-asf",
        ".asm"   : "text/x-asm",
        ".asx"   : "video/x-ms-asf",
        ".atom"  : "application/atom+xml",
        ".au"    : "audio/basic",
        ".avi"   : "video/x-msvideo",
        ".bat"   : "application/x-msdownload",
        ".bin"   : "application/octet-stream",
        ".bmp"   : "image/bmp",
        ".bz2"   : "application/x-bzip2",
        ".c"     : "text/x-c",
        ".cab"   : "application/vnd.ms-cab-compressed",
        ".cc"    : "text/x-c",
        ".chm"   : "application/vnd.ms-htmlhelp",
        ".class" : "application/octet-stream",
        ".com"   : "application/x-msdownload",
        ".conf"  : "text/plain",
        ".cpp"   : "text/x-c",
        ".crt"   : "application/x-x509-ca-cert",
        ".css"   : "text/css",
        ".csv"   : "text/csv",
        ".cxx"   : "text/x-c",
        ".deb"   : "application/x-debian-package",
        ".der"   : "application/x-x509-ca-cert",
        ".diff"  : "text/x-diff",
        ".djv"   : "image/vnd.djvu",
        ".djvu"  : "image/vnd.djvu",
        ".dll"   : "application/x-msdownload",
        ".dmg"   : "application/octet-stream",
        ".doc"   : "application/msword",
        ".dot"   : "application/msword",
        ".dtd"   : "application/xml-dtd",
        ".dvi"   : "application/x-dvi",
        ".ear"   : "application/java-archive",
        ".eml"   : "message/rfc822",
        ".eps"   : "application/postscript",
        ".exe"   : "application/x-msdownload",
        ".f"     : "text/x-fortran",
        ".f77"   : "text/x-fortran",
        ".f90"   : "text/x-fortran",
        ".flv"   : "video/x-flv",
        ".for"   : "text/x-fortran",
        ".gem"   : "application/octet-stream",
        ".gemspec": "text/x-script.ruby",
        ".gif"   : "image/gif",
        ".gz"    : "application/x-gzip",
        ".h"     : "text/x-c",
        ".hh"    : "text/x-c",
        ".htm"   : "text/html",
        ".html"  : "text/html",
        ".ico"   : "image/vnd.microsoft.icon",
        ".ics"   : "text/calendar",
        ".ifb"   : "text/calendar",
        ".iso"   : "application/octet-stream",
        ".jar"   : "application/java-archive",
        ".java"  : "text/x-java-source",
        ".jnlp"  : "application/x-java-jnlp-file",
        ".jpeg"  : "image/jpeg",
        ".jpg"   : "image/jpeg",
        ".js"    : "application/javascript",
        ".json"  : "application/json",
        ".log"   : "text/plain",
        ".m3u"   : "audio/x-mpegurl",
        ".m4v"   : "video/mp4",
        ".man"   : "text/troff",
        ".mathml"  : "application/mathml+xml",
        ".mbox"  : "application/mbox",
        ".mdoc"  : "text/troff",
        ".me"    : "text/troff",
        ".mid"   : "audio/midi",
        ".midi"  : "audio/midi",
        ".mime"  : "message/rfc822",
        ".mml"   : "application/mathml+xml",
        ".mng"   : "video/x-mng",
        ".mov"   : "video/quicktime",
        ".mp3"   : "audio/mpeg",
        ".mp4"   : "video/mp4",
        ".mp4v"  : "video/mp4",
        ".mpeg"  : "video/mpeg",
        ".mpg"   : "video/mpeg",
        ".ms"    : "text/troff",
        ".msi"   : "application/x-msdownload",
        ".odp"   : "application/vnd.oasis.opendocument.presentation",
        ".ods"   : "application/vnd.oasis.opendocument.spreadsheet",
        ".odt"   : "application/vnd.oasis.opendocument.text",
        ".ogg"   : "application/ogg",
        ".p"     : "text/x-pascal",
        ".pas"   : "text/x-pascal",
        ".pbm"   : "image/x-portable-bitmap",
        ".pdf"   : "application/pdf",
        ".pem"   : "application/x-x509-ca-cert",
        ".pgm"   : "image/x-portable-graymap",
        ".pgp"   : "application/pgp-encrypted",
        ".pkg"   : "application/octet-stream",
        ".pl"    : "text/x-script.perl",
        ".pm"    : "text/x-script.perl-module",
        ".png"   : "image/png",
        ".pnm"   : "image/x-portable-anymap",
        ".ppm"   : "image/x-portable-pixmap",
        ".pps"   : "application/vnd.ms-powerpoint",
        ".ppt"   : "application/vnd.ms-powerpoint",
        ".ps"    : "application/postscript",
        ".psd"   : "image/vnd.adobe.photoshop",
        ".py"    : "text/x-script.python",
        ".qt"    : "video/quicktime",
        ".ra"    : "audio/x-pn-realaudio",
        ".rake"  : "text/x-script.ruby",
        ".ram"   : "audio/x-pn-realaudio",
        ".rar"   : "application/x-rar-compressed",
        ".rb"    : "text/x-script.ruby",
        ".rdf"   : "application/rdf+xml",
        ".roff"  : "text/troff",
        ".rpm"   : "application/x-redhat-package-manager",
        ".rss"   : "application/rss+xml",
        ".rtf"   : "application/rtf",
        ".ru"    : "text/x-script.ruby",
        ".s"     : "text/x-asm",
        ".sgm"   : "text/sgml",
        ".sgml"  : "text/sgml",
        ".sh"    : "application/x-sh",
        ".sig"   : "application/pgp-signature",
        ".snd"   : "audio/basic",
        ".so"    : "application/octet-stream",
        ".svg"   : "image/svg+xml",
        ".svgz"  : "image/svg+xml",
        ".swf"   : "application/x-shockwave-flash",
        ".t"     : "text/troff",
        ".tar"   : "application/x-tar",
        ".tbz"   : "application/x-bzip-compressed-tar",
        ".tcl"   : "application/x-tcl",
        ".tex"   : "application/x-tex",
        ".texi"  : "application/x-texinfo",
        ".texinfo" : "application/x-texinfo",
        ".text"  : "text/plain",
        ".tif"   : "image/tiff",
        ".tiff"  : "image/tiff",
        ".torrent" : "application/x-bittorrent",
        ".tr"    : "text/troff",
        ".txt"   : "text/plain",
        ".vcf"   : "text/x-vcard",
        ".vcs"   : "text/x-vcalendar",
        ".vrml"  : "model/vrml",
        ".war"   : "application/java-archive",
        ".wav"   : "audio/x-wav",
        ".weba"  : "audio/webm",
        ".webm"  : "video/webm",
        ".wma"   : "audio/x-ms-wma",
        ".wmv"   : "video/x-ms-wmv",
        ".wmx"   : "video/x-ms-wmx",
        ".wrl"   : "model/vrml",
        ".wsdl"  : "application/wsdl+xml",
        ".xbm"   : "image/x-xbitmap",
        ".xhtml"   : "application/xhtml+xml",
        ".xls"   : "application/vnd.ms-excel",
        ".xml"   : "application/xml",
        ".xpm"   : "image/x-xpixmap",
        ".xsl"   : "application/xml",
        ".xslt"  : "application/xslt+xml",
        ".yaml"  : "text/yaml",
        ".yml"   : "text/yaml",
        ".zip"   : "application/zip"
    };

    console.log('Incoming Request: ' + request.method + ' ' + request.url);
    try {
        response.writeHead(200, {'Content-Type': types[file.substr(file.lastIndexOf('.'), file.length)]});
        response.write(fs.readFileSync(path + file, 'utf8'));
        response.end();
    } catch (Exception) {
        response.writeHead(400, {'Content-Type': types[file.substr(file.lastIndexOf('.'), file.length)]});
        response.write('<h2>404 - Not Found</h2>');
        console.log('  ---> Error loading file: ' + file);
        response.end();
    }
};

/**
 * Serve the PHP file to FPM
 *
 * This function is used to serve PHP files and invoke the
 * fpm serve. A few parameters are set directly from this method
 * as such as the SCRIPT_FILENAME, QUERY_STRING, etc. 
 *
 * All the parameters set by this function are required by the FPM
 * handler to process the request.
 *
 * @param  string script_file  The file to process.
 * @param  string script_dir   The directory containing the file.
 * @param  object request      The HTTP Request object.
 * @param  object response     The HTTP Response Object.
 * @param  array  options      A list of options to pass.
 */
function serveFpm(script_file, script_dir, request, response, params, options) {
    try {
        fs.readFileSync(script_dir + script_file, 'utf8');
    } catch (err) {
        console.log('  ---> Error loading file: ' + script_file);
        response.writeHead(404, {});
        response.end();
    }

    var qs = url.parse(request.url).query ? url.parse(request.url).query : '';
    params = makeHeaders(request.headers, [
        ["SCRIPT_FILENAME",script_dir + '/' + script_file],
        ["QUERY_STRING", qs],
        ["REQUEST_METHOD", request.method],
        ["SCRIPT_NAME", script_file],
        ["DOCUMENT_URI", script_file],
        ["REQUEST_URI", request.url],
        ["DOCUMENT_ROOT", script_dir],
        ["PHP_SELF", script_file],
        ["GATEWAY_PROTOCOL", "CGI/1.1"],
        ["SERVER_SOFTWARE", "nodephp/" + process.version]
    ]);

    console.log('Incoming Request: ' + request.method + ' ' + request.url);
    server(request, response, params, options);
};

/**
 * Create the actual server
 *
 * This is essentially the constructor where we pass our options
 * and our block configuration and from there we run a server that 
 * will serve static and FPM files.
 *
 * The options look like such:
 * <code>
 * {
 *     fcgi: {port: 9000, host: localhost},
 *     server: {port: 9001}
 * }
 * </code>
 *
 * The block parameter is used to define the rules of which types to serve.
 * <code>
 * {
 *     "\.(js|css)$": 'static',
 * }
 * </code>
 */
function createServer(opts, block) {

    // Let's mix those options.
    var options = Object.create({
        fcgi: {
            port: 9000,
            host: 'localhost', // This can be a socket.
        },
        server: {
            port: 9001,
        }
    });
    options.extend(opts);

    http.createServer(function(request, response) {
        /**
         * Here's a list of things to change:
         *  
         *  - Retrieve teh correct script invoked by parsing the request.url
         *    and analysing the filename passed.
         *
         *  - Rewrite rules?
         *  - Location blocks?
         *  - Get the headers and insert them correctly in Params.
         */

        // We simulate that the index page is is index.php if the requested
        // script was "/". 
        var script_file = request.url == '/' ? '/index.php' :  url.parse(request.url).pathname;
        var script_name = script_file.substr(1, script_file.length);
        
        // We only pass `pwd` as the second argument an we can run a server
        // with the directory index of the current directory. Handy.
        var __script_dir__ = process.cwd();

        // For now.
        var pathname = url.parse(request.url).pathname;
        var extension = pathname.substr(pathname.lastIndexOf('.'), pathname.length);

        for (rule in block) {
            if (rule == 'index') { continue; }
            if (pathname.match(rule)) {
                if (block[rule] == NODEPHP_STATIC) {
                    return serveStatic(pathname, __script_dir__, response, request);
                } else if (block[rule] == NODEPHP_FCGI) {
                    return serveFpm(script_file, __script_dir__, request, response, params, options);
                }
            }
        }

        // If we get here, it means we didn't find a PHP file and we didn't find a static file. Might
        // be time for a rewrite and our rewrites are simple: /index?...
        var default_index = block['index'] || '/index.php';
        serveFpm(default_index, __script_dir__, request, response, params, options);

    }).listen(options.server.port);

    console.log("PHP Server is now running on http://" + options.server.host + ":" + options.server.port);
};

/**
 * Even though some people hate this (With good reasons)
 * I find it works very well for what I need and I don't
 * have time to implement somethign more clever. 
 *
 * Enjoy and if you want comments and ideas about this, see
 * my link: http://onemoredigit.com/post/1527191998/extending-objects-in-node-js
 */
Object.defineProperty(Object.prototype, "extend", {
    enumerable: false,
    value: function(from) {
        var props = Object.getOwnPropertyNames(from);
        var dest = this;
        props.forEach(function(name) {
            if (name in dest) {
                var destination = Object.getOwnPropertyDescriptor(from, name);
                Object.defineProperty(dest, name, destination);
            }
        });
        return this;
    }
});
exports.nodephp = createServer;

exports.NODEPHP_TYPE_STATIC = NODEPHP_STATIC;
exports.NODEPHP_TYPE_FCGI   = NODEPHP_FCGI;
