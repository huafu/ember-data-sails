import Ember from 'ember';
import DS from 'ember-data';
import WithLoggerMixin from '../mixins/with-logger';
import {LEVELS} from '../mixins/with-logger';
import StoreMixin from '../mixins/store';
import SailsSocketService from '../services/sails-socket';

var get$ = Ember.get;

DS.Store.reopen(StoreMixin);

export function initialize(container, application) {
  var methods, minLevel, shouldLog;
  methods = {};
  minLevel = get$(application, 'SAILS_LOG_LEVEL');
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

  application.register('service:sails-socket', SailsSocketService);
  application.register('config:ember-data-sails', get$(application, 'emberDataSails') || {}, {instantiate: false});

  // setup injections
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('serializer', 'config', 'config:ember-data-sails');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

var EmberDataSailsInitializer = {
  name:   'ember-data-sails',
  before: 'store',

  initialize: initialize
};

export default EmberDataSailsInitializer;
