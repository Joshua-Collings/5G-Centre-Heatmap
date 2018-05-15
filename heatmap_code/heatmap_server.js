const express = require('express');
const app = express();

//Loads the heatmap webpage by serving the static files in the 'build' folder at the root path '/'
app.use(express.static('build')); 

//var port = 1880; //Default port for http requests
//Listens for connections on the specified port and hostname
//app.listen(port, "131.227.92.222",() => console.log('Listening on port '+port));

//Listens for connections on localhost, by omitting ip address
var port = 4000;
app.listen(port,() => console.log('Listening on port '+port));

