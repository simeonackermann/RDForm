var rdform;

function setRDForm( rdform ) {
	this.rdform = rdform;		
}

// after model is parsed - init form handlers
__initFormHandlers = function () {

	// example: check mail for @
	/*
	rdform.find('input[name="foaf:mbox"]').change(function() {
		if ( $(this).val().search(/\@/) == -1 ) {
			alert("wondering - no '@' in your mail...?!");
		}
	})
	*/

	// change isForename checkbox value to 1/0
	rdform.on("change", 'input:checkbox', function() {
		$(this).val( $(this).prop("checked") ? "1" : "0" );
	});

	// on change forename insert all forenames (rufname) into global input
	rdform.on("keyup change", 'div[typeof="cpm:Forename"]', function() {
		var forenames = "";
		
		rdform.find('div[typeof="cpm:Forename"]').each(function() {
			/*
			if ( $(this).find('input[name="cpm:isFirstName"]:checked').val() == "1" ) {
				forenames += $(this).find('input[name="cpm:forename"]').val() + " ";
			}
			*/
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
		// TODO get this from arguments attr
			var index = $(thisClass).attr("index");
			$(thisClass).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
			$(thisClass).find('input[name="cpm:forenamePosition"]').val( index );
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