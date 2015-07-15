/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-data-sails',

  contentFor: function(what, config) {
    var options;

    if (config.APP && config.APP.emberDataSails) {
      options = config.APP.emberDataSails;
    } else {
      options = {};
    }

    if (what === 'body') {

      // if loading the script from the Sails server, it's not necessary to set `io.sails.url`
      if (!options.loadExternalScript) {

        // if loadFromSails is true and host and/or scriptPath have not been set, use the Sails defaults
        if (!options.scriptPath) {
          options.scriptPath = "//localhost:1337/js/dependencies/sails.io.js";
        }

        return '<script type="text/javascript" id="eds-sails-io-script" src="' + options.scriptPath + '"></script>' +
          '<script type="text/javascript">io.sails.autoConnect = false; io.sails.emberDataSailsReady = true;</script>';
      }
      // when loading the script from a server that IS NOT the Sails server, we need to set `io.sails.url`
      else {
        return '<script type="text/javascript" src="' + options.scriptPath + '"></script>' +
          '<script type="text/javascript">io.sails.url = "' + options.sailsHost + '";io.sails.autoConnect = false; io.sails.emberDataSailsReady = true;</script>';
      }
    }
  }
};
