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
__afterDuplicateClass = function ( classContainer ) {
	var thisClass = classContainer.children("div[typeof]");
	
	
}

// before creating the class properties from input values
__createResultClassProperty = function( propertyContainer ) {



}

// before generating the class object from input values and properties
__createClass = function ( thisClass ) {
		
}