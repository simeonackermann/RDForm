<?php

header('Content-Type: application/json');


$filename = isset( $_POST['name'] ) ? $_POST['name'] : false;

if ( $filename ) {

	if ( ! is_writable("archive") ) {
		echo json_encode( array('result' => false, 'msg' => 'Archive folder not writeable') );
		exit;
	}

	if ( ! rename( "files/". $filename, "archive/". $filename ) ) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot delete file') );
		exit;
	}

	/*
	if ( ! unlink( "files/". $filename ) ) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot delete file') );
		exit;
	}
	*/

	echo json_encode( array('result' => true, 'msg' => 'Datei "' . $filename . '" erfolgreich gelöscht.') );

} else {
	echo json_encode( array('result' => false, 'msg' => 'No name given') );
}



?>