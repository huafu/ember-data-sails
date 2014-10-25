import DS from 'ember-data';
import StoreMixin from '../mixins/store';
import SailsSocketService from '../services/sails-socket';

import SailsSerializer from '../serializers/sails';
import SailsSocketAdapter from '../adapters/sails-socket';
import SailsRESTAdapter from '../adapters/sails-rest';

DS.Store.reopen(StoreMixin);

DS.SailsSerializer = SailsSerializer;
DS.SailsSocketAdapter = SailsSocketAdapter;
DS.SailsRESTAdapter = SailsRESTAdapter;


export function initialize(container, application) {
  application.register('service:sails-socket', SailsSocketService);
  application.register('serializer:sails', SailsSerializer);
  application.register('adapter:sails-rest', SailsRESTAdapter);
  application.register('adapter:sails-socket', SailsSocketAdapter);
  // setup injections
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

export default {
  name:   'sails-socket-service',
  before: 'store',

  initialize: initialize
};
