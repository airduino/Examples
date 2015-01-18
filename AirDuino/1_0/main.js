/* set up some variables */

const serial = chrome.serial;
var seq = 1;

/* STK500 commands */

SIGN_ON_MESSAGE = "AVR STK";

command = {

"Sync_CRC_EOP" : 0x20,  
"GET_SYNC" : 0x30,
"GET_SIGN_ON" : 0x31,
"SET_PARAMETER" : 0x40,
"GET_PARAMETER" : 0x41,
"SET_DEVICE" : 0x42,
"SET_DEVICE_EXT" : 0x45,                
"ENTER_PROGMODE" : 0x50,
"LEAVE_PROGMODE" : 0x51,
"CHIP_ERASE" : 0x52,
"CHECK_AUTOINC" : 0x53,
"LOAD_ADDRESS" : 0x55,
"UNIVERSAL" : 0x56,
"UNIVERSAL_MULTI" : 0x57,
"PROG_FLASH" : 0x60,
"PROG_DATA" : 0x61,
"PROG_FUSE" : 0x62,
"PROG_LOCK" : 0x63,
"PROG_PAGE" : 0x64,
"PROG_FUSE_EXT" : 0x65,        
"READ_FLASH" : 0x70,
"READ_DATA" : 0x71,
"READ_FUSE" : 0x72,
"READ_LOCK" : 0x73,
"READ_PAGE" : 0x74,
"READ_SIGN" : 0x75,
"READ_OSCCAL" : 0x76,
"READ_FUSE_EXT" : 0x77,        
"READ_OSCCAL_EXT" : 0x78 }     


parameters = {
"HW_VER" : 0x80,
"SW_MAJOR" : 0x81,
"SW_MINOR" : 0x82,
"LEDS": 0x83,
"VTARGET": 0x84,
"VADJUST": 0x85,
"OSC_PSCALE" : 0x86,
"OSC_CMATCH" : 0x87,
"RESET_DURATION" : 0x88,
"SCK_DURATION" : 0x89,
"BUFSIZEL" : 0x90, 
"BUFSIZEH" : 0x91,
"DEVICE" : 0x92, 
"PROGMODE" : 0x93,
"PARAMODE" : 0x94, 
"POLLING" : 0x95, 
"SELFTIMED" : 0x96, 
"TOPCARD_DETECT" : 0x98
}


responses = { 
  0x10 : "OK",               
  0x11 : "FAILED",
  0x12 : "UNKNOWN",
  0x13 : "NODEVICE",
  0x14 : "INSYNC",
  0x15 : "NOSYNC"
}

var DTRRTSOn = { dtr: true, rts: true }; 
var DTRRTSOff = { dtr: false, rts: false };
var SerialOpts = {bitrate: 115200 };

/* puts extra header data in message, computes checksum */

function buildPacket(sequence,size,message) {
  
 /* Message Start */ 
  
 var buffer = String.fromCharCode(27);  
  
 /* Sequence */ 
  
  if(sequence > 255) { console.log("buildPacket(): Sequence number exceeds 0xFF!"); }
 buffer += String.fromCharCode(sequence); /* must wrap after FF */
  
 /* Message Length */ 
  
 buffer += String.fromCharCode(0);    /* we are going to avoid going over 255 for simplicity for now */
 buffer += String.fromCharCode(message.length); /* length */
  
   if(message.length > 255) { console.log("buildPacket(): Message length exceeds what buildPacket() can handle (16 bit coming soon)"); } 
  
  
 /* Token (static) */ 
  
 buffer += String.fromCharCode(14); 
  
 /* Message */ 
  
  if(message.length > 275) { console.log("buildPacket(): Message length exceeds 275 bytes (STK500 does not support this)."); }
   buffer += message;          /* append message into buffer */
  var xor = 0;
  
 /* Checksum */ 
  
 for(var x = 0; x < buffer.length; x++) { 
    xor = xor ^ buffer.charCodeAt(x);
 }
 buffer += String.fromCharCode(xor);
  console.log("Checksum was: " + xor);
 return buffer;
}


function transmitPacket(buffer,delay) {
  setTimeout(function() {
  log(".");
  var debug = "";
  for(x = 0; x < buffer.length; x++) {
    debug += "[" + buffer.charCodeAt(x).toString(16) + "]"; 
  }
  console.log(debug);
  connection.send(buffer); 
  },delay + timer);
  timer = timer + delay;
}

var oneshot = 0;
var timer = 0;

function stk500_test() {
  oneshot = 0;
 // transmitPacket(String.fromCharCode(0xF0)+String.fromCharCode(0xF0)+String.fromCharCode(0xF0)+String.fromCharCode(0xF0),20);
  transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),0);
  transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),10);
  transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),10);
  stk500_getparam("HW_VER",50);
  stk500_getparam("SW_MAJOR",50);
  stk500_getparam("SW_MINOR",50);
  stk500_getparam("TOPCARD_DETECT",50);
  timer = 0;
}

function stk500_getparam(param,delay) {
  transmitPacket("A"+String.fromCharCode(parameters[param])+String.fromCharCode(command.Sync_CRC_EOP),delay);
}

function d2b(number) {
  return String.fromCharCode(number);
}

/* to program a page, we need to load in the address of flash memory. This address is independent of the bootloader space 
 the next step is to then provide up to 128 bytes of data over serial. There is a 0x00 and 0x46 that appears in the command.
 I have no idea what this does, but AVRDude uses this */

function stk500_prgpage(address,data,delay,flag) {
  address = hexpad16(address.toString(16)); /* convert and pad number to hex */
  address = address[2] + address[3] + address[0] + address[1];  /* make LSB first */
  console.log("Programming 0x"+address);
  address = String.fromCharCode(parseInt(address[0] + address[1],16)) +  String.fromCharCode(parseInt(address[2] + address[3],16)); /* h2b */
  transmitPacket(d2b(command.LOAD_ADDRESS)+address+d2b(command.Sync_CRC_EOP),delay);
  var debug = "";
  var datalen = data.length;
  buffer = "";
  transmitPacket(d2b(command.PROG_PAGE)+d2b(0x00)+d2b(datalen)+d2b(0x46)+data+d2b(command.Sync_CRC_EOP),delay);
  
}

function stk500_upload(heximage) {
  flashblock = 0;
  transmitPacket(d2b(command.ENTER_PROGMODE)+d2b(command.Sync_CRC_EOP),50);
  var blocksize = 128;
  blk = Math.ceil(heximage.length / blocksize);
  log("Binary data broken into "+blk+" blocks (block size is 128)\nComplete when you see "+blk+" dots: ")
  for(b = 0; b < Math.ceil(heximage.length / blocksize); b++) { 
     var currentbyte = blocksize * b;
     var block = heximage.substr(currentbyte,blocksize);
     /* console.log("Block "+b+" starts at byte "+currentbyte+": "+block) */
    flag = 0;
     stk500_prgpage(flashblock,block,250);
    flashblock = flashblock + 64;
  }
  timer = 0;
}
  
 

/* pads an 8 bit number */

function hexpad(num,size) { 
      var size = 2;
      var s = "00" + num;
    return s.substr(s.length-size);
    }

/* pads an 16 bit number */

function hexpad16(num,size) { 
      var size = 4;
      var s = "0000" + num;
    return s.substr(s.length-size);
    }


/* Interprets an ArrayBuffer as UTF-8 encoded string data. */
var ab2str = function(buf) {
  var bufView = new Uint8Array(buf);
  var encodedString = String.fromCharCode.apply(null, bufView);
  //console.log(encodedString);
  return decodeURIComponent(escape(encodedString));
};

/* Converts a string to UTF-8 encoding in a Uint8Array; returns the array buffer. */
var str2ab = function(str) {
 // var encodedString = unescape(encodeURIComponent(str));
  var encodedString = str;
  var bytes = new Uint8Array(encodedString.length);
  for (var i = 0; i < encodedString.length; ++i) {
    bytes[i] = encodedString.charCodeAt(i);
  }
  return bytes.buffer;
};

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

/* i stole chrome's arduino serial port example, thanks guys for the great foundation to build up from. no idea what half this crap is. */

var SerialConnection = function() {
  this.connectionId = -1;
  this.lineBuffer = "";
  this.boundOnReceive = this.onReceive.bind(this);
  this.boundOnReceiveError = this.onReceiveError.bind(this);
  this.onConnect = new chrome.Event();
  this.onReadLine = new chrome.Event();
  this.onError = new chrome.Event();
};


SerialConnection.prototype.onConnectComplete = function(connectionInfo) {
  if (!connectionInfo) {
    log("Connection failed.");
    return;
  }
  this.connectionId = connectionInfo.connectionId;
  serial.onReceive.addListener(this.boundOnReceive);
  serial.onReceiveError.addListener(this.boundOnReceiveError);
  this.onConnect.dispatch();
    serial.setControlSignals(connection.connectionId,DTRModeOn,function(result) { 
      console.log("DTR on: " + result); });
   
};


SerialConnection.prototype.onReceive = function(receiveInfo) {
  if (receiveInfo.connectionId !== this.connectionId) {
    return;
  }

  this.lineBuffer += ab2str(receiveInfo.data);
  var d = new Date();
  var n = d.getMilliseconds();
  var buffer = this.lineBuffer;
  var decoded = "";
  for(x = 0; x < buffer.length; x++ )
     { decoded += "[" + buffer.charCodeAt(x).toString(16) + "]"; }
  // console.log(n+" length: "+buff.length);
  //console.log(n+" received data: "+decoded);
  this.lineBuffer = "";
  var index;
  while ((index = this.lineBuffer.indexOf('\n')) >= 0) {
    var line = this.lineBuffer.substr(0, index + 1);
    this.onReadLine.dispatch(line);
    this.lineBuffer = this.lineBuffer.substr(index + 1);
  }
};

SerialConnection.prototype.onReceiveError = function(errorInfo) {
  if (errorInfo.connectionId === this.connectionId) {
    this.onError.dispatch(errorInfo.error);
  }
};

SerialConnection.prototype.getDevices = function(callback) {
  serial.getDevices(callback)
};


    
    
    
SerialConnection.prototype.connect = function(path) {
  serial.connect(path, SerialOpts, this.onConnectComplete.bind(this))
};

SerialConnection.prototype.send = function(msg) {
  if (this.connectionId < 0) {
    throw 'Invalid connection';
  }
  serial.send(this.connectionId, str2ab(msg), function() {});
};

SerialConnection.prototype.disconnect = function() {
  if (this.connectionId < 0) {
    throw 'Invalid connection';
  }
  
};



var connection = new SerialConnection();


/* this is the generic serial port line parser. we just check as stuff comes in async and then react to it */

connection.onReadLine.addListener(function(line) {
  console.log("RX line[" + line + "]");
  lasttext = line;
  if(pdustate == 1){
    pdustate = 0;
    log(smsDecode(line));
    connection.send("AT+CMGD="+msgid+"\r");         // we impuslively delete everything we get, last thing we need is full SMS memory..which is easy to do after 35-40 msgs.
   
  }
  if(line.indexOf("+CMTI") == 0)           /* if we get a message notification indicator */
    {msgid = line.split(",")[1].trim(); log("We got message "+msgid); connection.send("AT+CMGR="+msgid+"\r"); 
     }
  if(line.indexOf("+CMGR:") == 0) {         /* if we get the result from a read */
  pdustate = 1;
  }
  if(line.indexOf("+CMGS:000") == 0) {       /* if a message transmission was successful */
    sent.play();
    if(fileState == 0) {                    /* disable the animations and make it look like it was successful */
    disable = 0;
    $("#entry").prop("disabled", false);
    $("#entry").css("background-color","#ffffff");
    $("#entry").css('background-image', 'url(1pixel.gif)').css('background-repeat','no-repeat');
    }
    
    /* file transfer over SMS support. Works great..mostly..not ready yet... ive sent 2kB jpegs so far.. */
    
    if(fileState == 1) { sendFilePacket(); }         
    else if(fileState == 2) {
      filePacketPointer++;
      fileByteOffset = fileByteOffset + packetSize;
      sendFilePacket();
    }
    if(fileState == 3) { 
      sendFileEOF();
    }
    if(fileState == 4) {
      fileState = 0;
      var a = parseInt(fileHandle,16); 
      a=a+1; 
      fileHandle = hexpad(a.toString(16));
    }
  }
  
  /* handle SMS transmission errors. Typical 9555 operating proceedure is to just throw away the message you spend a half hour 
  trying to type on a DTMF pad. I HATE THAT. Lets make the experience better! */
  
  if(line.indexOf("+CMS ERROR") == 0) {
    error.play();
    if(fileState == 0) {
    disable = 0;
    $("#entry").prop("disabled", false);
    $("#entry").val(lastchat);
    $("#entry").css("background-color","#ff8888");  
    $("#smserror").dialog(open);
    $("#entry").css('background-image', 'url(1pixel.gif)').css('background-repeat','no-repeat');
    }
    
    /* if we were sending a file, this retransmits the SMS so it doesnt get lost */
    
    if(fileState == 1) {
       fileTransmit(fileName,fileDescription,fileBinary,fileHandler,fileHandle,fileEndpoint);
    }
    if(fileState == 2) {
      sendFilePacket();
    }
    if(fileState == 4) {
      sendFileEOF();
    }
  }
  
  /* If we get our signal quality message back, show a cute little signal indicator */
  
  if(line.indexOf("+CSQF:") == 0) { 
    console.log(line);
    var quality = line.split(":")[1].split("\r")[0].trim();
     console.log("["+quality+"]");
    if(quality == "5") { document.getElementById("signal").innerHTML ="&#9635;&#9635;&#9635;&#9635;&#9635;";  }
    if(quality == "4") { document.getElementById("signal").innerHTML ="&#9635;&#9635;&#9635;&#9635;&#9633;";  }
    if(quality == "3") { document.getElementById("signal").innerHTML ="&#9635;&#9635;&#9635;&#9633;&#9633;";  }
    if(quality == "2") { document.getElementById("signal").innerHTML ="&#9635;&#9635;&#9633;&#9633;&#9633;";  }
    if(quality == "1") { document.getElementById("signal").innerHTML ="&#9635;&#9633;&#9633;&#9633;&#9633;"; }
    if(quality == "0") { document.getElementById("signal").innerHTML ="No Service";  }
  }
  
  /* parse out the geolocation message and then provide position information */
  
  if(line.indexOf("-MSGEO:") == 0) { 
  var x = line.split(" ")[1].split(",")[0];
  var y = line.split(" ")[1].split(",")[1];
  var z = line.split(" ")[1].split(",")[2];
  var epoch = line.split(" ")[1].split(",")[3].trim();
  console.log("GEO info - x: "+x+" y: "+y+" z: "+z+" epoch: "+epoch);
  var result = outputResult(x,y,z,epoch);
  console.log(result);
    log("Lat: "+result[0]+" Lon: "+result[1]+" Time: "+result[2]);  
    document.getElementById("pos").innerHTML = "Lat: "+result[0]+" Lon: "+result[1];
    
  }

});

// Populate the list of available devices
connection.getDevices(function(ports) {
  // get drop-down port selector
  var dropDown = document.querySelector('#port_list');
  // clear existing options
  dropDown.innerHTML = "";
  // add new options
  ports.forEach(function (port) {
    var displayName = port["displayName"] + "("+port.path+")";
    if (!displayName) displayName = port.path;
    
    var newOption = document.createElement("option");
    newOption.text = displayName;
    newOption.value = port.path;
    dropDown.appendChild(newOption);
  });
});

// Handle the 'Connect' button
document.querySelector('#connect_button').addEventListener('click', function() {

 // $("#connect_box").dialog("close");
  // get the device to connect to
  var dropDown = document.querySelector('#port_list');
  var devicePath = dropDown.options[dropDown.selectedIndex].value;
  // connect
  log("Connecting to "+devicePath);
  connection.connect(devicePath);
  $("#connect_box").toggle("explode");
});
                


////////////////////////////////////////////////////////

// Toggle LED state




(function($)
{
    jQuery.fn.putCursorAtEnd = function()
    {
    return this.each(function()
    {
        $(this).focus()

        // If this function exists...
        if (this.setSelectionRange)
        {
        // ... then use it
        // (Doesn't work in IE)

        // Double the length because Opera is inconsistent about whether a carriage return is one character or two. Sigh.
        var len = $(this).val().length * 2;
        this.setSelectionRange(len, len);
        }
        else
        {
        // ... otherwise replace the contents with itself
        // (Doesn't work in Google Chrome)
        $(this).val($(this).val());
        }

        // Scroll to the bottom, in case we're in a tall textarea
        // (Necessary for Firefox and Google Chrome)
        this.scrollTop = 999999;
    });
    };
})(jQuery);



var tabCounter = 0;
var tabs = $( "#tabs" ).tabs();
var tabTemplate = "<li><a href='#{href}'>#{label}</a> <span class='ui-icon ui-icon-close' role='presentation'>Remove Tab</span></li>";
var tabTemplateNoClose = "<li><a href='#{href}'>#{label}</a></li>";
var tabTitle = "";
var tabContent = "";

  function addTab() {
      var dt = new Date();
      var label = $("#newsmsnum").val(),
        id = $("#newsmsnum").val(),
        li = $( tabTemplate.replace( /#\{href\}/g, "#" + id ).replace( /#\{label\}/g, label ) ),
        tabContentHtml = "New conversation started ("+dt+")";
        if(id == "00881662990000") { tabContentHtml += "<br/>(E-Mail to Iridium Gateway)"; }
 
      tabs.find( ".ui-tabs-nav" ).append( li );
      tabs.append( "<div id='" + id + "' style='width: 100%; height: 80%; overflow: auto;'><p>" + tabContentHtml + "</p></div>" );
      tabs.tabs( "refresh" );
      tabCounter++;
    }

   tabs.delegate( "span.ui-icon-close", "click", function() {
      var panelId = $( this ).closest( "li" ).remove().attr( "aria-controls" );
      $( "#" + panelId ).remove();
      tabs.tabs( "refresh" );
    });

$('#entry').keypress(function(event){
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if(keycode == '13'){
        lastchat = $("#entry").val();
        var chat = document.querySelector('[aria-hidden="false"]');
         if(chat.id == "buffer") { 
            connection.send($("#entry").val() + "\r");
         }
         if(chat.id != "buffer") {
            smsEncode(chat.id,$("#entry").val(),"");
         }  /* probably need to provide some sort of send progress feedback and fail capability */
         chat.innerHTML += "<p class='triangle-isosceles right'>" + $("#entry").val() + "</p>";
      chat.scrollTop = chat.scrollHeight;
        $("#entry").val(""); 
  if(chat.id != "buffer") {     inchat.play();
                           if(demo != 1) {
      $("#entry").prop("disabled", true);
      $("#entry").css("background-color","#888888");
      $("#entry").css('background-image', 'url(load.gif)').css('background-repeat','no-repeat');
                           } } }
});

function chatPrint(msisdn, text,timestamp) {
  console.log("Printing: "+msisdn+" with "+text);
  console.log("Hidden: "+isHidden());
      if(isHidden()) { notify(msisdn, text); }
  if($("#" + msisdn).length > 0) {
    console.log("This window was already open!");
    inchat.play();
    var chat = document.getElementById(msisdn);
    chat.innerHTML +=  "<p class='triangle-isosceles left'><font size='-2'>"+timestamp+"</font><br/>" + text + "</p>"; 
    chat.scrollTop = chat.scrollHeight;

  }
  if($("#" + msisdn).length < 1) { 
    console.log("this window is not open..opening it...");
     newmsg.play();
     $("#newsmsnum").val(msisdn);
     addTab();
     var chat = document.getElementById(msisdn);
     chat.innerHTML +=  "<p class='triangle-isosceles left'><font size='-2'>"+timestamp+"</font><br/>" + text + "</p>"; 
    chat.scrollTop = chat.scrollHeight;
  }
  
}


function getHiddenProp(){
    var prefixes = ['webkit','moz','ms','o'];
    
    // if 'hidden' is natively supported just return it
    if ('hidden' in document) return 'hidden';
    
    // otherwise loop over all the known prefixes until we find one
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document) 
            return prefixes[i] + 'Hidden';
    }

    // otherwise it's not supported
    return null;
}

function isHidden() {
    var prop = getHiddenProp();
    if (!prop) return false;
    
    return document[prop];
}

document.querySelector("#upload").addEventListener('click', function() {
    var filename = "";
    chrome.storage.local.get("airduino", function(data){
        filename=data;
    });
    var url_to_GET = 'https://airduino-binaries.s3.amazonaws.com/54bbdaf30e04cb4d6727b63a';

    $.ajax({
        crossDomain: true,
        url: url_to_GET,
        type: 'GET',
        success: function(data){
        
            hexfileascii=data;
            fixHex();
            console.log(data);
            serial.setControlSignals(connection.connectionId,DTRRTSOff,function(result) { 
                console.log("DTR off: " + result); 

                setTimeout(function(){                                                                      
                   serial.setControlSignals(connection.connectionId,DTRRTSOn,function(result) { 
                        console.log("DTR on:" + result);
                        setTimeout(function() { 
                         log("Arduino reset, now uploading.\n"); stk500_upload(hexfile);
                        },200);
                   });   
                }, 50);
          });                                                                            
              
        },
        error: function(error){
            console.log(error);
        }
    });
    
    console.log("LOL");

});

var chosenFileEntry = null;

/* convert the ASCII hex into binary */

function fixHex() {
   hexfile = "";
   buffer = hexfileascii.split("\n");
   for(x = 0; x < buffer.length; x++) {
     size = parseInt(buffer[x].substr(1,2),16);
     console.log("record size "+size);
     if(size == 0) { log("complete!\n"); $("#upload").removeClass("off"); return; }
     for(y = 0; y < (size * 2); y = y + 2) 
     {
       console.log(buffer[x].substr(y+9,2));
       hexfile += String.fromCharCode(parseInt(buffer[x].substr(y+9,2),16));      
     }
     
   }
}


function reset() { 
  log("Resetting device....")
  serial.setControlSignals(connection.connectionId,DTRRTSOff,function(result) { 
        console.log("DTR off: " + result); 
        setTimeout(function(){                                                                      
           serial.setControlSignals(connection.connectionId,DTRRTSOn,function(result) { 
                console.log("DTR on:" + result);
                log("done.\n");
           });   
        }, 100);
  }); 

}


function log(text) { 
  $("#console").append(text+'n');
  var elem = document.getElementById('console');
  elem.scrollTop = elem.scrollHeight;

}
