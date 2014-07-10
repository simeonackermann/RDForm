<?php

header('Content-Type: application/json');


$filename = isset( $_POST['name'] ) ? $_POST['name'] : false;
$content = isset( $_POST['form'] ) ? $_POST['form'] : false;


if ( $filename && $content ) {

	if ( ! is_writable("files") ) {
		echo json_encode( array('result' => false, 'msg' => 'Folder not writeable') );
		exit;
	}
	
	if (!$handle = fopen( "files/" . $filename, "w")) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot open file') );
		exit;
	}

	if (!fwrite($handle, $content)) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot write file') );
		exit;
	}

	 echo json_encode( array('result' => true, 'msg' => 'Datei "' . $filename . '" erfolgreich geschrieben.') );

	 fclose($handle);

} else {
	echo json_encode( array('result' => false, 'msg' => 'No name or form-content given') );
}



?>