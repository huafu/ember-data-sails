import Ember from 'ember';
import DS from 'ember-data';
import WithLogger from '../mixins/with-logger';

var SailsSerializer = DS.RESTSerializer.extend(WithLogger, {
  /**
   * @since 0.0.11
   * @method extractArray
   * @inheritDoc
   */
  extractArray: function (store, primaryType, payload) {
    var newPayload = {};
    newPayload[primaryType.typeKey.pluralize()] = payload;
    return this._super(store, primaryType, newPayload);
  },

  /**
   * @since 0.0.11
   * @method extractSingle
   * @inheritDoc
   */
  extractSingle: function (store, primaryType, payload, recordId) {
    var newPayload;
    // handle the delete case
    if (payload === null) {
      return this._super.apply(this, arguments);
    }
    newPayload = {};
    newPayload[primaryType.typeKey.pluralize()] = [payload];
    return this._super(store, primaryType, newPayload, recordId);
  },

  /**
   * @since 0.0.11
   * @method extractDeleteRecord
   * @inheritDoc
   */
  extractDeleteRecord: function (store, type, payload, id, requestType) {
    return this._super.apply(this, store, type, null, id, requestType);
  },

  /**
   * @since 0.0.11
   * @method serializeIntoHash
   * @inheritDoc
   */
  serializeIntoHash: function (data, type, record, options) {
    var json;
    if (Ember.keys(data).length > 0) {
      this.error(
        'trying to serialize multiple records in one hash for type %@'.fmt(type.typeKey),
        data
      );
      throw new Error('Sails does not accept putting multiple records in one hash');
    }
    json = this.serialize(record, options);
    for (var k in json) {
      data[k] = json[k];
    }
  },

  /**
   * @since 0.0.11
   * @method normalize
   * @inheritDoc
   */
  normalize: function (type, hash, prop) {
    var normalized;
    normalized = this._super(type, hash, prop);
    return this._extractEmbeddedRecords(type, normalized);
  },

  /**
   * Extract the embedded records and create them
   *
   * @since 0.0.11
   * @method _extractEmbeddedRecords
   * @param {subclass of DS.Model} type
   * @param {Object} hash
   * @returns {Object}
   * @private
   */
  _extractEmbeddedRecords: function (type, hash) {
    var self = this, serializer, store = this.store;
    type.eachRelationship(function (key, rel) {
      var data;
      if ((data = hash[key])) {
        if (rel.kind === 'belongsTo') {
          if (Ember.typeOf(hash[key]) === 'object') {
            self.debug('found 1 embedded %@ record:'.fmt(rel.type.typeKey), hash[key]);
            delete hash[key];
            serializer = store.serializerFor(rel.type.typeKey);
            self.store.push(rel.type, serializer.normalize(rel.type, data, null));
            hash[key] = data.id;
          }
        }
        else if (rel.kind === 'hasMany') {
          serializer = store.serializerFor(rel.type.typeKey);
          hash[key] = data.map(function (item) {
            if (Ember.typeOf(item) === 'object') {
              self.debug('found 1 embedded %@ record:'.fmt(rel.type.typeKey), item);
              self.store.push(rel.type, serializer.normalize(rel.type, item, null));
              return item.id;
            }
            return item;
          });
        }
        else {
          self.warn('unknown relationship kind %@:'.fmt(rel.kind), rel);
          throw new DS.Error('Unknown relationship kind ' + rel.kind);
        }
      }
    });
    return hash;
  }
});

export default SailsSerializer;
