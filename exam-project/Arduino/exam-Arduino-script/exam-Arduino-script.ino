#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

// pins
const int pwmPin = 9; // LED pin
const int analogInPin = A0; // LDR pin

// read vars
String inputString = "";
boolean pwmComplete = false;

// all sensor vars
float tempVal = 0;
float humidVal = 0;
int sensorVal = 0;
float lightVal = 0;
int prevLightVal = 0;

// comparing vars
float oldTemp = 1;
float oldHumid = 1;
float oldLight = 1;
float olds[3] = {oldTemp, oldHumid, oldLight};

#define SEALEVELPRESSURE_HPA (1013.25)

Adafruit_BME280 bme;

void setup() {
    Serial.begin(9600);
    
    // initialize the LED
    pinMode(pwmPin, OUTPUT);
    analogWrite(pwmPin, 0);

    bool status;
    
    // default settings
    // (you can also pass in a Wire library object like &Wire2)
    status = bme.begin(0x76);  //I2C address can be 0x77 or 0x76 (by default 0x77 set in library)
    if (!status) {
        Serial.println("Could not find a valid BME280 sensor, check wiring!");
        while (1);
    }
}

void loop() { 
    printValues();
    checkInput();
    delay(500);
}

void printValues() {
    
    // Sensor readings
    tempVal = bme.readTemperature();
    humidVal = bme.readHumidity();
    sensorVal = analogRead(analogInPin);
    lightVal = sensorVal/1024.*100;

    float newAr[3] = {tempVal, humidVal, lightVal};

    if (hasDifference( newAr, olds)) {
    // If there is a difference identified in the sensors,
    // Print them

    oldTemp = tempVal;
    oldHumid = humidVal;
    oldLight = lightVal;
    float olds[3] = {oldTemp, oldHumid, oldLight};

    Serial.print("AT");
    Serial.print(tempVal);

    //Serial.print("P:" + bme.readPressure() / 100.0F);
    //Serial.println(" hPa");

    Serial.print("H");
    Serial.print(humidVal);

    Serial.print("L");
    Serial.print(lightVal);

    Serial.print("B"); // The message lies between A and B
    Serial.println();
    }
}

bool hasDifference( float news[3], float olds[3]) {
    for (int i = 0; i < 3; i++) {
      if (news[i] != olds[i]) {
        return true;
      }
    }
    return false;
}

void checkInput() {
  if (Serial.available() > 0) {
    int input = Serial.read();
    // use the value of the incoming byte to control the LED's brightness:
    analogWrite(pwmPin, input);
  }
}
