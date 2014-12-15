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
		// example: check valid e-mail on change
		// this doesnt prevend submitting the form!
		_this.$elem.find('input[name="foaf:mbox"]').change(function() {
			$("." + _this.rdform._ID_ + "-alert").html("");
			var val = $(this).val();
			if ( /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(val) == false) {
				_this.rdform.showAlert( "info", "Invalid E-mail Address, please try again.");
			}
		});

	},

	// after instert existing data into the form
	__afterInsertData : function() {
		var _this = this;
	},

	// after adding a property
	__afterAddProperty : function ( thisPropertyContainer) {
		var _this = this;
		var thisProperty = thisPropertyContainer.find("."+_this.rdform._ID_+"-property").first();
	},

	// after adding a property
	__afterDuplicateProperty : function ( thisPropertyContainer ) {
		var _this = this;
		var thisProperty = thisPropertyContainer.find("."+_this.rdform._ID_+"-property").first();
	},

	// after adding a property
	__beforeRemoveProperty : function ( thisPropertyContainer ) {
		var _this = this;
		var thisProperty = thisPropertyContainer.find("."+_this.rdform._ID_+"-property").first();
	},

	// validate form-input on change value or on submit the form
	__userInputValidation : function ( property ) {
		var _this = this;
		// return false if property value is not valid
	},

	// get the the item for the result-search list on autocomplete
	__autocompleteGetItem : function( item ) {
		// e.g. change the label as: item.label.value = "My val: " + item.label.value;
		return item;
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