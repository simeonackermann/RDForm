/**
  * init default variables
  */
var _ID_ = "rdform",
	rdform, // rdform DOM object
	initedFormHandler = false,
	MODEL = new Array(),
	RESULT = new Array(),
	JSON_RESULT = new Object(),
	CONTEXT = new Object();

/**
  * RDForm Plugin base constructor
  */
(function ( $ ) {
	/**
	  * default plugin settings
	  */
	var settings = {
		model: 	"form.html",
		data: 	"",
		hooks: 	"",
		lang: 	"",
		cache: 	false,

		submit: function() {},
	}	
	
	/**
	  * plugin base constructor
	  *
	  * @param[] options, override default settings
	  * @return this
	  */
	$.fn.RDForm = function( options ) {		

		// overide defaults settings
        $.extend(settings, options);		
		rdform = $(this);

		//add an alert area before the form
		rdform.before( '<div class="row rdform-alert"></p></div>' );

		// loading language file
		if ( settings.lang != "" ) {
			var langFile = "lang/" + settings.lang + ".js";
			rdform_ajaxAsyncScript( langFile );
		}		

		//loading hooks file
		if ( settings.hooks != "" ) {
			rdform_ajaxAsyncScript( settings.hooks );
		}

		// loading model file
		var modelFile = settings.cache ? settings.model : settings.model + "?" + (new Date()).getTime();
		var model = "";
		$.ajax({
			url: modelFile,
			type: "GET",
			dataType: "text",
			async: false,
			success: function( m ) {
				model = m;
			},
			error: function( jqxhr, type, exception ) {
				RDForm.showAlert( "error", 'Error "'+exception+'" on loading data model file "'+ settings.model +'"');
			}
		});
		if ( "" == model ) return this;

		// parsing model
		RDForm.parseFormModel( 'rdform', model )

		// create form, fill with modell, buttons, data and ad buttons
		rdform_createForm();		

		// add submit callback function
		rdform.submit(function() {
			rdform_submit();
			return false;
		});

    	return this;
	};	

	rdform_createForm = function() {
		//add model-form to my form
		rdform.append( RDForm.createHTMLForm() );		

		// append submit button
		rdform.append(	'<div class="form-group"><div class="col-xs-12 text-right">' + 
							//'<button type="reset" class="btn btn-default">'+ RDForm.l("reset") +'</button> ' + 
							'<button type="submit" class="btn btn-lg btn-primary">'+ RDForm.l("create") +'</button>' + 
						'</div></div>' );

		if ( RDForm.initFormHandler.called != true ) {
			RDForm.initFormHandler();
		}

		// maybe add existing data
		if ( settings.data != "" ) {
			RDForm.addExistingData( undefined, settings.data );
		}
	};

	rdform_ajaxAsyncScript = function( script ) {
		$.ajax({
			url: script,
			dataType: "script",
			async: false,
			error: function( jqxhr, type, exception ) {
				RDForm.showAlert( "error", 'Error on loading script "'+ script +'": '+exception );
			}
		});
	};

	// submit callback function
	rdform_submit = function() {

		$("."+_ID_+"-alert").hide();
		var proceed = true;

		// validate required inputs
		$("input[required]").each(function() {
			if ( $(this).val() == "" ) {
				$(this).parents(".form-group").addClass("error");
				RDForm.showAlert( "warning", "Please fillout all required red marked fields!");
				proceed = false;
			} else {
				$(this).parents(".form-group").removeClass("error");
			}
		});

		// proceed
		if ( proceed ) {
			//$("button[type=submit]").html("update");
			RDForm.createResult();
			//RDForm.outputResult();

			// callback function submit
			settings.submit.call( JSON_RESULT );
		}

	};

}( jQuery ));

/**
  * RDForm main object
  *
  */
RDForm = {

	/**
	  * Parse form model, get the type via param
	  *
	  * @param type The type of the model. Currently only rdform available
	  * @return void
	  */
	parseFormModel: function( type, model ) {
		switch (type) {
			case 'rdform':
				RDForm.parseRDFormModel( model );
				break;
			default:
				RDForm.showAlert( "error", "Unknown model type \"" + type  + "\"" );
				break;
		}
	},


	/**
	  *	Parse RDFform model and create the MODEL array
	  *
	  * @data Model as a string from config file
	  * @return void
	  */
	parseRDFormModel: function( data ) {
		var dom_model = $.parseHTML( data );

		// get base
		if ( $(dom_model).attr("base") ) {
			CONTEXT["@base"] = $(dom_model).attr("base");
		}		

		// get prefixes
		if ( $(dom_model).attr("prefix") ) {
			var prefixesArr = $(dom_model).attr("prefix").split(" ");
			if ( prefixesArr.length % 2 != 0 ) {
				RDForm.showAlert( "warning", "Invalid prefix attribute format. Use: 'prefix URL prefix URL...'" );
			}
			for (var i = 0; i < prefixesArr.length - 1; i += 2) {
				CONTEXT[ prefixesArr[i] ] = prefixesArr[i+1];
			}
		}	

		// walk the classes
		$(dom_model).children('div[typeof]').each(function() {
			var curClass = new Object();
			var properties = new Array();	

			curClass['typeof'] = $(this).attr("typeof"); // TODO: test if all importants attrs exists !!!			
			curClass['resource'] = $(this).attr("resource"); 
			curClass['legend'] = RDForm.l( $(this).prev("legend").text() );
			if ( $(this).attr("id") )
				curClass['id'] = $(this).attr("id");
			if ( $(this).attr("return-resource") )
				curClass['return-resource'] = $(this).attr("return-resource");

			RDForm.validatePrefix( curClass['typeof'] );

			// walk the input-properties
			$(this).children('input').each(function() {
				var success = true;
				var curProperty = new Object();

				if ( $(this).attr("type") === undefined ) { // check if type exists, set literal as default
					$(this).attr("type", "literal");
					console.log( "Model parsing exception: type attribute in property \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\" is not set. I manually added it as literal..." );
				}
				if ( $(this).attr("name") === undefined ) { // check if name exists
					RDForm.showAlert( "warning", "Attention: Unnamed Property-" + $(this).attr("type") + " in \"" + curClass['typeof'] + "\". Please add any name." );
					success = false;
				}

				// add all attributes: type, name, value, multiple, additional, readonly, placeholder, datatype, requiere, autocomplete, textare, boolean, checked, select, ...				
				$.each ( $(this)[0].attributes, function( ai, attr) {
					curProperty[ attr.name ] = attr.value;

					// maybe translate same attributes
					if ( attr.name == "placeholder" || attr.name == "title" || attr.name == "label" ) {
						curProperty[ attr.name ] = RDForm.l( attr.value );
					}					
				});
				RDForm.validatePrefix( curProperty['name'] );
				curProperty['label'] = RDForm.l( $(this).prev("label").text() );				
				
				// do some property-type specific things
				switch ( curProperty['type'] ) {
					case "resource":
						curProperty['typeof'] = curClass['typeof'];
						
						// test if the resource class exists (if not external)
						if ( curProperty['external'] === undefined ) {
							if ( $(dom_model).find('div[typeof="'+$(this).val()+'"],div[id="'+$(this).val()+'"]').length < 1 ) {
								RDForm.showAlert( "warning", "Couldnt find the class \"" + $(this).val() + "\" in the form model... ;( \n\n I will ignore the resource \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\"." );
								success = false;
							}
						}
						// add arguments-index for multiple resources
						if ( curProperty['multiple'] !== undefined ) {
							var arguments = ( curProperty['arguments'] === undefined ) ? new Object() : $.parseJSON( curProperty['arguments'] );
							arguments['i'] = 1;
							curProperty['arguments'] = JSON.stringify( arguments );
						}
						break;		

					case "literal":
						break;									

					case "hidden":						
						break;

					default:
						RDForm.showAlert( "warning", "Unknown type \"" + $(this).attr("type") + "\" at property \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\" on parsing model found. I will ignore this property..." );
						success = false;
						break;
				}

				if ( success )
					properties.push( curProperty );
			})
			curClass['properties'] = properties;

			if ( properties.length == 0 ) {
				RDForm.showAlert( "warning", "No properties stored in class \"" + curClass['typeof'] + "\" on parsing model found..." );
			}

			if ( $(this).find("p.help") ) {
				curClass['help'] = $(this).find("p.help").html();
			}

			MODEL.push( curClass );
		})
		
		// define if a class as a root class (and not a resource class of another class)		
		// TODO BUG: on relation: person -> has -> cat, cat -> lives with -> person NO ROOT CLASS exists
		for ( var mi in MODEL ) {
			var isRootClass = true;
			for ( var mi2 in MODEL ) {
				// dont need to test the same class
				if ( MODEL[mi]['typeof'] == MODEL[mi2]['typeof'] ) continue;

				// test if any resource property in model2 points to current class
				for ( var mi2pi in MODEL[mi2]['properties'] ) {
					var thisProperty = MODEL[mi2]['properties'][mi2pi];
					if ( thisProperty['type'] == 'resource' 
						&& thisProperty['value'] !== undefined
						&& (   thisProperty['value'] == MODEL[mi]['typeof'] 
							|| thisProperty['value'] == MODEL[mi]['id'] 
							)
					) {
						isRootClass = false;
					}
				}
			}
			if ( isRootClass ) {
				MODEL[mi]['isRootClass'] = true;
			}			
		}
		console.log( "RDForm Model = ", MODEL );				
	}, // end of parseFormModel	

	/**
	  * Get the model of a class by the class name (typeof) or id
	  *
	  * @classTypeof String of the needed class model
	  * @return The model of the class
	  */
	getClassModel: function( classTypeof ) {
		var classModel = false;
		for ( mi in MODEL ) {
			if ( MODEL[mi]['typeof'] == classTypeof || MODEL[mi]['id'] == classTypeof ) {
				classModel = MODEL[mi];
				break;
			}
		}
		if ( ! classModel ) {
			RDForm.showAlert( "warning", "Class \"" + classTypeof + "\" doesnt exists but refered..." );
		}
		return classModel;
	},

	/**
	  * Create the HTML form and append all root classes in MODEL
	  *
	  * @return HTML DOM of the form
	  */
	createHTMLForm: function() {

		var elem = $('<form></form>');
		
		for ( var mi in MODEL ) {
			if ( MODEL[mi]['isRootClass'] ) {				
				elem.append( RDForm.createHTMLClass( MODEL[mi] ) );
			}
		}

		return elem.html();
	},

	/**
	  * Create a class for the HTML form
	  *
	  * @classModel Model-Object of the current class
	  * @return HTML DOM object of the class
	  */
	createHTMLClass: function( classModel ) {		
		/* TODO: max depth
		if( typeof(depth) === 'undefined' ) var depth = 0;
		depth += 1;
		if ( depth > 1 ) {
			console.log( "Reached max class depth." );
			return "";
		} */

		var thisClass = $("<div></div>");
		thisClass.attr( {
			'id': _ID_ + '-class-' + classModel['typeof'], // TODO: sub-ID ... (e.g. Person/Forename)
			'class': _ID_  + '-class-group',
		});		
		
		var attrs = $.extend( true, {}, classModel );
		delete attrs['properties']; 
		thisClass.attr( attrs ); // add all attributes except the array properties
		
		var thisLegend = $( "<legend>"+ classModel['legend'] +"</legend>" );
		/*
		// TODO: maybe add baseprefix, name, return-resource...
		if ( classModel['name'] ) 
			thisLegend.prepend( "<small>"+ classModel['name'] +"</small> " );
		
		if ( classModel['isRootClass'] ) {
			thisLegend.prepend( "<small class='rdform-class-baseprefix'>"+ CONTEXT[@base] +"</small> " );
		}

		if ( classModel['return-resource'] ) {
			thisLegend.append( "<small>"+ classModel['return-resource'] +"</small> " );
		} 
		*/
		thisLegend.append(	'<div class="rdform-edit-class-resource">' +
								'<small>'+ classModel['resource'] +'</small>' +
								'<span class="glyphicon glyphicon-pencil"></span>' +
								'<input type="text" value="'+ classModel['resource'] +'" class="form-control input-sm" />' +
							'</div>' );	

		thisLegend.append( '<small>a '+ classModel['typeof'] +'</small>' );	
		thisClass.append( thisLegend );

		if ( classModel['help'] !== undefined ) {
			thisClass.append(	'<div class="form-group rdform-class-help hidden">' +
									'<span class="help-block col-xs-12">'+classModel['help']+'</span>' +
								'</div>' );
			thisLegend.prepend( '<span class="glyphicon glyphicon-question-sign btn rdform-show-class-help"></span>' );
		}

		// add the properties
		for ( var pi in classModel['properties'] ) {
			var property =  classModel['properties'][pi];
			thisClass.append( RDForm.createHTMLProperty( property ) );				
		}
		
		if ( classModel['additional'] !== undefined ) {
			thisClass.append('<button type="button" class="btn btn-link btn-xs remove-class" title="'+ RDForm.l("Remove class %s", classModel['typeof']) +'"><span class="glyphicon glyphicon-remove"></span> '+ RDForm.l("remove") +'</button>');
		}		

		// add button for multiple classes
		if ( classModel['multiple'] !== undefined ) {
			//thisClass.attr('index', 1);
			thisClass.append('<button type="button" class="btn btn-default btn-xs duplicate-class" title="'+ RDForm.l("Duplicate class %s", classModel['typeof']) +'"><span class="glyphicon glyphicon-plus"></span> '+ RDForm.l("add") +'</button>');
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

		var thisProperty;

		switch ( property['type'] ) {

			case "hidden":
				var val = ( property['value'] !== undefined ) ? property['value'] : "";
				thisProperty = $( '<div class="'+_ID_+'-hidden-group"><input type="hidden" name="'+ property['name'] +'" id="" value="'+ val +'" /></div>' );
				break;

			case "literal":
				thisProperty = RDForm.createHTMLiteral( property );
				break;
			case "resource":
				thisProperty = RDForm.createHTMLResource( property );
				break;			

			default:
				RDForm.showAlert( "warning", "Unknown property type \""+property['type']+"\" detected on creating HTML property.");
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

		var thisFormGroup = $('<div class="form-group '+_ID_+'-literal-group"></div>');
		var thisInputContainer = $('<div class="col-xs-9"></div>');		
			
		// TODO: add ID and sub-ID
		//curPropertyID = _ID_ + '-property-' +  literal['typeof'] + "/" + curProperty['name']

		// TODO: cleanup the following spaghettic code....!

		if ( literal['additional'] !==  undefined ) {			
			thisInputContainer.append ('<button type="button" class="btn btn-default btn-sm add-class-literal" name="'+ literal['name'] +'" title="Add literal '+literal['name']+'">' + 
											'<span class="glyphicon glyphicon-plus"></span> '+ literal['label'] +
										'</button>' );
			thisFormGroup.append( thisInputContainer );
			return thisFormGroup;
		}

		var thisLabel = $("<label></label>");
		thisLabel.attr({
			//'for': curPropertyID,
			'class': 'col-xs-3 control-label'
		});
		thisLabel.text( literal['label'] );
		thisFormGroup.append( thisLabel );
		
		if ( literal['textarea'] !==  undefined ) {			
			var thisInput = $("<textarea></textarea>");
		}
		else if ( literal['select'] !==  undefined ) {
			var thisInput = $("<select></select>");
		}
		else {
			var thisInput = $("<input />");
		}	
		thisInput.attr({
			//'id': literalID,
			'class': 'form-control input-sm',
		});		
		thisInput.attr( literal );

		if ( literal['datatype'] !== undefined ) {
			if (  literal['datatype'].search(/.*date/) != -1 || literal['name'].search(/.*date/) != -1 ) {
				thisInputContainer.removeClass( "col-xs-9" );
				thisInputContainer.addClass( "col-xs-3" );
			}
		}

		if ( literal['boolean'] !== undefined ) {
			thisInput.attr( "type", "checkbox" );
			thisInputContainer.addClass( "checkbox" );
			thisInput.removeClass( "form-control input-sm" );
			thisInput = $("<label></label>").append( thisInput );
			thisInput.append( literal['label'] );
			thisLabel.text( "" );
		}
		else if ( literal['select'] !== undefined ) {
			var selectOptions = $.parseJSON( literal['select-options'] );
			thisInput.append( '<option value="" disabled selected>choose...</option>' );
			for ( var soi in selectOptions ) {
				thisInput.append( '<option value="'+ selectOptions[soi] +'">'+ selectOptions[soi] +'</option>' );
			}			
		}
		else if ( literal['textarea'] !== undefined ) {

		}
		else {
			thisInput.attr( "type", "text" );
		}

		thisInputContainer.append( thisInput );

		if ( literal['multiple'] != undefined ) {
			thisInput.attr('index', 1);
			thisInputContainer.append('<button type="button" class="btn btn-default btn-xs duplicate-literal" title="'+ RDForm.l("Duplicate literal %s", literal['name']) +'"><span class="glyphicon glyphicon-plus"></span> '+ RDForm.l("add") +'</button>');
		}

		if ( literal['help'] !== undefined ) {
			thisInputContainer.append( '<span class="glyphicon glyphicon-question-sign btn rdform-show-literal-help"></span>' );
			thisInputContainer.append(	'<span class="help-block rdform-literal-help hidden">' + literal['help'] + '</span>' );			
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

		var curFormGroup = $('<div class="form-group '+_ID_+'-resource-group"></div>');
		var resourceClass;
		var showHelp = false;

		if ( resource['external'] !== undefined ) {	// add simple input for external resources
			resourceClass = $("<input />");						
		}
		else { // add regular resource
			var classModel = $.extend( true, {}, RDForm.getClassModel(resource['value']) );
			
			// add button for additional or same resources (like person knows person)
			if ( resource['typeof'] == resource['value'] || typeof(resource['additional']) !== "undefined" ) {				
				//curFormGroup.addClass("add-resoource-button-group");
				if ( classModel['legend'] )
					var btnText = classModel['legend'];
				else
					var btnText = resource['title'] ? resource['title'] : resource['name'] + " - " + resource['value'];

				var resourceClass = $(	'<button type="button" class="btn btn-default add-class-resource" name="'+ resource['name'] +'" value="'+ resource['value'] +'" title="' + RDForm.l("Add class %s", resource['value'])+'">' + 
											'<span class="glyphicon glyphicon-plus"></span> '+ btnText +
										'</button>' );


				if ( classModel['help'] ) {
					showHelp = true;					
				}
			} 			
			else { // create class-model for the resource
				classModel['name'] = resource['name'];
				classModel['multiple'] = resource['multiple'];
				classModel['arguments'] = resource['arguments'];
				resourceClass = RDForm.createHTMLClass( classModel );
			}
		}
		/*
		resourceClass.attr( resource ); // BUG: adds the parent typeof
		if ( typeof btnText !== undefined ) resourceClass.attr( 'type', 'button' );
		*/
		resourceClass.attr({
			'name': resource['name'],
			'additional': resource['additional'],
			'multiple': resource['multiple'],
			'arguments': resource['arguments'],
		});

		//if ( resource['resource'] ) {
		//	resourceClass.attr( 'resource', resource['resource'] );
		//}		

		curFormGroup.append( resourceClass );

		if ( resource['external'] !== undefined ) {
			resourceClass.attr({
				'type': "text", 
				'external': 'external',
				'class': 'form-control input-sm',
				'value': resource['value'],
				'readonly': resource['readonly'],
				'placeholder': resource['placeholder'],
			});

			var thisLabel = $("<label>...</label>");
			thisLabel.text( resource['label'] );
			thisLabel.attr({
				//'for': curPropertyID,
				'class': 'col-xs-3 control-label'
			});
			curFormGroup.prepend( thisLabel );
			
			var thisInputContainer = $('<div class="col-xs-9"></div>');	
			resourceClass.wrap( thisInputContainer );
		}

		if ( showHelp == true ) {
			curFormGroup.append('<div class="rdform-resource-help-container">' +
									'<span class="glyphicon glyphicon-question-sign btn rdform-show-resource-help"></span>' +
									'<span class="help-block rdform-resource-help hidden">' + classModel['help'] + '</span>' +
								'</div>' );			
		}

		return curFormGroup;
	},

	/**
	 * Add existing data from a JSON-LD object to the form
	 *
	 * @param string|undefined name Name of the current field (for multiple literal)
	 * @param array|object data Values to insert
	 * @param object env DOM modell of current environment class
	 */
	addExistingData : function( name, data, env ) {
		if ( typeof env === 'undefined' ) {
			env = rdform.find( 'div[typeof="'+data["@type"]+'"]' );

			if ( env.length == 0 ) {
				RDForm.showAlert( "warning", 'Der Datensatz enthält die nicht im Modell vorhandene Klasse { "'+data["@type"]+'" }' );
				return;
			}
		}
		var prevKey = "";

		for ( var i in data ) {
			var curName = ( name === undefined ) ? i : name;	

			if ( i[0] != "@" ) { // we dont want @id, @type, ...

				if ( typeof data[i] === "string" ) { // its a literal	

					var literal = $(env).children("div.rdform-literal-group").find( 'input[name="'+curName+'"],textarea[name="'+curName+'"]' ).last();

					if ( $(literal).length == 0 ) { // doesnt found -> try to find an additional button
						var addBtn = $(env).children("div.rdform-literal-group").find( 'button.add-class-literal[name="'+curName+'"]' );
						if ( $(addBtn).length == 0 ) {
							RDForm.showAlert( "info", 'Der Datensatz enthält das nicht im Modell vorhandene Literal { "'+curName+'": "' + data[i] + '" }' );
							continue;
						}
						$(addBtn).trigger("click");
						literal = $(env).children("div.rdform-literal-group").find( 'input[name="'+curName+'"],textarea[name="'+curName+'"]' ).last();
					}

					if ( prevKey == curName ) { // same key -> try to duplicate
						$(literal).nextAll("button.duplicate-literal").trigger("click");
						literal = $(env).children("div.rdform-literal-group").find( 'input[name="'+curName+'"],textarea[name="'+curName+'"]' ).last();
						$(literal).parentsUntil(".rdform-literal-group").parent().removeAttr("style"); // bugfix: some classes have hidden inline style
					}

					$(literal).val( data[i] );	
					//$(literal).trigger("keyup");
					$(literal).parentsUntil(".rdform-literal-group").parent().removeAttr("style"); // bugfix: some classes have hidden inline style

					if ( $(literal).attr("type") == "checkbox" ) { // checkbox -> check or uncheck
						if ( data[i] == "0" || data[i] == "false" ) {
							$(literal).removeAttr("checked");							
						} /* else {
							$(literal).trigger("click");
						}*/
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
						RDForm.addExistingData( i, thisData, env );
					}
					else if ( ! thisData[0].hasOwnProperty("@id") ) { // its a literal in an object	
						var liArr = new Array();
						for ( var li in thisData ) {
							liArr.push( thisData[li]["@value"] );
						}
						RDForm.addExistingData( i, liArr, env );
					}				
					else { // its one or mutliple resources

						for ( var di in thisData ) {

							if ( ! thisData[di].hasOwnProperty("@type") ) { // it seemms to be an external resource
								var resource = $(env).children("div.rdform-resource-group").find( 'input[name="'+i+'"]' ).last();
								if ( $(resource).length != 0 ) {
									$(resource).val( thisData[di]["@id"] );	
									continue;
								}
							}

							var subEnv = $(env).find( 'div[typeof="'+thisData[di]["@type"]+'"]' ).last();

							if ( $(subEnv).length == 0 ) { // resourc not found -> try to find the add button
								var addBtn = $(env).children("div.rdform-resource-group").find( 'button.add-class-resource[value="'+thisData[di]["@type"]+'"]' );
								if ( $(addBtn).length == 0 ) {
									RDForm.showAlert( "info", 'Der Datensatz enthält die nicht im Modell vorhandene Resource { "'+thisData[di]["@type"]+'": "' + JSON.stringify(thisData) + '" }' );
									continue;
								}
								$(addBtn).trigger("click");
								subEnv = $(env).find( 'div[typeof="'+thisData[di]["@type"]+'"]' ).last();
							}

							if ( i != $(subEnv).attr("name")  ) {
								RDForm.showAlert( "info", 'Der Datensatz enthält die Propertie "'+i+'", die im Modell zu "'+$(subEnv).attr("name")+'" verändert ist.' );
							}

							// on multiple resource (walk thisData backwards) -> duplicate the subEnv
							if ( di > 0 ) {
								for (var ri = di-1; ri >= 0; ri--) {
									if( thisData[di]["@type"] == thisData[ri]["@type"] ) {										
										$(subEnv).find( 'button.duplicate-class' ).trigger("click");
										subEnv = $(env).find( 'div[typeof="'+thisData[di]["@type"]+'"]' ).last();
										$(subEnv).removeAttr("style"); // bugfix: some classes have hidden inline style
										break;
									}
								}
							}
							
							RDForm.addExistingData( undefined, thisData[di], subEnv );
						}
					}		
				}
			}
			prevKey = curName;
		}
	},

	/*******************************************************
	 *	Init form button handlers after building the form
	 * 
	 *******************************************************/
	initFormHandler: function() {
		RDForm.initFormHandler.called = true;
		/*
		$('body').on('focus',".date", function(){
			//$(".datepicker").datepicker('hide'); // if enabled resets the format
			$(this).datepicker({
				format :"yyyy-mm-dd",
				weekStart: 1
			});
		});​
		*/	
		if ( typeof __initFormHandlers !== "undefined" )
			__initFormHandlers();		

		// validate input values on change
		rdform.on("change", "input", function() {
			RDForm.userInputValidation( $(this) );
		});

		// BUTTON: show help class text
		rdform.on("click", ".rdform-show-class-help", function() {
			var classHelp =  $(this).parentsUntil("div[typeof]").parent().find("div.rdform-class-help").first();
			$(classHelp).toggleClass("hidden");
		});

		// BUTTON: show literal help text
		rdform.on("click", ".rdform-show-literal-help", function() {
			var classHelp =  $(this).parent().find("span.rdform-literal-help");
			$(classHelp).toggleClass("hidden");
		});

		// BUTTON: show literal help text
		rdform.on("click", ".rdform-show-resource-help", function() {
			var classHelp =  $(this).parent().find("span.rdform-resource-help");
			$(classHelp).toggleClass("hidden");
			return false;
		});

		// BUTTON: add a class-literal
		rdform.on("click", "button.add-class-literal", function() {
			var literalContainer = $(this).parentsUntil("div.rdform-literal-group").parent();
			var thisClass = $(this).parentsUntil("div[typeof]").parent();
			var classModel = RDForm.getClassModel( $(thisClass).attr('typeof') );
			// find literal in class-model
			for ( var pi in classModel.properties ) {
				if ( classModel.properties[pi].name == $(this).attr("name") ) {
					var thisLiteral = $.extend( true, {}, classModel.properties[pi] );					
					break;
				}
			}
			thisLiteral.additional = undefined; // set additional to undefined so createHTMLiteral will really create the literal
			
			var thisLiteralHTML = RDForm.createHTMLiteral( thisLiteral );

			//add remove button
			$(thisLiteralHTML).find("input,textarea").after('<button type="button" class="btn btn-link btn-xs remove-literal" title="'+ RDForm.l("Remove literal %s", $(this).attr("name") ) +'"><span class="glyphicon glyphicon-remove"></span> '+ RDForm.l("remove") +'</button>');

			$(thisLiteralHTML).hide();
			$(literalContainer).before( thisLiteralHTML );
			$(thisLiteralHTML).show("slow");
			$(literalContainer).remove();
			
			findWildcardInputs( thisLiteralHTML );

			return false;
		});

		// BUTTON: add a class-resource
		rdform.on("click", "button.add-class-resource", function() {
			//var classModel = getClassModel( $(this).val() );
			var classModel = $.extend( true, {}, RDForm.getClassModel( $(this).val() ) );
			classModel['multiple'] = $(this).attr("multiple");
			classModel['additional'] = $(this).attr("additional");
			//classModel['argument'] = $(this).attr("argument");
			classModel['arguments'] = $(this).attr("arguments");
			classModel['name'] = $(this).attr("name"); 

			var thisClass = RDForm.createHTMLClass( classModel );

			$(thisClass).hide();
			$(this).before( thisClass );
			$(thisClass).show("slow");
			$(this).parent().children("div.rdform-resource-help-container").remove();
			$(this).remove();			

			findWildcardInputs( thisClass );

			return false;
		});

		// BUTTON: remove a class resource
		rdform.on("click", "button.remove-class", function() {
			var classContainer = $(this).parentsUntil("div.rdform-resource-group").parent();
			var thisClass = classContainer.children("div[typeof]");
			var thisClassTypeof = thisClass.attr('typeof');
			var prevClass = classContainer.prev("div.rdform-resource-group").children('div[typeof="'+thisClassTypeof+'"]');
			var nextClass = classContainer.next("div.rdform-resource-group").children('div[typeof="'+thisClassTypeof+'"]');

			// remove a multiple class when it was allready duplicated (has next or prev)
			if ( thisClass.attr('multiple') 
				&& ( nextClass.length != 0 || prevClass.length != 0 )
				) {

				if ( nextClass.length != 0 ) { // remove any middle multiple class
					//show legend if the first class was deleted
					if ( prevClass.length == 0 )
						nextClass.children("legend").show();

					// decrease all next indexes in arguments and reload wildcard-inputs
					classContainer.nextAll("div.rdform-resource-group").each(function() {
						var curNextClass = $(this).children('div[typeof="'+thisClassTypeof+'"]');
						if ( curNextClass.length == 0 ) {
							return false;						
						}
						var arguments = $.parseJSON( $(curNextClass).attr('arguments') );
						--arguments['i'];
						$(curNextClass).attr("arguments", JSON.stringify( arguments ) );

						findWildcardInputs( curNextClass );
					});
				} else { // remove the last multiple class
					var thisAddBtn = thisClass.children("button.duplicate-class");
					prevClass.append( thisAddBtn );
				}

				classContainer.hide( "slow", function() {
					classContainer.remove();
				});

			} else { // remove a single additional or multiple-additional class -> add the add-resource button

				var classModel = $.extend( true, {}, RDForm.getClassModel( thisClass.attr('typeof') ) );
				classModel['additional'] = true;
				classModel['multiple'] = thisClass.attr('multiple');
				classModel['name'] = thisClass.attr('name');
				classModel['value'] = thisClass.attr('typeof');
				classModel['arguments'] = thisClass.attr('arguments');
				var newClassContainer = RDForm.createHTMLResource( classModel );

				$(classContainer).before( newClassContainer );
				classContainer.hide( "slow", function() {					
					classContainer.remove();
				});	
			}

			return false;
		});

		// BUTTON: duplicate a class
		rdform.on("click", "button.duplicate-class", function() {			
			var classContainer = $(this).parentsUntil("div.rdform-resource-group").parent().clone();			
			var thisClass = $(classContainer).children("div[typeof]");			

			$(thisClass).find('input[type="text"]:not([value*="{"]):not([readonly])').val(""); // reset values
			$(thisClass).find('textarea:not([value*="{"]):not([readonly])').val("");

			$(thisClass).children("legend").hide(); // hide legend
			$(thisClass).find("div").removeClass("error");

			// add remove btn if not already there
			if ( $(thisClass).find('button.remove-class').length == 0 ) {
				$('button.duplicate-class', thisClass).before('<button type="button" class="btn btn-link btn-xs remove-class" title="'+ RDForm.l("Remove class %s", $(thisClass).attr('typeof') ) +'"><span class="glyphicon glyphicon-remove"></span> '+ RDForm.l("remove") +'</button>');
			}

			// rewrite index, radio input names index and references in wildcards
			var arguments = $.parseJSON( $(thisClass).attr('arguments') );
			++arguments['i'];
			$(thisClass).attr("arguments", JSON.stringify( arguments ) );

			$(classContainer).hide();			
			$(this).parentsUntil("div.rdform-resource-group").parent().after( classContainer );
			$(classContainer).show("slow");
			$(classContainer).removeAttr("style"); // remove style (BUGIF in addExistingDate, on duplicate multiple resource the classConainer is hidden...)
			$(this).remove(); // remove duplicate btn

			if ( typeof __afterDuplicateClass !== "undefined" )
				__afterDuplicateClass( thisClass );

			findWildcardInputs( classContainer );

			return false;
		});

		// BUTTON: duplicate a literal
		rdform.on("click", "button.duplicate-literal", function() {			
			var literalContainer = $(this).parentsUntil("div.rdform-literal-group").parent().clone();
			var thisLiteral = $(literalContainer).find("input,textarea");

			if ( thisLiteral.val().search("{") == -1 ) {
				thisLiteral.val("");
			}

			//add remove button
			if ( $(literalContainer).find('button.remove-literal').length == 0 ) {
				$('button.duplicate-literal', literalContainer).before('<button type="button" class="btn btn-link btn-xs remove-literal" title="'+ RDForm.l("Remove literal %s", $(thisLiteral).attr("name") ) +'"><span class="glyphicon glyphicon-remove"></span> '+ RDForm.l("remove") +'</button>');
			}

			// rewrite index, radio input names index and references in wildcards
			var index = $(thisLiteral).attr("index");
			++index;
			$(thisLiteral).attr("index", index);

			$(literalContainer).hide();	
			$(this).parentsUntil("div.rdform-literal-group").parent().after( literalContainer );
			$(literalContainer).show("slow");
			$(this).remove(); // remove duplicate btn

			findWildcardInputs( literalContainer );

			return false;
		});		

		// BUTTON: remove literal
		rdform.on("click", "button.remove-literal", function() {
			var literalContainer = $(this).parentsUntil("div.rdform-literal-group").parent();
			var literalName = $(this).prev().attr("name");
			var prevLiteral = literalContainer.prev("div.rdform-literal-group").find('*[name="'+literalName+'"]');
			var nextLiteral = literalContainer.next("div.rdform-literal-group").find('*[name="'+literalName+'"]');
			
			// if its the only duplicated literal - add button from model
			if ( prevLiteral.length == 0 && nextLiteral.length == 0 ) {

				var thisClass = $(this).parentsUntil("div[typeof]").parent();
				var classModel = RDForm.getClassModel( $(thisClass).attr('typeof') );
				// find literal in class-model
				for ( var pi in classModel.properties ) {
					if ( classModel.properties[pi].name == literalName ) {
						var thisLiteral = $.extend( true, {}, classModel.properties[pi] );					
						break;
					}
				}				
				var thisLiteralHTML = RDForm.createHTMLiteral( thisLiteral );
				literalContainer.before( thisLiteralHTML );

			} 
			else { // middle or last literal, maybe copy duplicate-btn
				var addBtn = literalContainer.find("button.duplicate-literal");
				prevLiteral.parent().append( addBtn );
			}

			literalContainer.hide( "slow", function() {					
				literalContainer.remove();
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
				var thisInput = $(this);
				var envClass = $(this).parentsUntil("div[typeof]").parent();
				$(this).attr("modvalue",  $(this).val() );

				var strWcds = $(this).val().match(/\{[^\}]*/gi);
				for ( var i in strWcds ) {				
					var wcd = strWcds[i].substring( 1 );	

					wildcards[wcd] = getWildcardTarget( wcd, envClass );	

					// TODO: if wildcard not found no keyup event exists!
					$(wildcards[wcd]).keyup(function() {
						writeWildcardValue( thisInput, wildcards );
					});

					if ( wildcards[wcd].val().search(/\{.*\}/) == -1 ) {
						$(wildcards[wcd]).trigger( "keyup" );
					}
				}
			});

		}
		findWildcardInputs( rdform );
		
		// find the target input of a wildcard wcd in the class envClass
		function getWildcardTarget( wcd, envClass ) {

			var wcdTarget = envClass.find('input[name="'+wcd+'"],textarea[name="'+wcd+'"]');

			if ( wcdTarget.length == 0 && envClass.attr( "arguments" ) ) {
				var args = $.parseJSON( envClass.attr( "arguments" ) );				
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
				RDForm.showAlert("error", 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
			}

			return wcdTarget;
		}

		// write a wildcard value to the input
		function writeWildcardValue( src, wildcards ) {
			var val = $(src).attr("modvalue");

			for ( wcd in wildcards ) {
				if ( wildcards[wcd].val() != "" ) {
					var regex = new RegExp( '\{' + wcd + '\}', "g");
					val = val.replace( regex, wildcards[wcd].val() );
				}

			}
			$(src).val( val.trim() );

			$(src).trigger( "keyup" );
		}

		// edit a class resouce
		rdform.on("click", "div.rdform-edit-class-resource span", function() {
			$(this).next("input").show().focus();

			$(this).prev("small").hide();
			$(this).hide();

		});

		/*rdform.on("focus", "div.rdform-edit-class-resource input", function() {
			$(this).val( getWebsafeString( $(this).val() ) ); // this is ugly, because it deletes the wildcarcd-brakes...
		});*/

		// leave a class-resource edit input
		rdform.on("change blur", "div.rdform-edit-class-resource input", function() {
			$(this).prev().prev("small").show();
			$(this).prev("span").show();
			$(this).trigger( "keyup" );
			$(this).hide();
		});
		
		// live auto-update class-resource text
		rdform.on("keyup", "div.rdform-edit-class-resource input", function() {
			var val = $(this).val();

			if ( val != "" ) {
				//$(this).parentsUntil("div[typeof]").parent().attr( "resource", val );
				//$(this).prev().prev("small").text( getWebsafeString( val ) );
				// TODO: maybe websafe string but with {wildcard}
				$(this).prev().prev("small").text( val );
			}
		});

		//autocomplete input
		rdform.on("focus", "input[autocomplete]", function() {			
			// TODO: check if attrs query-endpoint etc exists
			var queryEndpoint = $(this).attr( "query-endpoint" );
			var queryStr = $(this).attr("query");
			var apitype = $(this).attr("query-apitype");
			var queryValues = $(this).attr("query-values");

				switch (apitype) {

					case "sparql" :

						$(this).autocomplete({
							source: function( request, response ) {		
								var query = queryStr.replace(/%s/g, "'" + request.term + "'");
								$.ajax({
									url: queryEndpoint,
									dataType: "json",
									data: {
										//'default-graph-uri': "http%3A%2F%2Fdbpedia.org",
										query: query,
										format: "json"
									},
									success: function( data ) {						
										response( $.map( data.results.bindings, function( item ) {
											return {
												label: item.label.value, // wird angezeigt
												value: item.label.value
											}
						            	}));
						            }
								});
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
						console.log( "Unknown autocomplete apitype " + apitype );
				}			
		});

		// reset button, reset form and values
		// deprecated: reset button removed
		/*
		rdform.find("button[type=reset]").click(function() {		
			$(rdform).html("");
			$("."+_ID_+"-result").hide();
			$("."+_ID_+"-result textarea").val( '' );

			// create form, fill with modell, buttons, data and ad buttons();
			rdform_createForm();

			// find wildcard inputs again
			findWildcardInputs( rdform );
		});
		*/

		// submit formular		
		//rdform.on( "submit", RDForm.onSubmit );
		rdform.submit(function() {		

			//RDForm.onSubmit();	
			/*
			$("."+_ID_+"-alert").hide();
			var proceed = true;

			// validate required inputs
			$("input[required]").each(function() {
				if ( $(this).val() == "" ) {
					$(this).parents(".form-group").addClass("error");
					RDForm.showAlert( "warning", "Please fillout all required red marked fields!");
					proceed = false;
				} else {
					$(this).parents(".form-group").removeClass("error");
				}
			});

			// proceed
			if ( proceed ) {
				$("button[type=submit]").html("update");
				RDForm.createResult();

				RDForm.outputResult();
			}
			*/
			//return false;
		});
		

	}, // end of initFormHandler	

	/*
	onSubmit: function() {

		alert("submitted...");
		RDForm.settings.onSubmit.call( this );

	},*/

	/**
	  * Walk every class (div[typeof]) in the HTML form to create the RESULT
	  *
	  * @return void
	  */
	createResult: function() {

		//RESULT = new Array();		
		/*
		rdform.children("div[typeof]").each(function( ci ) {
			RDForm.createResultClass( $(this) );
		});
		*/

		if ( typeof __createResult !== "undefined" )
			__createResult();

		JSON_RESULT = new Object();			

		// walk every root class
		rdform.children("div[typeof]").each(function( ci ) {			
			var curClass = RDForm.getResultClass( $(this) );
			if ( ! $.isEmptyObject( curClass ) ) { // dont add empty classes
				if (! JSON_RESULT.hasOwnProperty( curClass["@resource"] ) ) {
					JSON_RESULT[ curClass["@resource"] ] = new Array();
				}
				JSON_RESULT[ curClass["@resource"] ].push( curClass["@value"] );
			}
		});

		// make one length array classes to normal classes
		for ( var ci in JSON_RESULT ) {
			if ( JSON_RESULT[ci].length == 1 ) {
				JSON_RESULT[ci] = JSON_RESULT[ci][0];
			}
		}

		// if just one rootClass set as only class
		if ( Object.keys(JSON_RESULT).length == 1 ) {
			for ( var ci in JSON_RESULT ) {
				JSON_RESULT = JSON_RESULT[ci];
			}
		}

		// add context
		JSON_RESULT['@context'] = CONTEXT;

		console.log( "RDForm Result = ", JSON_RESULT );		
	},

	/**
	  * Add a class and its properties in the RESULT array
	  *
	  * @cls HTML DOM object of the current class
	  * @return the ID for this class or the return ID
	  */
	getResultClass: function( cls ) {

		var thisClass = new Object(),
			properties = new Object();

		// walk each property (div-group literal,resource,hidden)
		cls.children("div").each(function() {

			var property = new Object();
			//var curPropName = "";

			if ( typeof __createResultClassProperty !== "undefined" )
				__createResultClassProperty( $(this) ); // TODO: give input or resource class

			// decide if its a hidden,literal or resource property
			if ( $(this).hasClass(_ID_ + "-hidden-group") ) {
				//property = RDForm.createResultHidden( $(this).find('input') );
			}
			else if ( $(this).hasClass(_ID_ + "-literal-group") ) {
				property = RDForm.getResultLiteral( $(this).find('input,textarea,select') );
			}
			else if ( $(this).hasClass(_ID_ + "-resource-group") ) {
				property = RDForm.getResultResource( $(this) );
			}
			else if ( $(this).hasClass(_ID_ + "-class-help") ) {
				property = RDForm.createResultResource( $(this) );
			}
			else {
				console.log("Unknown div-group in RDForm. Class = " + $(this).attr("class") );
			}


			if ( ! $.isEmptyObject( property ) ) { // dont add empty properties
				if (! properties.hasOwnProperty( property["@resource"] ) ) {
					properties[ property["@resource"] ] = new Array();
				}
				properties[ property["@resource"] ].push( property["@value"] );
			}
		});

		if ( $.isEmptyObject( properties ) ) { // dont create empty classes
			console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has no properties' );
			return new Object();
		}

		// make one length array properties to normal properties
		for ( pi in properties ) {
			if ( properties[pi].length == 1 ) {
				properties[pi] = properties[pi][0];
			}
		}

		if ( typeof __createClass !== "undefined" )
			__createClass( $(cls) );		

		var classResource = $(cls).attr("resource");
		var wildcardsFct = RDForm.replaceWildcards( classResource, $(cls), RDForm.getWebsafeString );

		// dont save classes with wildcard pointers when every value is empty
		if ( classResource.search(/\{.*\}/) != -1 && wildcardsFct['count'] == 0 ) {
			console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has wildcards, but every pointer property is empty.' );
			return new Object();
		}

		thisClass["@resource"] = ( $(cls).attr("name") ) ? $(cls).attr("name") : $(cls).attr("typeof");

		// if it has a return-resource take this for the return
		if ( $(cls).attr("return-resource") ) {
			thisClass["@resource"] = RDForm.replaceWildcards( $(cls).attr("return-resource"), $(cls), RDForm.getWebsafeString )['str'];
		}

		thisClass["@value"] = { "@id" : wildcardsFct['str'], "@type" : $(cls).attr("typeof") };
		$.extend(true, thisClass["@value"], properties );

		return thisClass;
	},
	// deprecated
	createResultClass: function( cls )  {

		var thisClass = new Object();
		var properties = new Array();

		// walk each property (div-group literal,resource,hidden)
		cls.children("div").each(function() {

			var property = new Object();

			if ( typeof __createResultClassProperty !== "undefined" )
				__createResultClassProperty( $(this) ); // TODO: give input or resource class

			// decide if its a hidden,literal or resource property
			if ( $(this).hasClass(_ID_ + "-hidden-group") ) {
				property = RDForm.createResultHidden( $(this).find('input') );
			}
			else if ( $(this).hasClass(_ID_ + "-literal-group") ) {
				property = RDForm.createResultLiteral( $(this).find('input,textarea,select') );
			}
			else if ( $(this).hasClass(_ID_ + "-resource-group") ) {
				property = RDForm.createResultResource( $(this) );
			}
			else if ( $(this).hasClass(_ID_ + "-class-help") ) {
				property = RDForm.createResultResource( $(this) );
			}
			else {
				console.log("Unknown div-group in RDForm. Class = " + $(this).attr("class") );
			}

			if ( ! $.isEmptyObject( property ) ) { // dont add empty proprty
					properties.push( property );
			}

		}); // end walk group

		if ( properties.length == 0 ) { // skip a class without properties
			console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has no properties' );
			return false;
		}

		thisClass['properties'] = properties;

		if ( typeof __createClass !== "undefined" )
			__createClass( $(cls) );

		var classResource = $(cls).attr("resource");
		var wildcardsFct = RDForm.replaceWildcards( classResource, $(cls), RDForm.getWebsafeString );

		// dont save classes with wildcard pointers when every value is empty
		if ( classResource.search(/\{.*\}/) != -1 && wildcardsFct['count'] == 0 ) {
			console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has wildcards, but every pointer property is empty.' );
			return false;
		}
		classResource = wildcardsFct['str'];
		thisClass['resource'] = classResource;

		var classTypeof = $(cls).attr("typeof");
		thisClass['typeof'] = classTypeof;

		//TODO test if this class may already exists...

		RESULT.unshift( thisClass ); // TODO maybe deccide if push/unshift to control the class range

		// if it has a return-resource take this for the return
		if ( $(cls).attr("return-resource") ) {
			classResource = RDForm.replaceWildcards( $(cls).attr("return-resource"), $(cls), RDForm.getWebsafeString )['str'];
		}
		return classResource;
	},

	/**
	  * Create a hidden property for the RESULT
	  *
	  * @hidden HTML DOM Object of the current hidden input
	  * @return Object of this hidden property
	  */
	  // deprecated
	createResultHidden: function( hidden ) {
		var thisHidden = new Object();		

		thisHidden['type'] = 'hidden';

		var val = $(hidden).val();
		val = RDForm.replaceWildcards( val, $(hidden).parentsUntil("div[typeof]").parent() )['str'];
		thisHidden['value'] = '"' + val + '"';
		
		var name = $(hidden).attr("name");
		thisHidden['name'] = name;		

		return thisHidden;
	},

	/**
	  * Create a literal property (text,boolean,textarea) for the RESULT
	  *
	  * @literal HTML DOM Object of the current hidden input
	  * @return Object of this property
	  */
	getResultLiteral: function( literal ) {
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

			thisLiteral["@value"] = RDForm.replaceWildcards( val, $(literal).parentsUntil("div[typeof]").parent() )['str'];			
			thisLiteral['@resource'] = $(literal).attr("name");

			if ( $(literal).attr("datatype") !== undefined ) {
				CONTEXT[ thisLiteral['@resource'] ] = { "@type" : $(literal).attr("datatype") };
			}
		}		

		return thisLiteral;
	},
	// deprecated
	createResultLiteral: function( literal ) {
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

			thisLiteral['type'] = 'literal';

			var name = $(literal).attr("name");
			thisLiteral['name'] = name;

			if ( $(literal).attr("datatype") ) {
				thisLiteral['datatype'] = $(literal).attr("datatype");
			}

			val = RDForm.replaceWildcards( val, $(literal).parentsUntil("div[typeof]").parent() )['str'];
			thisLiteral['value'] = '"' + val + '"';
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
		var resource = new Object(),
			resourceGroup;

		// search for a normal resource class children
		resourceGroup = $(env).children('div[typeof]');
		if ( resourceGroup.length > 0 ) { 
			// create a new class for this resource and take its return ID
			resource = RDForm.getResultClass( resourceGroup );
		}
		// search for a external resource input
		else if ( $(env).find('input[external]').length > 0 ) {
			resourceGroup = $(env).find('input[external]');
			if ( $(resourceGroup).val() == "" ) {
				return resource;
			}
			resource['@resource'] = $(resourceGroup).attr("name");
			resource["@value"] = {
				"@id" : RDForm.replaceWildcards( $(resourceGroup).val(), $(env).parent("div[typeof]"), RDForm.getWebsafeString )['str']
			};
		}

		return resource;
	},
	// deprecated
	createResultResource: function( env ) {

		var resource = new Object();
		var resourceID = false;
		var resourceGroup;
		
		// search for a normal resource class children
		resourceGroup = $(env).children('div[typeof]');
		if ( resourceGroup.length > 0 ) { 
			// create a new class for this resource and take its return ID
			resourceID = RDForm.createResultClass( resourceGroup );
		}
		// search for a external resource input
		else if ( $(env).find('input[external]').length > 0 ) {
			resourceGroup = $(env).find('input[external]');			
			resourceID = RDForm.replaceWildcards( $(resourceGroup).val(), $(env).parent("div[typeof]"), RDForm.getWebsafeString )['str'];
		}

		if ( resourceID ) {
			resource['type'] = 'resource';
			resource['value'] = resourceID;
			resource['name'] = $(resourceGroup).attr("name");
		}

		return resource;
	},	

	/**
	  * TODO: JSON-LD to turtle
	  */
	createTurtleResult: function() {

	},

	/**
	  *	Create result string from baseprefix, prefixes and RESULT array and output it in the result textarea
	  *
	  * @return void
	*/
	outputResult: function() {

		// callback function submit
		// add result div
		if ( $("." + _ID_ + "-result").length == 0 ) {
			rdform.after( '<div class="row '+_ID_+'-result-container"><legend>'+ RDForm.l("Result") +'</legend><div class="col-xs-12"><textarea class="form-control '+_ID_+'-result" rows="10"></textarea></div></div>' );
		}
		
		var resultStr = JSON.stringify(JSON_RESULT, null, '\t');
				
		$("."+_ID_+"-result-container").show();	
		$("."+_ID_+"-result").val( resultStr );
		var lines = resultStr.split("\n");
		$("."+_ID_+"-result").attr( "rows" , ( lines.length ) );
		$('html, body').animate({ scrollTop: $("."+_ID_+"-result-container").offset().top }, 200);		

	}, // end of creating result
	// deprecated
	outputTurtle: function() {

		var resultStr = "";

		/*if ( BASEPREFIX != "" ) {
			resultStr += "@base <" + BASEPREFIX + "> .\n";
		}

		//create prefixes
		for ( var prefix in PREFIXES ) {
			resultStr += "@prefix " + prefix + ": <" + PREFIXES[prefix] + "> .\n";
		}*/

		// output classes
		for ( var ci in RESULT ) {
			resultStr += "\n<" + RESULT[ci]['resource'] + "> a " + RESULT[ci]['typeof'] + " ;\n";

			for ( var pi in RESULT[ci]['properties']) {
				var property = RESULT[ci]['properties'][pi];

				switch ( property['type'] ) {
					case 'literal' :
						resultStr += "	" + property['name'] + " " + property['value'];
						break;

					case 'resource' :
						resultStr += "	" + property['name'] + " <" + property['value'] + ">";
						break;

					default : continue;
				}				
				
				// add datatype if exist
				resultStr += property.hasOwnProperty('datatype') ? "^^" + property['datatype'] : "";

				// end of property or end of class (add ; or .)
				resultStr += ( ( 1 + parseInt(pi) ) == RESULT[ci]['properties'].length ) ? " .\n" : " ;\n";
			}
		}
		return resultStr;
	},


	/************************** HELPER FUNCTIONS ******************************/

	/*
	 * Replacing wildcards {...} with the value of the property in the envoirement class or with values in the arguments attribute of resource-classes
	 *
	 * @str String value with the wildcards
	 * @envClass DOM element where to find inputs (properties)
	 * @strFc Function, if defined the wildcard value will be passed to this
	 * 
	 * @return Object. Keys: 'str', 'count'
	 */
	replaceWildcards: function( str, envClass, strFct ) {
		var counted = 0;

		if ( str.search(/\{.*\}/) != -1 ) { // look if it has wilcards {...}

			var strWcds = str.match(/\{[^\}]*/gi);
			for ( var i in strWcds ) {
				var wcd = strWcds[i].substring( 1 );
				var env = envClass;

				var wcdVal = env.find('input[name="'+wcd+'"],textarea[name="'+wcd+'"]');

				// search the wilcard in the arguments attribute of resource classes
				if ( wcdVal.length == 0 && env.attr( "arguments" ) ) {
					var args = $.parseJSON( env.attr( "arguments" ) );
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
					RDForm.showAlert( "error", 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
					continue;
				}

				switch ( wcdVal.attr("type") ) {

					case 'checkbox' :
						wcdVal = ( wcdVal.val() != "" ) ? wcdVal.val() : wcdVal.prop("checked").toString();
						break;

					default :
						wcdVal = RDForm.replaceWildcards( wcdVal.val(), env )['str'];
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

	/**
	  * Validate if a string as a prefix which is defined in the form
	  *
	  * @str String to check
	  * @return Boolean if its valid or null if the string does not has any prefix
	  */
	validatePrefix: function( str ) {
		if ( str === undefined ) return null

		if ( str.search(":") != -1 ) {
			str = str.split(":")[0];
		} else {
			return null;
		}

		if ( str == "http" ) {
			return true;
		}

		for ( var prefix in CONTEXT ) {
			if ( str == prefix ) {
				return true;
			}
		}
		console.log( "Prefix \"" + str + "\" not defined in the form model (see attribute 'prefix')" );
		return false;
	},

	/*
	TODO: maybe write this helper function:
	getParentClass: function( env ) {
		var thisClass = env.parentsUntil("div[typeof]").parent().clone();
		thisClass.find( "div[typeof]" ).remove();
		return thisClass;
	}
	*/
	

	/** 
	  * Remove accents, umlauts, special chars, ... from string to get a web safe string
	  *
	  * @str String
	  * return String with only a-z0-9-_
	  */
	getWebsafeString: function ( str ) {
		// str= str.replace(/[ÀÁÂÃÄÅ]/g,"A");
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

	/*
	 * Validate and correct input values depending on the datatype after user changed the value
	 *
	 * @property DOM object with input element
	 * @return void
	 */
	userInputValidation: function ( property ) {	
		
		var value = $(property).val();
		value = value.trim();

		if ( $(property).attr("datatype") ) {

			if (   $(property).attr("datatype") == "xsd:date" 
				|| $(property).attr("datatype") == "xsd:gYearMonth" 
				|| $(property).attr("datatype") == "xsd:gYear"
			) {
				var datatype = "xsd:date";
				
				$(property).parentsUntil("div.form-group").parent().removeClass("has-error has-feedback");
				$(property).next("span.glyphicon").remove();

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
					console.log( "Unknown xsd:date format..." );
					$(property).parentsUntil("div.form-group").parent().addClass("has-error has-feedback");
					$(property).after( '<span class="glyphicon glyphicon-warning-sign form-control-feedback"></span>' );
				}
				$(property).attr( "datatype", datatype );
			}

			if ( $(property).attr("datatype").indexOf(":int") >= 0 ) {
				value = value.replace(/[^\d]/g, '');
			}
		}
		$(property).attr('value', value );
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

			//str = str.replace(/l\((.*)\)/, '$1');
			var translate = str.replace(/.*l\((.*?)\).*/, '$1');
			var translated = translate;

			if ( typeof TRANSLATIONS === "object" && TRANSLATIONS[translate] ) {
				translated = TRANSLATIONS[translate];
			} 

			//str = str.replace(/l*\(*.*?\)*/, translated);
			//var regex = new RegExp("\{" + wcd + "\}", "g");
			if ( str.search( /l\(/ ) != -1 ) {
				str = str.replace(/l\(.*?\)/, translated);
			} else {
				str = str.replace(translate, translated);
			}
			//var regex = new RegExp( /l\(/ + translate + /\)/ );
			//str = str.replace( regex, translated);
			//str = str.replace(/(.*)l\((.*?)\)(.*)/, '$1' + translated + '$3');

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

		console.log( "RDForm Alert ("+type+"): " + msg );
		$(".rdform-alert").append('<p class="alert '+cls+'" role="alert">' + msg + '</p>');
		$("."+_ID_+"-alert").show();

	},

}