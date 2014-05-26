$(document).ready(function(){

	// after pressing the duplicate button
	__afterDuplicateDataset = function ( dataset ) {

		if ( $(dataset).attr("typeof") == "cpm:Forename" ) {
			var index = $('form > div[typeof="cpm:Forename"]').length;
			$(dataset).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
			$(dataset).find('input[name="cpm:forenamePosition"]').val( index );
			$(dataset).find('input[name="cpm:isFirstName"]').val( "0" );
		}
	}

	// before creating the class properties from input values
	__createClassProperty = function( property ) {

		//if ( $(property).val() != "" ) {

			if ( $(property).attr("name") == "cpm:pid" ) {
				createPID();
			}

		//}
	}

	// befare generating the class object from input values and properties
	__createClass = function ( curClass ) {
		
		if ( $(curClass).attr("typeof") == "cpm:Career" ) {
			var classRes = $("form").find('div[typeof="cpm:Career"]').attr( "resource" );
			$("form").find('div[typeof="cpm:Career"]').attr( "resource", "cpl:Karriere_" + Math.floor( Math.random() * 10 ) );
		}
	}
	

	// generate unique prof id
	createPID = function() {
		var forename = $("form").find('input[name="cpm:forename"]').val();
		var surname = $("form").find('input[name="cpm:surname"]').val();

		var pid = ( ( forename.length + surname.length ) % 90 ) + 10;
		$("form").find('input[name="cpm:pid"]').val( pid );
	}

});