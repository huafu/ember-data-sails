import DS from 'ember-data';
import StoreMixin from '../mixins/store';
import SailsSocketService from '../services/sails-socket';

DS.Store.reopen(StoreMixin);


export function initialize(container, application) {
  application.register('service:sails-socket', SailsSocketService);
  application.inject('store', 'sailsSocket', 'service:sails-socket');
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

export default {
  name:   'sails-socket-service',
  before: 'store',

  initialize: initialize
};
