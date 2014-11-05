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

		// get pid from existing resource
		var resourceIri = $("#resourceIri").val();
		var pID = resourceIri.substring( resourceIri.indexOf("-") + 1 );
		_this.$elem.find( 'input[name="id"]' ).val( pID );
		_this.$elem.on("keyup", 'input[name="http://purl.org/voc/hp/birthDate"]', function() {
			var bYear = $(this).val().slice(0, 4);
			_this.$elem.find('input[name="birthDate"]').val( bYear ).trigger("keyup");
		});
		_this.$elem.on("keyup", 'input[name="http://purl.org/voc/hp/dateOfDeath"]', function() {
			var dYear = $(this).val().slice(0, 4);
			_this.$elem.find('input[name="deathDate"]').val( dYear ).trigger("keyup");
		});
	
	},

	// after instert existing data into the form
	__afterInsertData : function() {
		var _this = this;

		_this.$elem.find( 'input[external]' ).each(function() {
			$(this).hide();
			$(this).nextAll(".duplicate-external-resource").hide();
			$(this).nextAll(".remove-external-resource").hide();
			if ( $(this).val() != "" ) {			
				var thisResource = $(this);
				//var resLink = urlBase + "view/?r=" + $(thisResource).val()
				var resLink = $(thisResource).val()
				var meta = new $.JsonRpcClient({ ajaxUrl: urlBase + 'jsonrpc/resource' });
		        meta.call(
					'get', [modelIri, $(thisResource).val(), 'ntriples'],
					function(result) {
						jsonld.fromRDF(
							result.data, 
							{format: 'application/nquads'},
							function(err, doc) {
								if ( doc.length > 0 && doc[0].hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#label") ) {
									//thisResource.attr( "title", doc[0]["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]  ) ;
									$(thisResource).before('<a href="'+resLink+'">'+doc[0]["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]+'</a>');
								} else {
									var resLabel = $(thisResource).val();
									var resDir = resLabel.substring( 0, resLabel.lastIndexOf("/"));
									resDir = resDir.substring( resDir.lastIndexOf("/")+1 );
									resLabel = resLabel.substring( resLabel.lastIndexOf("/")  );
									$(thisResource).before('<a href="'+resLink+'">'+resDir+resLabel+'</a>');
								}
							}
						);
					},
					function(error)  { console.log('There was an error', error); }
				);
			}
		});	

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
	},

	// after the duplicateExternalResource button was pressed
	__afterDuplicateExternalResource : function ( thisResource ) {
		var _this = this;

		$(thisResource).find("input").show();
		$(thisResource).find("a").remove();
	},

	// validate form-input on change value or on submit the form
	__userInputValidation : function ( property ) {
		var _this = this;
		// return false if property value is not valid
	},


	// before creating the result object from the html form
	__createResult : function() {
		var _this = this;
	},

	// before creating the class properties from input values
	__createResultClassProperty : function( propertyContainer ) {
		var _this = this;
	},

	// before generating the class object from input values and properties
	__createClass : function ( thisClass ) {
		var _this = this;

		$(thisClass).attr( "resource", $(thisClass).attr( "resource").replace( " ", "_") );
	},
} // end of hooks

/*
RDForm_Hooks class. Normally you dont need to edit this
*/
function RDForm_Hooks( rdform ) {
	this.rdform = rdform;
	this.$elem = rdform.$elem;
	return this;
}