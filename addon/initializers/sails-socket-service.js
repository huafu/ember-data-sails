import SailsSocketService from 'ember-data-sails/services/sails-socket';


export function initialize(container, application) {
  application.register('service:sails-socket', SailsSocketService);
  application.inject('adapter', 'sailsSocket', 'service:sails-socket');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

export default {
  name:   'sails-socket-service',
  before: 'store',

  initialize: initialize
};
