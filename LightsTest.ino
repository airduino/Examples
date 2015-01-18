void setup(){
      
}

void loop(){
  int time = {{INTEGER:blink_speed:100,10000}};
  while(true){
    analogWrite("A0", 100);
    delay(time);
  }
}
