import Ember from 'ember';
import DS from 'ember-data';
import WithLoggerMixin from '../mixins/with-logger';
import {LEVELS} from '../mixins/with-logger';
import StoreMixin from '../mixins/store';
import SailsSocketService from '../services/sails-socket';

const { get } = Ember;

DS.Store.reopen(StoreMixin);

export function initialize(application) {
  let methods = {};
	let shouldLog = false;
	console.log(...arguments);
  const minLevel = get(application, 'SAILS_LOG_LEVEL');
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
  application.register('config:ember-data-sails', get(application, 'emberDataSails') || {}, {instantiate: false});

  // setup injections
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('serializer', 'config', 'config:ember-data-sails');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

export default {
  name:   'ember-data-sails',
  before: 'ember-data',

  initialize: initialize
};
