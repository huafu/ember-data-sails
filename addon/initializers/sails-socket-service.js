
export function initialize(container, application) {
  application.inject('adapter:sails-socket', 'sailsSocket', 'service:sails-socket');
  application.inject('route', 'sailsSocket', 'service:sails-socket');
  application.inject('controller', 'sailsSocket', 'service:sails-socket');
}

export default {
  name:   'sails-socket-service',
  before: 'store',

  initialize: initialize
};
