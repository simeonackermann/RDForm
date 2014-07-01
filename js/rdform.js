(function ( $ ) {
	/**
	  * default plugin settings
	  */
	var settings = {
		model: "form.html",
		hooks: "js/hooks.js"
	}	

	/**
	  * init default variables
	  */
	var _ID_ = "rdform"; // TODO: add id to html form
	var rdform; // rdform DOM object
	//var PREFIXES = new Array();	// RDF prefixes	
	var PREFIXES = new Object();	// RDF prefixes	
	var MODEL = new Array();
	var RESULT = new Array();

	
	/**
	  * plugin base constructor
	  *
	  * @param[] options
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

		// loading hooks js file
		$.getScript( settings.hooks )
			.fail(function( jqxhr, type, exception ) {
    			//$( "div.log" ).text( "Triggered ajaxError handler." );
    			alert('Error on loading JavaScript hooks file "'+settings.hooks+'". Is the filename right?');
			})
			.done(function() {			
				setRDForm( rdform ); // set rdform var in hooks file
				
				$.ajax({ 
					url: settings.model,
					type: "GET",
					dataType: "text",
					success: function( model ) {
						parseFormModel( 'rdform', model )
						
						rdform.append( createHTMLForm() );

						rdform.append(	'<div class="form-group"><div class="col-xs-12 text-right">' + 
											'<button type="reset" class="btn btn-default">zurücksetzen</button> ' + 
											'<button type="submit" class="btn btn-lg btn-primary">Datensatz anlegen</button>' + 
										'</div></div>' );
						initFormHandler();
					},
					error: function() {
						alert('Error when calling data model file "'+settings.model+'". Is the filename right?');
					}
				});
		});

		// add result div
		rdform.after( '<div class="row rdform-result"><legend>Ergebnis</legend><div class="col-xs-12"><textarea class="form-control" rows="10"></textarea></div></div>' );

    	return this;
	};

	parseFormModel = function( type, model ) {
		switch (type) {
			case 'rdform':
				return ( parseRDFormModel( model ) );
				break;
			default:
				alert( "Unknown model type \"" + type  + "\"" );
				break;
		}
	}


	/**
	  *	Parse form modell config file from user and build HTML formula
	  *
	  * @param model Modell as a string from config file
	  * @return DOM model
	  */
	parseRDFormModel = function( data ) {
		var dom_model = $.parseHTML( data );

		if ( $(dom_model).attr("prefix") ) {
			var prefixesArr = $(dom_model).attr("prefix").split(" ");
			if ( prefixesArr.length % 2 != 0 ) {
				alert( "Invalid prefix attribute format. Use: 'prefix: URL prefix: URL ...'" );
			}
			for (var i = 0; i < prefixesArr.length - 1; i += 2) {
				PREFIXES[ prefixesArr[i] ] = prefixesArr[i+1];
			}
		}	

		$(dom_model).children('div[typeof]').each(function() {
			var curClass = new Object();
			var properties = new Array();	

			curClass['typeof'] = $(this).attr("typeof"); // TODO: test if all importants attrs exists !!!
			curClass['resource'] = $(this).attr("resource"); 
			curClass['legend'] = $(this).prev("legend").text();

			validatePrefix( curClass['typeof'] );

			$(this).children('input').each(function() {
				var curProperty = new Object();

				if ( ! $(this).attr("type") ) {
					$(this).attr("type", "literal");
					console.log( "Model parsing exception: type attribute in property \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\" is not set. I manually added it as literal..." );
				}				

				curProperty['type'] = $(this).attr("type");
				curProperty['name'] = $(this).attr("name");
				curProperty['value'] = $(this).val();

				validatePrefix( curProperty['name'] );

				var success = true;
				switch ( curProperty['type'] ) {
					case "literal":
						// TODO use a function to get all attributes
						// -> http://stackoverflow.com/questions/14645806/get-all-attributes-of-an-element-using-jquery
						curProperty['datatype'] = $(this).attr("datatype");
						curProperty['placeholder'] = $(this).attr("placeholder");
						curProperty['required'] = $(this).attr("required");
						curProperty['readonly'] = $(this).attr("readonly");
						curProperty['autocomplete'] = $(this).attr("autocomplete");
						curProperty['label'] = $(this).prev("label").text();

						if ( $(this).attr("autocomplete") !== undefined )  {
							curProperty['query-endpoint'] = $(this).attr("query-endpoint");
							curProperty['query-apitype'] = $(this).attr("query-apitype");
							curProperty['query'] = $(this).attr("query");
						}

						break;

					case "boolean" :						
						curProperty['datatype'] = $(this).attr("datatype");
						curProperty['checked'] = $(this).attr("checked");
						curProperty['label'] = $(this).prev("label").text();
						break;

					case "resource":
						// TODO: test if resource class exists
						curProperty['typeof'] = curClass['typeof'];
						curProperty['title'] = $(this).attr("title");						
						curProperty['multiple'] = $(this).attr("multiple"); 
						curProperty['additional'] = $(this).attr("additional");
						curProperty['argument'] = $(this).attr("argument");

						if ( $(dom_model).find('div[typeof="'+$(this).val()+'"]').length < 1 ) {
							alert( "Couldnt find the class \"" + $(this).val() + "\" in the form model... ;( \n\n I will ignore the resource \"" + $(this).attr("name") + "\" in \"" + curClass['typeof'] + "\"." );
							success = false;
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
						&& thisProperty['value'] == MODEL[mi]['typeof'] 
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

		/**
		  * OBSOLETE PARSER
		  */
		{

			//$(dom_model).find("div[typeof]").addClass("form-group"); // add row-fluid to every class

			// parse resource properties as hidden
			$(dom_model).find('input[type="resource"]').attr("resource", "resource");
			$(dom_model).find('input[type="resource"]').attr("type", "hidden");

			// add type="text" to literal inputs
			//$(dom_model).find('input').not("[type]").attr("type", "text");
			$(dom_model).find('input[type="literal"]').attr("type", "text");

			// parse global variables
			$(dom_model).find('input[type="global"]').attr("global", "global");
			$(dom_model).find('input[type="global"]').attr("type", "hidden");
			
			// wrap not hidden inputs
			//$(dom_model).find('input[type!="hidden"]').wrap('<div class="span10"><div class="control-group"><div class="controls"></div></div></div>');
			$(dom_model).find('input[type!="hidden"]').wrap('<div class="form-group"><div class="col-xs-9"></div></div>');
			$(dom_model).find('input[type="text"]').addClass("form-control input-sm");

			// put legens into classes
			$(dom_model).find("legend").each(function() {
				$(this).next("div").prepend( $(this) );
			})

			// add label class and move labels into control groups
			$(dom_model).find("label").each(function() {
				$(this).addClass("col-xs-3 control-label");
				//$(this).next("div").children("div").prepend( $(this) );
				$(this).next("div").prepend( $(this) );
			})

			// add offset to inputs without label
			$(dom_model).find(".form-group").each(function() {
				if ( $(this).find(".control-label").length == 0 ) {
					$(this).find(".col-xs-9").addClass("col-xs-offset-3");
				}
			});

			// radio labels
			$(dom_model).find("input:radio").each(function() {
				$(this).wrap('<label class="radio">');
				$(this).after( $(this).attr("label") );
			})

			// TODO: implement checkbox

			// add small inputs
			var smallInput = $(dom_model).find('input[datatype*="date"]');
			//smallInput.addClass("input-small");
			//smallInput.parents(".span10").removeClass("span4").addClass("span4");
			smallInput.parents(".col-xs-9").removeClass("col-xs-9").addClass("col-xs-3");

			// multiple classes
			$(dom_model).find("div[multiple]").each( function() {
				// TODO: replace references in other inputs in same classes
				$(this).attr("index", "1" );
				$(this).find('input[type=radio]').each(function() {
					var regex = new RegExp( $(this).attr("name") + '\}', "g");
					$(this).parents("div[typeof]").attr("resource", $(this).parents("div[typeof]").attr("resource").replace( regex , $(this).attr("name") + "-1}" ) );				
					$(this).attr("name", $(this).attr("name") + "-1" );				
				})

				$(this).append('<p class="col-xs-offset-3"><button type="button" class="btn btn-default btn-xs duplicate-dataset"><span class="glyphicon glyphicon-plus"></span> hinzufügen</button></p>');
			});

			// select classes
			$(dom_model).find("div[select]").each( function(){
				var selectElem = $('<select class="form-control"><option disabled selected>Klasse wählen...</option></select>');
				var selectTypeof = $(this).attr("typeof");

				$(this).children("div[typeof]").each(function() {
					$(this).attr("subclassof", selectTypeof);

					var t = $(this).attr("typeof");

					if ( $(this).find("legend").length ) {
						t = $(this).find("legend").text() + " - " + t;
					}				
					selectTemplates[t] = $(this);
					$(selectElem).append('<option value="'+t+'">'+t+'</option>');

					$(this).remove();
				})
				$(this).append( selectElem );
				$(this).addClass("form-group");
				$(this).find("select").wrap('<div class="col-xs-6"></div>');
			})

		}

		return $(dom_model).html();
		
	} // end of parseFormModel

	/**
	  * Get the model of a class by the class name (typeof)
	  *
	  */
	getClassModel = function( classTypeof ) {
		var classModel = false;
		for ( mi in MODEL ) {
			if ( MODEL[mi]['typeof'] == classTypeof ) {
				classModel = MODEL[mi];
				break;
			}
		}
		if ( ! classModel ) {
			alert( "Class \"" + classTypeof + "\" doesnt exists but refered..." );
		}
		return classModel;

	}

	createHTMLForm = function() {

		var elem = $('<form></form>');
		
		for ( var mi in MODEL ) {
			if ( MODEL[mi]['isRootClass'] ) {				
				elem.append( createHTMLClass( MODEL[mi] ) );
			}
		}

		return elem.html();
	}

	createHTMLClass = function( dataClass ) {		
		/* TODO: max depth
		if( typeof(depth) === 'undefined' ) var depth = 0;
		depth += 1;
		if ( depth > 1 ) {
			console.log( "Reached max class depth." );
			return "";
		} */

		var thisClass = $("<div></div>");
		thisClass.attr( {
			'id': _ID_ + '-class-' + dataClass['typeof'], // TODO: sub-ID ... (e.g. Person/Forename)
			'class': _ID_  + '-class-group',
		});		
		
		var attrs = $.extend( true, {}, dataClass );
		delete attrs['properties'];
		thisClass.attr( attrs );
		
		var thisLegend = $( "<legend>"+ dataClass['legend'] +"</legend>" );
		if ( dataClass['name'] ) {
			thisLegend.prepend( "<small>"+ dataClass['name'] + "</small> " );
		}
		thisClass.append( thisLegend );		

		for ( var pi in dataClass['properties'] ) {
			var property =  dataClass['properties'][pi];
			thisClass.append( createHTMLProperty( property ) );						
		}

		if ( dataClass['multiple'] ) {
			thisClass.attr('index', 1);
			thisClass.append('<button type="button" class="btn btn-default btn-xs duplicate-class" title="Klasse '+dataClass['typeof']+' duplizieren"><span class="glyphicon glyphicon-plus"></span> hinzufügen</button>');
		}

		return thisClass;
	}
	
	createHTMLProperty = function( property ) {

		var thisProperty;

		switch ( property['type'] ) {

			case "hidden":
				thisProperty = $( '<div class="'+_ID_+'-hidden-group"><input type="hidden" name="'+ property['name'] +'" id="" value="'+ property['value'] +'" /></div>' );
				break;

			case "literal":
				thisProperty = createHTMLiteral( property );
				break;

			case "boolean":
				thisProperty = createHTMLiteral( property );
				break;

			case "resource":
				thisProperty = createHTMLResource( property );
				break;			

			default:
				alert("Unknown property type \""+property['type']+"\" detected on creating HTML property.");
				break;

		}
		return thisProperty;
	}

	createHTMLiteral = function( literal ) {

		var thisFormGroup = $('<div class="form-group '+_ID_+'-literal-group"></div>');
			
		// TODO: add ID and sub-ID
		//curPropertyID = _ID_ + '-property-' +  literal['typeof'] + "/" + curProperty['name']

		var thisLabel = $("<label></label>");
		thisLabel.attr({
			//'for': curPropertyID,
			'class': 'col-xs-3 control-label'
		});
		thisLabel.text( literal['label'] );
		thisFormGroup.append( thisLabel );

		var thisInputContainer = $('<div class="col-xs-9"></div>');		

		var thisInput = $("<input />");
		thisInput.attr({
			//'type': literal['type'],
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

		switch ( literal['type'] ) {
			case "literal" :
				thisInput.attr( "type", "text" );
				break;

			case "boolean" :
				thisInput.attr( "type", "checkbox" );
				thisInputContainer.addClass( "checkbox" );
				thisInput.removeClass( "form-control input-sm" );
				thisInput = $("<label></label>").append( thisInput );
				thisInput.append( literal['label'] );
				thisLabel.text( "" );
				break;

			default :
				alert("Unknown literal type \"" + literal['type'] + "\" detected on creating HTML form.");
				return $();
		}

		thisInputContainer.append( thisInput );
		thisFormGroup.append( thisInputContainer );

		return thisFormGroup;
	}

	createHTMLResource = function( resource ) {		

		var curFormGroup = $('<div class="form-group '+_ID_+'-resource-group"></div>');

		if ( resource['typeof'] == resource['value'] || typeof(resource['additional']) !== "undefined" ) {					
			var btnText = resource['title'] ? resource['title'] : "add " + resource['name'] + " - " + resource['value'];			
			var resourceClass = $(	'<button type="button" class="btn btn-default add-class-resource" name="'+ resource['name'] +'" value="'+ resource['value'] +'">' + 
										'<span class="glyphicon glyphicon-plus"></span> '+ btnText +
									'</button>' );
		} else {
			var classModel = $.extend( true, {}, getClassModel(resource['value']) );
			classModel['name'] = resource['name'];
			classModel['multiple'] = resource['multiple'];
			var resourceClass = createHTMLClass( classModel );
		}
		
		resourceClass.attr( resource );
		curFormGroup.append( resourceClass );

		return curFormGroup;

	}

	/*
	 *	Init form button handlers after building the form
	 */
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

		__initFormHandlers();		

		// validate input values on change
		rdform.find("input").change(function() {
			userInputValidation( $(this) );
		});

		// duplicate dataset button
		rdform.on("click", ".duplicate-class", function() {			
			var classContainer = $(this).parentsUntil("div.rdform-resource-group").parent().clone();
			var thisClass = classContainer.children("div[typeof]");			

			classContainer.find('input[type="text"]').val(""); // reset values
			classContainer.children().children("legend").remove(); // remove class legend
			classContainer.find("div").removeClass("error");
			//classContainer.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');

			// rewrite index, radio input names index and references in wildcards
			var index = $(thisClass).attr("index");
			++index;
			$(thisClass).attr("index", index);

			$(classContainer).hide();	
			$(this).parent().parent("div.rdform-resource-group").after( classContainer );
			$(classContainer).show("slow");
			$(this).remove(); // remove duplicate btn

			__afterDuplicateClass( thisClass );

			return false;
		});

		rdform.on("click", ".add-class-resource", function() {
			//var classModel = getClassModel( $(this).val() );
			var classModel = $.extend( true, {}, getClassModel( $(this).val() ) );
			classModel['multiple'] = $(this).attr("multiple");;
			classModel['argument'] = $(this).attr("argument");
			classModel['name'] = $(this).attr("name"); 

			var thisClass = createHTMLClass( classModel );

			$(thisClass).hide();	
			$(this).before( thisClass );
			$(thisClass).show("slow");

			$(this).remove();

			return false;
		});

		// text inputs with wildcard values -> bind handlers to dynamically change the value
		// TODO: doesnt work for dynamically added fields
		rdform.find('input[value*="{"]').each(function() {			
			var wildcards = new Object();
			var thisInput = $(this);
			var envClass = $(this).parentsUntil("div[typeof]").parent();
			$(this).attr("modvalue",  $(this).val() );			

			var strWcds = $(this).val().match(/\{[^\}]*/gi);
			for ( var i in strWcds ) {				
				var wcd = strWcds[i].substring( 1 );	

				wildcards[wcd] = getWildcardTarget( wcd, envClass );	

				$(wildcards[wcd]).keyup(function() {

					writeWildcardValue( thisInput, wildcards );

				});

				if ( wildcards[wcd].val().search(/\{.*\}/) == -1 ) {
					$(wildcards[wcd]).trigger( "keyup" );
				}
			}
		});


		function getWildcardTarget( wcd, envClass ) {

			var wcdTarget = envClass.find('input[name="'+wcd+'"]');

			if ( wcdTarget.length == 0 && envClass.attr( "argument" ) ) {
				var args = envClass.attr( "argument" ).split(" ");
				for ( var ai in args ) {
					var thisArg = args[ai].split(":");
					if ( wcd == thisArg[0] ) {
						thisArg[1] = thisArg[1].replace(/[{}]/g, '');

						wcdTarget = getWildcardTarget( thisArg[1], envClass.parentsUntil("div[typeof]").parent() );
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


		function writeWildcardValue( src, wildcards ) {
			var val = $(src).attr("modvalue");

			for ( wcd in wildcards ) {
				if ( wildcards[wcd].val() != "" ) {
					var regex = new RegExp( '\{' + wcd + '\}', "g");
					val = val.replace( regex, wildcards[wcd].val() );
				}

			}
			$(src).val( val.trim() );

			if ( $(src).attr("type") == "hidden" ) {
				$(src).trigger( "keyup" );
			}

		}

		//select class, add selected template before
		/*
		rdform.find("div[select] select").change(function() {			
			selectTemplates[$(this).val()].hide();
			$(this).parents("div[select]").before( selectTemplates[$(this).val()] );
			selectTemplates[$(this).val()].show("slow");
			$(this).children('option[value="'+$(this).val()+'"]').attr("disabled", "disabled");
		})
		*/

		//autocomplete
		// TODO BUG doesnt work on additional resource class/multiple
		rdform.find('input[autocomplete]').each( function() {	
			var queryEndpoint = $(this).attr( "query-endpoint" );
			var queryStr = $(this).attr("query");
			$(this).autocomplete({
				source: function( request, response ) {		
					queryStr = queryStr.replace(/%s/g, "'" + request.term + "'");
					$.ajax({
						url: queryEndpoint,
						dataType: "json",
						data: {
							//'default-graph-uri': "http%3A%2F%2Fdbpedia.org",
							query: queryStr,
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

	createResult = function() {

		RESULT = new Array();

		rdform.children("div[typeof]").each(function( ci ) {

			createResultClass( $(this) );

		})

		console.log( "Result = ", RESULT );

	}

	createResultClass = function( cls )  {

		var thisClass = new Object();
		var properties = new Array();

		cls.children("div").each(function() {

			var property = new Object();

			__createResultClassProperty( $(this) ); // TODO: give input or resource class

			if ( $(this).hasClass(_ID_ + "-hidden-group") ) {

				property = createResultHidden( $(this).find('input') );

			}
			else if ( $(this).hasClass(_ID_ + "-literal-group") ) {

				property = createResultLiteral( $(this).find('input') );

			}
			else if ( $(this).hasClass(_ID_ + "-resource-group") ) {

				property = createResultResource( $(this) );

			}
			else {
				console.log("Unknown RDForm group. Class = " + $(this).attr("class") );
			}

			if ( ! $.isEmptyObject( property ) ) {
					properties.push( property );
			}

		}); // end walk properties

		if ( properties.length == 0 ) {
			console.log( 'Skip class "' + $(cls).attr("typeof") + '" because it has no properties' );
			return false;
		}

		thisClass['properties'] = properties;

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

		return classResource; // class resource ID
	}

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

	createResultLiteral = function( literal ) {
		var thisLiteral = new Object();		

		var val = $(literal).val();

		if ( $(literal).attr("type") == "checkbox" ) {
			val = $(literal).prop("checked").toString();
		}
		//&& ( ( $(this).attr("type") == "radio" && $(this).prop("checked") || $(this).attr("type") != "radio" ) )

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

	createResultResource = function( env ) {

		var resource = new Object();
		var resourceID = false;

		var resourceGroup = $(env).children('div[typeof]');
		if ( resourceGroup.length > 0 ) { 
			resourceID = createResultClass( resourceGroup );
		}

		if ( resourceID ) {
			resource['type'] = 'resource';
			resource['value'] = resourceID;
			//resource['name'] = $(env).find('input').attr("name");
			resource['name'] = $(resourceGroup).attr("name");
		}

		return resource;
	}

	/* OBSOLETE!
	 * Create result classes array with class and properties
	 */
	createClasses = function() { // rdform
		// reset class Array
		classes = new Array();			

		/* walk through every class in form */
		rdform.find("div[typeof]").each(function( ci ) {
		//$(rdform).find("div[typeof]").each(function( ) {			
			var curClass = new Object();
			var properties = new Array();
			var tmpResources = new Array();

			//$(this).filter( $(this).find('input') ).attr('checked', true);
			//$(this).find('input').filter( ":radio" );
			
			/* walk through every class-property (inputs) */
			$(this).find('input').each(function( ) {
				var property = new Object();

				__createClassProperty( $(this) );

				// store not empty properties and resources
				if ( $(this).val() != ""
					// TODO: filter not checked radio buttons a better way
					&& ( ( $(this).attr("type") == "radio" && $(this).prop("checked") || $(this).attr("type") != "radio" ) )
					) {

					var propVal = $(this).val();
					var propName = $(this).attr("name");

					// if its a multiple class radio input remove -index
					if ( $(this).parents("div[typeof]").attr("multiple") && $(this).attr("type") == "radio" ) {
						propName = propName.replace(/-\d+$/, '');
					}

					property['name'] = propName;

					if ( $(this).attr("resource") ) {	// its a resource property
						property['resource']= propVal;
						tmpResources.push( property );

					} else if ( $(this).attr("global") ) { // its a global var
						propVal = replaceWildcards( propVal, $(this).parents("div[typeof]"), getWebsafeString )['str'];
						GLOBALS[propName] = propVal;

					} else { // its a regular property
						if ( $(this).attr("datatype") ) {
							property['datatype'] = $(this).attr("datatype");
						}
						propVal = replaceWildcards( propVal, $(this).parents("div[typeof]") )['str'];

						property['value'] = '"' + propVal + '"';
						properties.push( property );
					}
				} // end not empty property

			}); // end walk through properties			

			// dont save classes without any property
			if ( properties.length == 0 ) {
				console.log( 'Skip class "' + $(this).attr("typeof") + '" because it has no properties' );
				return true;
			}

			// add properties to current class 
			curClass['properties'] = properties;

			// add tmp resources to current class
			curClass['tmpResources'] = tmpResources;

			//* generate current class */
			__createClass( $(this) );
			var classID = $(this).attr("resource");			

			var wildcardsFct = replaceWildcards( classID, $(this), getWebsafeString );

			// dont save classes with wildcard pointers when every value is empty
			if ( classID.search(/\{.*\}/) != -1 && wildcardsFct['count'] == 0 ) {
				console.log( 'Skip class "' + $(this).attr("typeof") + '" because it has wildcards, but every pointer property is empty. Resource value is "' + classID + '"' );
				return true;
			}
			classID = wildcardsFct['str'];
			curClass['classID'] = classID;

			var classTypeof = $(this).attr("typeof");
			curClass['typeof'] = classTypeof;

			// if its a subclass (eg in a select class)
			if ( $(this).attr("subclassof") ) {
				curClass['subClassOf'] = $(this).attr("subclassof");
			} else {
				curClass['subClassOf'] = null;
			}

			// add current class to global classes
			classes.push( curClass );			

			/* use tmpResources to find
			   if current class is a property (resource) of another class add resource-properties to this class */
			for ( var tRCi in classes ) {
				for ( var tRi in classes[tRCi]['tmpResources'] ) {
					var property = new Object();
					var tmpResource = classes[tRCi]['tmpResources'][tRi];					
					if ( tmpResource['resource'].match( curClass['typeof'] ) 
						|| tmpResource['resource'].match( curClass['subClassOf'] ) // TODO MAYBE, do suClassOf (select class) another way
						) {
						property['name'] = tmpResource['name']; 
						property['value'] = curClass['classID'];
						classes[tRCi]['properties'].push( property );
					}
				}
			}

		}); // end walk through classes

		//console.log( GLOBALS );
		
		outputResult();

	} // end of creating classes	

	/*
	 *	Create result string and output in result textarea
	 */
	outputResult = function() {
		var resultStr = "";

		//create prefixes
		for ( var prefix in PREFIXES ) {
			resultStr += "@prefix " + prefix + ": <" + PREFIXES[prefix] + "> .\n";
		}

		// output classes
		for ( var ci in RESULT ) {
			resultStr += "\n" + RESULT[ci]['resource'] + " a " + RESULT[ci]['typeof'] + " ;\n";

			for ( var pi in RESULT[ci]['properties']) {
				var property = RESULT[ci]['properties'][pi];

				if ( property['type'] == 'hidden' ) continue;

				resultStr += "	" + property['name'] + " " + property['value'];
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


	/* helper functions */

	/*
	 * Replacing wildcards {...} with the value of the property in the domain
	 *
	 * @str String value with the wildcards
	 * @domain DOM element where to find inputs (properties)
	 * @adaptFct passing wildcard value to that function
	 * 
	 * return Object. Keys: 'str', 'count'
	 */
	replaceWildcards = function( str, envClass, strFct ) {
		var counted = 0;

		if ( str.search(/\{.*\}/) != -1 ) {

			var strWcds = str.match(/\{[^\}]*/gi);
			for ( var i in strWcds ) {
				var wcd = strWcds[i].substring( 1 );
				var env = envClass;

				var wcdVal = env.find('input[name="'+wcd+'"]');

				if ( wcdVal.length == 0 && env.attr( "argument" ) ) {
					var args = env.attr( "argument" ).split(" ");
					for ( var ai in args ) {
						var thisArg = args[ai].split(":");
						if ( wcd == thisArg[0] ) {
							wcdVal = $( '<input type="hidden" name="' + thisArg[0] + '" value="' + thisArg[1] + '" />' );
							env = envClass.parentsUntil("div[typeof]").parent();
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
					case 'hidden' :
						wcdVal = replaceWildcards( wcdVal.val(), env )['str'];
						break;

					case 'checkbox' :
						wcdVal = ( wcdVal.val() != "" ) ? wcdVal.val() : wcdVal.prop("checked").toString();
						break;

					default :
						wcdVal = wcdVal.val();
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
		return new Object( { 'str' : str.trim(), 'count' : counted } );
	}

	/*
		

	(function($) {

		var oldattr = $.fn.attr;

		$.fn.attr = function() {

			if( arguments.length == 1 ) {

				if ( typeof arguments === 'object' ) {
					console.log( "my attr ", arguments );
					//return this[0];
				} 

			}

			return oldattr.apply(this, arguments);

		};

	})($);

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
	TODO: write this helper function...
	getParentClass = function( env ) {
		var thisClass = env.parentsUntil("div[typeof]").parent().clone();
		thisClass.find( "div[typeof]" ).remove();
		return thisClass;
	}
	*/
	

	/* 
	 *	Remove accents, umlauts, special chars, ... from string
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

		//return str.replace(/[^a-z0-9-_]/gi,'');
		return str;
	}

	/*
	 *	Validate and correct input values depending on the datatype after user changed the value
	 *
	 * @property DOM object with input element
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

	

}( jQuery ));