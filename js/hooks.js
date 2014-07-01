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

}

// after pressing the duplicate button
__afterDuplicateClass = function ( thisClass ) {

	if ( $(thisClass).attr("typeof").search(/cpm:Forename/) != -1 ) {
			var index = $(thisClass).attr("index");
			$(thisClass).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
			$(thisClass).find('input[name="cpm:forenamePosition"]').val( index );
	}
	
}

// before creating the class properties from input values
__createResultClassProperty = function( propertyContainer ) {



}

// before generating the class object from input values and properties
__createClass = function ( thisClass ) {
		
}