import Ember from 'ember';
import DS from 'ember-data';
import WithLoggerMixin from '../mixins/with-logger';
import {LEVELS} from '../mixins/with-logger';
import StoreMixin from '../mixins/store';
import SailsSocketService from '../services/sails-socket';

DS.Store.reopen(StoreMixin);

var get = Ember.get;
var merge = Ember.merge;

export function initialize(container, application) {
  var methods, minLevel, shouldLog, socketScriptOptions;
  methods = {};
  minLevel = application.SAILS_LOG_LEVEL;
  shouldLog = false;
  LEVELS.forEach(function (level) {
    if (level === minLevel) {
      shouldLog = true;
    }
    if (!shouldLog) {
      methods[level] = Ember.K;
    }
  });
  WithLoggerMixin.reopen(methods);

  // find out the socket host and path
  socketScriptOptions = merge({
    protocol:   location.protocol === 'file:' ? 'http:' : location.protocol,
    hostname:   location.hostname,
    port:       location.port,
    scriptPath: '/js/dependencies/sails.io.js',
    apiPath:    ''
  }, get(application, 'emberDataSails.socketScript'));

  container.register('sails-socket:options', socketScriptOptions, {instantiate: false});
  container.register('service:sails-socket', SailsSocketService);

  // setup injections
  application.inject('service:sails-socket', 'socketOptions', 'sails-socket:options');
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

var EmberDataSailsInitializer = {
  name:   'ember-data-sails',
  before: 'store',

  initialize: initialize
};

export default EmberDataSailsInitializer;
