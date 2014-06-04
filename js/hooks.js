var rdform;

function setRDForm( rdform ) {
	this.rdform = rdform;		
}

// after model is parsed - init form handlers
__initFormHandlers = function () {

	// example: check mail for @
	rdform.find('input[name="foaf:mbox"]').change(function() {
		if ( $(this).val().search(/\@/) == -1 ) {
			alert("wondering - no '@' in your mail...?!");
		}
	})

}

// after pressing the duplicate button
__afterDuplicateDataset = function ( dataset ) {

	
}

// before creating the class properties from input values
__createClassProperty = function( property ) {

	// example: adding random number to global:pid
	if ( $(property).attr("name") == "global:pid" ) {
		$(property).val( '{foaf:name}-' + Math.floor( Math.random() * 10 ) );
	}
	
}

// before generating the class object from input values and properties
__createClass = function ( curClass ) {
	
	
}