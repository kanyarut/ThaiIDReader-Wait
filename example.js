#!/usr/bin/env node	#!/usr/bin/env node
var ThaiIDReader = require('./index');	
var idread = new ThaiIDReader();
idread.read((e)=>{
    console.log("Success");
    console.log(e);
},(e)=>{
    console.log("Error");
    console.log(e);
});