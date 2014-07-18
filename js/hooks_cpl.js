// after model is parsed - init form handlers
__initFormHandlers = function () {

	// really write checked-attrs for checkboxes -> MASTER-BRANCH CANDIDATE
	rdform.on( 'click', 'input[type=checkbox]', function(){
		$(this).attr("checked", $(this).prop("checked"));

	});

	$("button[type=reset]").click(function() {
		location.reload();
	});

	// change isForename checkbox value to 1/0
	rdform.on("change", 'input:checkbox', function() {
		$(this).val( $(this).prop("checked") ? "1" : "0" );
	});

	// on change forename insert all forenames (rufname) into global input
	rdform.on("keyup change", 'div[typeof="cpm:Forename"]', function() {
		var forenames = "";
		
		rdform.find('div[typeof="cpm:Forename"]').each(function() {
			if ( $(this).find('input[name="cpm:isFirstName"]').prop("checked") ) {
				forenames += $(this).find('input[name="cpm:forename"]').val() + " ";
			}
		});

		forenames = forenames.trim();
		rdform.find('input[name="forenames"]').val( forenames );
		// trigger keyup handler to input
		rdform.find('input[name="forenames"]').trigger( "keyup" );

	});

}

// after pressing the duplicate button
__afterDuplicateClass = function ( thisClass ) {
	
	if ( $(thisClass).attr("typeof").search(/cpm:Forename/) != -1 ) {
			var arguments = $(thisClass).attr("arguments");
			var index = $.parseJSON( arguments )['i'];
			$(thisClass).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
	}
	
}

// before creating the class properties from input values
__createResultClassProperty = function( propertyContainer ) {


	if ( $(propertyContainer).children("input").attr("name") == "pid" ) {

		//$(propertyContainer).children("input").val( Math.floor( Math.random() * 10 ) );
		createPID();
	}

}

// before generating the class object from input values and properties
__createClass = function ( thisClass ) {

	

	if ( $(thisClass).attr("typeof") == "cpm:Professor" ) {
		//console.log( 'Prof' );
		var label = $(thisClass).find('input[name="rdfs:label"]').first().val();
		//console.log( 'label=' + label );
	}

}

__filterRESULT = function ( RESULT ) {

	for ( var ci in RESULT ) {

		if ( RESULT[ci]['typeof'] ==  'cpm:Professor' ) {

			for ( var pi in RESULT[ci]['properties'] ) {
				if ( RESULT[ci]['properties'][pi]['name'] == 'rdfs:label' ) {

					var resource = RESULT[ci]['properties'][pi]['value'];
					resource = $.trim( resource.replace(/"/gi,'') );

					//var resource = RESULT[ci]['resource']; 
					resource = resource.replace(/[^a-z0-9-_]/gi,'_');

					$("#rdform-prof-uri").val( resource );

					break;

				}
			}			

		}

	}


	return RESULT;
}

/* own functions */

// generate unique prof id
createPID = function() {
	var forename = rdform.find('input[name="cpm:forename"]').val();
	var surname = rdform.find('input[name="cpm:surname"]').val();
	var birth = rdform.find('div[typeof="cpm:Birth"] input[name="cpm:date"]').val();

	// TODO: explode birth (-) sum parts lengths

	var pid = ( ( forename.length + surname.length ) % 90 ) + 10;
	rdform.find('input[name="pid"]').val( pid );
}