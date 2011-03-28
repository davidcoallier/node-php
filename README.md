Inline PHP Server Running on Node.js
====================================

Be worried, be very worried. The name **NodePHP** takes its name from the fact that we are effectively
turning a nice Node.js server into a FastCGI interface that interacts with PHP-FPM. 

This is omega-alpha-super-beta-proof-of-concept but it already runs a few simple scripts. Mostly done
for my talks on **Node.js for PHP Developers** this turns out to be quite an interesting project that
we are most likely be going to use with [Orchestra](http://orchestra.io) when we decide to release our
**Inline PHP server** that allows people to run PHP without Apache, Nginx or any webserver.

Yes this goes against all ideas and concepts of Node.js but the idea is to be able to create a web-server
directly from any working directory to allow developers to get going even faster than it was before. No
need to create vhosts or server blocks ore modify your /etc/hosts anymore.

Synopsis
--------
This node.js module is made for the sole purpose of my conference talk but also to allow developers to
get started with PHP even faster than the usual. After installing this node-module, developers need to make
sure they have PHP-FPM running somewhere on their system. If it is, they will be able to go to any of their
web-directory (that the FPM user has access to) and simply type `node php` and from there they will see a
nice little output that looks like this:

    bash$~ PHP Server is now running on port 9001
           Incoming Request: GET /test.php
             --> Request Response Status Code: "200"

This is going to be running in the browser allowing you to develop and test your applications faster. Hopefully
you will end up **forking** the project and helping out because I do not have enough time to do all I would want to
do with this thing.


Installing
----------
Well this is a bit tricky, there are a few things you will need in order to get this thang running:

  - You need a running PHP-FPM server. See below for a section on trying to get FPM running on your system.
  - You need to have Node.js installed with NPM 
  - Install **node-fastcgi-parser** ( https://github.com/billywhizz/node-fastcgi-parser )
  - You need to install this *package* with NPM so all dependencies are respected. So you `git clone git://github.com/davidcoallier/node-php.git`, then you `git submodule init`, then you `git submodule update`, and `npm install`

For this beta version, we assume that you are running FPM off `localhost` on port `9000`. If you are running
through a **socket** you may want to make your own script that looks like this:

    var php = require('nodephp');
    php.nodephp({
        fcgi: {
            port: '/tmp/php-fpm.sock',
            host: null,
        },
        server: {
            port: 9998
        }
    });

Please note that the sock connection has not been tested yet. All that has been tested is connecting to a different
FastCGI port and starting the server on a different port like such:

    var php = require('nodephp');
    php.nodephp({
        fcgi: {
            port: 9001,
            host: 'localhost',
        },
        server: {
            port: 9111
        }
    });


Serving Static Files
--------------------
You will realise rapidly enough that only running this is quite useless as it does not serve static files and such. This is why the **node-php**
code has the abiliyt to define **blocks** — albeit simple blocks. They are defined in the second argument of the nodephp call:

    var php = require('nodephp');
    php.nodephp({
        fcgi: {
            port: 9001,
            host: 'localhost',
        },
        server: {
            port: 9111
        }
    }, {
        "\.(js|css|png|jpg|jpeg|gif|txt|less)$": php.NODEPHP_TYPE_STATIC,
        "\.php$": php.NODEPHP_TYPE_FCGI,
        "index": "index.php"
    });

Where the following are:

    NODEPHP_TYPE_STATIC: Static files that do not need to go through the fastcgi handler (`fastcgi_pass`)
    NODEPHP_TYPE_FCGI: Files you do send through the FCGI handler.
    
If you want more simple using the default `localhost:9000` for the FCGI handler:

    var php = require('nodephp');
    php.nodephp({}, {
        "\.(js|css|png|jpg|jpeg|gif|txt|less)$": php.NODEPHP_TYPE_STATIC,
        "\.php$": php.NODEPHP_TYPE_FCGI,
        "index": "index.php"
    });

Hopefully this helps.


Issues &amp; Todos
------------------
There are a few very important issues right now:
    
  - There is no POST handling. I'm not that far in the FCGI specs yet — need to find how to send data (post data)
  - There is no **base** url. If you include ../../../../poop it will try to load it and most likely will fail.
  - If you try to load a file that the PHP-FPM worker does not have access to, it will fail silently and you will swear. A lot.


Disclaimer
----------
This is an ugly prototype and if you run this in production you are most likely mentally challenged (Not that it's a bad thing..) but
I take no responsibility for what you do with this. Moreover, this goes against everything Node.js stands for. So realise that.


License
-------
Released under the New BSD License.

Copyright (c) 2011 David Coallier
