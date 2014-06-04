(function ( $ ) {
	/**
	  * default plugin settings
	  *
	  */
	var settings = {
		model: "form.html",
		hooks: "js/hooks.js"
	}	

	// init default vars
	var rdform;
	var prefixes = new Array();	// RDF prefixes
	var classes = new Array(); // classes erray
	var globals = new Object(); // gloabel variables
	var selectTemplates = new Object(); // templates for select classes

	/*
	structure of classes array:
	[] => (
		['classID'] = class ID (attr=resource),
		['typeof'] = type of class,
		['properties']=> (
						[] => (
							['name'] = Property name,
							['value']	 = Property value,
							['datatype']= Property datatype or not defined
						),
					)
		),
		['subClassOf'] = parent classname (for select classes) or null
		['tmpProperties'] => (
							[] => (
								['value'] = property name (e.g. cpm:has-period),
								['resource'] = resource value (e.g. cpm:Career)
							),
		),			
	),
	*/
	
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

    	$.getScript( settings.hooks )
  			.done(function( script, textStatus ) {
    			console.log( textStatus );
  			})
  			.fail(function( jqxhr, type, exception ) {
    			//$( "div.log" ).text( "Triggered ajaxError handler." );
    			alert('Error on loading JavaScript hooks file "'+settings.hooks+'". Is the filename right?');
		});

    	$.ajax({ 
			url: settings.model,
			type: "GET",
			dataType: "text",
			success: function( model ) {
				parseFormModel( model );
			},
			error: function() {
				alert('Error when calling data model file "'+settings.model+'". Is the filename right?');
			}
		});

		

    	//return this;
	};


	/*
	 *	Parse form modell config file from user and build HTML formula
	 *
	 *	@model Modell as a string from config file
	 */
	parseFormModel = function( model ) {
		// regexp: http://de.selfhtml.org/perl/sprache/regexpr.htm#merken
		// rdfa http://www.w3.org/TR/xhtml-rdfa-primer/#setting-a-default-vocabulary
		var dom_model = $.parseHTML( model );

		if ( $(dom_model).attr("prefix") ) {
			prefixes = $(dom_model).attr("prefix").split(" ");
		}

		// TODO: maybe without each..., just $(dom_model).find("div[typeof]").addClass("row-fluid");

		$(dom_model).find("div[typeof]").addClass("row-fluid"); // add row-fluid to every class

		// parse resource properties
		$(dom_model).find('input[type="resource"]').attr("resource", "resource");
		$(dom_model).find('input[type="resource"]').attr("type", "hidden");

		// add type="text" to other inputs
		//$(this).find('input[type!="hidden"]').attr("type", "text");
		$(dom_model).find('input').not("[type]").attr("type", "text");

		// parse global variables
		$(dom_model).find('input[type="global"]').attr("global", "global");
		$(dom_model).find('input[type="global"]').attr("type", "hidden");
		
		// wrap not hidden inputs
		$(dom_model).find('input[type!="hidden"]').wrap('<div class="span10"><div class="control-group"><div class="controls"></div></div></div>');

		// put legens into classes
		$(dom_model).find("legend").each(function() {
			$(this).next("div").prepend( $(this) );
		})

		// add label class and move labels into control groups
		$(dom_model).find("label").each(function() {
			$(this).addClass("control-label");
			$(this).next("div").children("div").prepend( $(this) );
		})

		// radio labels
		$(dom_model).find("input:radio").wrap('<label class="radio"><label>');
		$(dom_model).find("input:radio").each(function() {
			$(this).after( $(this).attr("label") );
		})

		// TODO: checkbox

		// add small inputs
		var smallInput = $(dom_model).find('input[datatype*="date"]');
		smallInput.addClass("input-small");
		smallInput.parents(".span10").removeClass("span4").addClass("span4");

		// multiple classes
		$(dom_model).find("div[multiple]").each( function() {
			// TODO: replace references in other inputs in same classes
			$(this).attr("index", "1" );
			$(this).find('input[type=radio]').each(function() {
				var regex = new RegExp( $(this).attr("name") + '\}', "g");
				$(this).parents("div[typeof]").attr("resource", $(this).parents("div[typeof]").attr("resource").replace( regex , $(this).attr("name") + "-1}" ) );				
				$(this).attr("name", $(this).attr("name") + "-1" );				
			})

			$(this).append('<div class="span10"><a class="btn btn-mini duplicate-dataset" href="#"><i class="icon-plus"></i> hinzufügen</a></div>');
		});

		// select classes
		$(dom_model).find("div[select]").each( function(){
			var selectElem = $("<select><option disabled selected>Klasse wählen...</option></select>");
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
		})

		// add to form
		rdform.prepend( $(dom_model).html() );
		rdform.prepend( '<div class="row-fluid"><p id="error-msg" class="alert alert-error span6 hide"></p></div>' );				

		initFormHandler();
		
	} // end of parseFormModel

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

		// validate input values
		$("form.rdform input").change(function() {
			userInputValidation( $(this) );
		});

		// duplicate dataset button
		$("form.rdform").on("click", ".duplicate-dataset", function() {
			var dataset = $(this).parents("div[typeof]").clone();			
			dataset.find('input[type="text"]').val(""); // reset values
			dataset.find("legend").remove(); // remove labels
			//dataset.find("input").removeAttr("required"); // remove requiered attribute // TODO: maybe dont remove it, jus break empty classes
			dataset.find("div").removeClass("error");
			//dataset.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');

			// rewrite index, radio input names index and references in wildcards
			var index = $(dataset).attr("index");
			++index;
			$(dataset).attr("index", index);
			$(dataset).find('input[type="radio"]').each(function() {
				var newRadioName = $(this).attr("name").replace(/\d+$/, index);
				$(this).parents("div[typeof]").attr("resource", $(this).parents("div[typeof]").attr("resource").replace( $(this).attr("name"), newRadioName ) );
				$(this).attr("name", newRadioName );
			});

			//dataset.insertBefore( $(this) );		
			$(dataset).hide();	
			$(this).parents("div[typeof]").after( dataset );
			$(dataset).show("slow");
			$(this).parent().remove(); // remove duplicate btn

			__afterDuplicateDataset( dataset );

			return false;
		});

		// text inputs with wildcard values -> bind handlers to dynamically change the value
		$('form.rdform').find('input[type="text"][value*="{"]').each(function() {
			var wcdPointerVals = new Object();
			var wildcardTxtInput = $(this);
			$(this).attr("modvalue",  $(this).val() );

			var strWcds = $(this).val().match(/\{[^\}]*/gi);
			for ( var i in strWcds ) {				
				var wcd = strWcds[i].substring( 1 );
				if ( $('form.rdform input[name="'+wcd+'"]').length == 0 ) {
					alert( 'Error: property "' + wcd + '" does not exist.' );
				} 
				// keyup handlers for the pointed inputs
				$('form.rdform input[name="'+wcd+'"]').keyup( function() {
					wcdPointerVals[$(this).attr("name")] = $(this).val();
					var val = $(wildcardTxtInput).attr("modvalue");
					for ( var j in wcdPointerVals) {
						if ( val.search(j) != -1 ) {
							var regex = new RegExp( '\{' + j + '\}', "g");
							val = val.replace(regex, wcdPointerVals[j]);
						}
					}
					$(wildcardTxtInput).val( val );
				});
			}
		})

		//select class, add selected template before
		$("form.rdform div[select] select").change(function() {			
			selectTemplates[$(this).val()].hide();
			$(this).parent("div[select]").before( selectTemplates[$(this).val()] );
			selectTemplates[$(this).val()].show("slow");
			$(this).children('option[value="'+$(this).val()+'"]').attr("disabled", "disabled");
		})

		// reset button, reset form and values
		$("form.rdform button[type=reset]").click(function() {		
			$("#error-msg").hide();
			$("form.rdform")[0].reset();
			$(".result").hide();
			$(".result textarea").val( "" );
			// TODO: remove duplicated datasets
		});

		// submit formular
		$("form.rdform").submit(function() {			
			$("#error-msg").hide();
			var proceed = true;

			// validate required inputs
			$("input[required]").each(function() {
				if ( $(this).val() == "" ) {
					$(this).parents(".control-group").addClass("error");
					$("#error-msg").text("Bitte alle rot hinterlegten Felder ausfüllen!");
					$("#error-msg").show();
					proceed = false;
				} else {
					$(this).parents(".control-group").removeClass("error");
				}
			});

			// proceed
			if ( proceed ) {
				$("button[type=submit]").html("Datensatz aktualisieren");
				createClasses();
			}

			return false;
		});

	} // end of initFormHandler	

	/*
	 * Create result classes array with class and properties
	 */
	createClasses = function() { // rdform
		// reset class Array
		classes = new Array();	

		/* walk through every class in form */
		$("form.rdform > div[typeof]").each(function( ci ) {
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
						globals[propName] = propVal;

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

		//console.log( globals );
		
		createResult();

	} // end of creating classes	

	/*
	 *	Create result string and output in result textarea
	 */
	createResult = function() {
		var resultStr = "";

		//create prefixes
		for ( var i in prefixes ) {
			if ( i%2 == 0 ) {
				resultStr += "@prefix " + prefixes[i] + " ";
			} else {
				resultStr += "<" + prefixes[i] + "> .\n";
			}
		}

		// create result classes
		for ( var ci in classes ) {
			resultStr += "\n" + classes[ci]['classID'] + " a " + classes[ci]['typeof'] + " ;\n";

			for ( var pi in classes[ci]['properties']) {
				var property = classes[ci]['properties'][pi];
				resultStr += "	" + property['name'] + " " + property['value'];
				// add datatype if exist
				resultStr += property.hasOwnProperty('datatype') ? "^^" + property['datatype'] : "";
				// end of property or end of class (add ; or .)
				resultStr += ( ( 1 + parseInt(pi) ) == classes[ci]['properties'].length ) ? " .\n" : " ;\n";
			}
		}
		
		$(".result").show();
		$(".result textarea").val( resultStr );		
		var lines = resultStr.split("\n");
		$(".result textarea").attr( "rows" , ( lines.length ) );
		$('html, body').animate({ scrollTop: $(".result").offset().top }, 200);		

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
	replaceWildcards = function ( str, domain, adaptFct ) {
		var result = new Object();
		var counted = 0;

		if ( str.search(/\{.*\}/) != -1 ) {
			var strWcds = str.match(/\{[^\}]*/gi);		
			for ( var i in strWcds ) {
				var wcd = strWcds[i].substring( 1 );

				// test if its a pointer to a global var
				if ( wcd.search(/^global:/) != -1 ) {
					if ( globals[wcd] === undefined ) {
						alert('Error: the global var "' + wcd + '" does not exist but required for the wildcard "' + str + '"');
					} else {
						var wcdVal = globals[wcd];
					}
				} 
				// but its a pointer to a property
				else {
					var wcdVal = $(domain).find('input[name="' + wcd + '"]');
					if ( $(wcdVal).attr("type") == "radio" ) {						
						wcdVal = $(domain).find('input[name="' + wcd + '"]:checked');
					}

					// test if property exists
					if ( wcdVal.length == 0 ) {
						alert( 'Error: cannot find property "' + strWcds[i].substring( 1 ) + '"\n\n str = ' + str );
					}
					var wcdVal = wcdVal.val();
				}				

				// passing wildcard value to the function
				if ( adaptFct !== undefined ) {
					wcdVal = adaptFct(wcdVal);
				}

				if ( wcdVal != "" ) // count not empty properties 
					++counted;

				// regex: replace the {wildard pointer} with the value
				var regex = new RegExp("\{" + wcd + "\}", "g");
				if ( wcdVal != "" ) {										
					str = str.replace(regex, wcdVal );
				} else {
					str = str.replace(regex, '' );
				}
			}
		}
		result['str'] = str.trim();
		result['count'] = counted;
		return result;
	}
	

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

		return str.replace(/[^a-z0-9-_]/gi,'');
	}

	/*
	 *	Validate and correct input values depending on the datatype after user changed the value
	 *
	 * @property DOM object with input element
	 */
	userInputValidation = function ( property ) {	
		/*
		var dates = {
			'0000' : 'yYear',
			'0000-00' : 'gYearMonth',
			'0000-00-00' : 'date'			
		}
		*/

		var value = $(property).val();
		value = value.trim();

		if ( $(property).attr("datatype") ) {
			if ( $(property).attr("datatype").indexOf(":date") >= 0 ) { // TODO: how to get every date inputs?
				value = value.replace(/[^\d-]/g, '');
				value = value.replace(/-00/g, '' );
				// TOD: maybe show an info
				/*
				if ( str.search(/\b\d{4}-\d{2}-\d{2}\b/) != -1 ) {
					datatype = "xsd:gYearMonth";
				}
				*/
			}
			if ( $(property).attr("datatype").indexOf(":int") >= 0 ) {
				value = value.replace(/[^\d]/g, '');
			}
		}
		$(property).val( value );
	}

	

}( jQuery ));