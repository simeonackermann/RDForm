$(document).ready(function(){

	/*
	Result Classes:
	Array => (
			['classID']	 = class ID,
			['typeof']			= type of class,
			['properties']=> (
								Array => (
										['name'] = Property ID,
										['value']	 = Property value,
										['datatype']= Property datatype
										),
								)
			),
			[tmpProperties] => (
								Array => (
										['value'] = property name (e.g. cpm:has-period),
										['resource'] = resource value (e.g. cpm:Career)
								),
			),
	),
	*/

	/* init some vars */
	var prefixes = new Array();	
	var classes = new Array();	
	var globals = new Object();

	/*
	 *	Parse form modell config file from user and build HTML formula
	 *
	 *	@data Modell as a string from config file
	 */
	parseFormModel = function( data ) {
		// regexp: http://de.selfhtml.org/perl/sprache/regexpr.htm#merken
		// rdfa http://www.w3.org/TR/xhtml-rdfa-primer/#setting-a-default-vocabulary
		var dom_model = $.parseHTML( data );

		if ( $(dom_model).attr("prefix") ) {
			prefixes = $(dom_model).attr("prefix").split(" ");
		}		
		
		$(dom_model).children("div").each(function() {

			$(this).addClass("row-fluid"); // add row-fluid to every class

			// parse resource properties
			$(this).find('input[type="resource"]').attr("resource", "resource");
			$(this).find('input[type="resource"]').attr("type", "hidden");

			// add type="text" to other inputs
			//$(this).find('input[type!="hidden"]').attr("type", "text");
			$(this).find('input').not("[type]").attr("type", "text");

			// global variables
			$(this).find('input[type="global"]').attr("global", "global");
			$(this).find('input[type="global"]').attr("type", "hidden");
			
			// wrap not hidden inputs
			$(this).find('input[type!="hidden"]').wrap('<div class="span10"><div class="control-group"><div class="controls"></div></div></div>');

			// radio labels
			$(this).find("input:radio").each(function() {
				$(this).after( $(this).attr("label") );
			})

			// add label class and move labels into control groups
			$(this).find("label").each(function() {
				$(this).addClass("control-label");
				$(this).next("div").children("div").prepend( $(this) );
			})

			// add small inputs
			var smallInput = $(this).find('input[datatype*="date"]');
			smallInput.addClass("input-small");
			smallInput.parents(".span10").removeClass("span4").addClass("span4");			
			
		});

		// add to form
		$("form.rdform").prepend( $(dom_model).html() );
		$("form.rdform").prepend( '<div class="row-fluid"><p id="error-msg" class="alert alert-error span6 hide"></p></div>' );

		// add button to multiple fields
		$("form.rdform div[multiple]").each( function() {
			$(this).after('<a class="btn btn-mini duplicate-dataset" href="#"><i class="icon-plus"></i> hinzufügen</a>');
		});	

		initFormHandler();
		
	} // end of parseFormModel


	/*
	### GET formula ###
	*/
	$.ajax({ 
		url: "formular.html",
		type: "GET",
		dataType: "text",
		success: function(data) {
				parseFormModel( data );
		}
	});

	/*
	 *	Initial form buttons after building the form
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

		// validate input values
		$("form.rdform input").change(function() {
			propertyValidation( $(this) );
		})

		// duplicate dataset button
		$("form.rdform .duplicate-dataset").click(function() {
			var dataset = $(this).prev().clone();
			dataset.find("input").val(""); // reset values
			//dataset.find("label").remove(); // remove labels
			dataset.find("input").removeAttr("required"); // remove requiered attribute
			dataset.find("div").removeClass("error");
			//dataset.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');
			dataset.insertBefore( $(this) );
			__afterDuplicateDataset( dataset );

			return false;
		}); 

		// reset button
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

			// validate requiered inputs
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
				//var rdform = $("form.rdform").clone();

				// remove unchecked radio buttons
				//$(rdform).find("input:radio").not(":checked").remove();

				$("button[type=submit]").html("Datensatz aktualisieren");
				createClasses(); // dform
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
					&& ( ( $(this).prop("type") == "radio" && $(this).prop("checked") || $(this).prop("type") != "radio" ) )
					) {

					property['name'] = $(this).attr("name");

					if ( $(this).attr("resource") ) {	// its a resource property
						property['resource']= $(this).val();
						tmpResources.push( property );

					} else if ( $(this).attr("global") ) { // its a global var
						//var globVal = replaceWildcards( $(this) );
						var globVal = replaceWildcards( $(this).val(), $(this).parents("div[typeof]"), getWebsafeString )['str'];
						globals[$(this).attr("name")] = globVal;

						// TODO if global value points to antoher property of global

					} else { // its a regular property
						if ( $(this).attr("datatype") ) {
							property['datatype'] = $(this).attr("datatype");
						}
						var propVal = replaceWildcards( $(this).val(), $(this).parents("div[typeof]") )['str'];

						property['value'] = '"' + propVal + '"';
						properties.push( property );
					}
				} // end not empty property

			}); // end walk through properties			

			// dont save classes without any property
			if ( properties.length == 0 ) {
				console.log( 'Break class "' + $(this).attr("typeof") + '" because it has no properties' );
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
				console.log( 'Break class "' + $(this).attr("typeof") + '" because it has wildcards, but every pointer property is empty. Resource value is "' + classID + '"' );
				return true;
			}
			classID = wildcardsFct['str']

			curClass['classID'] = classID;
			curClass['typeof'] = $(this).attr("typeof");

			// add current class to global classes
			classes.push( curClass );			

			/* use tmpResources to find
			   if current class is a property (resource) of another class add resource-properties to this class */
			for ( var tRCi in classes ) {
				for ( var tRi in classes[tRCi]['tmpResources'] ) {
					var property = new Object();
					var tmpResource = classes[tRCi]['tmpResources'][tRi];
					if ( tmpResource['resource'].match( curClass['typeof'] ) ) {
						property['name'] = tmpResource['name']; 
						property['value'] = curClass['classID'];
						classes[tRCi]['properties'].push( property );
					}
				}
			}

		}); // end walk through classes

		console.log( globals );
		
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
		resultStr += "\n";

		// create result classes
		for ( var ci in classes ) {
			resultStr += classes[ci]['classID'] + " a " + classes[ci]['typeof'] + " ;\n";

			for ( var pi in classes[ci]['properties']) {
				var property = classes[ci]['properties'][pi];
				resultStr += "	" + property['name'] + " " + property['value'];
				// add datatype if exist
				resultStr += property.hasOwnProperty('datatype') ? "^^" + property['datatype'] : "";
				// end of property or end of class (add ; or .)
				resultStr += ( ( 1 + parseInt(pi) ) == classes[ci]['properties'].length ) ? " .\n\n" : " ;\n";
			}
		}
		
		$(".result").show();
		$(".result textarea").val( resultStr );
		$('html, body').animate({ scrollTop: $(".result").offset().top }, 200);

	} // end of creating result


	/* helper functions */

	/*
	 * Replacing wildcards {...} with the value of the proprty in the domain
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
					//var globalVar = wcd.substring(7);
					if ( globals[wcd] === undefined ) {
						alert('The global var "' + wcd + '" doest not exist but required for the wildcard "' + str + '"');
					} else {
						var wcdVal = globals[wcd];
					}
				} 
				// but its a pointer to a property
				else {
					wcd = $(domain).find('input[name="' + wcd + '"]');

					// test if property exists
					if ( wcd.length == 0 ) {
						alert( 'Cannot find property "' + strWcds[i].substring( 1 ) + '"' );
					}
					var wcdVal = wcd.val();
				}				

				// passing wildcard value to the function
				if ( adaptFct !== undefined ) {
					wcdVal = adaptFct(wcdVal);
				}

				if ( wcdVal != "" ) // count not empty properties 
						++counted;

				// replace the {wildard pointer} with the value
				var regex = new RegExp(strWcds[i] + "\}", "g");
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
	 *	Remove accents, umlauts, special signs, ... from string
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
		// replace not alphabetical signs if its in dictionary
		// TODO: test if str empty
		str = str.replace(/[^\w ]/gi, function(char) {
			return dict[char] || char;
		});

		return str.replace(/[^a-z0-9-_]/gi,'');
	}

	/*
	 *	Validate and correct input values from datatype
	 *
	 * @property DOM object with input element
	 */
	propertyValidation = function ( property ) {		
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
});