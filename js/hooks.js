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

__afterAddLiteral = function ( thisLiteral ) {
}

__afterDuplicateLiteral = function ( thisLiteral ) {
}

__afterAddClass = function ( thisResource ) {
}

// after pressing the duplicate button
__afterDuplicateClass = function ( thisClass ) {
}

__afterDuplicateExternalResource = function ( thisResource ) {
}

// after instert existing data into the form
__afterInsertData = function() {

}

// before creating result object from html formula
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