(function ( $ ) {
	/**
	  * default plugin settings
	  */
	var settings = {
		model: "form.html",
		data: "",
		hooks: "js/hooks.js",
		lang: "",
		ontologie: "",
	}

	/**
	  * init default variables
	  */
	var _ID_ = "rdform"; // TODO: add id to html form
	var rdform; // rdform DOM object
	var MODEL = new Array();
	var RESULT = new Array();
	var PREFIXES = new Object();	// RDF prefixes		
	var BASEPREFIX;

	// TODO: put PREFIXES and BASEPREFIX into MODEL as Objects
	
	/**
	  * plugin base constructor
	  *
	  * @param[] options, override default settings
	  * @return void
	  */
	$.fn.RDForm = function( options ) {		

		// overide defaults
        var opts = $.extend(settings, options);
		
		rdform = $(this);
		rdform.append( '<div class="row"><p id="error-msg" class="alert alert-error hide"></p></div>' );				

		// loading bootstrap
		/*
		$.ajax({
            url:"css/bootstrap.min.css",
            success:function(data){
                 $("<style></style>").appendTo("head").html(data);
            }
        })
		*/

		// load setting file
		if ( settings.lang != "" ) {
			var langFile = "lang/" + settings.lang + ".js";
			$.getScript( langFile )
				.fail(function( jqxhr, type, exception ) {
	    			alert('Error on loading language file "'+ langFile +'"...');
				})
				.done(function() {				
			});
		}

		// load external ontologie
		if ( settings.ontologie != "" ) {
			var ontFile = settings.ontologie;
			$.getScript( ontFile )
				.fail(function( jqxhr, type, exception ) {
	    			alert('Error on loading ontologie file "'+ ontFile +'"...');
				})
				.done(function() {	
			});
		}

		// loading hooks js file
		$.getScript( settings.hooks )
			.fail(function( jqxhr, type, exception ) {
    			//$( "div.log" ).text( "Triggered ajaxError handler." );
    			// TODO: better error reporting, instead alerts...
    			alert('Error on loading JavaScript hooks file "'+settings.hooks+'". Is the filename right?');
			})
			.done(function() {			
				setRDForm( rdform ); // set rdform var in hooks file

				// load nd parse model file
				$.ajax({ 
					url: settings.model,
					type: "GET",
					dataType: "text",
					success: function( model ) {
						parseFormModel( 'rdform', model )
						
						rdform.append( createHTMLForm() );

						rdform.append(	'<div class="form-group"><div class="col-xs-12 text-right">' + 
											'<button type="reset" class="btn btn-default">'+ l("reset") +'</button> ' + 
											'<button type="submit" class="btn btn-lg btn-primary">'+ l("create") +'</button>' + 
										'</div></div>' );
						initFormHandler();
					},
					error: function() {
						alert('Error when calling data model file "'+settings.model+'". Is the filename right?');
					}
				});
		});

		// add result div
		rdform.after( '<div class="row rdform-result"><legend>'+ l("Result") +'</legend><div class="col-xs-12"><textarea class="form-control" rows="10"></textarea></div></div>' );

    	return this;
	};

	/**
	  * Parse form model, get the type via param
	  *
	  * @param type The type of the model. Currently only rdform available
	  * @return void
	  */
	parseFormModel = function( type, model ) {
		switch (type) {
			case 'rdform':
				parseRDFormModel( model );
				break;
			default:
				alert( "Unknown model type \"" + type  + "\"" );
				break;
		}
	}


	/**
	  *	Parse RDFform model and create the MODEL array
	  *
	  * @data Model as a string from config file
	  * @return void
	  */
	parseRDFormModel = function( data ) {
		var dom_model = $.parseHTML( data );

		// get base
		if ( $(dom_model).attr("base") ) {
			BASEPREFIX = $(dom_model).attr("base");
		}		

		// get prefixes
		if ( $(dom_model).attr("prefix") ) {
			var prefixesArr = $(dom_model).attr("prefix").split(" ");
			if ( prefixesArr.length % 2 != 0 ) {
				alert( "Invalid prefix attribute format. Use: 'prefix URL prefix URL...'" );
			}
			for (var i = 0; i < prefixesArr.length - 1; i += 2) {
				PREFIXES[ prefixesArr[i] ] = prefixesArr[i+1];
			}
		}	

		// walk the classes
		$(dom_model).children('div[typeof]').each(function() {
			var curClass = new Object();
			var properties = new Array();	

			curClass['typeof'] = $(this).attr("typeof"); // TODO: test if all importants attrs exists !!!			
			curClass['resource'] = $(this).attr("resource"); 
			curClass['legend'] = l( $(this).prev("legend").text() );
			if ( $(this).attr("id") )
				curClass['id'] = $(this).attr("id");
			if ( $(this).attr("return-resource") )
				curClass['return-resource'] = $(this).attr("return-resource");

			validatePrefix( curClass['typeof'] );

			// walk the input-properties
			$(this).children('input').each(function() {
				var curProperty = new Object();

				if ( ! $(this).attr("type") ) {
					$(this).attr("type", "literal");
					console.log( "Model parsing exception: type attribute in property \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\" is not set. I manually added it as literal..." );
				}				

				curProperty['type'] = $(this).attr("type");
				curProperty['name'] = $(this).attr("name");
				curProperty['value'] = $(this).val();
				curProperty['label'] = l( $(this).prev("label").text() );
				curProperty['multiple'] = $(this).attr("multiple"); 
				curProperty['readonly'] = $(this).attr("readonly");

				validatePrefix( curProperty['name'] );

				var success = true;
				switch ( curProperty['type'] ) {
					case "literal":
						// TODO use a function to get all optiional/required attributes
						// -> http://stackoverflow.com/questions/14645806/get-all-attributes-of-an-element-using-jquery
						curProperty['datatype'] = $(this).attr("datatype");
						curProperty['placeholder'] = l( $(this).attr("placeholder") );
						curProperty['required'] = $(this).attr("required");						
						curProperty['autocomplete'] = $(this).attr("autocomplete");
						curProperty['textarea'] = $(this).attr("textarea");
						curProperty['boolean'] = $(this).attr("boolean");
						curProperty['checked'] = $(this).attr("checked");

						if ( $(this).attr("autocomplete") !== undefined )  {
							curProperty['query-endpoint'] = $(this).attr("query-endpoint");
							curProperty['query-apitype'] = $(this).attr("query-apitype");
							curProperty['query-values'] = $(this).attr("query-values");
							curProperty['query'] = $(this).attr("query");							
						}

						if ( $(this).attr("select") !== undefined ) {
							curProperty["select"] = $(this).attr("select");
							curProperty["select-options"] = $(this).attr("select-options");
						}

						break;			
					
					case "resource":
						curProperty['typeof'] = curClass['typeof'];
						curProperty['title'] = l( $(this).attr("title") );
						curProperty['additional'] = $(this).attr("additional");
						curProperty['argument'] = $(this).attr("argument");
						curProperty['arguments'] = $(this).attr("arguments");
						curProperty['external'] = $(this).attr("external");

						// test if resource class exists if its not an external resource
						if ( curProperty['external'] === undefined ) {
							if ( $(dom_model).find('div[typeof="'+$(this).val()+'"],div[id="'+$(this).val()+'"]').length < 1 ) {
								alert( "Couldnt find the class \"" + $(this).val() + "\" in the form model... ;( \n\n I will ignore the resource \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\"." );
								success = false;
							}
						}
						if ( curProperty['multiple'] !== undefined ) {
							var arguments = new Object();
							if ( curProperty['arguments'] !== undefined ) {
								arguments = $.parseJSON( curProperty['arguments'] );
							} 
							arguments['i'] = 1;
							curProperty['arguments'] = JSON.stringify( arguments );
						}
						break;										

					case "hidden":						
						break;

					default:
						alert("Unknown type \"" + $(this).attr("type") + "\" at property \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\" on parsing model found. I will ignore this property..." );
						success = false;
						break;
				}

				if ( success )
					properties.push( curProperty );
			})
			curClass['properties'] = properties;

			if ( properties.length == 0 ) {
				alert( "No properties stored in class \"" + curClass['typeof'] + "\" on parsing model found..." );
			}

			MODEL.push( curClass );
		})
		
		// define if a class is a root class (and not a resource class of another class)		
		// TODO BUG: on relation: person -> has -> cat, cat -> lives with -> person NO ROOT CLASS exists
		for ( var mi in MODEL ) {
			var isRootClass = true;
			for ( var mi2 in MODEL ) {
				for ( var mi2pi in MODEL[mi2]['properties'] ) {
					var thisProperty = MODEL[mi2]['properties'][mi2pi];
					if (   MODEL[mi]['typeof'] != MODEL[mi2]['typeof']
						&& thisProperty['type'] == 'resource' 
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
		console.log( "Model = ", MODEL );				
	} // end of parseFormModel

	/**
	  * Get the model of a class by the class name (typeof) or id
	  *
	  * @classTypeof String of the needed class model
	  * @return The model of the class
	  */
	getClassModel = function( classTypeof ) {
		var classModel = false;
		for ( mi in MODEL ) {
			if ( MODEL[mi]['typeof'] == classTypeof || MODEL[mi]['id'] == classTypeof ) {
				classModel = MODEL[mi];
				break;
			}
		}
		if ( ! classModel ) {
			alert( "Class \"" + classTypeof + "\" doesnt exists but refered..." );
		}
		return classModel;
	}

	/**
	  * Create the HTML form and append all root classes in MODEL
	  *
	  * @return HTML DOM of the form
	  */
	createHTMLForm = function() {

		var elem = $('<form></form>');
		
		for ( var mi in MODEL ) {
			if ( MODEL[mi]['isRootClass'] ) {				
				elem.append( createHTMLClass( MODEL[mi] ) );
			}
		}

		return elem.html();
	}

	/**
	  * Create a HTML class
	  *
	  * @classModel Model-Object of the current class
	  * @return HTML DOM object of the class
	  */
	createHTMLClass = function( classModel ) {		
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
		thisClass.attr( attrs ); // add all attributes insead the array properties
		
		var thisLegend = $( "<legend>"+ classModel['legend'] +"</legend>" );
		/*
		// TODO: maybe add baseprefix, name, return-resource...
		if ( classModel['name'] ) 
			thisLegend.prepend( "<small>"+ classModel['name'] +"</small> " );
		
		if ( classModel['isRootClass'] ) {
			thisLegend.prepend( "<small class='rdform-class-baseprefix'>"+ BASEPREFIX +"</small> " );
		}

		if ( classModel['return-resource'] ) {
			thisLegend.append( "<small>"+ classModel['return-resource'] +"</small> " );
		} 
		*/
		thisLegend.append(	'<div class="rdform-edit-class-resource">' +
								'<small>'+ classModel['resource'] +'</small>' +
								'<span class="glyphicon glyphicon-pencil"></span>' +
								'<input type="text" value="'+ classModel['resource'] +'" class="form-control" />' +
							'</div>' );	

		thisLegend.append( '<small>a '+ classModel['typeof'] +'</small>' );	

		thisClass.append( thisLegend );

		for ( var pi in classModel['properties'] ) {
			var property =  classModel['properties'][pi];
			thisClass.append( createHTMLProperty( property ) );				
		}

		/*
		if ( classModel['additional'] !== undefined ) {
			thisClass.append('<button type="button" class="btn btn-link btn-xs remove-class" title="'+ l("Remove class %s", classModel['typeof']) +'"><span class="glyphicon glyphicon-remove"></span> '+ l("remove") +'</button>');
		}
		*/

		// add button for mutliple classes
		if ( classModel['multiple'] ) {
			thisClass.attr('index', 1);
			thisClass.append('<button type="button" class="btn btn-default btn-xs duplicate-class" title="'+ l("Duplicate class %s", classModel['typeof']) +'"><span class="glyphicon glyphicon-plus"></span> '+ l("add") +'</button>');
		}

		return thisClass;
	}
	
	/**
	  * Create HTML propertie, decides if its a hidden, literal, resource, ...
	  *
	  * @property The object of the current proprtie
	  * @return HTML DOM object of the propertie
	  */
	createHTMLProperty = function( property ) {

		var thisProperty;

		switch ( property['type'] ) {

			case "hidden":
				thisProperty = $( '<div class="'+_ID_+'-hidden-group"><input type="hidden" name="'+ property['name'] +'" id="" value="'+ property['value'] +'" /></div>' );
				break;

			case "literal":
				thisProperty = createHTMLiteral( property );
				break;
			/*
			case "boolean":
				thisProperty = createHTMLiteral( property );
				break;
			*/
			case "resource":
				thisProperty = createHTMLResource( property );
				break;			

			default:
				alert("Unknown property type \""+property['type']+"\" detected on creating HTML property.");
				break;

		}
		return thisProperty;
	}

	/**
	  * Create literal propertie group  
	  *
	  * @literal Object of the current literal propertie
	  * @return  HTML DOM object of the literal group
	  */
	createHTMLiteral = function( literal ) {

		var thisFormGroup = $('<div class="form-group '+_ID_+'-literal-group"></div>');
		var thisInputContainer = $('<div class="col-xs-9"></div>');		
			
		// TODO: add ID and sub-ID
		//curPropertyID = _ID_ + '-property-' +  literal['typeof'] + "/" + curProperty['name']

		// TODO: cleanup the following spaghettic code....!

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

		if ( literal['datatype'] ) {
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

		if ( literal['multiple'] ) {
			thisInput.attr('index', 1);
			thisInputContainer.append('<button type="button" class="btn btn-default btn-xs duplicate-literal" title="'+ l("Duplicate literal %s", literal['name']) +'"><span class="glyphicon glyphicon-plus"></span> '+ l("add") +'</button>');
		}

		thisFormGroup.append( thisInputContainer );		

		return thisFormGroup;
	}

	/**
	  * Create a group for a resource
	  *
	  * @resource Object of the current resource from MODEL
	  * @return HTML DOM object of the resource group
	  */
	createHTMLResource = function( resource ) {		

		var curFormGroup = $('<div class="form-group '+_ID_+'-resource-group"></div>');
		var resourceClass;

		if ( resource['external'] !== undefined ) {	// add simple input for external resources
			resourceClass = $("<input />");						
		}
		else {
			// add button for additional or same resources (like person know person)
			if ( resource['typeof'] == resource['value'] || typeof(resource['additional']) !== "undefined" ) {					
				var btnText = resource['title'] ? resource['title'] : "add " + resource['name'] + " - " + resource['value'];			
				var resourceClass = $(	'<button type="button" class="btn btn-default add-class-resource" name="'+ resource['name'] +'" value="'+ resource['value'] +'">' + 
											'<span class="glyphicon glyphicon-plus"></span> '+ btnText +
										'</button>' );
			} 
			// get class-model for the resource
			else {
				var classModel = $.extend( true, {}, getClassModel(resource['value']) );
				classModel['name'] = resource['name'];
				classModel['multiple'] = resource['multiple'];
				resourceClass = createHTMLClass( classModel );
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
			'argument': resource['argument'],
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

		return curFormGroup;
	}

	/*******************************************************
	 *	Init form button handlers after building the form
	 * 
	 *******************************************************/
	initFormHandler = function() {
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
			userInputValidation( $(this) );
		});

		// BUTTON: add a class-resource
		rdform.on("click", "button.add-class-resource", function() {
			//var classModel = getClassModel( $(this).val() );
			var classModel = $.extend( true, {}, getClassModel( $(this).val() ) );
			classModel['multiple'] = $(this).attr("multiple");
			classModel['additional'] = $(this).attr("additional");
			classModel['argument'] = $(this).attr("argument");
			classModel['arguments'] = $(this).attr("arguments");
			classModel['name'] = $(this).attr("name"); 

			var thisClass = createHTMLClass( classModel );

			$(thisClass).hide();	
			$(this).before( thisClass );
			$(thisClass).show("slow");

			$(this).remove();

			findWildcardInputs( thisClass );

			return false;
		});

		// BUTTON: remove a class resource
		rdform.on("click", "button.remove-class", function() {
			var classContainer = $(this).parentsUntil("div.rdform-resource-group").parent();
			classContainer.remove();
			return false;
		});

		// BUTTON: duplicate a class
		rdform.on("click", "button.duplicate-class", function() {			
			var classContainer = $(this).parentsUntil("div.rdform-resource-group").parent().clone();
			var thisClass = classContainer.children("div[typeof]");			

			thisClass.find('input[type="text"]:not([value*="{"]):not([readonly])').val(""); // reset values
			thisClass.find('input[modvalue]').each(function() { // set wildcard inputs to default
				$(this).val( $(this).attr('modvalue') );
			});

			thisClass.children("legend").remove(); // remove class legend
			thisClass.find("div").removeClass("error");
			//classContainer.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');

			// rewrite index, radio input names index and references in wildcards
			var arguments = $.parseJSON( $(thisClass).attr('arguments') );
			++arguments['i'];
			$(thisClass).attr("arguments", JSON.stringify( arguments ) );

			// TODO dont need this anymore, instead obsolete cpl HOOK
			var index = $(thisClass).attr("index");
			++index;
			$(thisClass).attr("index", index);

			$(classContainer).hide();	
			$(this).parentsUntil("div.rdform-resource-group").parent().after( classContainer );
			$(classContainer).show("slow");
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
			//literalContainer.removeClass("error");
			//literalContainer.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');

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

		// find inputs with wildcard
		function findWildcardInputs( env ) {

			// text inputs with wildcard values -> bind handlers to dynamically change the value
			// TODO: doesnt work for dynamically added fields
			$(env).find('input[value*="{"]').each(function() {			
			//rdform.on("change", 'input[value*="{"]', function() {
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
				alert( 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
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
		rdform.find("button[type=reset]").click(function() {		
			$("#error-msg").hide();
			rdform[0].reset();
			// TODO: remove duplicates, selects ...
			$(".rdform-result").hide();
			$(".rdform-result textarea").val( "" );
			// TODO: remove duplicated datasets
		});

		// submit formular
		rdform.submit(function() {			
			$("#error-msg").hide();
			var proceed = true;

			// validate required inputs
			$("input[required]").each(function() {
				if ( $(this).val() == "" ) {
					$(this).parents(".form-group").addClass("error");
					$("#error-msg").text("Bitte alle rot hinterlegten Felder ausfüllen!");
					$("#error-msg").show();
					proceed = false;
				} else {
					$(this).parents(".form-group").removeClass("error");
				}
			});

			// proceed
			if ( proceed ) {
				$("button[type=submit]").html("Datensatz aktualisieren");
				//createClasses();
				createResult();

				outputResult();
			}

			return false;
		});

	} // end of initFormHandler	

	/**
	  * Walk every class (div[typeof]) in the HTML form to create the RESULT
	  *
	  * @return void
	  */
	createResult = function() {

		RESULT = new Array();

		rdform.children("div[typeof]").each(function( ci ) {
			createResultClass( $(this) );
		});

		if ( typeof __filterRESULT !== "undefined" )
			RESULT = __filterRESULT( RESULT );

		console.log( "Result = ", RESULT );
	}

	/**
	  * Add a class and its properties in the RESULT array
	  *
	  * @cls HTML DOM object of the current class
	  * @return the ID for this class or the return ID
	  */
	createResultClass = function( cls )  {

		var thisClass = new Object();
		var properties = new Array();

		// walk each property (div-group literal,resource,hidden)
		cls.children("div").each(function() {

			var property = new Object();

			if ( typeof __createResultClassProperty !== "undefined" )
				__createResultClassProperty( $(this) ); // TODO: give input or resource class

			// decide if its a hidden,literal or resource property
			if ( $(this).hasClass(_ID_ + "-hidden-group") ) {
				property = createResultHidden( $(this).find('input') );
			}
			else if ( $(this).hasClass(_ID_ + "-literal-group") ) {
				property = createResultLiteral( $(this).find('input,textarea,select') );
			}
			else if ( $(this).hasClass(_ID_ + "-resource-group") ) {
				property = createResultResource( $(this) );
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
		var wildcardsFct = replaceWildcards( classResource, $(cls), getWebsafeString );

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
			classResource = replaceWildcards( $(cls).attr("return-resource"), $(cls), getWebsafeString )['str'];
		}
		return classResource;
	}

	/**
	  * Create a hidden property for the RESULT
	  *
	  * @hidden HTML DOM Object of the current hidden input
	  * @return Object of this hidden property
	  */
	createResultHidden = function( hidden ) {
		var thisHidden = new Object();		

		thisHidden['type'] = 'hidden';

		var val = $(hidden).val();
		val = replaceWildcards( val, $(hidden).parentsUntil("div[typeof]").parent() )['str'];
		thisHidden['value'] = '"' + val + '"';
		
		var name = $(hidden).attr("name");
		thisHidden['name'] = name;

		return thisHidden;
	}

	/**
	  * Create a literal property (text,boolean,textarea) for the RESULT
	  *
	  * @literal HTML DOM Object of the current hidden input
	  * @return Object of this property
	  */
	createResultLiteral = function( literal ) {
		var thisLiteral = new Object();		

		var val = $(literal).val();

		if ( $(literal).attr("type") == "checkbox" ) {
			val = $(literal).prop("checked").toString();
		}
		//&& ( ( $(this).attr("type") == "radio" && $(this).prop("checked") || $(this).attr("type") != "radio" ) )

		switch ( $(literal).get(0).tagName ) {
			/*
			case 'INPUT' :
				break;

			case 'TEXTAREA' :
				break;
			*/

			case 'SELECT' :
				val = $( ":selected", $(literal) ).val();
				break;

		}

		if ( val != "" ) {

			thisLiteral['type'] = 'literal';

			var name = $(literal).attr("name");
			thisLiteral['name'] = name;

			if ( $(literal).attr("datatype") ) {
				thisLiteral['datatype'] = $(literal).attr("datatype");
			}
			
			val = replaceWildcards( val, $(literal).parentsUntil("div[typeof]").parent() )['str'];
			thisLiteral['value'] = '"' + val + '"';
		}		

		return thisLiteral;
	}

	/**
	  * Create a resource-class property for the RESULT
	  *
	  * @env HTML DOM Object of the current resource group
	  * @return Object of this resource property
	  */
	createResultResource = function( env ) {

		var resource = new Object();
		var resourceID = false;
		var resourceGroup;
		
		// search for a normal resource class children
		resourceGroup = $(env).children('div[typeof]');
		if ( resourceGroup.length > 0 ) { 
			// create a new class for this resource and take its return ID
			resourceID = createResultClass( resourceGroup );
		}
		// search for a external resource input
		else if ( $(env).find('input[external]').length > 0 ) {
			resourceGroup = $(env).find('input[external]');			
			resourceID = replaceWildcards( $(resourceGroup).val(), $(env).parent("div[typeof]"), getWebsafeString )['str'];
		}

		if ( resourceID ) {
			resource['type'] = 'resource';
			resource['value'] = resourceID;
			resource['name'] = $(resourceGroup).attr("name");
		}

		return resource;
	}

	/**
	  *	Create result string from baseprefix, prefixes and RESULT array and output it in the result textarea
	  *
	  * @return void
	  */
	outputResult = function() {
		var resultStr = "";

		if ( BASEPREFIX != "" ) {
			resultStr += "@base <" + BASEPREFIX + "> .\n";
		}

		//create prefixes
		for ( var prefix in PREFIXES ) {
			resultStr += "@prefix " + prefix + ": <" + PREFIXES[prefix] + "> .\n";
		}

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
		
		$(".rdform-result").show();
		$(".rdform-result textarea").val( resultStr );		
		var lines = resultStr.split("\n");
		$(".rdform-result textarea").attr( "rows" , ( lines.length ) );
		$('html, body').animate({ scrollTop: $(".rdform-result").offset().top }, 200);		

	} // end of creating result


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
	replaceWildcards = function( str, envClass, strFct ) {
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
					alert( 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
					continue;
				}

				switch ( wcdVal.attr("type") ) {

					case 'checkbox' :
						wcdVal = ( wcdVal.val() != "" ) ? wcdVal.val() : wcdVal.prop("checked").toString();
						break;

					default :
						//wcdVal = wcdVal.val();
						wcdVal = replaceWildcards( wcdVal.val(), env )['str'];
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
	}

	/**
	  * Validate if a string as a prefix which is defined in the form
	  *
	  * @str String to check
	  * @return Boolean if its valid or null if the string does not has any prefix
	  */
	validatePrefix = function( str ) {

		if ( str.search(":") != -1 ) {
			str = str.split(":")[0];
		} else {
			return null;
		}

		for ( var prefix in PREFIXES ) {
			//resultStr += "@prefix " + prefix + " <" + PREFIXES[prefix] + "> .\n";
			if ( str == prefix ) {
				return true;
			}
		}
		console.log( "Prefix \"" + str + "\" not defined in the form model (see attribute 'prefix')" );
		return false;
	}

	/*
	TODO: maybe write this helper function:
	getParentClass = function( env ) {
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
	getWebsafeString = function ( str ) {
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
		return str.replace(/[^a-z0-9-_]/gi,'');
	}

	/*
	 * Validate and correct input values depending on the datatype after user changed the value
	 *
	 * @property DOM object with input element
	 * @return void
	 */
	userInputValidation = function ( property ) {	
		
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
		$(property).val( value );
	}

	/**
	  * Translate a string
	  *
	  * @str The string to translate. It can contain the l-function, that l(...) will be replaced
	  * @param String. If given, %s in str will be replaced with param
	  *
	  * @return String. The translated string
	  */
	l = function( str, param ) {

		console.log( str );

		if ( typeof str === "string" && str != "" ) {

			str = str.replace(/l\((.*)\)/, '$1');

			if ( typeof TRANSLATIONS === "object" && TRANSLATIONS[str] ) {
				str = TRANSLATIONS[str];
			}

			if ( typeof param !== undefined ) {
				str = str.replace( /%s/g, param );
			}
		}
		return str;
	}

}( jQuery ));