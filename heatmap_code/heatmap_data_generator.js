var MongoClient = require('mongodb').MongoClient; //Creating a MongoClient object from the module 'mongodb'
var assert = require('assert'); //Module used to perform a simple test to compare an expected result with an actual result
var gps_fs = require('fs'); //File system module
var op_fs = require('fs');
const readline = require('readline');
const { URL } = require('url'); //Provides utilities for URL resolution and parsing
var http = require('http');

// Connection URL for "iotegg" MongoDB database
var mongodb_url = 'mongodb://USER_NAME:PASSWORD@131.227.92.236:27017/iotegg'; //CHANGE USER_NAME and PASSWORD to access database

//Egg variables (note that gps_index does not match egg_number - the gps data array
//will only have data for eggs that exist i.e. not for IoTEgg006, as it doesn't exist)
var egg_str = "IoTEgg001", temperature, egg_number = 1, gps_data, gps_index = 0;

//Time frame variables for database query
var start_date = new Date(), end_date = new Date(), time_in_ms, hour_offset = 0, MAX_HOURS_BACK = 3;

//Read in data from the text file containing gps coordinates for each of the eggs
gps_fs.readFile('iotegg_locations_all.txt', 'utf8', (err, data) => {
    if (err) throw err;
    gps_data = data.split('\r\n'); //Store data as an array of strings 
    
    setTime();    
});

function clearDataFiles()
{
    //Clears the contents of the heatmap data files, and adds the time and date of the data as a header 
    op_fs.writeFile("build/first_floor_data.txt", file_date_time, (err) => {
        if (err) throw err;
        
        op_fs.writeFile("build/second_floor_data.txt", file_date_time, (err) => {
            if (err) throw err;
            mongoDB_connect(); //Call to start downloading data from the database
            
        });
    }); 
}

//Set the time variables for the database query, and the heading of each file
//which specifies the time the readings were made. The start and end times for
//the database query are set to the nearest minute, so that data isn't displayed 
//from across 2 minutes e.g. 14:00:00 to 14:01:00, rather than 14:00:34 to 14:01:34. 
//The end and start times are also from at least 1 minute and 2 minutes before 
//the current time, respectively, to ensure that there is data in the database 
//for collection. It's unlikely that data from the current time would have been
//uploaded straight away for access. 
function setTime()
{
    if(hour_offset == 0)
    {
        var current_time = new Date();
        time_in_ms = current_time.getTime() - current_time.getSeconds()*1000; //Store current time in ms, to the nearest minute
    }

    var hours_back_ms = hour_offset*3600000;
    
    end_date.setTime(time_in_ms-60000-hours_back_ms); //To the nearest minute, at least 1 minute before current time and date 
    start_date.setTime(time_in_ms-120000-hours_back_ms); //To the nearest minute, at least 2 minutes before current time and date
     
    //Header string for data files 
    file_date_time = start_date.getHours() + ":"; 
    
    if(start_date.getMinutes() < 10)
        var minute = "0" + start_date.getMinutes();
    else
        var minute = start_date.getMinutes();
    
    file_date_time = file_date_time + minute + " " + start_date.getDate() + "/" + (start_date.getMonth()+1) + "/" + start_date.getFullYear() + '\n';  
    
    if(hour_offset == 0)
        clearDataFiles();
    
    else 
    {
        op_fs.appendFile("build/first_floor_data.txt", file_date_time, (err) => {
        if (err) throw err;
        
        op_fs.appendFile("build/second_floor_data.txt", file_date_time, (err) => {
            if (err) throw err;            
            mongoDB_connect(); //Call to start downloading data from the database
            
        });
    }); 
    }
}

//Moves on to the next egg to request data from
function next_egg(db)
{
    var gps_str = gps_data[gps_index];
    var gps_egg_number = parseInt(gps_str.substring(0, gps_str.indexOf(' ')));

    //Egg data was from an egg that has gps coordinates 
    if(egg_number === gps_egg_number)
    {
        gps_index++; //Increment index for the next egg's GPS coordinates 
    }
    
    egg_number++; //Increment egg number for next download of data
     
    if(egg_number <= 116)
    {
        if(egg_number < 10)
        {
            egg_str = "IoTEgg00" + egg_number; //Concatenate string and integer 
        }
            
        else if(egg_number < 100)
        {
            egg_str = "IoTEgg0" + egg_number;
        }
          
        else 
        {
            egg_str = "IoTEgg" + egg_number;
        } 

        findDocuments(db);
        
    }
    
    //No more eggs, so close the connection to the database
    else
    {
        console.log("Data collected from", hour_offset, "hours back\n" );
        
        //Reset all egg variables for querying the database again 
        egg_str = "IoTEgg001", temperature, egg_number = 1, gps_data, gps_index = 0;
        
        if(hour_offset < MAX_HOURS_BACK)
        {
            hour_offset++;        
            setTime();
        }

        else
        {
            hour_offset = 0;
            db.close();
            setTimeout(setTime, 60000); //Call the setTime function after 1 minute has passed (60000ms) 
        }
    }
}

//MONGODB--------------------------------------------------------------------------------------------------
//Connect to MongoDB database
function mongoDB_connect()
{
    MongoClient.connect(mongodb_url, function(err, db) 
    {
        assert.equal(null, err); //err == null if there's no error; AssertionError message displayed otherwise 
        console.log("Connected successfully to IoTEggs server\n"); //prints to stdout
  
        findDocuments(db);
    
    });
}

//Finds documents from the monogdb database, based on the specified egg in egg_str 
function findDocuments(db) 
{
    //Fetch the "measurements" collection
    var collection = db.collection('measurements');
  
    // Finds all temperature readings for the specified device, within the given time, 
    // by searching on the compound index {device: 1, timestamp: -1}. Order of items 
    // returned based on final sorting. 
    collection.find({device: {$eq: egg_str}, feature: {$eq: "temperature"}, timestamp: { $gte: start_date,$lt: end_date }}).sort({device:1, timestamp:-1}).limit(1).toArray(function(err, docs) 
    {
        assert.equal(null,err);
        //console.log("Timestamp query:");
        console.log(docs);
        
        var reading_str = JSON.stringify(docs, null, 1); //Conversion from JSON to string (1 space indentation)
        
        //No data from specified egg number 
        if(reading_str === "[]")
        {
            next_egg(db); //Move to the next egg
        }
        
        else
        {
            var reading_fields = reading_str.split('\n');
            
            //Readings to 1 d.p.
            temperature = reading_fields[6].substring(reading_fields[6].indexOf(':')+2,reading_fields[6].indexOf(':')+6); 
        
            //Readings below 10 degrees are also set to 1 d.p. 
            if(parseFloat(temperature) < 10.0)
                temperature = reading_fields[6].substring(reading_fields[6].indexOf(':')+2,reading_fields[6].indexOf(':')+4); 
            
            requestLocation(db);
        }


    });
}

//Request egg location-----------------------------------------------------------------------------
function requestLocation(db) 
{
    var gps_str = gps_data[gps_index];
 
    var gps_egg_number = parseInt(gps_str.substring(0, gps_str.indexOf(' ')));

    //console.log("GPS egg:" + gps_egg_number + " " + "Egg:" + egg_number);
    
    //GPS data file egg number matches egg number in counter 
    if(gps_egg_number === egg_number)
    {
        writeData(db);
    }
    
    //Data has been received from an egg that doesn't have GPS coordinates 
    else
    {
        next_egg(db);
    }

}

//Writes egg data to a text file for the heatmapping application 
function writeData(db)
{    
    var data_fields = gps_data[gps_index].split(',');
    
    var latitude_str = data_fields[3].substring(data_fields[3].indexOf(':')+1, data_fields[3].indexOf('}')); 
    var longitude_str = data_fields[5].substring(data_fields[5].indexOf(':')+1, data_fields[5].indexOf('}'));
    var altitude_str = data_fields[7].substring(data_fields[7].indexOf(':')+1, data_fields[7].indexOf('}'));     
  
    var egg_lat = parseFloat(latitude_str), egg_lng = parseFloat(longitude_str);
   
    var egg_x = ((egg_lng-(-0.593406))*(200000/83))*240; //Changes axis to 0 to 1, and then scales it up for 0 to 270
    var egg_y = ((egg_lat-(51.243245))*(200000/51))*240;
    
    var egg_data = "X" + egg_x + "Y" + egg_y + "T" + temperature + ','+ '\n';
 
    //1st Floor
    if(altitude_str === "57.0")
    {
        //Appends the data to a file, creating it if it doesn't already exists 
        op_fs.appendFile("build/first_floor_data.txt",egg_data, function(err){
            if(err)
            {
                return console.log(err);
            }
                
                        
        });

    }
    
    //2nd Floor 
    if(altitude_str === "61.0")
    {
        //Appends the data to a file, creating it if it doesn't already exists 
        op_fs.appendFile("build/second_floor_data.txt",egg_data, function(err){
            if(err)
            {
                return console.log(err);
            }
                
            //console.log("\nData Appended\n");      
               
        });

    }
    
             
    next_egg(db);
    
    
}



