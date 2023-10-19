const DiscordJS = require('discord.js')
const WOKCommands = require('wokcommands')
const path = require('path')
const mongoose = require('mongoose')
const { mongodb, spotify } = require('./config.json');
const { Player } = require("discord-music-player");

const codesModel = require('./models/codesSchema');

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = spotify.id; // Your client id
var client_secret = spotify.secret; // Your secret
var redirect_uri = spotify.redirect_url + process.env.PORT || 3000 + '/callback'; // Your redirect uri

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

   app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);
  
    var scope = 'ugc-image-upload user-read-playback-state user-modify-playback-state user-read-currently-playing streaming app-remote-control user-read-email user-read-private playlist-read-collaborative playlist-modify-public playlist-read-private playlist-modify-private user-library-modify user-library-read user-top-read user-read-playback-position user-read-recently-played user-follow-read user-follow-modify';
    res.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
      }));
});

app.get('/callback', async function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;


  if (state === null || state !== storedState) {
    res.redirect('/?' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        state: state
      
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };
    
    
    request.post(authOptions, async function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token;
        var refresh_token = body.refresh_token;

        let codes = await codesModel.create({
          state: state,
          code: code,
          access_token: access_token,
          refresh_token: refresh_token,
        })
        codes.save();
        
        res.redirect('/?' +
          querystring.stringify({
            code: code,
            state: state
          }));
      } else {
        res.redirect('/?' +
          querystring.stringify({
            error: 'invalid_code'
          }));
      }
    });
  }
});

app.listen(3000);

const { Intents } = DiscordJS

const client = new DiscordJS.Client({
  restTimeOffset: 0,
  // These intents are recommended for the built in help menu
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
  ws: { properties: { $browser: 'Discord Android' } }
})
const player = new Player(client, {
  leaveOnEmpty: false,
  leaveOnEnd: false,
  deafenOnJoin: true
});
// You can define the Player as *client.player* to easily access it.
client.player = player;

client.on('ready', () => {
    new WOKCommands(client, {
        commandsDir: path.join(__dirname, 'commands'),
        featuresDir: path.join(__dirname, 'features'),
        typeScript: false,
        showWarns: false,
        delErrMsgCooldown: 0,
        ignoreBots: true,
        botOwners: ['810914149135548416'],
        disabledDefaultCommands: [
            'help',
            'command',
            'language',
            'prefix',
            'requiredrole',
            'channelonly'
        ],
        debug: false
    })
        .setDefaultPrefix(',')
});

client.config = require('./config.json');
mongoose.connect(mongodb, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() =>{
  console.log('Connected to the database!!')
}).catch((err) => {
  console.log(err);
});


client.login('MTAzMTYxMDg5NDY5NTgxMzI4MA.Gcl0b1.MLOsJr5LYluAOYbxICCwqvLEQmpbdIvHELqldM')
