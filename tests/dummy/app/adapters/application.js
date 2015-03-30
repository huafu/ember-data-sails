import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';

export default SailsSocketAdapter.extend({
  defaultSerializer: '-rest',
  namespace:         'api/v1',
  useCSRF:      true
});
