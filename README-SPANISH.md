Servidor PHP ejecutando en linea en Node.js
====================================

Preocupate, preocupate mucho, El nombre **NodePHP** se toma de el hecho de que estamos efectivamente volcando a buen servidor Node.js a una interfaz FastCGI que interactúa con PHP-FPM.

Este es omega-alfa-super-beta-prueba-de-concepto pero esta actualmente ejecutando unos pocos scripts simples. Parcialmente hecho para mis platicas sobre **Node.js para los desarrolladores de PHP** esta resulta ser un proyecto bastante interesante que estamos más probable es que vamos a utilizar con [Orchestra] (http://orchestra.io) cuando decidimos lanzar nuestra **Servidor en línea de PHP** que permite a las personas para ejecutar PHP sin Apache, Nginx o cualquier servidor web.

Sí, esto va en contra de todas las ideas y conceptos de Node.js, pero la idea es ser capaz de crear un servidor web directamente desde cualquier directorio de trabajo para permitir a los desarrolladores para ponerse en marcha incluso más rápido de lo que era antes. 

No necesita crear un host virtual o bloques de servidor o modificar más tu /etc/hosts.

Sinopsis
--------
Este módulo Node.js se hace con el único propósito de mi platica de conferencia, sino que también para permitir a los desarrolladores
empezar a trabajar con PHP incluso más rápido de lo normal. Después de instalar este módulo de node, los desarrolladores tienen que asegurarse de que tienen PHP-FPM corriendo en algún lugar de su sistema. Si es así, ellos serán capaces de ir a cualquiera de sus directorios web (esos que el usuario FPM tiene acceso) y simplemente escriba 'node PHP' y desde allí se verá una poco bonita salida que luce como esto:

    bash$~ servidor PHP esta ahora corriendo en el puerto 9001
           Petición de entrada: GET /test.php
             -> Codigo de estatus de respuesta de petición: "200"

Esto se va a correr en el navegador permitiendole desarrollar y probar las aplicaciones más rápido. Ojalá el resultado final será **bifurcando** el proyecto y ayudando porque no tengo suficiente tiempo para hacer todo lo que quisiera hacer con esa cosa.


¿Qué?
-----
Le permite entrar en un directorio, escribir "node-php" y tener un servidor web en ejecución que sirve PHP. ¿Feliz?...


Instalación
----------
Bueno, esto es un poco difícil, hay algunas cosas que se necesitan en orden para conseguir esto en ejecución.

  - Necesitas un servidor PHP-FPM corriendo.
  - Necesitas tener instalado Node.js con la NGP
  - Instalar **node-fastcgi-parser** (https://github.com/billywhizz/node-fastcgi-parser)
  - A continuación, 'git clone git://github.com/davidcoallier/node-php.git', a continuación 'git submodule update', y`'npm install'.

Para esta versión beta, se supone que está corriendo FPM fuera de localhost en el puerto 9000. Si está corriendo a través de un **socket** tu puedes desear tu propio script que se veria así:

    Var = php require('nodephp');
    php.nodephp ({
        fcgi: {
            puerto: '/tmp/php-fpm.sock',
            host: null,
        },
        servidor: {
            puerto: 9998
        }
    });

Por favor recuerde que la conexión no ha sido probada aún. Todo lo que se ha probado es la conexión a una diferente puerto FastCGI e iniciar el servidor en un puerto diferente tal como:

    Var = php require('nodephp');
    php.nodephp ({
        fcgi: {
            puerto: 9001,
            host: 'localhost',
        },
        servidor: {
            puerto: 9111
        }
    });


Sirviendo archivos estáticos
--------------------
Liberarás suficientemente rápido que sólo se corriéndolo esto es bastante inútil, ya que no sirve archivos estáticos y semejantes. Esta es el porque el código **node-php** tiene la capacidad para definir **bloques** aunque bloques simples. Se definen en el segundo argumento de la llamada **node-php**:

    Var php = require('nodephp');
    php.nodephp ({
        fcgi: {
            puerto: 9001,
            host: 'localhost',
        },
        servidor: {
            puerto: 9111
        }
    }, {
        "\.(js|css|png|jpg|jpeg|gif|txt|less)$": php.NODEPHP_TYPE_STATIC,
        "\.php$": php.NODEPHP_TYPE_FCGI,
        "index": "index.php"
    });

Donde los siguientes son:

    NODEPHP_TYPE_STATIC: Archivos estáticos que no necesitan pasar por el controlador de fastcgi ( 'fastcgi_pass')
    NODEPHP_TYPE_FCGI: Archivos que usted envia a través del controlador de FCGI.
    
Si quieres más simplsa utilizando el 'localhost: 9000' por defecto para el manejador FCGI:

    var php = require('nodephp');
    php.nodephp ({}, {
        "\.(js|css|png|jpg|jpeg|gif|txt|less)$": php.NODEPHP_TYPE_STATIC,
        "\.php$": php.NODEPHP_TYPE_FCGI,
        "index": "index.php"
    });

Esperemos que esto ayuda.


Elementos & tareas
------------------
Hay algunos elementos muy importantes justo ahora:
    
  -No es un manejador de POST. No estoy tan lejos en las especificaciones de FCGI sin embargo - es necesario encontrar como enviar datos (datos de POST)
  - No hay una url **base**. Si incluyes ../../../../poop tratará de cargarlo y muy probablemente fallará.
  - Si intentas cargar un archivo que el trabajador PHP-FPM no tiene acceso, se producirá un error silencioso y maldeciras. Mucho. Por silencio me refiero, se le dará un 404 incluso aunque los archivos existan.


Renuncia
----------
Este es un prototipo feo y si lo ejecutas en producción, seras más probablemente retos mentales (No es que sea algo malo ..), pero no tomo ninguna responsabilidad de lo que puede hacer con el. Por otra parte, esto va en contra de todo lo que Node.js. Así que dense cuenta de eso.


Licencia
-------
Publicado bajo la nueva licencia BSD.

Copyright (C) 2011 David Coallier
