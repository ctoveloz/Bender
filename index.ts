const wa = require("@open-wa/wa-automate");
const { create, decryptMedia, ev } = wa;
const uaOverride = 'WhatsApp/2.16.352 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Safari/605.1.15';
const { default: PQueue } = require("p-queue");
const fs = require("fs");
const YoutubeMp3Downloader = require("youtube-mp3-downloader");
const path = require('path');
const rimraf = require('rimraf');
const moment = require('moment');
const youtubeDl = require('youtube-dl');
const request = require('request');
const createCsvWriter = require('csv-writer').createArrayCsvWriter;
const mime = require('mime-types');

/* instagram */
const axios = require('axios')
const qs = require('querystring')
const cheerio = require('cheerio');

const csvWriter = createCsvWriter({
  header: ['NAME', 'E-mail', 'Phone'],
  path: './registrados/contacts' + moment() + '.csv'
});



// Fila
const queue = new PQueue({
  concurrency: 1,
  autoStart: false,
});

/**
 * WA Client
 * @type {null | import("@open-wa/wa-automate").Client}
 */
let cl = null;

/**
 * Process the message
 * @param {import("@open-wa/wa-automate").Message} message
 */

//array of senders
const obj = [];

async function procMess(message) {

  //VARIAVEIS
  const senderId = message.sender.id;
  const nameSender = message.sender.pushname;
  const messageSender = message.body;


  /*********************
    *
    *
    *  COMEÇO FUNÇÃO BLOQUEIO
    * 
    * *****************/
  const blockSender = function () {
    //registra sender que usou o serviço
    var holder = {};
    obj.forEach(function (d) {
      if (holder.hasOwnProperty(d.id)) {
        holder[d.id] = holder[d.id] + d.value;
      } else {
        holder[d.id] = d.value;
      }
    });
    var obj2 = [];
    for (var prop in holder) {
      obj2.push({ id: prop, value: holder[prop] });
    }

    // filtro retorna historico sender
    var id_filter = senderId;
    var filtered = obj2.filter(function (item) {
      return id_filter.indexOf(item.id) !== -1;
    });

    // Bloqueia sender que usou o serviço por mais de 5x
    for (var i = 0; i < filtered.length; i++) {
      if (filtered[i].value >= 5) {

        var id = filtered[0].id;

        cl.sendText(message.from, '📵 Você usou o seu limite grátis disponivel, você podera usar novamente em 30 minutos.\n 🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* quando for desbloqueado.');

        console.log(id + ' Foi Bloqueado');

        //bloqueia contato sender
        setTimeout(function () {
          cl.contactBlock(message.from);
        }, 100);

        // Desbloqueia sender
        setTimeout(function () {
          cl.contactUnblock(message.from);

          console.log(id + ' Foi Desbloqueado');

          //deleta historico sender, sempre 1 numero a mais que o limite de bloqueio
          for (var i = 0; i < obj.length; i++) {
            if (obj[i].id == id) {
              obj.splice(i, 6);
              break;
            }
          }

        }, 1800000);

      }
    }
  }

  /*********************
   *
   *
   *  FIM FUNÇÃO BLOQUEIO
   * 
   * *****************/



  //somente o numero
  const regNumberPhone = senderId.toString().replace('@c.us', '');


  // YOUTUBE TO MP3
  if (message.body.includes('#mp3') && (message.body.includes('youtube.com')) || message.body.includes('#mp3') && (message.body.includes('youtu.be'))) {

    blockSender();

    /**** CONVERSOR YOUTUBE *****/

    // GET URL YOUTUBE
    const youtubeUrl = message.body.replace("#mp3", "");
    //Configure YoutubeMp3Downloader with your settings
    var YD = new YoutubeMp3Downloader({
      "ffmpegPath": "/usr/bin/ffmpeg",        // FFmpeg binary location
      "outputPath": "./mp3",    // Output file location (default: the home directory)
      "youtubeVideoQuality": "lowest",  // Desired video quality (default: highestaudio)
      "queueParallelism": 1,                  // Download parallelism (default: 1)
      "progressTimeout": 999999999,                // Interval in ms for the progress reports (default: 1000)
      "allowWebm": true                      // Enable download from WebM sources (default: false)
    });

    //regex youtube
    const youtubeParser = function (url) {
      var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      var match = url.match(regExp);
      return (match && match[7].length == 11) ? match[7] : false;
    }

    const youtubeId = youtubeParser(message.body).toString();

    //Download video and save as MP3 file
    YD.download(youtubeId);

    YD.on("finished", function (err, data) {

      const musicTitle = data.videoTitle.toString();
      const musicId = encodeURIComponent(data.videoId).toString();

      console.log(senderId + ' converteu ' + musicTitle);
      cl.sendFile(message.from, './mp3/' + musicId + '.mp3', musicTitle, null, `${message.id}`).then(() => {

        cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

        //deleta chat
        cl.deleteChat(message.from);

        //registra sender em obj
        obj.push({ id: senderId, value: 1 });

        //deleta mp3 apos meia hora
        setTimeout(function () {

          try {
            rimraf('./mp3/' + musicId + '.mp3', function (e) {
              console.log(musicId + 'deletado');
            });
          } catch (e) {
            console.log(e);
          }

        }, 1800000);

      });
      //register DB

      /*
      clMongo.connect(err => {
        const mensagensSenders = clMongo.db("mensagenswp").collection("mensagens");

        const mensagem = message.body;
        const senderId = message.sender.id;
        const musicTitle = data.videoTitle.toString();
        let mensagens = { mensagem: mensagem, senderId: senderId, musicTitle: musicTitle};

        mensagensSenders.insertOne(mensagens, function(err, res) {
          if (err) throw err;
          console.log("1 musica convertida para mp3");
        });
      })

      */
    });

    YD.on("error", function (error) {
      cl.sendText(message.from, '⚠️ Erro neste video do Youtube. \n\n ❌ *Não Funciona:* \n - _Videos com mais de 8 minutos._ \n\n ✅ _Procure um link diferente no YOUTUBE da mesma musica._ ', `${message.id}`);
      console.log(error);
    });


  }

  //YOUTUBE TO MP4
  else if (message.body.includes('#mp4') && (message.body.includes('youtube.com')) || message.body.includes('#mp4') && (message.body.includes('youtu.be'))) {

    blockSender();

    let url = message.body.replace("#mp4", "");

    //regex youtube
    const youtubeParser = function (url) {
      var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      var match = url.match(regExp);
      return (match && match[7].length == 11) ? match[7] : false;
    }

    const youtubeId = youtubeParser(url).toString();

    youtubeDl.getInfo(youtubeId, function (err, info) {
      'use strict'
      if (err) {
        throw err
      }
      if (info === undefined || info === null) {
        cl.reply(message.from, `⚠️ Erro, tente outro.`, `${message.id}`);
        throw err
      } else {

        const minutos = info.duration.replace(":", "");
        if (minutos > 800) {
          cl.reply(message.from, `⚠️ O video tem que ter no máximo 8 minutos.`, `${message.id}`);
        } else {
    
            cl.sendFileFromUrl(message.from, info.url, 'videoyt.mp4', '', `${message.id}`).then(() => {

              cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

              //deleta chat
              cl.deleteChat(message.from);
      
              //registra sender em obj
              obj.push({ id: senderId, value: 1 });

            });
  
        }

      }

    })

    /*
    youtubeDl.exec(url, ['-x', '--audio-format', 'mp3'], {}, function exec(err,output) {
      'use strict'
      if (err) {
        throw err
      }
      console.log(output);
    })
    */

  }


  // FACEBOOK Download
  else if (message.body.includes('#fb') && message.body.includes('facebook.com') || message.body.includes('#fb') && message.body.includes('fb.watch')) {

    blockSender();
    
    let url = message.body.replace("#fb", "");

    youtubeDl.getInfo(url, function (err, info) {
      'use strict'
      if (err) {
        cl.reply(message.from, `⚠️ Erro, tente outro.`, `${message.id}`);
        throw err
      }
      if (info === undefined || info === null) {
        cl.reply(message.from, `⚠️ Erro, tente outro.`, `${message.id}`);
      } else {
      
        cl.sendFileFromUrl(message.from, info.url, 'videofb.mp4', '', `${message.id}`).then(() => {

          cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

          //deleta chat
          cl.deleteChat(message.from);
  
          //registra sender em obj
          obj.push({ id: senderId, value: 1 });

        });


      }

    })

  }


  // INSTAGRAM Download
  else if (message.body.includes('#ig') && message.body.includes('instagram.com')) {

    blockSender();

    let url_post = message.body.replace("#ig", "");

    let split_url = url_post.split('/');
    let ig_code = split_url[4];

    const urlConvertida = "https://www.instagram.com/p/" + ig_code + "/?__a=1";

    console.log('url: ', urlConvertida);

    var url = "https://sssinstagram.com/results";
    const requestBody = {
      id: urlConvertida,
    }
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }

    axios.post(url, qs.stringify(requestBody), config)
      .then((result) => {
        // Do somthing
        let $ = cheerio.load(result.data);
        let ig = [];

        $('div.button_div > a').each(function (i, e) {
          ig[i] = $(this).attr("href");
        });
        console.log(ig[0])

        cl.sendFileFromUrl(message.from, ig[0], 'videofb.mp4', '', `${message.id}`).then(() => {

          cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

          //deleta chat
          cl.deleteChat(message.from);

          //registra sender em obj
          obj.push({ id: senderId, value: 1 });

        });

      })


  }

  //FIGURINHA
  else if (message.mimetype) {
    const filename = `${message.t}.${mime.extension(message.mimetype)}`;

    // if it is a sticker, you need to run this.
    let mediaData;
    if (message.type === 'sticker') {
      //getStickerDecryptable is an insiders feature! 
      let stickerDecryptable = await cl.getStickerDecryptable(message.id);
      if (stickerDecryptable) mediaData = await decryptMedia(stickerDecryptable, uaOverride);
    } else {
      mediaData = await decryptMedia(message, uaOverride);
    }
    if (message.type === 'video' && message.caption.includes('#figurinha') || message.type === 'video' && message.caption.includes('#Figurinha') || message.type === 'video' && message.caption.includes('#FIGURINHA')) {
      blockSender();
      const mp4_as_sticker = await cl.sendMp4AsSticker(message.from, mediaData).then(() => {

        cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

        //deleta chat
        cl.deleteChat(message.from);

        //registra sender em obj
        obj.push({ id: senderId, value: 1 });

      });
    }
    if (message.type === 'image' && message.caption.includes('#figurinha') || message.type === 'image' && message.caption.includes('#Figurinha') || message.type === 'image' && message.caption.includes('#FIGURINHA')) {
      blockSender();
      await cl.sendImageAsSticker(message.from, `data:${message.mimetype};base64,${mediaData.toString('base64')}`).then(() => {

        cl.sendText(message.from, '🏆 Ajude com uma doação e ganhe uma conta _ilimitada_ digite *#ajudar* .');

        //deleta chat
        cl.deleteChat(message.from);

        //registra sender em obj
        obj.push({ id: senderId, value: 1 });

      });
    }

  }

  //MENU
  else if (message.body.includes('#menu')) {

    if (nameSender === undefined || nameSender === null) {

      cl.reply(message.from,
        'Olá,\n Aqui estão os comandos do Bender. \n\n  *#ig* _link video Instagram_ \n Baixa videos do Instagram. \n\n  *#mp3* _link video youtube_ \n Converte videos do youtube para mp3.\n\n  *#mp4* _link video Youtube_ \n Baixa videos do Youtube.\n\n  *#fb* _link video Facebook_ \n Baixa videos do Facebook.\n\n ✨ Envie Imagem ou Video com a legenda *#figurinha* e transforme em figurinhas.\n\n 📧 *#cadastrar* _Receba as próximas novidades do Bender._  \n\n 🏆 *#ajudar* Ajude a manter o Bender.\n\n\n Desenvolvido por: https://cmation.codes', `${message.id}`);

    } else {
      cl.reply(message.from,
        'Olá ' + nameSender + '\n Aqui estão os comandos do Bender. \n\n  *#ig* _link video Instagram_ \n Baixa videos do Instagram. \n\n  *#mp3* _link video youtube_ \n Converte videos do youtube para mp3.\n\n  *#mp4* _link video Youtube_ \n Baixa videos do Youtube.\n\n  *#fb* _link video Facebook_ \n Baixa videos do Facebook.\n\n ✨ Envie Imagem ou Video com a legenda *#figurinha* e transforme em figurinhas.\n\n 📧 *#cadastrar* _Receba as próximas novidades do Bender._  \n\n 🏆 *#ajudar* Ajude a manter o Bender.\n\n\n Desenvolvido por: https://cmation.codes', `${message.id}`);
    }
  }

  //teste bloqueio
  else if (message.body.includes('#ajudar') || message.body.includes('#ajuda') || message.body.includes('#Ajuda') || message.body.includes('#Ajudar')) {

    if (nameSender === undefined || nameSender === null) {
      cl.reply(message.from,
        'Olá 😊,\n Ajudando o Bender você pode usar todas as funções sem limites.\n\n Link de Doação: https://mpago.la/2e6YAtr \n\n Envie o comprovante para o email: cmation.codes@gmail.com', `${message.id}`);
    } else {

      cl.reply(message.from,
        'Olá' + nameSender + ' 😊\n Ajudando o Bender você pode usar todas as funções sem limites.\n\n Link de Doação: https://mpago.la/2e6YAtr \n\n Envie o comprovante para o email: cmation.codes@gmail.com', `${message.id}`);

    }

  }

  //teste bloqueio
  else if (message.body.includes('#bloc')) {
    blockSender();
    cl.deleteChat(message.from);
    obj.push({ id: senderId, value: 1 });
  }

  //teste bloqueio
  else if (message.body.includes('#blocc')) {
    blockSender();
    cl.deleteChat(message.from);
    obj.push({ id: senderId, value: 1 });
  }

  else if (message.body.includes('#cadastrar')) {
    cl.reply(message.from, `Se inscreva e saiba as próximas novidades do Bender.\n *Qual o seu email?*`, `${message.id}`);
  }

  else if (message.body.includes('@')) {


    const validateEmail = function (email) {
      var re = /\S+@\S+\.\S+/;
      return re.test(email);
    }

    if (validateEmail(messageSender)) {

      const records = [
        [nameSender, messageSender, regNumberPhone]
      ];

      csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
          console.log(nameSender + ' foi registrado');
        });

      cl.reply(message.from, `Tudo certo você agora esta registrado.`, `${message.id}`);

      //deleta contato sender
      setTimeout(function () {
        cl.deleteChat(message.from);
      }, 900);

    } else {
      cl.reply(message.from, `O email não é válido.`, `${message.id}`);
    }
  }

  else {

    cl.reply(message.from, '⚠️ Digite *#menu*', `${message.id}`);

    setTimeout(function () {
      cl.deleteChat(message.from);
    }, 3600000);

  }

}

/**
 * Add message to process queue
 */
const processMessage = (message) =>
  queue.add(async () => {
    try {
      procMess(message);
    } catch (e) {
      console.error(e);
    }
  });

/**
 * Initialize client
 * @param {import("@open-wa/wa-automate").Client} client
 */
async function start(client) {
  cl = client;
  queue.start();
  client.onMessage(processMessage);
}

ev.on("qr.**", async (qrcode) => {
  const imageBuffer = Buffer.from(
    qrcode.replace("data:image/png;base64,", ""),
    "base64"
  );
  fs.writeFileSync("./public/qr_code.png", imageBuffer);
});

create({
  sessionId: 'BenderTest',
  headless: true,
  autoRefresh: true,
  restartOnCrash: start,
  qrTimeout: 0,
  cacheEnabled: false,
  useChrome: true,
  killProcessOnBrowserClose: true,
  throwErrorOnTosBlock: false,
  chromiumArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--aggressive-cache-discard',
    '--disable-cache',
    '--disable-application-cache',
    '--disable-offline-load-stale-cache',
    '--disk-cache-size=0'
  ]
}).then((client) => start(client));