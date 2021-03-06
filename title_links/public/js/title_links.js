frappe.ui.form.ControlLink = frappe.ui.form.ControlLink.extend({
	format_for_input: function(value){
		var me = this, su = this._super, ret;
		if (value) {
			frappe.call({
				'async': false,
				'method': 'title_links.routes.search_title',
				'args': {
					doctype: me.df.options,
					name: value
				},
				callback: function(res){
					if (!res.exc){
						ret = res.message[1];
					}
				}
			});
		} else if (me.value) {
			ret = me.value;
		} else {
			ret = su(value)
		}
		return ret;
	},
	set_input: function(value){
		this.last_value = this.value;
		this.value = value;
		if (this.$input) {
			this.$input.data("value", value);
			this.$input.val(this.format_for_input(value));
		}
		this.set_disp_area();
		this.set_mandatory && this.set_mandatory(value);
	},
	get_value: function(){
		return this.$input ? this.$input.data("value") : undefined;
	},
	setup_awesomeplete: function(){
		var me = this;
		this.$input.on('blur', function(){
			var value = me.$input.val();
			if(me.doctype && me.docname) {
				if(value!==me.last_value) {
					me.parse_validate_and_set_in_model(value);
					me.set_mandatory(value);
				}
			} else {
				me.set_input(value);
			}
		});

		this.$input.cache = {};
		
		this.$awesomplete = new Awesomplete(me.input, {
			minChars: 0,
			maxItems: 99,
			autoFirst: true,
			list: [],
			data: function(item, input){
				var label = item.value + "%%%" + (item.description || "") + "%%%" + (item.title || "");
				if (item.value.indexOf("__link_option") !== -1){
					label = item.label
				}
				return {
					label: label,
					value: item.value
				}
			},
			filter: function(item, input){
				var value = item.value.toLowerCase();
				if (item.label){
					value += " " + item.label.toLowerCase();
				}
				if (value.indexOf('__link_option') !== -1 ||
					value.indexOf(input.toLowerCase()) !== -1){
					return true;
				}
			},
			item: function(item, input){
				if (item.value.indexOf("__link_option") == -1){
					var parts = item.split("%%%"),
					d = {
						value: parts[0],
						description: parts[1],
					},
					_value = parts[2] || parts[0];
				
					if (me.translate_values){
						_value = __(_value);
					}
					var html = "<strong>" + _value + "</strong>";
					if (d.description && d.value !== d.description){
						html += '<br><span class="small">' + __(d.description) + '</span>';
					}
				} else {
					var html = item.label;
				}
				return $('<li></li>')
						.data('item.autocomplete', d)
						.prop('aria-selected', 'false')
						.html('<a><p>' + html + '</p></a>')
						.get(0)
			},
			sort: function(a, b){
				return 0;
			}
		});

		this.$input.on("input", function(e){
			var doctype = me.get_options();
			if (!doctype) return;
			if (!me.$input.cache[doctype]){
				me.$input.cache[doctype] = {};
			}

			if (e.target.value && (e.target.value||"").length){
				var term = e.target.value;

				if (me.$input.cache[doctype][term] != null){
					//immediately show from cache
					me.$awesomplete.list = me.$input.cache[doctype][term];
				}
				
				var args = {
					'txt': term,
					'doctype': doctype
				}

				me.set_custom_query(args);

				frappe.call({
					'type': 'GET',
					'method': 'title_links.routes.search_link',
					'no_spinner': true,
					'args': args,
					callback: function(r){
						if (!me.$input.is(":focus")){
							return;
						}

						if (!me.df.only_select){
							if (frappe.model.can_create(doctype)
								&& me.df.fieldtype !== "Dynamic Link"){
								// new item
								r.results.push({
									'label': "<span class='text-primary link-options>"
											+ "<i class='fa fa-plus' style='margin-right: 5px;'></i>"
											+ __("Create a new {0}", [__(me.df.options)])
											+ "</span>",
									'value': 'create_new__link_option',
									'action': me.new_doc
								});
							}
							// advanced search
							r.results.push({
								label: "<span class='text-primary link-options'>"
										+ "<i class='fa fa-search' style='margin-right: 5px;'></i>"
										+ __("Advanced Search")
										+ "</span>",
								value: "advanced_search__link_option",
								action: me.open_advanced_search
							});
						}
						me.$input.cache[doctype][term] = r.results;
						me.$awesomplete.list = r.results;
					}
					me.$input.cache[doctype][term] = r.results;
					me.$awesomplete.list = r.results;
				}
			});
		});

		this.$input.on("awesomplete-open", function(e){
			me.$wrapper.css({'z-index': 101});
			me.autocomplete_open = true;
		});

		this.$input.on("awesomplete-close", function(e){
			me.$wrapper.css({'z-index': 1});
			me.autocomplete_open = false;
		});

		this.$input.on("awesomplete-select", function(e) {
			var o = e.originalEvent;
			var item = me.$awesomplete.get_item(o.text.value);

			me.autocomplete_open = false;

			// prevent selection on tab
			var TABKEY = 9;
			if(e.keyCode === TABKEY) {
				e.preventDefault();
				me.$awesomplete.close();
				return false;
			}

			if(item.action) {
				item.value = "";
				item.action.apply(me);
			}

			// if remember_last_selected is checked in the doctype against the field,
			// then add this value
			// to defaults so you do not need to set it again
			// unless it is changed.
			if(me.df.remember_last_selected_value) {
				frappe.boot.user.last_selected_values[me.df.options] = item.value;
			}

			if(me.frm && me.frm.doc) {
				me.selected = true;
				me.parse_validate_and_set_in_model(item.value);
				me.format_for_input(item.value);
				setTimeout(function() {
					me.selected = false;
				}, 100);
			} else {
				me.selected = true;
				me.set_input(item.value);
				me.$input.trigger('change');
			}
			o.preventDefault();
			me.$awesomplete.close()
			me.$input.trigger('awesomplete-selectcomplete');
		});

		this.$input.on("awesomplete-selectcomplete", function(e) {
			var o = e.originalEvent;
			if(o.text.value.indexOf("__link_option") !== -1) {
				me.$input.val("");
			}
		});
	}
});


frappe.form.formatters.Link = function(value, docfield, options) {
	var doctype = docfield._options || docfield.options, title;
	if (value){
		frappe.call({
			'async': false,
			'method': 'title_links.routes.search_title',
			'args': {
				doctype: doctype,
				name: value
			},
			callback: function(res){
				if (!res.exc){
					title = res.message[1];
				}
			}
		});
	}
	if(value && value.match(/^['"].*['"]$/)) {
		return value.replace(/^.(.*).$/, "$1");
	}
	if(options && options.for_print) {
		return title || value;
	}
	if(!value) {
		return "";
	}
	if(docfield && docfield.link_onclick) {
		return repl('<a onclick="%(onclick)s">%(title)s</a>',
			{onclick: docfield.link_onclick.replace(/"/g, '&quot;'), title:title});
	} else if(docfield && doctype) {
		return repl('<a class="grey" href="#Form/%(doctype)s/%(name)s" data-doctype="%(doctype)s">%(label)s</a>', {
			doctype: encodeURIComponent(doctype),
			name: encodeURIComponent(value),
			label: __(options && options.label || title || value)
		});
	} else {
		return title || value;
	}
};

frappe.ui.form.GridRow = frappe.ui.form.GridRow.extend({
	make_column: function(df, colsize, txt, ci){
		var me = this;
		if (this.doc && this.doc.doctype !== cur_frm.doctype && me.doc[df.fieldname] && df.fieldtype.indexOf("Link") !== -1){
			frappe.call({
				'async': false,
				'method': 'title_links.routes.search_title',
				'args': {
					doctype: (df.fieldtype === "Link") ? df.options : me.doc[df.options],
					name: me.doc[df.fieldname]
				},
				callback: function(res){
					if (!res.exc){
						txt = res.message[1];
					}
				}
			});	
		}
		return this._super(df, colsize, txt, ci);
	}
});

(function(){
frappe.templates["list_item_main"] = frappe.templates["list_item_main"].replace(
	'<a class="filterable h6 text-muted grey" data-filter="{%= col.fieldname %},=,{%= value %}">{%= value %}</a>',
	'<a class="filterable h6 text-muted grey" data-filter="{%= col.fieldname %},=,{%= value %}">{%= frappe.format(value, col.df, null, data) %}</a>'
);
delete frappe.template.compiled["list_item_main"];
})();
