/**
 * First we include our new webserver.
 */
var php = require('./lib/nodephp.js');

/**
 * Second we use it. This will create a new webserve on port 9001 and
 * will interact with fcgi on localhost and port 9000.
 *
 * This script will run with the "document_root" from where it's being
 * ran so if you run it from /var/www/test the "document_root" will be
 * ... wait for it... "/var/www/test".
 */
server = php.nodephp({fcgi: {host: '127.0.0.1', port: 9010}}, {
		"\.(js|css|png|jpg|jpeg|gif|txt|less)$": php.NODEPHP_TYPE_STATIC,
		"\.php$": php.NODEPHP_TYPE_FCGI,
		"index": "index.php"
});
