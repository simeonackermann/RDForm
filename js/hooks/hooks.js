/*
RDForm Hooks-File - to hook in on certain points of application execution
*/

// after model is parsed - init form handlers
__initFormHandlers = function () {

	// example: check valid e-mail on change
	// this doesnt prevend submitting the form!
	$(rdform).find('input[name="foaf:mbox"]').change(function() {
		$("." + _ID_ + "-alert").html("");
		var val = $(this).val();
		if ( /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(val) == false) {
			RDForm.showAlert( "info", "Invalid E-mail Address, please try again.");
		}
	});

}

// after instert existing data into the form
__afterInsertData = function() {
}

// after the addLiteral button was clicked
__afterAddLiteral = function ( thisLiteral ) {
}

// after the duplicateLiteral button was clicked
__afterDuplicateLiteral = function ( thisLiteral ) {
}

// after the addClass button was clicked
__afterAddClass = function ( thisResource ) {
}

// after the duplicateClass button was clicked
__afterDuplicateClass = function ( thisClass ) {
}

// after the duplicateExternalResource button was pressed
__afterDuplicateExternalResource = function ( thisResource ) {
}

// validate form-input on change value or on submit the form
__userInputValidation = function ( property ) {
	return true;
}


// before creating the result object from the html form
_createResult = function() {
}

// before creating the class properties from input values
__createResultClassProperty = function( propertyContainer ) {

	// create the hidden pid field
	if ( $(propertyContainer).children("input").attr("name") == "pid" ) {
		$(propertyContainer).children("input").val( Math.floor( Math.random() * 10 ) );
	}

}

// before generating the class object from input values and properties
__createClass = function ( thisClass ) {
}