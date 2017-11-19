odoo.define('web_google_maps.MapRecord', function(require) {
    'use strict';

    var core = require('web.core');
    var Domain = require('web.Domain');
    var field_utils = require('web.field_utils');
    var utils = require('web.utils');
    var Widget = require('web.Widget');
    var WidgetRegistry = require('web.widget_registry');

    var _t = core._t;
    var Qweb = core.qweb;

    var MapRecord = Widget.extend({
        template: 'MapView.record',
        events: {
            'click .o_map_global_click': 'on_marker_clicked',
        },
        init: function (parent, state, options) {
            this._super.apply(this, arguments);

            this.fields = state.fields;
            this.fieldsInfo = state.fieldsInfo.map;
            this.modelname = state.model;

            this.options = options;
            this.read_only_mode = state.read_only_mode;
            this.model = state.model;
            this.group_info = state.group_info;
            this.qweb = options.qweb;
            this.sub_widgets = {};

            this.init_content(record);
            // avoid quick multiple clicks
            this.on_marker_clicked = _.debounce(this.on_marker_clicked, 300, true);
        },
        init_content: function (record) {
            var self = this;
            this.id = record.id;
            this.values = {};
            _.each(record, function (v, k) {
                self.values[k] = {
                    value: v
                };
            });
            this.record = this.transform_record(record);
            var qweb_context = {
                record: this.record,
                widget: this,
                read_only_mode: this.read_only_mode,
                user_context: session.user_context,
                formats: formats,
                map_image: this.map_image
            };
            for (var p in this) {
                if (_.str.startsWith(p, 'map_')) {
                    qweb_context[p] = _.bind(this[p], this);
                }
            }
            this.qweb_context = qweb_context;
            this.content = this.qweb.render('map-marker-iw', qweb_context);
        },
        renderElement: function () {
            this._super();
            this.$el.addClass('o_map_record');
            this.$el.data('record', this);
            if (this.$el.hasClass('o_map_global_click') || this.$el.hasClass('o_map_global_click_edit')) {
                this.$el.on('click', this.proxy('on_global_click'));
            }
        },
        transform_record: function (record) {
            var self = this;
            var new_record = {};
            _.each(_.extend(_.object(_.keys(this.fields), []), record), function (value, name) {
                var r = _.clone(self.fields[name] || {});
                if ((r.type === 'date' || r.type === 'datetime') && value) {
                    r.raw_value = time.auto_str_to_date(value);
                } else {
                    r.raw_value = value;
                }
                r.value = formats.format_value(value, r);
                new_record[name] = r;
            });
            return new_record;
        },
        map_image: function (model, field, id, cache, options) {
            options = options || {};
            var url;
            if (this.record[field] && this.record[field].value && !utils.is_bin_size(this.record[field].value)) {
                url = 'data:image/png;base64,' + this.record[field].value;
            } else if (this.record[field] && !this.record[field].value) {
                url = "/web/static/src/img/placeholder.png";
            } else {
                if (_.isArray(id)) {
                    id = id[0];
                }
                if (!id) {
                    id = undefined;
                }
                if (options.preview_image)
                    field = options.preview_image;
                var unique = this.record.__last_update && this.record.__last_update.value.replace(/[^0-9]/g, '');
                url = session.url('/web/image', {
                    model: model,
                    field: field,
                    id: id,
                    unique: unique
                });
                if (cache !== undefined) {
                    // Set the cache duration in seconds.
                    url += '&cache=' + parseInt(cache, 10);
                }
            }
            return url;
        },
        on_global_click: function (ev) {
            if (!ev.isTrigger) {
                var trigger = true;
                var elem = ev.target;
                var ischild = true;
                var children = [];
                while (elem) {
                    var events = $._data(elem, 'events');
                    if (elem == ev.currentTarget) {
                        ischild = false;
                    }
                    var test_event = events && events.click && (events.click.length > 1 || events.click[0].namespace !== "tooltip");
                    if (ischild) {
                        children.push(elem);
                        if (test_event) {
                            // do not trigger global click if one child has a click event registered
                            trigger = false;
                        }
                    }
                    if (trigger && test_event) {
                        _.each(events.click, function (click_event) {
                            if (click_event.selector) {
                                // For each parent of original target, check if a
                                // delegated click is bound to any previously found children
                                _.each(children, function (child) {
                                    if ($(child).is(click_event.selector)) {
                                        trigger = false;
                                    }
                                });
                            }
                        });
                    }
                    elem = elem.parentElement;
                }
                if (trigger) {
                    this.on_marker_clicked(ev);
                }
            }
        },
        on_marker_clicked: function () {
            this.trigger_up('map_record_open', {
                id: this.id
            });
        },
        map_compute_domain: function(domain) {
            return data.compute_domain(domain, this.values);
        },
    });

    return MapRecord;

});