$(document).ready(function(){

	// after model is parsed - init form handlers
	__initFormHandlers = function () {

		// insert forenames to prof. label
		$('form.rdform').on("keyup", 'input[name="cpm:forename"]', function() {
			var forenames = "";
			$('form.rdform input[name="cpm:forename"]').each(function() {
				forenames += $(this).val() + " ";
			})
			forenames = forenames.trim();
			$('form.rdform input[name="global:forenames"]').val( forenames );
			$('form.rdform input[name="global:forenames"]').trigger( "keyup" );
		});		

	}

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

		if ( $(property).attr("name") == "global:pid" ) {
				createPID();
		}
	}

	// before generating the class object from input values and properties
	__createClass = function ( curClass ) {
		
		if ( $(curClass).attr("typeof") == "cpm:Career" ) {
			var classRes = $("form.rdform").find('div[typeof="cpm:Career"]').attr( "resource" );
			$("form.rdform").find('div[typeof="cpm:Career"]').attr( "resource", "cpl:Karriere_" + Math.floor( Math.random() * 10 ) );
		}
	}
	
	/* own functions */

	// generate unique prof id
	createPID = function() {
		var forename = $("form.rdform").find('input[name="cpm:forename"]').val();
		var surname = $("form.rdform").find('input[name="cpm:surname"]').val();

		var pid = ( ( forename.length + surname.length ) % 90 ) + 10;
		$("form.rdform").find('input[name="global:pid"]').val( pid );
	}

});