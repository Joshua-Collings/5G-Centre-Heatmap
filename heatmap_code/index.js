import React from 'react';
import ReactDOM from 'react-dom';
import 'leaflet/dist/leaflet.css'; //Leaflet css file (import before leaflet.js)
import L from 'leaflet';
import 'heatmap.js';
import HeatmapOverlay from 'heatmap.js/plugins/leaflet-heatmap/leaflet-heatmap.js'; 
import './index.css';
   
class App extends React.Component {
    
    //Initialise state
    constructor(props) {
        super(props); //Call the constructor of the super class 
        this.state = {
            floor: "floor1", //Default selected floor (automatically checked)
            heatmap: "temperature",
            current_time: "",
            back_1hr: "",
            back_2hrs: "",
            back_3hrs: "",
            hrs_back: 0, //0 hours back for most recent data 
            update: "false", //Changes to true when the data being displayed is updated every 1 minute
         };       
        
        this.time_date = "16:00 28/02/18"; //The time and date that is displayed on the webpage 
        
        //Used to load and display a single image over specific BOUNDS of the map (using pixel coordinates)
        this.imageBounds = [[0, 0], [240, 240]]; //Image is approx. 2400x2440 pixels - bounds represented by a rectangular area in MAP UNITS: [y,x]

        this.floor1_url = "floor_plans/01-SHCII-FP-01.jpg";
        this.floor2_url = "floor_plans/01-SHCII-FP-02.jpg"; //MUST use "", NOT ''

        this.first_floor = L.imageOverlay(this.floor1_url, this.imageBounds);
        this.second_floor = L.imageOverlay(this.floor2_url, this.imageBounds); 
        this.floors = L.layerGroup([this.first_floor]); //DEFAULT FLOOR ON START UP
        
        //Heatmap data -----------------------------------------------------------------------------------------------------------------
                
        //Configuration options for a HeatmapOverlay instance 
        var config = {
            //Radius should be small ONLY if scaleRadius is true (or small radius is intended)
            //If scaleRadius is false it will be the constant radius used in pixels
            "radius": 40,
            "maxOpacity":.8, 
            "minOpacity":0.01,
            //Scales the radius based on map zoom
            "scaleRadius": true, 
            //If set to false the heatmap uses the global maximum for colourization
            //If activated: uses the data maximum within the current map boundaries 
            //(there will always be a red spot with useLocalExtremas true when you zoom out)
            "useLocalExtrema": false,
            //Field name in your data represents the latitude - default "lat"
            latField: 'y',
            //Field name in your data represents the longitude - default "lng"
            lngField: 'x',
            //Field name in your data represents the data value - default "value"
            valueField: 'value',
                               
        };
        
        this.temp_heatmap = new HeatmapOverlay(config); //Temperature HeatmapOverlay instance   
        this.temperature_floor_1 = {}; //Heatmap data objects
        this.temperature_floor_2 = {};        
        
        this.read_1stFloorData("first_floor_data.txt"); 

        this.temp_heatmap.setData(this.temperature_floor1_hr0); //Initialises instance with dataset for 1st floor 
        setInterval(() => this.setState({update: "true"}), 10000); //Trigger an update of the heatmap data every 10 seconds

    }
    
    read_2ndFloorData(file, first_floor_data)
    {
        var rawFile = new XMLHttpRequest();
        var that = this; //Store pointer to the instance of the class
        
        rawFile.open("GET", file, false);
        
        //Called when readyState changes
        rawFile.onreadystatechange = function ()
        {
            //Data received 
            if(rawFile.readyState === 4)
            {
                //Successful request (200), or error (0)
                if(rawFile.status === 200 || rawFile.status === 0)
                {
                    var second_floor_data = rawFile.responseText;
                    that.readData(first_floor_data, second_floor_data);  
                }
            }
        }
        rawFile.send(null);
    }
    
    read_1stFloorData(file)
    {
        var rawFile = new XMLHttpRequest();
        var that = this; //Store pointer to the instance of the class
        
        rawFile.open("GET", file, false);
        
        rawFile.onreadystatechange = function ()
        {
            if(rawFile.readyState === 4)
            {
                if(rawFile.status === 200 || rawFile.status === 0)
                {
                    var first_floor_data = rawFile.responseText;
                    that.read_2ndFloorData("second_floor_data.txt", first_floor_data);
                }
            }
        }
        rawFile.send(null);
    }
    
    //Used to set this.time_date before it is rendered as the date and time
    //in the top left hand corner of the webpage.    
    updateDateAndTime()
    {
        //Set the time string for the top of the webpage, based on the 
        //current time being displayed for the heatmap
        switch(this.state.hrs_back)
        {
            case 0:
                this.time_date = this.state.current_time;
                break;
            
            case 1:
                this.time_date = this.state.back_1hr;  
                break;
                
            case 2:
                this.time_date = this.state.back_2hrs;  
                break;  

            case 3:
                this.time_date = this.state.back_3hrs;  
                break;    
        } 
    }
    
    readData(floor_1, floor_2)
    {
        //MAKE SURE the data that is set for the heatmap object is for the current floor on display
        //e.g. this.temp_heatmap.setData(this.temperature_floor_1); if floor 1 is on display at the point of update
       
        var floor1_points = []; //Data points for heatmap overlays 
        var floor2_points = [];        
        var hours_back = 0; //How many hours back the readings are from 
        
        var floor_1_strs = floor_1.split('\n'); //Array of data strings
        
        //Time and date copied from the header of the heatmap data file 
        this.state.current_time = floor_1_strs[0];
        
        //Set floor 1 data points in floor1_points array
        for(var i=1; i<(floor_1_strs.length); i++)
        {
            //X in the string indicates a data point
            if(floor_1_strs[i].indexOf('X') !== -1)
            {
                var x_coord = parseFloat(floor_1_strs[i].substring(floor_1_strs[i].indexOf('X')+1, floor_1_strs[i].indexOf('Y')));
                var y_coord = parseFloat(floor_1_strs[i].substring(floor_1_strs[i].indexOf('Y')+1, floor_1_strs[i].indexOf('T')));
                var temperature = parseFloat(floor_1_strs[i].substring(floor_1_strs[i].indexOf('T')+1, floor_1_strs[i].indexOf(',')));
                
                var point = {
                    x: x_coord,
                    y: y_coord,
                    value: temperature
                };
                
                floor1_points.push(point); //Add point to the end of the array 
 
            }
            
            //Data for a previous hour has been reached
            else
            {
                //Store the collected data in the relevant dataset
                switch(hours_back)
                {
                    //0hrs back
                    case 0:
                        this.temperature_floor1_hr0 = {
                            max: 40, //max value for red on the heatmap
                            data:floor1_points
                        }; 

                        this.state.back_1hr = floor_1_strs[i]; //Store -1hr time and date from the data file
                        break;
                    
                    //1hr back
                    case 1:
                        this.temperature_floor1_hr1 = {
                            max: 40, //max value for red on the heatmap
                            data:floor1_points
                        };

                        this.state.back_2hrs = floor_1_strs[i]; //Store -2hrs time and date from the data file    
                        break;
                        
                    //2hrs back
                    case 2:
                        this.temperature_floor1_hr2 = {
                            max: 40, //max value for red on the heatmap
                            data:floor1_points
                        }; 
                        
                        this.state.back_3hrs = floor_1_strs[i]; //Store -3hrs time and date from the data file
                        break;
                        
                    //3hrs back
                    case 3:
                        this.temperature_floor1_hr3 = {
                            max: 40, //max value for red on the heatmap
                            data:floor1_points
                        }; 
                        break;
                }
                
                hours_back++; //Move on to the next hour's data
                floor1_points = [];
            }
  
 
        }
        
        hours_back = 0; //Reset for 2nd floor data
        var floor_2_strs = floor_2.split('\n'); //Array of data strings
        
        //Set floor 2 data points in floor2_points array
        for(i=1; i<(floor_2_strs.length); i++)
        {
            //X in the string indicates a data point
            if(floor_2_strs[i].indexOf('X') !== -1)
            {
                x_coord = parseFloat(floor_2_strs[i].substring(floor_2_strs[i].indexOf('X')+1, floor_2_strs[i].indexOf('Y')));
                y_coord = parseFloat(floor_2_strs[i].substring(floor_2_strs[i].indexOf('Y')+1, floor_2_strs[i].indexOf('T')));
                temperature = parseFloat(floor_2_strs[i].substring(floor_2_strs[i].indexOf('T')+1, floor_2_strs[i].indexOf(',')));
                
                point = {
                    x: x_coord,
                    y: y_coord,
                    value: temperature
                };
                
                floor2_points.push(point); //Add point to the end of the array 
 
            }
            
            //Data for a previous hour has been reached
            else
            {
                //Store the collected data in the relevant dataset
                switch(hours_back)
                {
                    //0hrs back
                    case 0:
                        this.temperature_floor2_hr0 = {
                            max: 40, //max value for red on the heatmap
                            data:floor2_points
                        }; 

                        break;
                    
                    //1hr back
                    case 1:
                        this.temperature_floor2_hr1 = {
                            max: 40, //max value for red on the heatmap
                            data:floor2_points
                        }; 
                        break;
                        
                    //2hrs back
                    case 2:
                        this.temperature_floor2_hr2 = {
                            max: 40, //max value for red on the heatmap
                            data:floor2_points
                        }; 
                        break;
                        
                    //3hrs back
                    case 3:
                        this.temperature_floor2_hr3 = {
                            max: 40, //max value for red on the heatmap
                            data:floor2_points
                        }; 
                        break;
                }
                
                hours_back++; //Move on to the next hour's data
                floor2_points = [];
            }
  
 
        }
        
        this.updateDateAndTime();      

    }
      

    //Deal with a click of any of the radio buttons. setState will trigger 
    //a re-rendering of the buttons to checked, within the render() function.
    handleClick(button_pressed) 
    {
        switch(button_pressed)
        {
            case "floor1":
                this.setState({floor: "floor1"});
                break;
            
            case "floor2":
                this.setState({floor: "floor2"});
                break;
            
            case "0hrs":
                this.time_date = this.state.current_time;
                this.setState({hrs_back: 0});
                break;
            
            case "-1hr":
                this.time_date = this.state.back_1hr;  
                this.setState({hrs_back: 1});
                break;
                
            case "-2hrs":
                this.time_date = this.state.back_2hrs;  
                this.setState({hrs_back: 2});
                break;  

            case "-3hrs":
                this.time_date = this.state.back_3hrs;  
                this.setState({hrs_back: 3});
                break;      

        }     
    }
    
    //Invoked immediately after a component is mounted (instance of a 
    //component is being created and inserted into the DOM)
    componentDidMount() 
    {
          
        //Instantiates a map object 
        var map = new L.Map('map', {
            crs: L.CRS.Simple, //Coordinates in [y,x] - maps longitude and latitude into x and y pixel coordinates
            zoomSnap: 0.01, //Zoom will snap to the nearest multiple of 0.01
            maxBounds: this.imageBounds, //Restricts the map view to only the image's bounds
            maxBoundsViscosity: 1.0, //Prevents a user from dragging outside of the map's bounds (solid border)
            layers: [this.temp_heatmap,this.floors] //Layers that will be displayed on start up
        });                 
                   
        //Set the floors behind the heatmap layer
        this.first_floor.setZIndex(-1000); 
        this.second_floor.setZIndex(-1000);                     
                          
        //Calculates the zoom to fit the whole map, whilst setting 
        //the minimum zoom so that you can't zoom out past the image 
        //bounds 
        map.fitBounds(this.imageBounds); 
        map.setMinZoom(map.getBoundsZoom(this.imageBounds, true));
             
    }
    
    //Called after the component has been re-rendered, as a result
    //of a change of state. render() will therefore be called before
    //this function. 
    componentDidUpdate() 
    {    
        //Check for new data
        if(this.state.update === "true")
        {
            this.read_1stFloorData("first_floor_data.txt"); 
            this.setState({update: "false"});
        }
        
        if(this.state.floor === "floor1")
        {
            //Change to the first floor 
            this.floors.removeLayer(this.second_floor);
            this.floors.addLayer(this.first_floor);
            
            //Add the first floor's temperature heatmap
            if(this.state.heatmap === "temperature")
            {
                switch(this.state.hrs_back)
                {
                    case 0:
                        this.temp_heatmap.setData(this.temperature_floor1_hr0);
                        break;
                    
                    case 1:
                        this.temp_heatmap.setData(this.temperature_floor1_hr1);  
                        break;
                        
                    case 2:
                        this.temp_heatmap.setData(this.temperature_floor1_hr2);  
                        break;
                        
                    case 3:
                        this.temp_heatmap.setData(this.temperature_floor1_hr3);  
                        break;
                }
                
            }
        }
        
        if(this.state.floor === "floor2")
        {   
            //Change to the second floor
            this.floors.removeLayer(this.first_floor);
            this.floors.addLayer(this.second_floor);
            
            //Add the second floor's temperature heatmap
            if(this.state.heatmap === "temperature")
            {
                switch(this.state.hrs_back)
                {
                    case 0:
                        this.temp_heatmap.setData(this.temperature_floor2_hr0);  
                        break;
                    
                    case 1:
                        this.temp_heatmap.setData(this.temperature_floor2_hr1);  
                        break;
                    
                    case 2:
                        this.temp_heatmap.setData(this.temperature_floor2_hr2);  
                        break;
                        
                    case 3:
                        this.temp_heatmap.setData(this.temperature_floor2_hr3);  
                        break;
                }
            }
        }
    }
    

    //Returns a description of what will be rendered to the screen for 
    //the user interface. Button presses will trigger re-rendering, 
    //and a change in what is displayed.       
    render() 
    {
        return (                    
            
            
            <div>  
            <right_buttons>
            
                <input type="radio" value="floor1" checked={this.state.floor === "floor1"} onClick={() => this.handleClick("floor1")}/> 1st Floor 
                
                <block>
                    <input type="radio" value="floor2" checked={this.state.floor === "floor2"} onClick={() => this.handleClick("floor2")}/> 2nd Floor
                </block>
                
                <block>
                    <input type="radio" value="temperature" checked={this.state.heatmap === "temperature"} onClick={() => this.handleClick('T')}/> Temperature
                </block>
                
                <time_buttons>
                    
                    <block>
                    <time_label_css>
                        Time
                    </time_label_css>
                    </block>
                    
                   <block>
                        <input type="radio" value="0hrs_back" id="currenttime" checked={this.state.hrs_back === 0} onClick={() => this.handleClick("0hrs")}/> 
                        <label> Current time</label>
                    </block>
                    
                    <block>
                        <input type="radio" value="back_1hr" checked={this.state.hrs_back === 1} onClick={() => this.handleClick("-1hr")}/>-1 Hour
                    </block>
                    
                    <block>
                        <input type="radio" value="back_2hrs" checked={this.state.hrs_back === 2} onClick={() => this.handleClick("-2hrs")}/>-2 Hours
                    </block>
                    
                    <block>
                        <input type="radio" value="back_3hrs" checked={this.state.hrs_back === 3} onClick={() => this.handleClick("-3hrs")}/>-3 Hours
                    </block>

                </time_buttons>
                
            </right_buttons>     
            
         
                <date_time_css>
                {this.time_date}
                </date_time_css>
           
            
            </div>
                
                    
        )
    }}

ReactDOM.render(<App/>, document.getElementById('root'));  //Render application
