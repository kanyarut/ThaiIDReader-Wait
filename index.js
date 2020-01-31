var pcsclite = require('pcsclite');

// command list
const _INIT_SELECT = [0x00, 0xA4, 0x04, 0x00, 0x08, 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01]

const _SELECT1 = [0x00, 0xC0, 0x00, 0x00]
const _SELECT2 = [0x00, 0xc0, 0x00, 0x01]

let _SELECT = _SELECT1;

const _CID  = [0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d]
const _THFULLNAME  = [0x80, 0xb0, 0x00, 0x11, 0x02, 0x00, 0x64]
const _ENFULLNAME  = [0x80, 0xb0, 0x00, 0x75, 0x02, 0x00, 0x64]
const _BIRTH  = [0x80, 0xb0, 0x00, 0xD9, 0x02, 0x00, 0x08]
const _GENDER  = [0x80, 0xb0, 0x00, 0xE1, 0x02, 0x00, 0x01]
const _ISSUER  = [0x80, 0xb0, 0x00, 0xF6, 0x02, 0x00, 0x64]
const _ISSUE  = [0x80, 0xb0, 0x01, 0x67, 0x02, 0x00, 0x08]
const _EXPIRE  = [0x80, 0xb0, 0x01, 0x6F, 0x02, 0x00, 0x08]
const _ADDRESS  = [0x80, 0xb0, 0x15, 0x79, 0x02, 0x00, 0x64]

class ThaiIDReader {
    reader = null;
    pcsc = null;
    protocol = null;

	constructor() {	
		this.read = this.read.bind(this)
	    this.onReader = this.onReader.bind(this)
	    this.readData = this.readData.bind(this)
	    this.sendCommand = this.sendCommand.bind(this)
	    this.transmit = this.transmit.bind(this)
	    this.readerExit = this.readerExit.bind(this)
	    this.pcscExit = this.pcscExit.bind(this)
	}

    async read(cb,errorcb){
        this.cb = cb;
        this.errorcb = errorcb;
        this.pcsc = pcsclite()

        let openTimeout = setTimeout(()=>{ 
            this.onPcscError("No Reader Found"); 
        },10000);
        
        this.pcsc.on('reader', (reader)=>{ clearTimeout(openTimeout); this.onReader(reader); })
        this.pcsc.on('error', (err)=>{clearTimeout(openTimeout); this.onPcscError(err)})
    }
		
    onReader(reader){
        this.reader = reader;
        this.reader.on('status', (status) => {
            //console.log(status)
            var changes = this.reader.state ^ status.state;
            if (changes) {
                if ((changes & this.reader.SCARD_STATE_EMPTY) && (status.state & this.reader.SCARD_STATE_EMPTY)) {
                    this.errorcb('Card removed')
                    //this.readerExit(true);
                } else if ((changes & this.reader.SCARD_STATE_PRESENT) && (status.state & this.reader.SCARD_STATE_PRESENT)) {
                    // detect corrupt card and change select apdu
                    console.log("Card inserted")
                    if (status.atr[0] == 0x3B && status.atr[1] == 0x67) { _SELECT = _SELECT2;}
                    
                    setTimeout(()=>{ 
                        this.onCardInsert(); 
                    },3000);
                }
            }
        });
    }

    onCardInsert() {
        console.log("onCardInsert")
        /*
        this.reader.connect({share_mode: this.reader.SCARD_SHARE_SHARED},(err, protocol) => {
            if (err) {
                console.log(err)
                setTimeout(()=>{
                    this.onCardInsert();
                },1000);
            } else {
                this.protocol = protocol;
                return this.readData( true );
            }
        })
        */
        this.reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
            if (err) {
                console.log(err);
            } else {
                console.log('Protocol(', this.reader.name, '):', protocol);
                reader.transmit(new Buffer([0x00, 0xB0, 0x00, 0x00, 0x20]), 40, protocol, function(err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Data received', data);
                        this.reader.close();
                        this.pcsc.close();
                    }
                });
            }
        });
    }

     async readData ( init ) {
        let result = {};
        console.log("readData");
        try {
            if(init)await this.sendCommand(_INIT_SELECT);
            result.cid = await this.sendCommand(_CID, true);
            result.fullname = await this.sendCommand(_THFULLNAME, true);
            result.dob = await this.sendCommand(_BIRTH, true);
            result.gender = await this.sendCommand(_GENDER, true);
            result.address = await this.sendCommand(_ADDRESS, true);
        } catch(e) {
            this.errorcb(e)
        }
        this.readerExit();
        this.cb( result );
    }

    async sendCommand (command, select) {
        //console.log("sendCommand");
        let data = null
        let commands = [command]
        if (select) commands.push( _SELECT.concat(command.slice(-1)) )
        for(let i in commands) {
            data = await this.transmit( commands[i])
        }
        return this.hex2string(data.toString('hex'))
    }

    async transmit (command) {
      	return new Promise((resolve, reject) => {
            //console.log(this.protocol)
	        this.reader.transmit(Buffer.from(command), 256, this.protocol, (err, data) => {
				if(err) {
					reject(err)
				}
				else {
					resolve(data)
				}
	        })
      	})
    }

    hex2string (input) {
		let tempHex = input
		if (tempHex.length > 4) tempHex = tempHex.slice(0, -4)
		const patt = /^[a-zA-Z0-9&@.$%\-,():`# \/]+$/
		const hex = tempHex.toString()
		let str = ''
		let tmp = ''
		for (let i = 0; i < hex.length; i += 2) {
			tmp = String.fromCharCode(parseInt(hex.substr(i, 2), 16))
			if (!tmp.match(patt)) {
				tmp = String.fromCharCode(parseInt(hex.substr(i, 2), 16) + 3424)
			}
			str += tmp
		}
		str = str.replace(/#/g, ' ').trim()
		return str
    }

    onPcscError(err){
        this.errorcb(err)
        this.pcscExit();
    }

    readerExit(empty){
        if(this.reader) {
            this.reader.close();
            this.pcscExit();
        }
    }

    pcscExit(){
        if(this.pcsc) {
            this.pcsc.close();
        }
    }
}
module.exports = ThaiIDReader