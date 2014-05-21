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
	

	Tmp Resource Properties:
	Array => (
			['class']	 = owner-class of the property (result[index])
			['value']		= property name (e.g. cpm:has-period)
			['resource']= resource value (e.g. cpm:Career)
			),	

	*/

	/* inti some vars */
	var prefixes = new Array();	
	var classes = new Array();
	var tmpResources = new Array();

	/*
	 *	Parse form modell config file from user and build HTML formula
	 *
	 *	@data Modell as a string from config file
	 */
	parseFormModel = function( data ) {
		// regexp: http://de.selfhtml.org/perl/sprache/regexpr.htm#merken
		// rdfa http://www.w3.org/TR/xhtml-rdfa-primer/#setting-a-default-vocabulary

		//var prefixAttr = data.match(/<form prefix="[^\"]*/gi).toString().substr(14); // get prefix value, substr <form ... (14 letter)
		//prefixAttr = prefixAttr.substr( prefixAttr.indexOf('"') + 1 );
		//prefixes = prefixAttr.split(" ");

		var dom_model = $.parseHTML( data );

		/*

		var data_rows = data.split("\n");

		for ( ri in data_rows ) {
			
		}

		*/

		prefixes = $(dom_model).attr("prefix").split(" ");
		
		$(dom_model).children("div").each(function() {

			$(this).addClass("row-fluid"); // add row-fluid to every class

			// add type="hidden" to resource inputs
			$(this).find('input[datatype="resource"]').attr("type", "hidden");

			// add type="text" to other inputs
			$(this).find('input[type!="hidden"]').attr("type", "text");

			// wrap input text elements
			$(this).find('input[type="text"]').wrap('<div class="span10"><div class="control-group"><div class="controls"></div></div></div>');

			// add .control-label to labels
			$(this).find("label").addClass("control-label");

			// move labels into cotrol groups
			$(this).find("label").each(function() {
				$(this).next("div").children("div").prepend( $(this) );
			})

			// add small inputs
			var smallInput = $(this).find('input[datatype="xsd:date"]');
			smallInput.addClass("input-small");
			smallInput.parents(".span10").removeClass("span4").addClass("span4");
			
			
		});

		$("form").prepend( $(dom_model).html() );
		$("form").prepend( '<div class="row-fluid"><p id="error-msg" class="alert alert-error span6 hide"></p></div>' );

		/*

		// remove form
		data = data.replace(/<form.*>/g, '');
		data = data.replace(/<\/form.*>/g, '');

		// add row-fluid class
		data = data.replace(/<div/g, '<div class="row-fluid"');

		// add div before and after input elements
		data = data.replace(/(.*<input.*\/>)/g, '<div>$1</div>');
		// remove div from resource and hidden inputs
		data = data.replace(/<div>(.*<input.*datatype="resource".*)<\/div>/g, '$1');
		data = data.replace(/<div>(.*<input.*type="hidden".*)<\/div>/g, '$1');

		// add type="hidden" to resource inputs
		data = data.replace(/<input(.*datatype="resource")/g, '<input type="hidden"$1');

		// add type="text" to other inputs
		//data = data.replace(/<input(?!.*\sdatatype="resource")/g, '<input type="text"');
		data = data.replace(/<input(?!.*\stype=)/g, '<input type="text"');
		
		// insert data to form
		$("form").prepend( data );
		$("form").prepend( '<div class="row-fluid"><p id="error-msg" class="alert alert-error span6 hide"></p></div>' );

		// put labels into divs
		$("label").each(function() {
			$(this).next("div").prepend( $(this) );
		})

		// add class "date" and "input-small" to every from|to input
		$("input[name=cpm\\:from], input[name=cpm\\:to]").addClass("date input-small");
		$("input.date").parent().addClass("span2");
		// add span4 to every not date 
		//$("input:not(.date)").parent().addClass("span4");
		$('input[type="text"]').parent().addClass("span6");	
		*/	

		// add button to multiple fields
		$("form div[multiple]").each( function() {
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

		$(".duplicate-dataset").click(function() {
			var dataset = $(this).prev().clone();
			dataset.find("input").val(""); // reset values
			dataset.find("label").remove(); // remove labels
			dataset.find("input").removeAttr("required"); // remove requiered attribute
			dataset.find("div").removeClass("error");
			//dataset.append('<a class="btn btn-link" href="#"><i class="icon-remove"></i> entfernen</a>');
			dataset.insertBefore( $(this) );
			__afterDuplicateDataset( dataset );

			return false;
		}); 

		// submit formular
		$("button[type=submit]").click(function() {			
			$("#error-msg").hide();
			var proceed = true;
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
	createClasses = function() {
		// reset result Arrays
		classes = new Array();	
		tmpResources = new Array();

		/* walk through every class in formula */
		$("form > div[typeof]").each(function( ci ) {			
			var curClass = new Object();
			var properties = new Array();			
			
			/* walk through every class-property (inputs) */
			$(this).find('input').each(function( ) { //TODO: input[value!="" -> dont need: if ( $(this).val() != "" ) {
				var property = new Object();

				__createClassProperty( $(this) );

				// store properties and resources
				if ( $(this).val() != "" ) {
					property['name'] = $(this).attr("name");
					if ( $(this).attr("datatype") != "resource" ) {	// its a regular property
							if ( $(this).attr("datatype") ) {
								if ( $(this).attr("datatype") == "xsd:date" ) {
									prepareDateProperty( $(this) );
								}
								property['datatype']= $(this).attr("datatype");
							}

							// if value points to another property
							if ( $(this).val().search(/\{.*\}/) != -1 ) {
								var propRes = $(this).val().substring( $(this).val().indexOf('{')+1, $(this).val().indexOf('}') );
								propRes = $(this).parents("div[typeof]").find('input[name="'+propRes+'"]').val();
								if ( propRes != "" ) {
									$(this).val( propRes );
								}
							}
							property['value'] = '"' + $(this).val() + '"';
							properties.push( property );
					} else { // its a resource property
						property['class'] = ci;
						property['resource']= $(this).val();
						tmpResources.push( property );
					}
				}

			}); // end walk through properties			

			// dont safe classes without any property
			if ( properties.length == 0 )
				return true;

			// add properties to current class 
			curClass['properties'] = properties;					

			//* generate current class */
			__createClass( $(this) );
			var classID = $(this).attr("resource"); 

			if ( classID.search(/\{.*\}/) != -1 ) { // ID is a property value
				var propNames = classID.match(/\{[^\}]*/gi);
				var propValI = 0;
				for ( var i in propNames ) {
					var prop = propNames[i].substring( 1 );
					prop = $(this).find('input[name="' + prop + '"]');
					if ( $(prop).attr("type") != "hidden" && $(prop).val() != "" ) // count not hidden or empty properties 
						++propValI;
					prop = getWebsafeString( $(prop).val() );					
					classID = classID.replace(/\{[^\}]*\}/, prop ); // replace {...} with property value
				}
				if ( propValI == 0 ) 
					return true; // every properties for classID are emtpy or hidden -> break current class
			}

			// TMP, class id replace % with number TODO: replace this
			//classID = classID.replace(/%/g, Math.floor( Math.random() * 10 ) );

			curClass['classID'] = classID;
			curClass['typeof'] = $(this).attr("typeof");

			// add current class to classes
			classes.push( curClass );

			/* if current class is a property (resource) of another class add resource-properties to this class */
			for ( var tRi in tmpResources ) {
				var property = new Object();
				var tmpResource = tmpResources[tRi];
				if ( tmpResource['resource'].match( curClass['typeof'] ) ) {
					property['name'] = tmpResource['name']; 
					property['value'] = curClass['classID'];
					classes[tmpResource['class']]['properties'].push( property );
				}
			}

		}); // end walk through classes
		
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
			resultStr += classes[ci]['classID'] + " a " + classes[ci]['typeof'] + "	;\n";

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
	 *	Remove accents, umlauts, special signs, ... from string ###
	 *
	 * @str String
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
		str = str.replace(/[^\w ]/gi, function(char) {
			return dict[char] || char;
		});

		return str.replace(/[^a-z0-9]/gi,''); // return str without special signs
	}


	prepareDateProperty = function ( property ) {
		/*
		var datatype = $(property).attr("datatype");
		str = str.replace(/[^\d-]/g, '');
		str = str.replace(/-00/g, '');
		if ( str.search(/\b\d{4}-\d{2}-\d{2}\b/) != -1 ) {
			datatype = "xsd:gYearMonth";
		}
		*/
	}

	/* hook functions */	
	__afterDuplicateDataset = function ( dateset ) {}
	__createClassProperty = function( property ) {}
	__createClass = function ( curClass ) {}
});