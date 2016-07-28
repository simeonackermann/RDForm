(function( $ ) {

	/************************************************************************
	* RDForm class
	************************************************************************/
	function RDForm( elem, settings ) {
		this.$elem = $(elem);
		this.settings = settings;
		this._ID_ = "rdform";
		this.template = null;
		this.data = settings.data;
		this.Hooks = null;
		this.translations = null;

		//add an alert area before the form
		this.alertArea = $('<div class="row '+this._ID_+'-alert"></div>');
		this.$elem.before( this.alertArea );

		this.MODEL = new Array();
		this.RESULT = new Object();
		
		return this;
	}

	RDForm.prototype = {
		prepare: function() {
			var _this = this;

			// loading language file
			if ( _this.settings.lang && _this.settings.lang != "en.js" ) {
				$.ajax({ url: _this.settings.lang, dataType: "script", async: false,
					success: function() {
						_this.translations = rdform_translations;
						if ( _this.settings.debug ) {
							console.log( "Loaded language file " + _this.settings.lang );
						}
					},
					error: function( jqxhr, type, e ) {
						_this.showAlert( "error", 'Error on loading language file "'+ _this.settings.lang +'": '+e );
					}
				});
			}

			//loading hooks file
			if ( _this.settings.hooks ) {
				$.ajax({ url: _this.settings.hooks, dataType: "script", async: false,
					success: function() {
						try {
							_this.Hooks = new RDForm_Hooks( _this );
							if ( _this.settings.debug ) {
								console.log( "Loaded hooks file " + _this.settings.hooks );
							}
						} catch (e) {
							_this.showAlert( "error", 'Cannot init hooks file "'+ _this.settings.hooks +'": '+e );
						}
					},
					error: function( jqxhr, type, e ) {
						_this.showAlert( "error", 'Cannot load hooks file "'+ _this.settings.hooks +'": '+e );
					}
				});
			}

			// loading jsonld
			if ( typeof jsonld === 'undefined' ) {
				$.ajax({ url: "js/jsonld.js", dataType: "script", async: false,
					error: function( jqxhr, type, e ) {
						_this.showAlert( "error", 'Cannot load JSON-LD plugin "js/jsonld.js": '+e );
					}
				});
			}

			// loading template file			
			var templateFile = _this.settings.cache ? _this.settings.template : _this.settings.template + "?" + (new Date()).getTime();
			var template = null;
			$.ajax({ url: templateFile, type: "GET", dataType: "text", async: false,
				success: function( m ) {
					template = m;
				},
				error: function( jqxhr, type, e ) {
					_this.showAlert( "error", 'Cannot load template "'+ _this.settings.template +'": '+e);
				}
			});
			_this.template = template;
		},

		init: function() {
			var _this = this;

			if ( _this.settings.debug ) {
				console.log("RDForm settings = ", _this.settings);
			}

			// parsing model
			if ( _this.template ) {
				_this.parseTemplate();
				if ( this.settings.debug ) {
					console.log( "RDForm Model = ", this.MODEL );
				}
			}

			if ( _this.MODEL.length > 0 ) {
				_this.$elem.append( _this.createHTMLForm() );
				_this.$elem.attr("autocomplete", "off");
								
				_this.initFormHandler( _this.$elem );

				var sbm_text = "create";

				// maybe add existing data
				if ( _this.data ) {
					sbm_text = "update";
					if ( _this.settings.debug ) {
						console.log( "RDForm Insert Data = ", _this.data );
					}
					_this.addExistingData();
				}

				// append submit button
				_this.$elem.append('<div class="form-group '+_this._ID_+'-submit-btn-group"><div class="col-xs-12 text-right">' + 
									'<button type="reset" class="btn btn-default '+_this._ID_+'-abort">'+ _this.l("reset") +'</button> ' + 
									'<button type="submit" class="btn btn-lg btn-primary">'+ _this.l(sbm_text) +'</button>' + 
								'</div></div>' );
			}
			return this;
		},


		/**
		  *	Parse template file and create the MODEL array
		  *
		  * @return void
		  */
		parseTemplate: function( ) {
			var _this = this;
			var template = $.parseHTML( _this.template );
			var curClassIndex = 0;

			_this.MODEL[0] = { "@context" : {} };

			// get baseuri
			if ( $(template).attr("base") ) {
				_this.setBaseUri($(template).attr("base"));
			}		

			// get prefixes
			if ( $(template).attr("prefix") ) {
				var prefixesArr = $(template).attr("prefix").split(" ");
				if ( prefixesArr.length % 2 != 0 ) {
					_this.showAlert( "warning", "Invalid prefix attribute format. Use: 'prefix URL prefix URL...'" );
				}
				for (var i = 0; i < prefixesArr.length - 1; i += 2) {
					_this.MODEL[0]["@context"][ prefixesArr[i] ] = { "@id" : prefixesArr[i+1] };
				}
			}

			// walk the classes
			$(template).children('div').each(function(i) {
				var curClass = new Object({ '@rdform' : {} });
				var properties = new Object();

				if ( $(this).attr("typeof") === undefined ) {
					_this.showAlert( "error", "Error: Couldnt find the attribute \"typeof\" in div on position " + (i+1) );
					return;
				}

				if ( $(this).attr("resource") === undefined ) {
					_this.showAlert( "error", "Error: Couldnt find the attribute \"resource\" in div on position " + (i+1) );
					return;
				}

				curClass['@id'] = $(this).attr("resource");
				curClass['@type'] = $(this).attr("typeof");
				_this.validatePrefix( curClass['@type'] );
								
				if ( $(this).attr("id") )
					curClass['@rdform']['id-html'] = $(this).attr("id");
				if ( $(this).attr("return-resource") )
					curClass['@rdform']['id-return'] = $(this).attr("return-resource");
				if ( $(this).attr("typeof-select") )
					curClass['@rdform']['typeof-select'] = $(this).attr("typeof-select");
				if ( $(this).prev("legend").length > 0 )
					curClass['@rdform']['legend'] = _this.l( $(this).prev("legend").text() );				
				if ( $(this).find("p.help") ) {
					curClass['@rdform']['help'] = $(this).find("p.help").html();
				}
				//curClass['@rdform']['properties'] = [];

				// walk the input-properties
				$(this).children('input').each(function() {
					var curProperty = { '@rdform' : {} };

					if ( $(this).attr("type") === undefined ) { // check if type exists, set literal as default
						$(this).attr("type", "literal");
						_this.showAlert( "warning", "Model parsing exception: type attribute in property \"" + $(this).attr("name") + "\" in \"" + curClass['@id'] + "\" is not set. I manually added it as literal..." );
					}
					if ( $(this).attr("name") === undefined ) { // check if name exists
						_this.showAlert( "error", "Attention: Unnamed Property-" + $(this).attr("type") + " in \"" + curClass['@id'] + "\". Please add any name." );
						return;
					}

					// add all attributes: type, name, value, multiple, additional, readonly, placeholder, datatype, requiere, autocomplete, textare, boolean, checked, select, ...				
					$.each ( $(this)[0].attributes, function( ai, attr) {
						curProperty["@rdform"][ attr.name ] =  attr.value;

						// maybe translate same attributes
						if ( attr.name == "placeholder" || attr.name == "title" || attr.name == "label" ) {
							curProperty["@rdform"][ attr.name ] = _this.l( attr.value );
						}
					});
					// maybe add the label
					if ( $(this).prev("label").length > 0 ) {
						curProperty["@rdform"]["label"] = _this.l( $(this).prev("label").text() );
					} else {
						curProperty["@rdform"]["label"] = $(this).attr("name");
					}
					// add datatype as type
					if ( $(this).attr("datatype") ) {
						curProperty["@type"] = $(this).attr("datatype");
						// add type property in context
						if ( ! _this.MODEL[0].hasOwnProperty("@context") ) {
							_this.MODEL[0]["@context"] = new Object();
						}
						if ( ! _this.MODEL[0]["@context"].hasOwnProperty($(this).attr("name")) ) {
							_this.MODEL[0]["@context"][$(this).attr("name")] = new Object();
						}
						_this.MODEL[0]["@context"][$(this).attr("name")]["@type"] = $(this).attr("datatype");
					}
					// add value as @value
					if ( $(this).attr("value") ) {
						curProperty["@value"] = $(this).attr("value");
					}	
					// add index
					if ( $(this).attr("multiple") ) {
						curProperty["@rdform"]["index"] = 1;
					}

					// do some property-type specific things
					switch ( curProperty['@rdform']['type'] ) {
						case "resource":
							if ( $(this).attr("value") ) {
								curProperty["@type"] = $(this).attr("value");
								delete curProperty["@value"];
							}
							
							// test if the resource class exists (if not external)
							if ( $(this).attr("external") === undefined ) {

								if ( $(template).find('div[typeof="'+$(this).val()+'"],div[id="'+$(this).val()+'"]').length < 1 ) {
									_this.showAlert( "warning", "Couldnt find the class \"" + $(this).val() + "\" in the form model... ;( \n\n I will ignore the resource \"" + $(this).attr("name") + "\" in \"" + curClass['@id'] + "\"." );
									return;
								}

							} else {
								curProperty["@id"] = $(this).attr("name");
								delete curProperty["@type"];	
							}

							var arguments = new Object();
							if ( $(this).attr("arguments") ) {
								arguments = $.parseJSON( $(this).attr("arguments") );
							}
							// add arguments-index for multiple resources
							if ( $(this).attr("multiple") ) {
								arguments['i'] = 1;
							}
							if ( $(this).attr("arguments") || $(this).attr("multiple") ) {
								//curProperty["@rdform"]["arguments"] = JSON.stringify(arguments);
								curProperty["@rdform"]["arguments"] = arguments;
							}
							
							break;

						case "literal":
							break;

						case "hidden":
							break;

						default:
							_this.showAlert( "warning", "Unknown type \"" + $(this).attr("type") + "\" at property \"" + $(this).attr("name") + "\" in \"" + curClass['@type'] + "\" on parsing model found. I will ignore this property..." );
							return;
							break;
					}

					var propName = $(this).attr("name");
					_this.validatePrefix( propName );
					
					if ( properties[ propName ] ) {
						properties[ propName ].push(curProperty);
					} else {
						properties[ propName ] = [ curProperty ];
					}
					//curClass['@rdform']['properties'].push(propName); // maybe add this array for the right property index range
				}); // end of walking properties

				if ( properties.length == 0 ) {
					_this.showAlert( "warning", "No properties stored in class \"" + curClass['@type'] + "\" on parsing model found..." );
				}
				
				// add properties to the current class
				$.extend( true, curClass, properties );

				// find inputs which referencing this class by type or id
				var thisClassReference = _this.getElement( $(template).find('input'), "value", curClass['@type'] );
				if ( thisClassReference.length == 0 && curClass["@rdform"]['id-html'] ) {
					thisClassReference = _this.getElement( $(template).find('input'), "value", curClass["@rdform"]['id-html'] );
				}
				// add current class as child resource if it was referenced
				if ( thisClassReference.length > 0 ) {
					addToModel( _this.MODEL, curClass );
				// add current class ass root-class, extend with baseuri and prefixes
				} else {
					$.extend( true, _this.MODEL[curClassIndex], curClass );
				}				
				curClassIndex++;
			}); // end of walking class

			// add a class as child-class into a referencing class
			function addToModel( model, curClass ) {
				$.each( model, function( rootClsIx, rootCls ) {
					$.each( rootCls, function( clsIx, thisCls ) {
						if ( typeof thisCls === "object" ) {
							$.each( thisCls, function( propIx, thisProp ) {
								// add currentClass if type==type or type==id, prop[id] must undefined for classes of same types
								if ( thisProp.hasOwnProperty("@type") 
									 && thisProp["@id"] == undefined
									 && ( thisProp["@type"] == curClass['@type']
									   || thisProp["@type"] == curClass["@rdform"]['id-html'] 
										)
									) {
										$.extend( true, thisProp, curClass );
								}
							});
						}
						// add recursive for deeper references
						if ( Array.isArray(thisCls) ) {
							addToModel( thisCls, curClass );
						}
					});
				});
			}

		},

		/**
		  * Create the HTML form and append all root classes in MODEL
		  *
		  * @return HTML DOM of the form
		  */
		createHTMLForm: function() {
			var _this = this
			var elem = $('<form></form>');
			for ( var mi in this.MODEL ) {
				$(elem).append( _this.createHTMLClass( _this.MODEL[mi] ) );
			}
			return $(elem).children();
		},

		/**
		  * Create a class for the HTML form
		  *
		  * @classModel Model-Object of the current class
		  * @return HTML DOM object of the class
		  */		
		createHTMLClass: function( classModel ) {
			var _this = this;
			var thisClass = $("<div></div>");
			thisClass.attr( {
				'id' 		: _this._ID_ + '-class-' + _this.getWebsafeString(classModel['@type']), // TODO: sub-ID ... (e.g. Person/Forename)
				'class' 	: _this._ID_  + '-class-group '+_this._ID_+'-property',
				'typeof'	: classModel['@type'],
				'resource'	: classModel['@id']
			});
			thisClass.attr( classModel['@rdform'] ); // add all rdform-attributes
			thisClass.data( _this._ID_ + "-model", classModel);

			// maybe rewrite arguments index
			if ( classModel['@rdform']['arguments'] !== undefined ) {
				/*var arguments = $.parseJSON( $(thisClass).attr('arguments') );
				arguments['i'] = classModel["@rdform"]['index'];
				$(thisClass).attr("arguments", JSON.stringify( arguments ) );
				*/
				$(thisClass).attr("arguments", JSON.stringify( classModel['@rdform']['arguments'] ) );
				//thisClass.data( _this._ID_ + "-model[@rdform][arguments]", arguments);
			}
			
			var thisLegend = $( "<legend></legend>" );
			if ( classModel["@rdform"]['legend'] !== undefined ) {
				thisLegend.html( '<span class="rdform-legend-text">' + classModel["@rdform"]['legend'] + "</span>" );
			}
			
			/*
			// TODO: maybe add baseprefix, name, return-resource...
			if ( classModel['name'] ) 
				thisLegend.prepend( "<small>"+ classModel['name'] +"</small> " );
			
			if ( classModel['isRootClass'] ) {
				thisLegend.prepend( "<small class=''+_this._ID_+'-class-baseprefix'>"+ CONTEXT[@base] +"</small> " );
			}

			if ( classModel['return-resource'] ) {
				thisLegend.append( "<small>"+ classModel['return-resource'] +"</small> " );
			} 
			*/
			thisLegend.append(	'<div class="'+_this._ID_+'-edit-class-resource">' +
									'<small>'+ classModel['@id'] +'</small>' +
									'<span class="glyphicon glyphicon-pencil"></span>' +
									'<input type="text" name="'+_this._ID_+'-classUri" value="'+ classModel['@id'] +'" class="form-control input-sm" />' +
								'</div>' );	

			thisLegend.append( '<small>a '+ classModel['@type'] +'</small>' );

			if ( classModel["@rdform"]['typeof-select'] !== undefined ) {
				var typeofSelect = $(' <select class="'+_this._ID_+'-class-typeof-select form-control input-sm"></select>');
				var selectOptions = $.parseJSON( classModel['@rdform']['typeof-select'] );
				typeofSelect.append( '<option value="" disabled selected>'+_this.l("choose type")+'...</option>' );
				for ( var soi in selectOptions ) {
					typeofSelect.append( '<option value="'+ soi +'">'+ _this.l( selectOptions[soi] ) +'</option>' );
				}
				thisLegend.append( typeofSelect );
			}

			thisClass.append( thisLegend );

			if ( classModel['@rdform']['help'] !== undefined ) {
				thisClass.append(	'<div class="form-group '+_this._ID_+'-class-help hidden">' +
										'<span class="help-block col-xs-12">'+classModel['@rdform']['help']+'</span>' +
									'</div>' );
				thisLegend.prepend( '<span class="glyphicon glyphicon-question-sign btn '+_this._ID_+'-show-class-help"></span>' );
			}

			// add the properties
			$.each( classModel, function(key, propertyArr) {
				if ( key[0] != "@" ) {
					$.each( propertyArr, function(i, property) {
						thisClass.append( _this.createHTMLProperty( property ) );
					});
				}
			});
			
			if ( classModel['@rdform']['additional'] !== undefined ) {
				thisClass.append('<button type="button" class="btn btn-link btn-xs '+_this._ID_+'-remove-property" title="'+ _this.l("Remove class %s", classModel['@rdform']['legend']) +'"><span class="glyphicon glyphicon-remove"></span> '+ _this.l("remove") +'</button>');
			}

			// add duplicate and remove button for multiple classes
			if ( classModel['@rdform']['multiple'] !== undefined ) {
				if ( classModel['@rdform']['additional'] === undefined ) {
					thisClass.append('<button type="button" class="btn btn-link btn-xs '+_this._ID_+'-remove-property" title="'+ _this.l("Remove class %s", classModel['@rdform']['legend']) +'"><span class="glyphicon glyphicon-remove"></span> '+ _this.l("remove") +'</button>');
				}
				thisClass.append('<button type="button" class="btn btn-default btn-xs '+_this._ID_+'-duplicate-property" title="'+ _this.l("Duplicate class %s", classModel['@rdform']['legend']) +'"><span class="glyphicon glyphicon-plus"></span> '+ _this.l("add") +'</button>');
			}			
			return thisClass;
		},

		/**
		  * Create HTML propertie, decides if its a hidden, literal, resource, ...
		  *
		  * @property The object of the current proprtie
		  * @return HTML DOM object of the propertie
		  */
		createHTMLProperty: function( property ) {
			var _this = this;
			var thisProperty;

			switch ( property['@rdform']['type'] ) {
				case "hidden":
					var val = ( property['@rdform']['value'] !== undefined ) ? property['@rdform']['value'] : "";
					var name = property['@rdform']['name']
					name = name.substring( name.search(/ /) );
					thisProperty = $( '<div class="'+this._ID_+'-hidden-group hidden-group-'+ _this.getWebsafeString(name) +'"><input type="hidden" name="'+ name +'" id="" value="'+ val +'" /></div>' );
					break;
				case "literal":
					thisProperty = this.createHTMLiteral( property );					
					break;
				case "resource":
					thisProperty = this.createHTMLResource( property );
					break;			
				default:
					this.showAlert( "error", "Unknown property type \""+property['@rdform']['type']+"\" detected on creating HTML property.");
					break;
			}
			
			return thisProperty;
		},

		/**
		  * Create literal propertie group  
		  *
		  * @literal Object of the current literal propertie
		  * @return  HTML DOM object of the literal group
		  */
		createHTMLiteral: function( literal )  {
			var _this = this;
			var literalName = literal['@rdform']['name']
			literalName = literalName.substring( literalName.search(/ /) );
			var thisFormGroup = $('<div class="form-group '+_this._ID_+'-property-container '+_this._ID_+'-literal-group literal-group-'+_this.getWebsafeString(literalName)+'"></div>');
			var thisInputContainer = $('<div class="col-xs-9"></div>');

			// return create button
			if ( literal['@rdform']['additional'] !==  undefined && literal['@rdform']['additionalIntermit'] === undefined ) {
				var addBtn = $(	'<button type="button" class="btn btn-default btn-sm '+_this._ID_+'-add-property" name="'+ literal['@rdform']['name'] +'" title="' + _this.l('Add literal %s',  literal['@rdform']['label']) +'" label="'+literal['@rdform']['label']+'">' + 
									'<span class="glyphicon glyphicon-plus"></span> '+ literal['@rdform']['label'] +
								'</button>' );
				addBtn.data( _this._ID_ + "-model", literal);
				thisFormGroup.append ( addBtn );
				return thisFormGroup;
			}

			var thisLabel = $("<label class='col-xs-3 control-label'>"+literal['@rdform']['label']+"</label>");
			thisFormGroup.append( thisLabel );
			
			if ( literal['@rdform']['textarea'] !==  undefined ) {
				var thisInput = $("<textarea></textarea>");
			}
			else if ( literal['@rdform']['select'] !==  undefined ) {
				var thisInput = $("<select></select>");
				var selectOptions = $.parseJSON( literal['@rdform']['select-options'] );
				thisInput.append( '<option value="" disabled selected>'+_this.l("choose")+'...</option>' );
				for ( var soi in selectOptions ) {
					thisInput.append( '<option value="'+ soi +'">'+ _this.l( selectOptions[soi] ) +'</option>' );
				}
			}
			else if ( literal['@rdform']['boolean'] !==  undefined ) {
				var thisInput = $("<input type='checkbox' />");
			}
			else {
				var thisInput = $("<input type='text' />");
			}	

			thisInput.data( _this._ID_ + "-model", literal);
			// add attributes (except type)
			var attr = $.extend( true, {}, literal["@rdform"] );
			delete attr["type"];
			thisInput.attr( attr );
			thisInput.attr('class', 'form-control input-sm '+_this._ID_+'-property');

			if ( literal['@rdform']['datatype'] !== undefined ) {
				if (  literal['@rdform']['datatype'].search(/.*date/) != -1 || literal['@rdform']['name'].search(/.*date/) != -1 ) {
					thisInputContainer.removeClass( "col-xs-9" );
					thisInputContainer.addClass( "col-xs-3" );

					thisInput.addClass(_this._ID_ + "-datepicker");
					thisInput.attr("data-date-format", "yyyy-mm-dd");
				}
			}

			if ( literal['@rdform']['boolean'] !== undefined ) {
				thisInputContainer.addClass( "checkbox" );
				thisInput.removeClass( "form-control input-sm" );
				thisInput = $("<label></label>").append( thisInput );
				thisInput.append( literal['@rdform']['label'] );
				thisLabel.text( "" );
			}	

			thisInputContainer.append( thisInput );		

			if ( literal['@rdform']['datatype'] == "xsd:date" || literal['@rdform']['datatype'] == "http://www.w3.org/2001/XMLSchema#date" ) {
				var dateTypeSelect = $('<select name="" class="form-control input-sm '+_this._ID_+'-date-type-select">' +
							'<option value="xsd:date">'+_this.l("Year")+'-'+_this.l("Month")+'-'+_this.l("Day")+'</option>'+
							'<option value="xsd:gYearMonth">'+_this.l("Year")+'-'+_this.l("Month")+'</option>'+
							'<option value="xsd:gYear">'+_this.l("Year")+'</option>'+
						'</select>');
				thisInputContainer.after( $('<div class="col-xs-3"></div>').append(dateTypeSelect) );
			}

			if ( literal['@rdform']['additional'] !==  undefined ) {
				thisInputContainer.append('<button type="button" class="btn btn-link btn-xs '+_this._ID_+'-remove-property" title="'+ _this.l("Remove literal %s", literal['@rdform']['label'] ) +'"><span class="glyphicon glyphicon-remove"></span> '+ _this.l("remove") +'</button>');
			}

			if ( literal['@rdform']['multiple'] !== undefined ) {
				// add remove button
				if ( literal['@rdform']['additional'] ===  undefined ) {
					thisInputContainer.append('<button type="button" class="btn btn-link btn-xs '+_this._ID_+'-remove-property" title="'+ _this.l("Remove literal %s", literal['@rdform']['label'] ) +'"><span class="glyphicon glyphicon-remove"></span> '+ _this.l("remove") +'</button>');
				}
				// add duplicate btn
				thisInputContainer.append(	'<button type="button" class="btn btn-default btn-xs '+_this._ID_+'-duplicate-property" title="'+ _this.l("Duplicate literal %s", literal['@rdform']['label'] ) +'">'+
												'<span class="glyphicon glyphicon-plus"></span> '+ _this.l("add") +
											'</button>');
			}

			if ( literal['@rdform']['required'] !== undefined ) {	
				thisLabel.append( ' <abbr title="'+_this.l("Required field")+'">*</abbr>' );
			}
			if ( literal['@rdform']['hidden'] !== undefined ) {
				thisFormGroup.addClass("hidden");
			}

			if ( literal['@rdform']['help'] !== undefined ) {
				thisLabel.prepend( '<span class="glyphicon glyphicon-question-sign btn '+_this._ID_+'-show-literal-help"></span>' );
				thisInputContainer.append(	'<span class="help-block '+_this._ID_+'-literal-help hidden">' + literal['@rdform']['help'] + '</span>' );			
			}

			thisFormGroup.append( thisInputContainer );		

			return thisFormGroup;
		},

		/**
		  * Create a group for a new resource. It can be a new subclass, an add button for an new subclass or a single input field for an external resource
		  *
		  * @resource Object of the current resource from MODEL
		  * @return HTML DOM object of the resource group
		  */
		createHTMLResource: function( resource ) {		
			var _this = this;
			var curFormGroup = $('<div class="form-group '+_this._ID_+'-property-container '+_this._ID_+'-resource-group resource-group-'+_this.getWebsafeString(resource['@rdform']['name'])+'-'+_this.getWebsafeString(resource['@rdform']['value'])+'"></div>');

			if ( resource['@rdform']['external'] !== undefined ) {	// add simple input for external resources

				// return create button
				if ( resource['@rdform']['additional'] !==  undefined && resource['@rdform']['additionalIntermit'] === undefined ) {
					var addBtn = $(	'<button type="button" class="btn btn-default btn-sm '+_this._ID_+'-add-property" name="'+ resource['@rdform']['name'] +'" value="'+ resource['@rdform']['value'] +'" title="' + _this.l('Add resource %s',  resource['@rdform']['label']) +'" label="'+resource['@rdform']['label']+'">' + 
										'<span class="glyphicon glyphicon-plus"></span> '+ resource['@rdform']['label'] +
									'</button>' );
					addBtn.data( _this._ID_ + "-model", resource);
					if ( resource['@rdform']['typeof'] !==  undefined ) {
						$(addBtn).attr("typeof", resource['@rdform']['typeof']);
					}
					if ( resource['@rdform']['help'] !== undefined ) {
						addBtn.after( '<span class="glyphicon glyphicon-question-sign btn '+_this._ID_+'-show-literal-help"></span>' );
						addBtn.after(	'<span class="help-block '+_this._ID_+'-literal-help hidden">' + resource['@rdform']['help'] + '</span>' );
					}
					curFormGroup.append ( addBtn );
					return curFormGroup;
				}

				var resourceClass = $('<input type="url" class="form-control input-sm '+_this._ID_+'-property" />');
				resourceClass.data( _this._ID_ + "-model", resource);
				// add attributes (except type)
				var attr = $.extend( true, {}, resource["@rdform"] );
				delete attr["type"];
				attr["arguments"] = JSON.stringify(attr["arguments"]);
				resourceClass.attr( attr );
			}
			else { // add regular resource
				var resourceClass;
				
				// add button for additional or same resources (like person knows person)
				if ( resource['@rdform']['additional'] !== undefined && resource['@rdform']['additionalIntermit'] === undefined ) {	
					//curFormGroup.addClass("add-resoource-button-group");
					if ( resource['@rdform']['legend'] )
						var btnText = resource['@rdform']['legend'];
					else
						var btnText = resource['@rdform']['title'] ? resource['@rdform']['title'] : resource['@rdform']['name'] + " - " + resource['@rdform']['value'];

					var resourceClass = $(	'<button type="button" class="btn btn-default '+_this._ID_+'-add-property" name="'+ resource['@rdform']['name'] +'" value="'+ resource['@rdform']['value'] +'" title="' + _this.l("Add class %s", btnText)+'" label="'+btnText+'">' + 
												'<span class="glyphicon glyphicon-plus"></span> '+ btnText +
											'</button>' );
					resourceClass.data( _this._ID_ + "-model", resource);
				} 			
				else { // create class-model for the resource
					resourceClass = _this.createHTMLClass( resource );
				}
			}			

			curFormGroup.append( resourceClass );

			if ( resource['@rdform']['external'] !== undefined ) {

				var thisLabel = $('<label class="col-xs-3 control-label"></label>');
				thisLabel.text( resource['@rdform']['label'] );
				curFormGroup.prepend( thisLabel );
				
				var thisInputContainer = $('<div class="col-xs-9"></div>');
				resourceClass.wrap( thisInputContainer );

				if ( resource['@rdform']['help'] !== undefined ) {
					thisLabel.prepend( '<span class="glyphicon glyphicon-question-sign btn '+_this._ID_+'-show-literal-help"></span>' );
					resourceClass.after(	'<span class="help-block '+_this._ID_+'-literal-help hidden">' + resource['@rdform']['help'] + '</span>' );
				}

				if ( resource['@rdform']['subform'] !== undefined ) {
					curFormGroup.removeClass('resource-group-'+_this.getWebsafeString(resource['@rdform']['name'])+'-');
					curFormGroup.addClass('resource-group-'+_this.getWebsafeString(resource['@rdform']['name'])+'-'+resource['@rdform']['subform']);
					resourceClass.after('<button type="button" class="btn btn-default btn-xs '+_this._ID_+'-new-subform" title="'+ _this.l("New resource %s", resource['@rdform']['label']) +'"><span class="glyphicon glyphicon-plus-sign"></span> '+ _this.l("new") +'</button>');
				}

				if ( resource['@rdform']['multiple'] !== undefined ) {
					resourceClass.after('<button type="button" class="btn btn-default btn-xs '+_this._ID_+'-duplicate-property" title="'+ _this.l("Duplicate resource %s", resource['@rdform']['label']) +'"><span class="glyphicon glyphicon-plus"></span> '+ _this.l("add") +'</button>');					
				}

				if ( resource['@rdform']['subform'] !== undefined ) {
					resourceClass.after('<button type="button" class="btn btn-default btn-xs '+_this._ID_+'-edit-subform hide" title="'+ _this.l("Edit resource %s", resource['@rdform']['label']) +'"><span class="glyphicon glyphicon-pencil"></span> '+ _this.l("edit") +'</button>');
				}

				resourceClass.after('<button type="button" class="btn btn-link btn-xs '+_this._ID_+'-remove-property" title="'+ _this.l("Remove resource %s", resource['@rdform']['label']) +'"><span class="glyphicon glyphicon-remove"></span> '+ _this.l("remove") +'</button>');

				if ( resource['@rdform']['hidden'] !== undefined ) {
					curFormGroup.addClass("hidden");
				}				

			}

			/*if ( resource["@rdform"]["help"] !== undefined && resource['@rdform']['additionalIntermit'] === undefined ) {
				curFormGroup.append('<div class="'+_this._ID_+'-resource-help-container">' +
										'<span class="glyphicon glyphicon-question-sign btn '+_this._ID_+'-show-resource-help"></span>' +
										'<span class="help-block '+_this._ID_+'-resource-help hidden">' + resource['@rdform']['help'] + '</span>' +
									'</div>' );
			}*/
			return curFormGroup;
		},

		/**
		 * Public addExistingData call function to insert data from a JSON-LD object to the form
		 *
		 * @param array|object data Values to insert
		 */
		 addExistingData : function() {
		 	var _this = this;
		 	jsonld.expand(_this.data, function(err, expanded_data) {
				if ( err != null ) {
					_this.showAlert( "error", "Error on insert existing data: " + JSON.stringify(err, null, ' ') );
					return false;
				}

				_this.data = expanded_data;

				if ( _this.Hooks && typeof _this.Hooks.__beforeInsertData !== "undefined" )
						_this.Hooks.__beforeInsertData();

				$.each( _this.data, function( key, value ) {
					_this.addExistingDataFct( undefined, value );
				})

				if ( _this.Hooks && typeof _this.Hooks.__afterInsertData !== "undefined" )
						_this.Hooks.__afterInsertData();
				
			});
		 },

		/**
		 * Add existing data from a JSON-LD object to the form
		 *
		 * @param string|undefined name Name of the current field (for multiple literal)
		 * @param array|object data Values to insert
		 * @param object env DOM modell of current environment class
		 */
		addExistingDataFct : function( name, data, env ) {
			var _this = this;
			if ( typeof env === 'undefined' ) {
				var classTypeof = ( typeof data["@type"] === "string" ) ? data["@type"] : data["@type"][0];
				env = _this.getElement( _this.$elem.find('div'), 'typeof', classTypeof );

				if ( env.length == 0 ) {
					_this.showAlert( "info", 'Der Datensatz enthält die nicht im Modell vorhandene Klasse { "'+classTypeof+'" }' );
					return;
				}
			}		
			var prevKey = "";

			for ( var i in data ) {
				var curName = ( name === undefined ) ? i : name;

				if ( i == "@id" ) {
					var uriInput = $(env).find('input[name="'+_this._ID_+'-classUri"]').first();
					$(uriInput).val( _this.getUriPrefix(data[i]) );
					$(uriInput).trigger("keyup").trigger("blur");
					if ( data[i].search(/\{.*\}/) != -1 ) { // add new modvalue if uri contains wildcards
						$(uriInput).attr("modvalue", _this.getUriPrefix(data[i]));
					} else {
						$(uriInput).removeAttr("modvalue"); // remove wildcard updating
					}
				}

				if ( i[0] != "@" ) { // we dont want insert @id, @type, ...

					if ( typeof data[i] === "string" ) { // its a literal

						var literal = _this.getElement( $(env).children("div."+_this._ID_+"-literal-group").find("input,select,textarea"), 'name', curName ).last();

						if ( $(literal).length == 0 ) { // doesnt found -> try to find an additional button
							var addBtn = _this.getElement( $(env).children("div."+_this._ID_+"-literal-group").find('button.'+_this._ID_+'-add-property'), 'name', curName );
							if ( $(addBtn).length == 0 ) {
								_this.showAlert( "info", 'Der Datensatz enthält das nicht im Modell vorhandene Literal { "'+curName+'": "' + data[i] + '" }', false );
								continue;
							}
							$(addBtn).trigger("click");
							literal = _this.getElement( $(env).children("div."+_this._ID_+"-literal-group").find("input,textarea"), 'name', curName ).last();
						}

						if ( prevKey == curName ) { // same key -> try to duplicate
							$(literal).nextAll('button.'+_this._ID_+'-duplicate-property').trigger("click");
							literal = _this.getElement( $(env).children("div."+_this._ID_+"-literal-group").find("input,textarea"), 'name', curName ).last();
						}

						$(literal).val( data[i] );
						$(literal).trigger("keyup").trigger('change');
						$(literal).parentsUntil("."+_this._ID_+"-literal-group").parent().removeAttr("style"); // bugfix: some classes have hidden inline style

						if ( $(literal).attr("type") == "checkbox" ) { // checkbox -> check or uncheck
							if ( data[i] == "0" || data[i] == "false" ) {
								$(literal).removeAttr("checked");
							} else {
								$(literal).attr( "checked", "checked" );
							}
						}

					} else { // its an array: multiple literals or resource ( $.isArray(data[i]) )

						// push single/multiple resources or multiple resources as array of objects
						var thisData = new Array();
						if ( $.isArray(data[i]) ) {
							thisData = data[i];
						} else {
							thisData.push( data[i] );
						}

						if ( typeof thisData[0] === "string" ) { // its multiple literal
							_this.addExistingDataFct( i, thisData, env );
						}
						else if ( ! thisData[0].hasOwnProperty("@id") ) { // its a literal in an object	
							var liArr = new Array();
							for ( var li in thisData ) {
								liArr.push( thisData[li]["@value"] );
							}
							_this.addExistingDataFct( i, liArr, env );
						}				
						else { // its one or multiple resources

							for ( var di in thisData ) {

								// create dummy __insertHook if not exists
								if ( ! _this.Hooks && typeof _this.Hooks.__insertResource === "undefined" ) {
									_this.Hooks.__insertResource = function(i, di, resource, callback){ callback(i, di, resource) };
								}

								// call __insertHook and wait for callback (helpful to get asynchron data in hooks)
								_this.Hooks.__insertResource(i, di, thisData[di], function(i, di, data) {
									thisData[di] = data;

									if ( ! thisData[di].hasOwnProperty("@type") ) { // it seemms to be an external resource
										var resource = _this.getElement( $(env).children("div."+_this._ID_+"-resource-group").find("input"), 'name', i ).last();
										if ( $(resource).length == 0 ) {
											var addBtn = _this.getElement( $(env).find('button.'+_this._ID_+'-add-property'), 'name', i );
											if ( $(addBtn).length != 0 ) {
												$(addBtn).trigger("click");
												resource = _this.getElement( $(env).children("div."+_this._ID_+"-resource-group").find("input"), 'name', i ).last();
											}
										}
										if ( $(resource).length != 0 ) {
											if ( di > 0 ) {
												$(resource).parent().find( 'button.'+_this._ID_+'-duplicate-property' ).trigger("click");
												resource = _this.getElement( $(env).children("div."+_this._ID_+"-resource-group").find("input"), 'name', i ).last();
												$(resource).parentsUntil("."+_this._ID_+"-resource-group").parent().removeAttr("style"); // bugfix: some classes have hidden inline style
											}
											$(resource).val( thisData[di]["@id"] );
										} else {
											_this.showAlert( "info", 'Der Datensatz enthält die nicht im Modell vorhandene externe Resource { "'+i+'": "' + JSON.stringify(thisData[di]) + '" }', false );
										}
										return true;
									}

									var thisType = ( typeof thisData[di]["@type"] === "string" ) ? thisData[di]["@type"] : thisData[di]["@type"][0];
									var subEnv = _this.getElement( $(env).find("div"), 'typeof', thisType ).last();
									var hasIDHTML = false;

									if ( $(subEnv).attr("id-html") != undefined ) { // subEnv has id-html -> may find the right id-html resource
										if ( thisData[di].hasOwnProperty( "http://www.w3.org/2000/01/rdf-schema#type" ) ) {
											thisType = thisData[di]["http://www.w3.org/2000/01/rdf-schema#type"][0]["@value"];
										}
										subEnv = _this.getElement( $(env).find("div"), 'id-html', thisType ).last();
										hasIDHTML = true;
									}

									if ( $(subEnv).length == 0 ) { // resource not found -> try to find external resource with typeof
										var resource = _this.getElement( _this.getElement( $(env).find("input"), 'name', i ), 'typeof', thisType ).last();										
										if ( $(resource).length == 0 ) {
											var addBtn = _this.getElement( _this.getElement( $(env).find("button"), 'name', i ), 'typeof', thisType );
											if ( $(addBtn).length != 0 ) {
												$(addBtn).trigger("click");
												resource = _this.getElement( _this.getElement( $(env).find("input"), 'name', i ), 'typeof', thisType ).last();
											}
										}
										if ( $(resource).length != 0 ) {
											if ( $(resource).val() != "" ) {
												$(resource).parent().find( 'button.'+_this._ID_+'-duplicate-property' ).trigger("click");
											}
											resource = _this.getElement( _this.getElement( $(env).find("input"), 'name', i ), 'typeof', thisType ).last();
											var resourceLabel = thisData[di]["@id"].split("/").reverse()[0];
											if ( thisData[di].hasOwnProperty('http://www.w3.org/2000/01/rdf-schema#label') ) {
												resourceLabel = thisData[di]['http://www.w3.org/2000/01/rdf-schema#label'][0]['@value'];
											}

											$(resource).val( thisData[di]["@id"] ).hide().trigger("blur");
											$(resource).after('<p class="'+_this._ID_+'-resource-uri-container"><a href="'+thisData[di]["@id"]+'" class="'+_this._ID_+'-resource-uri">'+resourceLabel+'</a></p>');
										} else {
											_this.showAlert( "info", 'Der Datensatz enthält die nicht im Modell vorhandene externe Resource { "'+i+'": "' + JSON.stringify(thisData[di]) + '" }', false );
										}
										return true;
									}

									if ( $(subEnv).length == 0 ) { // resourc not found -> try to find the add button
										var addBtn = _this.getElement( $(env).children("div."+_this._ID_+"-resource-group").find( 'button.'+_this._ID_+'-add-property'), 'value', thisType );
										if ( $(addBtn).length == 0 ) {
											// add btn not found, may data has rdfs:type
											if ( thisData[di].hasOwnProperty( "http://www.w3.org/2000/01/rdf-schema#type" ) ) {
												thisType = thisData[di]["http://www.w3.org/2000/01/rdf-schema#type"][0]["@value"];
												addBtn = _this.getElement( $(env).children("div."+_this._ID_+"-resource-group").find( 'button.'+_this._ID_+'-add-property'), 'value', thisType );
												hasIDHTML = true;
											}
										}
										if ( $(addBtn).length == 0 ) { // data not found
											_this.showAlert( "info", 'Der Datensatz enthält die nicht im Modell vorhandene Resource { "'+thisType+'": "' + JSON.stringify(thisData[di]) + '" }', false );
											return false;
										}
										$(addBtn).trigger("click");

										subEnv = _this.getElement( $(env).find("div"), 'typeof', thisType ).last();
										if ( hasIDHTML ) {
											subEnv = _this.getElement( $(env).find("div"), 'id-html', thisType ).last();
										}
									}

									if ( i != $(subEnv).attr("name") && i != _this.replaceStrPrefix($(subEnv).attr("name")) ) {
										_this.showAlert( "info", 'Der Datensatz enthält die Propertie "'+i+'", die im Modell zu "'+$(subEnv).attr("name")+'" verändert ist.', false );
									}

									// on multiple resource (walk thisData backwards) -> duplicate the subEnv
									if ( di > 0 ) {
										for (var ri = di-1; ri >= 0; ri--) {
											var thisRType = ( typeof thisData[ri]["@type"] === "string" ) ? thisData[ri]["@type"] : thisData[ri]["@type"][0];
											if ( hasIDHTML && thisData[ri].hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#type") ) {
												thisRType = thisData[ri]["http://www.w3.org/2000/01/rdf-schema#type"][0]["@value"];
											}
											if( thisType == thisRType ) {
												$(subEnv).find( 'button.'+_this._ID_+'-duplicate-property' ).trigger("click");
												subEnv = _this.getElement( $(env).find("div"), 'typeof', thisType ).last();
												if ( hasIDHTML ) {
													subEnv = _this.getElement( $(env).find("div"), 'id-html', thisType ).last();
												}
												$(subEnv).removeAttr("style"); // bugfix: some classes have hidden inline style
												break;
											}
										}
									}

									_this.addExistingDataFct( undefined, thisData[di], subEnv );

								}); // end of __insertResource Hook

							}
						}		
					}
				}
				prevKey = curName;
			}
		}, // end of addExistingData
	
		/*******************************************************
		 *	Init form button handlers after building the form
		 * 
		 *******************************************************/
		initFormHandler : function( env ) {
			var _this = this;

			if ( _this.Hooks && typeof _this.Hooks.__initFormHandlers !== "undefined" )
				_this.Hooks.__initFormHandlers( env );

			if ( $.datepicker ) {
				//_this.$elem.on("focus", "."+_this._ID_+"-datepicker", function() {
				$("."+_this._ID_+"-datepicker", $(env)).on("focus", function() {
					$(this).datepicker({
						weekStart: 1
					});
				});
			}
			
			// validate input values on change
			$("input", $(env)).on("change", function() {
				_this.userInputValidation( $(this) );
			});

			// BUTTON: show help class text
			$("."+_this._ID_+"-show-class-help", $(env)).on("click", function() {
				var classHelp =  $(this).parentsUntil("div[typeof]").parent().find("div."+_this._ID_+"-class-help").first();
				$(classHelp).toggleClass("hidden");
			});

			// BUTTON: show literal help text
			$("."+_this._ID_+"-show-literal-help", $(env)).on("click", function() {
				var classHelp =  $(this).parentsUntil("div[typeof]").find("span."+_this._ID_+"-literal-help");
				$(classHelp).toggleClass("hidden");
			});

			// BUTTON: show resource help text
			$("."+_this._ID_+"-show-resource-help", $(env)).on("click", function() {
				var classHelp =  $(this).parent().find("span."+_this._ID_+"-resource-help");
				$(classHelp).toggleClass("hidden");
				return false;
			});

			// SELECT: date type
			$("."+_this._ID_+"-date-type-select", $(env)).on("click", function() {
				var dateFormat = "";
				var defaultDate = "1970-01-01";
				var dateProperty = $(this).parentsUntil("div.form-group").parent().find('input.'+_this._ID_+'-property');
				var newDate = dateProperty.val();
				
				if ( $(this).val() == "xsd:gYear" ) {
					dateFormat = "JJJJ";
				} else if ( $(this).val() == "xsd:gYearMonth" ) {
					dateFormat = "JJJJ-MM";
				} else {
					dateFormat = "JJJJ-MM-TT";
				}

				dateProperty.attr("placeholder", dateFormat);
				newDate = dateProperty.val().slice(0, dateFormat.length);
				if ( newDate.length > 0 ) {
					newDate = newDate + defaultDate.slice(newDate.length, dateFormat.length);
					dateProperty.val(newDate);
				}
				_this.userInputValidation( dateProperty );
			});

			// BUTTON: edit subform
			$("button."+_this._ID_+"-edit-subform", $(env)).on("click", function() {
				var resContainer = $(this).parentsUntil("div.form-group").parent();

				if ( _this.Hooks && typeof _this.Hooks.__editSubform !== "undefined" )
					_this.Hooks.__editSubform( resContainer );

				// todo: native edit subform
			});

			// BUTTON: new subform
			$("button."+_this._ID_+"-new-subform", $(env)).on("click", function() {

				if ( $(this).parent().find("input."+_this._ID_+"-property").val().search(/^http/) == -1 ) {
					var resContainer = $(this).parentsUntil("div.form-group").parent(); // add in same container
				} else {
					$(this).parent().find("button."+_this._ID_+"-duplicate-property").trigger("click");
					var resContainer = $(this).parentsUntil("div.form-group").parent().next(); // add in new container
				}

				if ( _this.Hooks && typeof _this.Hooks.__newSubform !== "undefined" )
					_this.Hooks.__newSubform( resContainer );

				// todo: native new subform
			});

			// BUTTON: add property
			$("button."+_this._ID_+"-add-property", $(env)).on("click", function() {
				var btnContainer = $(this).parent("div.form-group");						
				var propertyModel = $.extend( true, {}, $(this).data( _this._ID_ + "-model" ) );
				
				propertyModel["@rdform"]['additionalIntermit'] = true;
				var propertyHTML = _this.createHTMLProperty( propertyModel );

				$(propertyHTML).hide();
				$(btnContainer).after( propertyHTML );
				$(propertyHTML).show("slow");
				$(btnContainer).remove();
				//$(propertyHTML).find("div.rdform-resource-help-container").remove();

				if ( _this.Hooks && typeof _this.Hooks.__afterAddProperty !== "undefined" )
					_this.Hooks.__afterAddProperty( propertyHTML );
				
				_this.initFormHandler( propertyHTML );

				return false;
			});

			// BUTTON: duplicate property			
			$("button."+_this._ID_+"-duplicate-property", $(env)).on("click", function() {
				var btnContainer = $(this).parentsUntil("div.form-group").parent();
				var propertyModel = $.extend( true, {}, $(btnContainer).find("."+_this._ID_+"-property").first().data( _this._ID_ + "-model" ) );
				var index = propertyModel["@rdform"]['index'];
				++index;

				propertyModel["@rdform"]['index'] = index;
				if ( propertyModel["@rdform"]["arguments"] !== undefined ) {
					propertyModel["@rdform"]["arguments"]["i"] = index;
				}

				var propertyHTML = _this.createHTMLProperty( propertyModel );
				
				// hide legend text, help and label
				$(propertyHTML).find(".help-block, ."+_this._ID_+"-show-class-help, ."+_this._ID_+"-legend-text").hide();
				$(propertyHTML).find( ".control-label" ).css( "textIndent", "-999px" ).css( "textAlign", "left" );				
				$(btnContainer).find("."+_this._ID_+"-new-subform").hide();

				$(propertyHTML).hide();
				$(btnContainer).after( propertyHTML );
				$(propertyHTML).show("slow");
				$(this).hide();

				if ( _this.Hooks && typeof _this.Hooks.__afterDuplicateProperty !== "undefined" )
					_this.Hooks.__afterDuplicateProperty( propertyHTML );
				
				_this.initFormHandler( propertyHTML );
			} );		

			//BUTTON: remove property
			$("button."+_this._ID_+"-remove-property", $(env)).on("click", function() {
				var btnContainer = $(this).parentsUntil("div.form-group").parent();
				var propertyModel = $.extend( true, {}, $(btnContainer).find("."+_this._ID_+"-property").first().data( _this._ID_ + "-model" ) );

				var prevProperty = btnContainer.prev('div[class="'+btnContainer.attr("class")+'"]');
				var nextProperty = btnContainer.next('div[class="'+btnContainer.attr("class")+'"]');
				
				if ( _this.Hooks && typeof _this.Hooks.__beforeRemoveProperty !== "undefined" )
					_this.Hooks.__beforeRemoveProperty( btnContainer );
				
				// the only property (no prevs or next) - recreate this property
				if ( prevProperty.length == 0 && nextProperty.length == 0 ) {
					propertyModel["@rdform"]['additionalIntermit'] = undefined;
					var propertyHTML = _this.createHTMLProperty( propertyModel );

					$(propertyHTML).hide().removeAttr("style");
					$(btnContainer).after( propertyHTML );
					$(propertyHTML).show("slow");

					//findWildcardInputs( propertyHTML );
					_this.initFormHandler( propertyHTML );
				}
				// the last property
				else if ( prevProperty.length > 0 && nextProperty.length == 0 ) {
					// show duplicate btn in the prev
					prevProperty.find("button."+_this._ID_+"-duplicate-property").show();
					prevProperty.find("button."+_this._ID_+"-new-subform").show();
				}
				// the first property
				else if ( prevProperty.length == 0 && nextProperty.length > 0 ) {
					// show label/legend in the next
					$(nextProperty).find("legend,.help-block").show();
					$(nextProperty).find( "label" ).css( "textIndent", "0px" ).css( "textAlign", "right" );
				}
				// middle property, nothing todo
				else {
				}

				// first or middle property
				if ( nextProperty.length > 0 ) {
					// decrease all next indexes in arguments and reload wildcard-inputs
					btnContainer.nextAll('div[class="'+btnContainer.attr("class")+'"]').each(function() {
						//var curNextModel = $(this).data( _this._ID_ + "-model" );

						var curNextProperty = $(this).find("."+_this._ID_+"-property").first();
						var curNextPropertyModel = $(curNextProperty).data( _this._ID_ + "-model" );
						var index = $(curNextProperty).attr('index');
						--index;

						if ( curNextPropertyModel['@rdform']['arguments'] ) {
							curNextPropertyModel['@rdform']['arguments']['i'] = index;
							$(curNextProperty).attr("arguments", JSON.stringify( curNextPropertyModel['@rdform']['arguments'] ) );
						}
						curNextPropertyModel['@rdform']['index'] = index;
						$(curNextProperty).attr('index', index);

						findWildcardInputs( curNextProperty );;
					});					
				}

				//remove property container
				$(btnContainer).hide( "slow", function() {					
					$(btnContainer).remove();
				});				

			});

			// find inputs with wildcard
			function findWildcardInputs( env ) {			

				// reset inputs values with existing modvalue
				$(env).find('input[modvalue]').each(function() {
					$(this).val( $(this).attr("modvalue" ) );
				});

				// text inputs with wildcard values -> bind handlers to dynamically change the value
				$(env).find('input[value*="{"]').each(function() {
					var wildcards = new Object();
					var wildcardFcts = new Object();
					var thisInput = $(this);
					var envClass = $(this).parentsUntil("div[typeof]").parent();
					$(this).attr("modvalue",  $(this).val() );

					var strWcds = $(this).val().match(/\{[^\}]*/gi);
					for ( var i in strWcds ) {
						var wcd = strWcds[i].substring( 1 );	

						// may get and remove wildcard-function
						if ( wcd.search(/\(/) != -1 ) {
							var wcdFcts = wcd.match(/\([^\)]*/gi);
							wcd = wcd.replace( /\(.*\)/g, '' );
							for ( var i in wcdFcts ) {
								var wcdFct = wcdFcts[i].substring( 1 );	
								wildcardFcts[wcd] = wcdFct;
								var regex = new RegExp( '\\(' + wcdFct + '\\)', "g");
								$(this).attr("modvalue", $(this).attr("modvalue").replace( regex, '' ) );
							}
						}

						wildcards[wcd] = getWildcardTarget( wcd, envClass );	

						if ( wildcards[wcd].length > 0 ) {
							// TODO: if wildcard not found no keyup event exists!
							$(wildcards[wcd]).keyup(function() {
								writeWildcardValue( thisInput, wildcards, wildcardFcts );
							});

							if ( wildcards[wcd].val().search(/\{.*\}/) == -1 ) { // trigger keyup for wildcards without wildcards
								$(wildcards[wcd]).trigger( "keyup" );
							}
						}
					}
				});

			}
			//findWildcardInputs( _this.$elem );
			findWildcardInputs( $(env) );
			
			// find the target input of a wildcard wcd in the class envClass
			function getWildcardTarget( wcd, envClass ) {

				var wcdTarget = envClass.find('input[name="'+wcd+'"],textarea[name="'+wcd+'"]');

				//if ( wcdTarget.length == 0 && envClass.attr( "arguments" ) ) { // if no input exist, may get wilcard vars from resource arguments 
				//	var args = $.parseJSON( envClass.attr( "arguments" ) );				
				if ( wcdTarget.length == 0 && envClass.data( _this._ID_ + "-model" )["@rdform"]["arguments"] !== undefined ) { // if no input exist, may get wilcard vars from resource arguments 
					var args = envClass.data( _this._ID_ + "-model" )["@rdform"]["arguments"];
					for ( var ai in args ) {
						args[ai] = args[ai].toString();
						if ( wcd == ai ) {
							if ( args[ai].search(/\{.*\}/) != -1 ) {
								wcdTarget = getWildcardTarget( args[ai].replace(/[{}]/g, ''), envClass.parentsUntil("div[typeof]").parent() );
							} else {
								wcdTarget = $( '<input type="hidden" name="' + ai + '" value="' + args[ai] + '" />' );
							}
							break;
						}
					}				
				}

				// test if property exists
				if ( wcdTarget.length == 0 ) {
					_this.showAlert("error", 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
				}

				return wcdTarget;
			}

			// write a wildcard value to the input
			function writeWildcardValue( src, wildcards, wildcardFcts ) {
				var val = $(src).attr("modvalue");
				if ( val == undefined ) return false;

				for ( wcd in wildcards ) {
					var wldVal = wildcards[wcd].val();

					if ( wildcards[wcd].val() != "" ) {
						var regex = new RegExp( '\{' + wcd + '\}', "g");

						// may apply wildcard-function
						if ( wildcardFcts.hasOwnProperty(wcd) ) {
							if ( wildcardFcts[wcd] == "BASE" ) {
								wldVal = wldVal.split("/").reverse()[0];
							}
							if ( wildcardFcts[wcd] == "HASH" ) {
								wldVal = _this.getHash(wldVal);
							}
						}

						if ( $(src).attr("name") == _this._ID_+"-classUri" ) { // make wcdVal as resouce uri
							wldVal = wldVal.replace(/\{.*\}/, ''); // replace existing wildcard-pointer in wcdVal
							wldVal = _this.getWebsafeString(wldVal); // make webSafe string
						}

						if ( _this.Hooks && typeof _this.Hooks.__writeWildcardValue !== "undefined" )
							wldVal = _this.Hooks.__writeWildcardValue( $(src), wldVal );

						wldVal = wldVal.replace(/\{\S*\}/g, ''); // remove wildcards in wildcard-value

						val = val.replace( regex, wldVal );
					}
				}
				val = val.trim();

				if ( val == "" ) { // if wildcard value would empty, set to modvalue
					val = $(src).attr("modvalue");
				}

				$(src).val( val );
				$(src).trigger( "keyup" );
			}

			// edit a class resouce
			$("div."+_this._ID_+"-edit-class-resource span", $(env)).on("click", function() {
				$(this).next("input").show().focus();

				$(this).prev("small").hide();
				$(this).hide();
			});
			
			// live auto-update class-resource text
			$("div."+_this._ID_+"-edit-class-resource input", $(env)).on("keyup", function() {
				var val = $(this).val();

				if ( val != "" ) {
					$(this).parentsUntil("div[typeof]").parent().attr( "resource", val );
					$(this).prev().prev("small").text( val );
				}
			});

			// leave a class-resource edit input
			$("div."+_this._ID_+"-edit-class-resource input", $(env)).on("change blur", function() {
				$(this).prev().prev("small").show();
				$(this).prev("span").show();
				$(this).trigger( "keyup" );
				$(this).hide();
			});

			// select a class typeof selection
			$("select."+_this._ID_+"-class-typeof-select", $(env)).on("change", function() {
				$(this).parentsUntil("div[typeof]").parent().attr( "typeof", $(this).val() );
				$(this).prev("small").text("a " + $(this).val());
			});

			// leave external input
			$("input[external]", $(env)).on("blur", function() {
				if ( $(this).val() != "" && _this.userInputValidation( $(this) ) ) {
					$(this).parent().find("."+_this._ID_+"-edit-subform").removeClass("hide");
					$(this).parent().find("."+_this._ID_+"-remove-property").removeClass("hide");
					if ( $(this).attr("multiple") === undefined ) {
						$(this).parent().find("."+_this._ID_+"-new-subform").hide();
					}

					if ( _this.Hooks && typeof _this.Hooks.__afterBlurExternalResource !== "undefined" )
						_this.Hooks.__afterBlurExternalResource( $(this) );
				}
			});

			// create custom autoconmplete item with resource uri as href
			$.widget("custom.autocompleteLinkItem", $.ui.autocomplete, {
				_renderItem: function( ul, item ) {
					return $( "<li>" )
					.attr( "data-value", item.value )
					.append( '<a onclick="return false" href="' + item.value + '">' + item.label + "</a>" )
					.appendTo( ul );
					}
			});

			//autocomplete input
			$("input[autocomplete]", $(env)).on("focus", function() {
				// TODO: check if attrs query-endpoint etc exists
				var queryEndpoint = $(this).attr( "query-endpoint" );
				var queryStr = $(this).attr("query");
				var apitype = $(this).attr("query-apitype");
				var queryValues = $(this).attr("query-values");
				var queryDataType = $(this).attr("query-datatype");

				switch (apitype) {
					case "sparql" :
						$(this).autocompleteLinkItem().autocompleteLinkItem({
							source: function( request, response ) {		
								var query = queryStr.replace(/%s/g, "'" + request.term + "'");
								$.ajax({
									url: queryEndpoint,
									dataType: queryDataType,
									data: {
										query: query,
										format: "json"
									},
									success: function( data ) {
										response( $.map( data.results.bindings, function( item ) {
											var label = [];
											if ( _this.Hooks && typeof _this.Hooks.__autocompleteGetItem !== "undefined" )
												item = _this.Hooks.__autocompleteGetItem( item );
											$.each(item, function(k,v) {
												if ( k != "item" )
													label.push(v.value);
											});
											label = label.join(" | ");
											return {
												label: label, // wird angezeigt
												value: item.item.value
											}
						            	}));
						            },
						            error: function(err) {
						            	_this.showAlert( "error", 'Error on autocomplete: ' + JSON.stringify(err, null, ' ') );
						            }
								});
					      	},
					      	select : function( event, ui ) {
					      		if ( _this.Hooks && typeof _this.Hooks.__selectAutocompleteItem !== "undefined" )
									_this.Hooks.__selectAutocompleteItem( this, ui.item.value );
					      	},
							minLength: 2
						});
						break;

					case "local" :
						$(this).autocomplete({
							source: $.parseJSON( queryValues )
						});
						break;

					default :
						_this.showAlert( "error", "Unknown autocomplete apitype " + apitype );
				}
			});

			// trigger keyup on change autocomplete input
			$("input[autocomplete]", $(env)).on("change", function() {
				$(this).trigger("keyup");
			});

			if ( _this.Hooks && typeof _this.Hooks.__afterInitFormHandler!== "undefined" )
				_this.Hooks.__afterInitFormHandler( );

		},// end of initFormHandler	

		/**
		  * Submit the form callback functions
		  */
		submit: function() {
			var _this = this;
			var proceed = true;

			this.$elem.find("input").each(function() {
				var valid = _this.userInputValidation( $(this) );
				if ( ! valid ) {
					proceed = false;
					$('html, body').animate({ scrollTop: $(this).offset().top }, 100);
					return true;
				}
			});

			// proceed
			if ( proceed ) {				
				var json_result = _this.createResult();
				jsonld.expand(json_result, function(err, expanded) {
					if( err ) {
						_this.showAlert( "error", "Error on creating the expanded result: " + JSON.stringify(err, null, ' ') );
						return false;
					}

					if ( _this.data ) {
						expanded = _this.mergeExistingDataWithResult( expanded );
					}

					_this.RESULT = expanded;
					if ( _this.settings.debug ) {
						console.log( "RDForm Result = ", _this.RESULT );
					}

					if ( _this.settings.verbose ) {
						_this.outputResult();
					}

					// this calls the callback function
					_this.settings.submit.call( _this.RESULT );
				});
			}
		},

		// Abort form
		abort : function() {
			this.settings.abort.call();
		},

		/**
		  * Walk every class (div[typeof]) in the HTML form to create the RESULT
		  *
		  * @return void
		  */
		createResult: function() {
			var _this = this;

			if ( _this.Hooks && typeof _this.Hooks.__createResult !== "undefined" )
				_this.Hooks.__createResult();

			json_result = new Object();			

			// walk every root class
			_this.$elem.children("div[typeof]").each(function( ci ) {			
				var curClass = _this.getResultClass( $(this) );
				if ( ! $.isEmptyObject( curClass ) ) { // dont add empty classes
					if (! json_result.hasOwnProperty( curClass["@resource"] ) ) {
						json_result[ curClass["@resource"] ] = new Array();
					}
					json_result[ curClass["@resource"] ].push( curClass["@value"] );
				}
			});

			// make one length array classes to normal classes
			for ( var ci in json_result ) {
				if ( json_result[ci].length == 1 ) {
					json_result[ci] = json_result[ci][0];
				}
			}

			// if just one rootClass set as only class
			if ( Object.keys(json_result).length == 1 ) {
				for ( var ci in json_result ) {
					json_result = json_result[ci];
				}
			}

			// add context
			if ( _this.MODEL[0].hasOwnProperty("@context") ) {
				json_result['@context'] = _this.MODEL[0]["@context"];
			}
			
			return json_result;
		},

		/**
		  * Add a class and its properties in the RESULT array
		  *
		  * @cls HTML DOM object of the current class
		  * @return the ID for this class or the return ID
		  */
		getResultClass: function( cls ) {
			var _this = this;
			var thisClass = new Object(),
				properties = new Object();

			// walk each property (div-group literal,resource,hidden)
			cls.children("div").each(function() {

				var property = new Object();
				//var curPropName = "";

				if ( _this.Hooks && typeof _this.Hooks.__createResultClassProperty !== "undefined" )
					_this.Hooks.__createResultClassProperty( $(this) ); // TODO: give input or resource class

				// decide if its a literal or resource property
				if ( $(this).hasClass(_this._ID_ + "-literal-group") ) {
					property = _this.getResultLiteral( $(this).find('input,textarea,select') );
				}
				else if ( $(this).hasClass(_this._ID_ + "-resource-group") ) {
					property = _this.getResultResource( $(this) );
				}

				if ( ! $.isEmptyObject( property ) ) { // dont add empty properties
					if (! properties.hasOwnProperty( property["@resource"] ) ) {
						properties[ property["@resource"] ] = new Array();
					}
					properties[ property["@resource"] ].push( property["@value"] );
				}
			});

			if ( $.isEmptyObject( properties ) ) { // dont create empty classes
				//console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has no properties' );
				return new Object();
			}

			// make one length array properties to normal properties
			for ( pi in properties ) {
				if ( properties[pi].length == 1 ) {
					properties[pi] = properties[pi][0];
				}
			}

			if (_this.Hooks && typeof _this.Hooks.__createClass !== "undefined" )
				_this.Hooks.__createClass( $(cls) );		

			var classResource = $(cls).attr("resource");
			var wildcardsFct = _this.replaceWildcards( classResource, $(cls), _this.getWebsafeString );
			
			// dont save classes with wildcard pointers when every value is empty
			if ( classResource.search(/\{.*\}/) != -1 && wildcardsFct['count'] == 0 ) {
				console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has wildcards, but every pointer property is empty.' );
				return new Object();
			}

			thisClass["@resource"] = ( $(cls).attr("name") ) ? $(cls).attr("name") : $(cls).attr("typeof");

			// if it has a return-resource take this for the return
			if ( $(cls).attr("return-resource") ) {
				thisClass["@resource"] = _this.replaceWildcards( $(cls).attr("return-resource"), $(cls), _this.getWebsafeString )['str'];
			}

			thisClass["@value"] = { "@id" : wildcardsFct['str'], "@type" : $(cls).attr("typeof") };
			$.extend(true, thisClass["@value"], properties );

			if (_this.Hooks && typeof _this.Hooks.__createdClass !== "undefined" )
				thisClass = _this.Hooks.__createdClass( thisClass );

			return thisClass;
		},

		/**
		  * Create a literal property (text,boolean,textarea) for the RESULT
		  *
		  * @literal HTML DOM Object of the current hidden input
		  * @return Object of this property
		  */
		getResultLiteral: function( literal ) {
			var _this = this;
			var thisLiteral = new Object();	

			if ( $(literal).length == 0 ) {
				return thisLiteral; // return empty object fur null litreal e.g. add btn
			}
			var val = $(literal).val();		

			if ( $(literal).attr("type") == "checkbox" ) {
				val = $(literal).prop("checked").toString();
			}			
			if ( $(literal).prop("tagName") == "SELECT" ) {
				val = $( ":selected", $(literal) ).val();
			}

			if ( val != "" ) {
				thisLiteral["@value"] = _this.replaceWildcards( val, $(literal).parentsUntil("div[typeof]").parent() )['str'];			
				thisLiteral['@resource'] = $(literal).attr("name");

				if ( $(literal).attr("datatype") !== undefined ) {
					_this.MODEL[0]["@context"][$(literal).attr("name")]["@type"] = $(literal).attr("datatype");
				}
			}		
			return thisLiteral;
		},

		/**
		  * Create a resource-class property for the RESULT
		  *
		  * @env HTML DOM Object of the current resource group
		  * @return Object of this resource property
		  */
		getResultResource: function( env ) {
			var _this = this;
			var resource = new Object(),
				resourceGroup;			

			// search for a normal resource class children
			resourceGroup = $(env).children('div[typeof]');
			if ( resourceGroup.length > 0 ) { 
				// create a new class for this resource and take its return ID
				resource = _this.getResultClass( resourceGroup );
			}
			// search for a external resource input
			else if ( $(env).find('input[external]').length > 0 ) {
				resourceGroup = $(env).find('input[external]');
				if ( $(resourceGroup).val() == "" ) {
					return resource;
				}
				resource['@resource'] = $(resourceGroup).attr("name");
				resource["@value"] = {
					"@id" : _this.replaceWildcards( $(resourceGroup).val(), $(env).parent("div[typeof]"), _this.getWebsafeString )['str']
				};
			}
			return resource;
		},		

		/**
		  * Merge existing data with tha data of the form. Add properties to the result which were not in the form.
		  * @param Array result array of the form data
		  * @return Array result
		  */
		mergeExistingDataWithResult: function( result ) {
			var _this = this;
			var model = _this.MODEL;
			$.each( _this.data, function( key0, value0 ) {
				// TODO: BUG: only literals and external resources of the root classes get merged!
				$.each( value0, function( key1, value1) {
					if ( 	! model[0].hasOwnProperty(_this.replaceStrPrefix(key1)) &&
							! model[0].hasOwnProperty(_this.getUriPrefix(key1))
					) {
						result[0][ _this.replaceStrPrefix( key1 ) ] = value1;
					}
				});
			});
			return result;
		},

		/**
		  *	Create result string from baseprefix, prefixes and RESULT array and output it in the result textarea
		  *
		  * @return void
		*/
		outputResult: function() {
			// add result div
			if ( $("." + this._ID_ + "-result").length == 0 ) {
				this.$elem.after( '<div class="row '+this._ID_+'-result-container"><legend>'+ this.l("Result") +'</legend><div class="col-xs-12"><textarea class="form-control '+this._ID_+'-result" rows="10"></textarea></div></div>' );
			}
			
			var resultStr = JSON.stringify(this.RESULT, null, '\t');

			$("."+this._ID_+"-result-container").show();	
			$("."+this._ID_+"-result").val( resultStr );
			var lines = resultStr.split("\n");
			$("."+this._ID_+"-result").attr( "rows" , ( lines.length ) );
			$('html, body').animate({ scrollTop: $("."+this._ID_+"-result-container").offset().top }, 200);				
		},

		/*******************************************************
		 * Helper functions
		 * 
		 *******************************************************/

		/* Replacing wildcards {...} with the value of the property in the envoirement class or with values in the arguments attribute of resource-classes
		 *
		 * @str String value with the wildcards
		 * @envClass DOM element where to find inputs (properties)
		 * @strFc Function, if defined the wildcard value will be passed to this
		 * 
		 * @return Object. Keys: 'str', 'count'
		 */
		replaceWildcards: function( str, envClass, strFct ) {
			var _this = this;
			var counted = 0;

			if ( str.search(/\{.*\}/) != -1 ) { // look if it has wilcards {...}

				var strWcds = str.match(/\{[^\}]*/gi);
				for ( var i in strWcds ) {
					var wcd = strWcds[i].substring( 1 );
					var env = envClass;

					var wcdVal = env.find('input[name="'+wcd+'"],textarea[name="'+wcd+'"]');

					// search the wilcard in the arguments attribute of resource classes
					//if ( wcdVal.length == 0 && env.attr( "arguments" ) ) {
						//var args = $.parseJSON( env.attr( "arguments" ) );
					if ( wcdVal.length == 0 && env.data(_this._ID_ + "-model")["@rdform"]["arguments"] !== undefined ) {
						var args = env.data(_this._ID_ + "-model")["@rdform"]["arguments"];
						for ( var ai in args ) {
							args[ai] = args[ai].toString();
							if ( wcd == ai ) {
								if ( args[ai].search(/\{.*\}/) != -1 ) {
									env = envClass.parentsUntil("div[typeof]").parent();
								} 
								wcdVal = $( '<input type="hidden" name="' + ai + '" value="' + args[ai] + '" />' );
								break;
							}
						}
					}				

					// test if property exists
					if ( wcdVal.length == 0 ) {
						this.showAlert( "error", 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
						continue;
					}

					switch ( wcdVal.attr("type") ) {

						case 'checkbox' :
							wcdVal = ( wcdVal.val() != "" ) ? wcdVal.val() : wcdVal.prop("checked").toString();
							break;

						default :
							wcdVal = _this.replaceWildcards( wcdVal.val(), env )['str'];
					}

					// passing wildcard value to the function
					if ( strFct !== undefined ) {
						wcdVal = strFct(wcdVal);			
					}

					// regex: replace the {wildard pointer} with the value
					var regex = new RegExp("\{" + wcd + "\}", "g");
					if ( wcdVal != "" ) {
						++counted;	// count not empty properties 								
						str = str.replace(regex, wcdVal );
					} else {
						str = str.replace(regex, '' );
					}
				}
			}
			return new Object( { 'str' : str, 'count' : counted } );
		},

		/*
		 * Validate and correct input values depending on the datatype after user changed the value
		 *
		 * @property DOM object with input element
		 * @return void
		 */
		userInputValidation: function ( property ) {	
			var _this = this;
			var valid = true;			

			$(property).parentsUntil("div.form-group").parent().removeClass("has-error has-feedback");
			$(property).next("span.glyphicon-warning-sign").remove();

			if ( _this.Hooks && typeof _this.Hooks.__userInputValidation !== "undefined" ) {
				if ( _this.Hooks.__userInputValidation( $(property) ) == false )
					valid = false;
			}
			var value = $(property).val();
			value = value.trim();

			if ( $(property).attr("required") ) {
				if ( $(property).val() == "" ) {
					valid = false;
				}
			}
			else if ( $(property).attr("datatype") && $(property).val() != "" ) {

				if (   $(property).attr("datatype") == "xsd:date" 
					|| $(property).attr("datatype") == "xsd:gYearMonth" 
					|| $(property).attr("datatype") == "xsd:gYear"
				) {
					var datatype = "xsd:date";
					$(property).val( value.slice(0, 10) ); // max default date jjjj-mm-tt					

					value = $(property).val();
					value = value.replace(/\./g, '-');
					value = value.replace(/[^\d-]/g, '');

					if ( value.search(/^\d{4}$/) != -1 ) {
						datatype = "xsd:gYear";
					} 
					else if ( value.search(/^\d{4}-\d{2}$/) != -1 ) {
						datatype = "xsd:gYearMonth";					
					} 
					else if ( value.search(/^\d{4}-\d{2}-\d{2}$/) != -1 ) {
						datatype = "xsd:date";					
					} 
					else {
						_this.showAlert( "warning", 'Unknown xsd:date format in "'+ property.attr("name") +'"' );
						valid = false;
					}
					$(property).attr( "datatype", datatype );

					var dateTypeSelect = $(property).parentsUntil("div.form-group").parent().find('select.'+_this._ID_+'-date-type-select');
					if ( dateTypeSelect !== undefined ) {
						$("option[value='"+datatype+"']", dateTypeSelect).prop("selected", true);
					}
				}

				if ( $(property).attr("datatype").indexOf(":int") >= 0 ) {
					value = value.replace(/[^\d]/g, '');
				}
			}
			else if ( $(property).prop("type") == "url" && $(property).val() != ""  ) {
				$(property).val( _this.replaceStrPrefix($(property).val()) ); // maybe it contains a prefix
				if ( $(property).val().search(/^http/) == -1 ) {
					valid = false;
				}
			}			
			
			if ( ! valid ) {
				$(property).parentsUntil("div.form-group").parent().addClass("has-error has-feedback");
				$(property).after( '<span class="glyphicon glyphicon-warning-sign form-control-feedback"></span>' );
				return false;
			}

			$(property).attr('value', value );
			return true;
		},

		/**
		  * Validate if a string as a prefix which is defined in the form
		  *
		  * @str String to check
		  * @return Boolean if its valid or null if the string does not has any prefix
		  */
		validatePrefix: function( str ) {
			var _this = this;
			if ( str === undefined ) return null

			if ( str.search(":") != -1 ) {
				str = str.split(":")[0];
			} else {
				return null;
			}

			if ( str == "http" ) {
				return true;
			}

			if ( _this.MODEL[0]["@context"].hasOwnProperty(str) ) {
				return true;
			}

			this.showAlert( "warning", "Prefix \"" + str + "\" not defined in the form model (see attribute 'prefix')" );
			return false;
		},

		/**
		  * Set Base Uri for the model
		  * 
		  * @str URI String
		  */
		setBaseUri : function( uri ) {
			this.MODEL[0]["@context"]["@base"] = uri;
		},

		/**
		  * Creating random hash of a string (non unique secure!)
		  *
		  * @str String
		  */
		getHash : function( str ) {
			return (str.length * Math.random()).toString(36).slice(2);
		},

		/** 
		  * Remove accents, umlauts, special chars, ... from string to get a web safe string
		  *
		  * @str String
		  * return String with only a-z0-9-_
		  */
		getWebsafeString: function ( str ) {
			if ( str === undefined ) return '';

			// replace dictionary		
			var dict = {
				"ä": "ae", "ö": "oe", "ü": "ue",
				"Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
				"á": "a", "à": "a", "â": "a", "ã": "a",
				"é": "e", "è": "e", "ê": "e",
				"ú": "u", "ù": "u", "û": "u",
				"ó": "o", "ò": "o", "ô": "o",
				"Á": "A", "À": "A", "Â": "A", "Ã": "A",
				"É": "E", "È": "E", "Ê": "E",
				"Ú": "U", "Ù": "U", "Û": "U",
				"Ó": "O", "Ò": "O", "Ô": "O",
				"ß": "ss"
			}
			// replace not alphabetical chars if its in dictionary
			// TODO: test if str empty
			str = str.replace(/[^\w ]/gi, function(char) {
				return dict[char] || char;
			});
			str = str.replace(/ /gi,'_');
			return str.replace(/[^a-z0-9-_]/gi,'');
		},

		/**
		 * Search und reaplace a prefix in a String if defined in the context
		 * 
		 * @param String str 
		 * @return String with (maybe) replaced prefix
		 */
		replaceStrPrefix : function( str ) {
			var _this = this;
			if ( str === undefined ) return str;

			if ( str.search(":") != -1 ) {
				var str_arr = str.split(":");
			} else {
				return str;
			}
			if ( str_arr[0] == "http" ) {
				return str;
			}

			if ( _this.MODEL[0]["@context"].hasOwnProperty(str_arr[0]) ) {
				return _this.MODEL[0]["@context"][str_arr[0]]["@id"] + str_arr[1];
			}

			return str;
		},

		/**
		  * Return the compact uri (prefix:name)
		  *
		  * @param String str The Uri
		  * @return String Replaced Uri with prefix (if defined in model->@context)
		*/
		getUriPrefix: function( str ) {
			var _this = this;
			var strShort = str;
			if ( str === undefined ) return str;

			$.each( _this.MODEL[0]["@context"], function(key,val) {
				if ( 	val.hasOwnProperty("@id") &&
						str.search(val["@id"]) != -1
				 ) {
				 	var regex = new RegExp(val["@id"], "g");
					strShort =  str.replace( regex, key + ":" );
					return false;
				}
			} );

			return strShort;
		},

		/**
		 * Filter DOM group for an element by any attribute
		 * @param DOM env The DOM-group where to llok for
		 * @param String attr The attribute you are looking for
		 * @param String val The value of the attribute
		 * @return DOM element
		 */
		getElement : function( env, attr, val ) {
			var _this = this;
			var el = $(env).filter(function(index) {
				return ( $(this).attr(attr) === val ) 
					|| ( _this.replaceStrPrefix( $(this).attr(attr) ) === val );
			});
			return el;
		},

		/**
		  * Translate a string
		  *
		  * @str The string to translate. It can contain the l-function, that l(...) will be replaced
		  * @param String. If given, %s in str will be replaced with param
		  *
		  * @return String. The translated string
		  */
		l: function( str, param ) {

			if ( typeof str === "string" && str != "" ) {

				var translate = str.replace(/.*l\((.*?)\).*/, '$1');
				var translated = translate;

				if ( this.translations && this.translations[translate] ) {
					translated = this.translations[translate];
				} 

				if ( str.search( /l\(/ ) != -1 ) {
					str = str.replace(/l\(.*?\)/, translated);
				} else {
					str = str.replace(translate, translated);
				}

				if ( typeof param !== undefined ) {
					str = str.replace( /%s/g, param );
				}
			}
			return str;
		},

		/**
		  * Show a message in a colorred box above the form
		  *
		  * @param String type Message type (succes, error, warning)
		  * @param String msg The message
		  * @return viod
		  */
		showAlert : function( type, msg ) {
			var cls = "";
			switch ( type ) {
				case "success" :
					cls = "alert-success";
					break;
				case "error" :
					cls = "alert-danger";
					break;
				case "warning" :
					cls = "alert-warning";
					break;
				default :
					cls = "alert-info";
			}
			if ( this.settings.verbose || type == "error" || type == "warning" ) {
				this.alertArea.append('<p class="alert '+cls+'" role="alert">' + msg + '</p>').show();
				$('html, body').animate({ scrollTop: (this.alertArea.offset().top) }, 100);
			}
			else if ( this.settings.debug ) {
				console.log( "RDForm ("+type+"): " + msg );
			}
		},		
	}; // end of rdform.prototype

	/************************************************************************
	* RDForm
	************************************************************************/
	$.fn.RDForm = function( option, settings ) {

		// decide if settings are getted or setted
		if (typeof option === 'object') {
			settings = option;
		} else if (typeof option === 'string') {
			if ( settings ) {
				var defaultSettings = new Object();
				defaultSettings[option] = settings;
				this.data('_rdform_settings', defaultSettings );
				return true;
			} else {
				return this.data('_rdform_settings').settings[option];
			}
		}

		// merge object data with settings if any
		if ( this.data('_rdform_settings') ) {
			settings = $.extend({}, this.data('_rdform_settings'), settings || {});
		}
	
		// merge default settings with given settings
		settings = $.extend({}, $.fn.RDForm.defaultSettings, settings || {});

		return this.each(function() {
			var elem = $(this);			
			var rdform = new RDForm(this, settings);

			// prepare plugin: may loading hooks, lang, ...
			rdform.prepare();			

			// create form
			rdform.init();

			// store settings at element
			elem.data("_rdform_settings", settings);

			// store this class at element
			elem.data("_rdform_class", rdform);

			elem.find(".rdform-abort").click(function() {
				rdform.abort();
				return false;
			});

			// callback submit function
			elem.submit(function() {
				rdform.submit();
				return false;
			});
		});
	};
	
	/************************************************************************
	* Default settings
	************************************************************************/
	$.fn.RDForm.defaultSettings = {
		template	: "templates/form.html",
		data 		: null,
		hooks 		: null,		
		lang 		: null,
		cache 		: false,
		verbose 	: false,
		debug 		: false,
		submit 		: function() {},
		abort 		: function() {},
	};

	

})(jQuery);