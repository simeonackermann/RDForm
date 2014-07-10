$(document).ready(function(){

	var firstSubmit = true;
	$("form.rdform").submit(function() {
		if ( firstSubmit )
			$(".rdform-result").after( '<p><button type="button" class="btn btn-info rdform-write-file">In Datei schreiben</button></p><p id="rdform-store-msg"></p>' );

		firstSubmit = false;		
	});

	$(document).on("click", "#rdform-filestore a", function() {

		$.post( "store/getFile.php", { name: $(this).text() })
			.done(function( jsondata ) {
				if ( jsondata.result && jsondata.content != "" ) {
					$("form.rdform").html( jsondata.content );
				}
		});
		return false;
	});	

	$(document).on( "click", "button.rdform-write-file", function() {

		$.post( "store/writeFile.php", { name: $("#rdform-prof-uri").val(), form: $("form.rdform").html() })
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

	getFiles = function() {
		$.ajax("store/getFiles.php")
			.done(function( jsondata ) {		    
				printoutFilelist( jsondata.files );
		});
	}
	getFiles();

	printoutFilelist = function( files ) {
		if ( files.length == 0 ) {
			$("#rdform-filestore").html( "<i>Keine Dateien gefunden</i>" );
			return;
		}
		var ul = $("<ul></ul>");
		for ( i in files ) {
			ul.append( "<li><a href='#'>"+files[i]+"</a></li>" );
		}
		$("#rdform-filestore").html( ul );
	}

});