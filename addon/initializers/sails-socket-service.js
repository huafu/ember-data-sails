export default {
  name: 'sails-socket-service',
  before: 'store',

  initialize: function(container, app) {
    app.inject('adapter:sails-socket', 'sailsSocket', 'service:sails-socket');
    app.inject('route', 'sailsSocket', 'service:sails-socket');
    app.inject('controller', 'sailsSocket', 'service:sails-socket');
  }
};
