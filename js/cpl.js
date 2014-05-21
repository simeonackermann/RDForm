$(document).ready(function(){


	__afterDuplicateDataset = function ( dataset ) {

		if ( $(dataset).attr("typeof") == "cpm:Forename" ) {
			var index = $('form > div[typeof="cpm:Forename"]').length;
			$(dataset).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
			$(dataset).find('input[name="cpm:forenamePosition"]').val( index );
			$(dataset).find('input[name="cpm:isFirstName"]').val( "0" );
		}
	}

	__createClass = function ( curClass ) {
		
		if ( $(curClass).attr("typeof") == "cpm:Career" ) {
			var classRes = $("form").find('div[typeof="cpm:Career"]').attr( "resource" );
			//classRes = classRes.replace( /%/g, Math.floor( Math.random() * 10 ) );
			$("form").find('div[typeof="cpm:Career"]').attr( "resource", "cpl:Karriere_" + Math.floor( Math.random() * 10 ) );
		}
	}

	__createClassProperty = function( property ) {

		if ( $(property).val() != "" ) {

			if ( $(property).attr("name") == "cpm:pid" ) {
				createPID();
			}

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