# RDForm #

generates a fully functionall HTML5 form parsed from a flexible data model and exports the data into RDF (turtle notation). 
The data model is based on the RDFa notation with flexible possiilities to creating classes, properties, resources, relations and datatypes.

> This software is currently in a very early state and does not include every HTML or RDF element.

## Install ##

* **Requirements:** only JavaScript (JQuery) in a modern browser
* download the source code
* edit form.html to your requirements
* open index.html in your browser

For a more complex example change in index.html the line 68 to:

	$(document).ready(function(){
		$(".rdform").RDForm({
			model: "form_cpl.html",
			hooks: "js/hooks_cpl.js"
		});
	});


## Documentation ##

On the base of the data model the HTML5 form is generated. Its stored in form.html and its notation is based on [RDFa](https://en.wikipedia.org/wiki/RDFa) with HTML-form elements and attributes.

The base notation is:

	<form>
		<legend>Title</legend>
		<div typeof="Person" resource="Person-{label}">
			<label>Label</label>
			<input name="label" datatype="string" />
		</div>
	</form>

is parsed to (the label value comes from user input):

	Person-MrUnkown a Person ;
		label "Mr Unknown"^^string .


### Element descriptions and attributes: ###

* `<form>` indicates the data model

	* `prefix`

* `<legend>` title for the next class and form fieldset

* `<div>` introduces a new class

	* `typeof` type of the class
	* `resources` class identifier
	* `multiple` if given, class can be duplicated
	* `select` generates a select list of containung subclasses

* `<label>` label for the following property

* `<input>` class property, resource or global var

	* `name` name of the property
	* `datatype` datatype of the proprty (eg string, int, date)	
	* `type` [resource|global|hidden] if given, the input is not a normal property, see above for input types
	* `value` value of the property or resource pointer to another class 
	* `placeholder` help text
	* `required` required field
	* `readonly` read only field



## input types ###

Without the type attribute an input is a normal class property. Otherwiese it can be:

* `type="resource"` a resource with the name of another class
* `type="global"` a global variable without any effects to the class
* `type="hidden"` a hidden property is only not visible in the form


### wildcards {} and global vars ###

With wildcards the class identifier or a property value can point to a specific property value of the same class. Just write the name of the property into {}. eg:

	<div typeof="Person" resource="Person-{label}">
		<input name="label" />
		<input name="label_ref" type="hidden" value="{label}" />
	</div>

Global variables are properties with type="global" which can also referenced with wildcards in other classes.

	<div typeof="Person" resource="Person-ID">
		<input name="global:my_unique_id" type="global" value="..." />
	</div>
	
	<div typeof="MyClass" resource="Class-{global:my_unique_id}">
		...
	</div>


### resource properties ###

Classes can contain properties with a refernce to another class. eg:

	<div typeof="Person" resource="Person-ID">
		<input name="hasName" type="resource" value="{Name}" />
	</div>

	<div typeof="Name" resource="Name-ID">
		...
	</div>


### hooks ###

With hooks its easier to include own JavaScript functions. Have a look to js/hooks.js for more information.


## Changelog ##

### 0.1

* initial version