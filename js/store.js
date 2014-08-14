$(document).ready(function(){

	rdform = $("form.rdform");	

	var showForm = false;
	$(document).on("click", ".show-list", function() {		
		showForm = false;
		window.location.reload();
	});

	// alert a message before closing/reload window
	window.onbeforeunload = function (e) {

		if ( $(rdform).css("display") == "block" && showForm ) {

			e = e || window.event;

		    // For IE and Firefox prior to version 4
		    if (e) {
		        e.returnValue = 'Sure?';
		    }

		    // For Safari
		    return 'Sure?';

		}
	};

	function myShowForm( data ) {
		showForm = true;
		$(".rdform-filestore-wrapper").hide("slow");	
		
		$(rdform).RDForm({
			model: "form_cpl.html",
			data: data,
			hooks: "js/hooks_cpl.js",
			lang: "de"
		});
		rdform.show("fast");
		$(".show-list").show();		

		$(rdform).find("button:submit").text("Datensatz anlegen");

		// unbind original submit, set own new
		rdform.unbind( "submit" );
		$(rdform).submit(function() {
			RDForm.createResult();
			writeFile();
			return false;
		});
	}

	$(document).on("click", ".show-form", function() {
		$(rdform).html("");
		$(".rdform-result").html("");
		myShowForm(undefined);
	});	

	// show feeedback
	$(".feedback button").click(function() {
		$(this).hide();
		$(".feedback p").show();
	});
	// hide feeedback
	$(".feedback").focusout(function() {
		$(".feedback button").show();
		$(".feedback p").hide();
	});

	// add some buttons on first form submitting
	/*
	var firstSubmit = true;
	$("form.rdform").submit(function() {
		if ( firstSubmit )
			$(".rdform-result").after(  '<p><button type="button" class="btn btn-info rdform-write-file">In Datei schreiben</button></p>' +
										'<p><button type="button" class="btn btn-link btn-xs show-list">zurück zur Liste</button></p>' +
										'<p id="rdform-store-msg"></p>'
				);

		firstSubmit = false;		
	});
	*/		

	// choose a file from files-list
	$(document).on("click", "#rdform-filestore a.prof-label", function() {		
		$.post( "store/getFile.php", { name: $(this).attr("data-file") })		
			.done(function( jsondata ) {
				if ( jsondata.result && jsondata.content != "" ) {
					var data = $.parseJSON( jsondata.content );
					myShowForm(data);
					$(rdform).find("button:submit").text("Datensatz aktualisieren");
				}

		});
		return false;
	});	

	// delete a dataset
	$(document).on( "click", "#rdform-filestore button.delete-prof", function() {
		var name = $(this).prev("a").attr("data-file");
		var deleteCheck = confirm('Wollen Sie den Datensatz "'+name+'" wirklich löschen?');
		if (deleteCheck == true) {

			$.post( "store/deleteFile.php", { name: name })				
				.done(function( jsondata ) {
					getFiles();
				
			});

		}
	
	});

	/*
	$(document).on( "click", "button.rdform-write-file", function() {

		var name = $("#rdform-prof-filename").val();
		var content = $(".rdform-result").find("textarea").val();

		$.post( "store/writeFile.php", { name: name, content: content })
			.done(function( jsondata ) {
				if ( jsondata.result ) {
					$("#rdform-store-msg").toggleClass("text-success");
				} else {
					$("#rdform-store-msg").toggleClass("text-danger");
				}
				$("#rdform-store-msg").text( jsondata.msg );

				getFiles();
		});
	});
	*/

	writeFile = function(  ) {

		var name = $("#rdform-prof-filename").val();
		
		var content = JSON.stringify(JSON_RESULT, null, '\t');

		$(rdform).hide();

		$(".rdform-result").html("");
		var resultMsg = $('<p></p>');

		
		$.post( "store/writeFile.php", { name: name, content: content })
			.done(function( jsondata ) {
				if ( jsondata.result ) {
					$(resultMsg).addClass("text-success");
				} else {
					$(resultMsg).addClass("text-danger");
				}
				$(resultMsg).text( jsondata.msg );

				//getFiles();
		});

			$(".rdform-result").append( resultMsg );
		//$(".rdform-result").append( $('<button type="submit" class="btn btn-default btn-xs show-form">Neuen Datensatz anlegen</button>') );
		
		$(".rdform-result").show();

	}

	

	getFiles = function() {
		$.ajax("store/getFiles.php")
			.done(function( jsondata ) {		    
				printoutFilelist( jsondata.files );
		});
	}
	getFiles();

	printoutFilelist = function( files ) {
		if ( files.length == 0 ) {
			$("#rdform-filestore").html( "<i>Keine Datensätze gefunden</i>" );
			return;
		}
		var ul = $('<ul></ul>');
		for ( i in files ) {
			ul.append( 	"<li class='list-group-item'>" +
							"<a href='#' title='Professor bearbeiten' class='prof-label' data-file='"+files[i]+"'>"+files[i].replace(/_/g, " ")+"</a>" +
							'<button type="button" class="btn btn-link btn-xs pull-right delete-prof" title="Diesen Professor löschen""><span class="glyphicon glyphicon-remove"></span> löschen</button>' +
						"</li>" );
		}
		$("#rdform-filestore").html( ul.html() );
	}

	/*
	THIS IS ONLY A BUGFIX - remove it later then i can call the initFormHandler in rdform.js here!
	*/
	// find inputs with wildcard
	findWildcardInputs = function ( env ) {

		// reset inputs values with existing modvalue
		$(env).find('input[modvalue]').each(function() {
			$(this).val( $(this).attr("modvalue" ) );
		});

		// text inputs with wildcard values -> bind handlers to dynamically change the value
		$(env).find('input[value*="{"]').each(function() {
			var wildcards = new Object();
			var thisInput = $(this);
			var envClass = $(this).parentsUntil("div[typeof]").parent();
			$(this).attr("modvalue",  $(this).val() );

			var strWcds = $(this).val().match(/\{[^\}]*/gi);
			for ( var i in strWcds ) {				
				var wcd = strWcds[i].substring( 1 );	

				wildcards[wcd] = getWildcardTarget( wcd, envClass );	

				// TODO: if wildcard not found no keyup event exists!
				$(wildcards[wcd]).keyup(function() {
					writeWildcardValue( thisInput, wildcards );
				});

				if ( wildcards[wcd].val().search(/\{.*\}/) == -1 ) {
					$(wildcards[wcd]).trigger( "keyup" );
				}
			}
		});

	}
	
	// find the target input of a wildcard wcd in the class envClass
	getWildcardTarget = function ( wcd, envClass ) {

		var wcdTarget = envClass.find('input[name="'+wcd+'"],textarea[name="'+wcd+'"]');

		if ( wcdTarget.length == 0 && envClass.attr( "arguments" ) ) {
			var args = $.parseJSON( envClass.attr( "arguments" ) );				
			for ( var ai in args ) {
				args[ai] = args[ai].toString();
				if ( wcd == ai ) {
					if ( args[ai].search(/\{.*\}/) != -1 ) {
						wcdTarget = getWildcardTarget( args[ai].replace(/[{}]/g, ''), envClass.parentsUntil("div[typeof]").parent() );
					} else {
						wcdTarget = $( '<input type="hidden" name="' + ai + '" value="' + args[ai] + '" />' );
					}
					break;
				}
			}				
		}

		// test if property exists
		if ( wcdTarget.length == 0 ) {
			alert( 'Error: cannot find property "' + wcd + '" for wildcard replacement.' );
		}

		return wcdTarget;
	}

	// write a wildcard value to the input
	writeWildcardValue = function( src, wildcards ) {
		var val = $(src).attr("modvalue");

		for ( wcd in wildcards ) {
			if ( wildcards[wcd].val() != "" ) {
				var regex = new RegExp( '\{' + wcd + '\}', "g");
				val = val.replace( regex, wildcards[wcd].val() );
			}

		}
		$(src).val( val.trim() );

		$(src).trigger( "keyup" );
	}

});