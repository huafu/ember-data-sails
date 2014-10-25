import Ember from 'ember';
import SailsSocketAdapter from '../adapters/sails-socket';


var StoreMixin = Ember.Mixin.create({
  /**
   * @since 0.0.11
   * @inheritDoc
   * @method pushPayload
   * @param {String|subclass of DS.Model} [type]
   * @param {Object} payload
   * @param {Boolean} [subscribe] Whether to subscribe to pushed models or not (Sails socket)
   */
  pushPayload: function (/*type, payload, subscribe*/) {
    var args = [].slice.call(arguments), sub = false,
      old = this._pushSubscribes;
    if (Ember.typeOf(args[args.length - 1]) === 'boolean') {
      sub = args.pop();
    }
    this._pushSubscribes = sub;
    this._super.apply(this, args);
    this._pushSubscribes = old;
  },


  /**
   * @since 0.0.11
   * @method push
   * @inheritDoc
   */
  push: function (typeName/*, data, _partial*/) {
    var res = this._super.apply(this, arguments), id, type, adapter;
    if (this._pushSubscribes && res && (id = res.get('id'))) {
      type = this.modelFor(typeName);
      adapter = this.adapterFor(type);
      if(adapter instanceof SailsSocketAdapter)
      {
        adapter._scheduleSubscribe(type, id);
      }
    }
    return res;
  },

  /**
   * Schedule a subscription to the given model
   *
   * @since 0.0.11
   * @method subscribe
   * @param {String|subclass of DS.Model} type
   * @param {Array<String|Number>|String|Number} ids
   */
  subscribe: function (type, ids) {
    var adapter;
    if (Ember.typeOf(ids) !== 'array') {
      ids = [ids];
    }
    type = this.modelFor(type);
    adapter = this.adapterFor(type);
    for (var i = 0; i < ids.length; i++) {
      adapter._scheduleSubscribe(type, ids[i]);
    }
  }
});

export default StoreMixin;
