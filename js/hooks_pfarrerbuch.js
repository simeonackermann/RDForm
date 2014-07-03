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

	//console.log( propertyContainer );

	if ( $(propertyContainer).children("input").attr("name") == "pid" ) {
		$(propertyContainer).children("input").val( Math.floor( Math.random() * 10 ) );
	}


}

// before generating the class object from input values and properties
__createClass = function ( thisClass ) {
		
}

__filterResultPropertyAfterCreating = function( property ) {

	if ( property.name == "hp:hasPosition" ) {

		property.value = rdform.find('div[name="hp:hasPosition"] input[name="rdf:object"]').val();
	}

	return property;

}