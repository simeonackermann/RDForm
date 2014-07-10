<?php

header('Content-Type: application/json');

$filename = isset( $_POST['name'] ) ? $_POST['name'] : false;
$content = "";

if ( $filename ) {

    if( file_exists("files/" . $filename) ) {

    	$content = file_get_contents("files/" . $filename);

    	echo json_encode( array('result' => true, 'content' => $content) );

    } else {
    	echo json_encode( array('result' => false, 'msg' => 'File not found') );	
    }

    //closedir($handle);
} 
else {
	echo json_encode( array('result' => false, 'msg' => 'No name given') );
}
?>