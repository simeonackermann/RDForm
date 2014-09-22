<?php

header('Content-Type: application/json');

$files = array();

if ($handle = opendir('files/')) {

    while (false !== ($file = readdir($handle))) {
        if ( $file != "." && $file != ".." ) 
        	array_push($files, $file);
    }
    closedir($handle);
}

sort($files);

echo json_encode( array('files' => $files) );

?>