/*
RDForm Hooks-File - to hook in on certain points of application execution

Variables:
_this.rdform 	- The RDForm-class. Plublic functions can accessed like: _this.rdform.showAlert( "info", "...");
_this.$elem 	- The form element
*/
RDForm_Hooks.prototype = {

	// after model is parsed - init form handlers
	__initFormHandlers : function () {
		var _this = this;

		/*
		// really write checked-attrs for checkboxes -> MASTER-BRANCH CANDIDATE
		_this.$elem.on( 'click', 'input[type=checkbox]', function(){
			$(this).attr("checked", $(this).prop("checked"));

		});

		// really write textarea value to html
		_this.$elem.on( 'change', 'textarea', function(){
			$(this).text( $(this).val() );
		});
		*/
		$("button[type=reset]").click(function() {
			location.reload();
		});

		// change isForename checkbox value to 1/0
		_this.$elem.on("change", 'input:checkbox', function() {
			$(this).val( $(this).prop("checked") ? "1" : "0" );
		});

		// on change forename insert all forenames (rufname) into global input
		_this.$elem.on("keyup change", 'div[typeof="cpm:Forename"]', function() {
			var forenames = "";
			
			_this.$elem.find('div[typeof="cpm:Forename"]').each(function() {
				if ( $(this).find('input[name="cpm:isFirstName"]').prop("checked") ) {
					forenames += $(this).find('input[name="cpm:forename"]').val() + " ";
				}
			});

			forenames = forenames.trim();
			_this.$elem.find('input[name="forenames"]').val( forenames );
			// trigger keyup handler to input
			_this.$elem.find('input[name="forenames"]').trigger( "keyup" );

		});

		// big publication literal highlighting
		_this.$elem.find('label:contains("Veröffentlichungen / Publikationen")').first().parent().before("<div class='rdform-hidden-group'><legend>Veröffentlichungen, Literatur, Sonstiges</legend></div>");	


	},

	// after instert existing data into the form
	__afterInsertData : function() {
		var _this = this;
	},

	// after the addLiteral button was clicked
	__afterAddLiteral : function ( thisLiteral ) {
		var _this = this;
	},

	// after the duplicateLiteral button was clicked
	__afterDuplicateLiteral : function ( thisLiteral ) {
		var _this = this;
	},

	// after the addClass button was clicked
	__afterAddClass : function ( thisResource ) {
		var _this = this;
	},

	// after the duplicateClass button was clicked
	__afterDuplicateClass : function ( thisClass ) {
		var _this = this;

		// set forename placeholder to index
		if ( $(thisClass).attr("typeof").search(/cpm:Forename/) != -1 ) {
			var arguments = $(thisClass).attr("arguments");
			var index = $.parseJSON( arguments )['i'];
			$(thisClass).find('input[name="cpm:forename"]').attr( "placeholder" , index + ". Vorname");
		}
	},

	// after the duplicateExternalResource button was pressed
	__afterDuplicateExternalResource : function ( thisResource ) {
		var _this = this;
	},

	// validate form-input on change value or on submit the form
	__userInputValidation : function ( property ) {
		var _this = this;
		
		// validate if cpm:from is a smaller date than cpm:to
		if ( $(property).attr("name") == "cpm:from" ) {
			var from = Date.parse( $(property).val() );
			var toEl = $(property).parentsUntil(".rdform-literal-group").parent().next().find('input[name="cpm:to"]');
			var to = Date.parse( toEl.val() );		
			if ( from >= to ) {
				return false;
			} else {
				if ( $(property).parentsUntil(".rdform-literal-group").parent().next().hasClass("has-error") ) {
					_this.rdform.userInputValidation( toEl );
				}
			}
		}
		else if ( $(property).attr("name") == "cpm:to" ) {
			var to = Date.parse( $(property).val() );
			var fromEl = $(property).parentsUntil(".rdform-literal-group").parent().prev().find('input[name="cpm:from"]');
			var from = Date.parse( fromEl.val() );		
			if ( from >= to ) {
				return false;
			} else {
				if ( $(property).parentsUntil(".rdform-literal-group").parent().prev().hasClass("has-error") ) {
					_this.rdform.userInputValidation( fromEl );
				}
			}
		}	

	},


	// before creating the result object from the html form
	__createResult : function() {
		var _this = this;

		// get the filename from name and forename
		var forenames = "";
		_this.$elem.find('div[typeof="cpm:Forename"]').each(function() {
			if ( $(this).find('input[name="cpm:isFirstName"]').prop("checked") ) {
				forenames += $(this).find('input[name="cpm:forename"]').val() + " ";
			}
		});
		forenames = forenames.trim();
		//var forenames = $(rdform).find('input[name="forenames"]').val();
		var surname = _this.$elem.find('input[name="cpm:surname"]').val();
		var resource = forenames + " " + surname;

		resource = resource.replace(/ /gi,'_');
		resource = _this.rdform.getWebsafeString(resource);
		$("#rdform-prof-filename").val( resource );
	},

	// before creating the class properties from input values
	__createResultClassProperty : function( propertyContainer ) {
		var _this = this;

		if ( $(propertyContainer).children("input").attr("name") == "pid" ) {
			this.createPID();
		}
	},

	// before generating the class object from input values and properties
	__createClass : function ( thisClass ) {
		var _this = this;

		if ( $(thisClass).attr("typeof") == "cpm:Professor" ) {
			var label = $(thisClass).find('input[name="rdfs:label"]').first().val();
		}
	},

	/* own functions */

	// generate unique prof id
	createPID : function() {
		var _this = this;

		var forename = _this.$elem.find('input[name="cpm:forename"]').val();
		var surname = _this.$elem.find('input[name="cpm:surname"]').val();
		var birth = _this.$elem.find('div[typeof="cpm:Birth"] input[name="cpm:date"]').val();

		// TODO: explode birth (-) sum parts lengths

		var pid = ( ( forename.length + surname.length ) % 90 ) + 10;
		_this.$elem.find('input[name="pid"]').val( pid );
	}

} // end of hooks

/*
RDForm_Hooks class. Normally you dont need to edit this
*/
function RDForm_Hooks( rdform ) {
	this.rdform = rdform;
	this.$elem = rdform.$elem;
	return this;
}