const { MessageEmbed, MessageButton, MessageActionRow } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const prModel = require('../../models/prSchema');
const codesModel = require('../../models/codesSchema');
var Spotify = require('node-spotify-api');
const errorModel = require('../../models/errorSchema');
const { spotify, bot } = require('../../config.json')
const client_id = spotify.id;
const client_secret = spotify.secret;
const discordServer = bot.support;
const website = spotify.redirect_url + 3000;

const cooldowns = new Map();
const cooldowns1 = new Map();

module.exports = {
    aliases: ['sp'],
    category: 'spotify-commands',
    ownerOnly: false,
    slash: false,
    callback: async ({ client, message, args }) => {
      try {
        if(!args[0]){
            const embed = new MessageEmbed()
            .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
            .setColor('#747f8d')
            .setTitle('Command: spotify')
            .setDescription(`Control your music on Spotify through commands!\nRun \`spotify login\` to authorize your account.\n\`\`\`Syntax: ,spotify\`\`\``)
            message.channel.send({ embeds: [embed] });
        } else if(args[0] == 'login'){
          const cooldown = cooldowns.get(message.author.id);
          if (cooldown) {
            const remaining = cooldown - Date.now();

            const sec = remaining/1000
            const secs = sec.toString().slice(0, -1)

            const embed = new MessageEmbed()
            .setColor('#50C7EF')
            .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

            message.channel.send({ embeds: [embed] }).then( (msg) => {
              setTimeout(() => msg.delete(), 5000)
            })
            .catch(console.error);
          } else {
            prModel.countDocuments({ userID: message.author.id },async function (err, count){
              if(count>0){
                const embed = new MessageEmbed()
                .setColor(`#FAA81A`)
                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Your **Spotify account** is already connected!`)
                message.channel.send({ embeds: [embed] })
                return;
              } else {
                let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](${website + '/login'}) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: client_id,
                          clientSecret: client_secret,
                          redirectUri: website + '/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          console.log(err)
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })

                cooldowns.set(message.author.id, Date.now() + 105000);
                setTimeout(() => cooldowns.delete(message.author.id), 105000);  
              } 
            }); 
          }
        } else if(args[0] == 'logout'){
          const cooldown = cooldowns1.get(message.author.id);
          if (cooldown) {
              const remaining = cooldown - Date.now();
              const sec = remaining/1000
              const secs = sec.toString().slice(0, -1)
  
              const embed = new MessageEmbed()
              .setColor('#50C7EF')
              .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs}** seconds before using this command again`)
  
              message.channel.send({ embeds: [embed] }).then( (msg) => {
                setTimeout(() => msg.delete(), 5000)
              })
              .catch(console.error);

          } else {
            prModel.countDocuments({ userID: message.author.id },async function (err, count){
              if(count>0){
                let customcrData;
                  try {
                    const button1 = new MessageButton()
                    .setCustomId('approve')
                    .setLabel('Approve')
                    .setStyle('SUCCESS')
                    .setDisabled(false);
  
                    const button2 = new MessageButton()
                    .setCustomId('decline')
                    .setLabel('Decline')
                    .setStyle('DANGER')
                    .setDisabled(false);
  
                    const row = new MessageActionRow()
                    .addComponents(button1, button2)
  
                    const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Are you sure that you would like to unlink your **Spotify**?`)
                    message.channel.send({ embeds: [embed], components: [row] }).then( (msg)  => {
                      var filter = i => i.customId === 'approve' || i.customId === 'decline' && i.user.id === message.author.id;
                      const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });
                      collector.on('collect', async i => {
                        if (i.customId === 'approve') {
                          customcrData = await prModel.findOne({ userID: message.author.id })
                          customcrData.delete().catch ((e) => console.log(e));
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Spotify account** has been unlinked!`)
                          msg.edit({ embeds: [embed], components: [] })
                        } else if(i.customId === 'decline'){
                          message.delete().then(msg.delete())
                        }
                      });
                      collector.on('end', msg => msg.delete())
                    })
                  } catch (err) {
                    console.log(err);
                  }              
              } else {
                const embed = new MessageEmbed()
                .setColor(`#FAA81A`)
                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: You don't have a **Spotify account** linked!`)
                message.channel.send({ embeds: [embed] })
                return;
                
              }
                
            });
            cooldowns1.set(message.author.id, Date.now() + 25000);
              setTimeout(() => cooldowns1.delete(message.author.id), 25000);
          }
        } else if(args[0] == 'device' || args[0] == 'devices'){
          if(args[1] == 'list'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.getMyDevices()
              .then(function(data) {
                let availableDevices = data.body.devices;
                if(availableDevices.length<1){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: No **devices** connected to your **Spotify account**!`)
                  return message.channel.send({ embeds: [embed] })
                }
                if(availableDevices.length<10){
                  const Member = message.guild.members.cache.get(message.author.id)
                  let nickname;
                  if (Member.nickname !== null) {
                    nickname = `${Member.nickname}`;
                  } else {
                    nickname = `${message.author.username}`
                  }
                  let dev1;
                  if(availableDevices[0]){
                    var dev_name=availableDevices[0].name;
                    var dev_type=availableDevices[0].type;
                    let active;
                    if(availableDevices[0].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev1= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev2;
                  if(availableDevices[1]){
                    var dev_name=availableDevices[1].name;
                    var dev_type=availableDevices[1].type;
                    let active;
                    if(availableDevices[1].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev2= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev3;
                  if(availableDevices[2]){
                    var dev_name=availableDevices[2].name;
                    var dev_type=availableDevices[2].type;
                    let active;
                    if(availableDevices[2].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev3= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev4;
                  if(availableDevices[3]){
                    var dev_name=availableDevices[3].name;
                    var dev_type=availableDevices[3].type;
                    let active;
                    if(availableDevices[3].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev4= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev5;
                  if(availableDevices[4]){
                    var dev_name=availableDevices[4].name;
                    var dev_type=availableDevices[4].type;
                    let active;
                    if(availableDevices[4].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev5= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev6;
                  if(availableDevices[5]){
                    var dev_name=availableDevices[5].name;
                    var dev_type=availableDevices[5].type;
                    let active;
                    if(availableDevices[5].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev6= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev7;
                  if(availableDevices[6]){
                    var dev_name=availableDevices[6].name;
                    var dev_type=availableDevices[6].type;
                    let active;
                    if(availableDevices[6].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev7= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev8;
                  if(availableDevices[7]){
                    var dev_name=availableDevices[7].name;
                    var dev_type=availableDevices[7].type;
                    let active;
                    if(availableDevices[7].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev8= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev9;
                  if(availableDevices[8]){
                    var dev_name=availableDevices[8].name;
                    var dev_type=availableDevices[8].type;
                    let active;
                    if(availableDevices[8].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev9= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev10;
                  if(availableDevices[9]){
                    var dev_name=availableDevices[9].name;
                    var dev_type=availableDevices[9].type;
                    let active;
                    if(availableDevices[9].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev10= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  const embed = new MessageEmbed()
                  .setColor(Member.displayHexColor)
                  .setAuthor({ name: `${nickname}`, iconURL: `${message.author.displayAvatarURL({ dynamic: true })}`})
                  .setTitle('Spotify devices')
                  .setFooter({ text: 'Page 1/1 (1 entry)'})
                  if(availableDevices[0]){
                    embed.setDescription(`${dev1}`)
                  }
                  if(availableDevices[1]){
                    embed.setDescription(`${dev1}\n${dev2}`)
                  }
                  if(availableDevices[2]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}`)
                  }
                  if(availableDevices[3]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}`)
                  }
                  if(availableDevices[4]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}`)
                  }
                  if(availableDevices[5]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}`)
                  }
                  if(availableDevices[6]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}`)
                  }
                  if(availableDevices[7]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}`)
                  }
                  if(availableDevices[8]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}`)
                  }
                  if(availableDevices[9]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}\n${dev10}`)
                  }
                  message.channel.send({ embeds: [embed]})
                } else {
                  const Member = message.guild.members.cache.get(message.author.id)
                  let nickname;
                  if (Member.nickname !== null) {
                    nickname = `${Member.nickname}`;
                  } else {
                    nickname = `${message.author.username}`
                  }
                  let dev1;
                  if(availableDevices[0]){
                    var dev_name=availableDevices[0].name;
                    var dev_type=availableDevices[0].type;
                    let active;
                    if(availableDevices[0].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev1= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev2;
                  if(availableDevices[1]){
                    var dev_name=availableDevices[1].name;
                    var dev_type=availableDevices[1].type;
                    let active;
                    if(availableDevices[1].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev2= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev3;
                  if(availableDevices[2]){
                    var dev_name=availableDevices[2].name;
                    var dev_type=availableDevices[2].type;
                    let active;
                    if(availableDevices[2].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev3= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev4;
                  if(availableDevices[3]){
                    var dev_name=availableDevices[3].name;
                    var dev_type=availableDevices[3].type;
                    let active;
                    if(availableDevices[3].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev4= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev5;
                  if(availableDevices[4]){
                    var dev_name=availableDevices[4].name;
                    var dev_type=availableDevices[4].type;
                    let active;
                    if(availableDevices[4].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev5= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev6;
                  if(availableDevices[5]){
                    var dev_name=availableDevices[5].name;
                    var dev_type=availableDevices[5].type;
                    let active;
                    if(availableDevices[5].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev6= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev7;
                  if(availableDevices[6]){
                    var dev_name=availableDevices[6].name;
                    var dev_type=availableDevices[6].type;
                    let active;
                    if(availableDevices[6].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev7= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev8;
                  if(availableDevices[7]){
                    var dev_name=availableDevices[7].name;
                    var dev_type=availableDevices[7].type;
                    let active;
                    if(availableDevices[7].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev8= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev9;
                  if(availableDevices[8]){
                    var dev_name=availableDevices[8].name;
                    var dev_type=availableDevices[8].type;
                    let active;
                    if(availableDevices[8].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev9= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev10;
                  if(availableDevices[9]){
                    var dev_name=availableDevices[9].name;
                    var dev_type=availableDevices[9].type;
                    let active;
                    if(availableDevices[9].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev10= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  const embed = new MessageEmbed()
                  .setColor(Member.displayHexColor)
                  .setAuthor({ name: `${nickname}`, iconURL: `${message.author.displayAvatarURL({ dynamic: true })}`})
                  .setTitle('Spotify devices')
                  .setFooter({ text: 'Page 1/1 (1 entry)'})
                  if(availableDevices[0]){
                    embed.setDescription(`${dev1}`)
                  }
                  if(availableDevices[1]){
                    embed.setDescription(`${dev1}\n${dev2}`)
                  }
                  if(availableDevices[2]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}`)
                  }
                  if(availableDevices[3]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}`)
                  }
                  if(availableDevices[4]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}`)
                  }
                  if(availableDevices[5]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}`)
                  }
                  if(availableDevices[6]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}`)
                  }
                  if(availableDevices[7]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}`)
                  }
                  if(availableDevices[8]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}`)
                  }
                  if(availableDevices[9]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}\n${dev10}`)
                  }
                  message.channel.send({ embeds: [embed]})
                }
              }, function(err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.body.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.body.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken().then(
                        async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
                          spotifyApi.getMyDevices()
              .then(function(data) {
                let availableDevices = data.body.devices;
                if(availableDevices.length<10){
                  const Member = message.guild.members.cache.get(message.author.id)
                  let nickname;
                  if (Member.nickname !== null) {
                    nickname = `${Member.nickname}`;
                  } else {
                    nickname = `${message.author.username}`
                  }
                  let dev1;
                  if(availableDevices[0]){
                    var dev_name=availableDevices[0].name;
                    var dev_type=availableDevices[0].type;
                    let active;
                    if(availableDevices[0].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev1= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev2;
                  if(availableDevices[1]){
                    var dev_name=availableDevices[1].name;
                    var dev_type=availableDevices[1].type;
                    let active;
                    if(availableDevices[1].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev2= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev3;
                  if(availableDevices[2]){
                    var dev_name=availableDevices[2].name;
                    var dev_type=availableDevices[2].type;
                    let active;
                    if(availableDevices[2].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev3= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev4;
                  if(availableDevices[3]){
                    var dev_name=availableDevices[3].name;
                    var dev_type=availableDevices[3].type;
                    let active;
                    if(availableDevices[3].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev4= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev5;
                  if(availableDevices[4]){
                    var dev_name=availableDevices[4].name;
                    var dev_type=availableDevices[4].type;
                    let active;
                    if(availableDevices[4].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev5= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev6;
                  if(availableDevices[5]){
                    var dev_name=availableDevices[5].name;
                    var dev_type=availableDevices[5].type;
                    let active;
                    if(availableDevices[5].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev6= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev7;
                  if(availableDevices[6]){
                    var dev_name=availableDevices[6].name;
                    var dev_type=availableDevices[6].type;
                    let active;
                    if(availableDevices[6].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev7= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev8;
                  if(availableDevices[7]){
                    var dev_name=availableDevices[7].name;
                    var dev_type=availableDevices[7].type;
                    let active;
                    if(availableDevices[7].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev8= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev9;
                  if(availableDevices[8]){
                    var dev_name=availableDevices[8].name;
                    var dev_type=availableDevices[8].type;
                    let active;
                    if(availableDevices[8].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev9= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev10;
                  if(availableDevices[9]){
                    var dev_name=availableDevices[9].name;
                    var dev_type=availableDevices[9].type;
                    let active;
                    if(availableDevices[9].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev10= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  const embed = new MessageEmbed()
                  .setColor(Member.displayHexColor)
                  .setAuthor({ name: `${nickname}`, iconURL: `${message.author.displayAvatarURL({ dynamic: true })}`})
                  .setTitle('Spotify devices')
                  .setFooter({ text: 'Page 1/1 (1 entry)'})
                  if(availableDevices[0]){
                    embed.setDescription(`${dev1}`)
                  }
                  if(availableDevices[1]){
                    embed.setDescription(`${dev1}\n${dev2}`)
                  }
                  if(availableDevices[2]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}`)
                  }
                  if(availableDevices[3]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}`)
                  }
                  if(availableDevices[4]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}`)
                  }
                  if(availableDevices[5]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}`)
                  }
                  if(availableDevices[6]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}`)
                  }
                  if(availableDevices[7]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}`)
                  }
                  if(availableDevices[8]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}`)
                  }
                  if(availableDevices[9]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}\n${dev10}`)
                  }
                  message.channel.send({ embeds: [embed]})
                } else {
                  const Member = message.guild.members.cache.get(message.author.id)
                  let nickname;
                  if (Member.nickname !== null) {
                    nickname = `${Member.nickname}`;
                  } else {
                    nickname = `${message.author.username}`
                  }
                  let dev1;
                  if(availableDevices[0]){
                    var dev_name=availableDevices[0].name;
                    var dev_type=availableDevices[0].type;
                    let active;
                    if(availableDevices[0].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev1= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev2;
                  if(availableDevices[1]){
                    var dev_name=availableDevices[1].name;
                    var dev_type=availableDevices[1].type;
                    let active;
                    if(availableDevices[1].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev2= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev3;
                  if(availableDevices[2]){
                    var dev_name=availableDevices[2].name;
                    var dev_type=availableDevices[2].type;
                    let active;
                    if(availableDevices[2].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev3= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev4;
                  if(availableDevices[3]){
                    var dev_name=availableDevices[3].name;
                    var dev_type=availableDevices[3].type;
                    let active;
                    if(availableDevices[3].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev4= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev5;
                  if(availableDevices[4]){
                    var dev_name=availableDevices[4].name;
                    var dev_type=availableDevices[4].type;
                    let active;
                    if(availableDevices[4].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev5= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev6;
                  if(availableDevices[5]){
                    var dev_name=availableDevices[5].name;
                    var dev_type=availableDevices[5].type;
                    let active;
                    if(availableDevices[5].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev6= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev7;
                  if(availableDevices[6]){
                    var dev_name=availableDevices[6].name;
                    var dev_type=availableDevices[6].type;
                    let active;
                    if(availableDevices[6].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev7= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev8;
                  if(availableDevices[7]){
                    var dev_name=availableDevices[7].name;
                    var dev_type=availableDevices[7].type;
                    let active;
                    if(availableDevices[7].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev8= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev9;
                  if(availableDevices[8]){
                    var dev_name=availableDevices[8].name;
                    var dev_type=availableDevices[8].type;
                    let active;
                    if(availableDevices[8].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev9= '\`2\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  let dev10;
                  if(availableDevices[9]){
                    var dev_name=availableDevices[9].name;
                    var dev_type=availableDevices[9].type;
                    let active;
                    if(availableDevices[9].is_active==true){
                      active='**[Current]**'
                    } else {
                      active=''
                    }
                    dev10= '\`1\` '+`${dev_name} `+`**(${dev_type})** `+`${active}`
                  }
                  const embed = new MessageEmbed()
                  .setColor(Member.displayHexColor)
                  .setAuthor({ name: `${nickname}`, iconURL: `${message.author.displayAvatarURL({ dynamic: true })}`})
                  .setTitle('Spotify devices')
                  .setFooter({ text: 'Page 1/1 (1 entry)'})
                  if(availableDevices[0]){
                    embed.setDescription(`${dev1}`)
                  }
                  if(availableDevices[1]){
                    embed.setDescription(`${dev1}\n${dev2}`)
                  }
                  if(availableDevices[2]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}`)
                  }
                  if(availableDevices[3]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}`)
                  }
                  if(availableDevices[4]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}`)
                  }
                  if(availableDevices[5]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}`)
                  }
                  if(availableDevices[6]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}`)
                  }
                  if(availableDevices[7]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}`)
                  }
                  if(availableDevices[8]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}`)
                  }
                  if(availableDevices[9]){
                    embed.setDescription(`${dev1}\n${dev2}\n${dev3}\n${dev4}\n${dev5}\n${dev6}\n${dev7}\n${dev8}\n${dev9}\n${dev10}`)
                  }
                  message.channel.send({ embeds: [embed]})
                }
              }), function(err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] });  
                            }
                          }
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                    );  
                  } 
              });
            }
          } else if(!args[1]){
            const embed = new MessageEmbed()
                .setColor('#747F8D')
                .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
                .setTitle('Command: spotify device')
                .setDescription(`Change the device that youre listening to Spotify with\n\`\`\`Syntax: ,spotify device (name)\nExample: ,spotify device mells leapfrog\`\`\``)   
            message.channel.send({ embeds: [embed] });
          } else {
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.getMyDevices()
              .then(function(data) {
                let availableDevices = data.body.devices;
                if(availableDevices.length<2){
                  const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: You don't have any **other devices** to transfer playback to!`)
                  message.channel.send({ embeds: [embed] })
                } else {
                let index = availableDevices.findIndex( res => res.name === args[1] )
                var id = availableDevices[index].id
                var name = availableDevices[index].name
                spotifyApi.transferMyPlayback([id],{"play": true})
                .then(function() {
                  const embed = new MessageEmbed()
                  .setColor('#1DD65E')
                  .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Switched device to **${name}**`)
                  return message.channel.send({ embeds: [embed] })
                }, function(err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.body.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken()
                      .then(async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
                          let index = availableDevices.findIndex( res => res.name === args[1] )
                var id = availableDevices[index].id
                var name = availableDevices[index].name
                          spotifyApi.transferMyPlayback([id],{"play": true})
                          .then(function() {
                            const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:956293073875374090> <@${message.author.id}>: Switched device to **${name}**`)
                            return message.channel.send({ embeds: [embed] })
                          }), function(err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] });  
                            }
                          }
                        },function(err) {
                          console.log('Could not refresh access token', err);
                      });
                  }
                });
              }
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.body.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken()
                    .then(async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
  
                        spotifyApi.getMyDevices()
              .then(function(data) {
                let availableDevices = data.body.devices;
                if(availableDevices.length<2){
                  const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: You don't have any **other devices** to transfer playback to!`)
                  message.channel.send({ embeds: [embed] })
                } else {
                let index = availableDevices.findIndex( res => res.name === args[1] )
                var id = availableDevices[index].id
                var name = availableDevices[index].name
                spotifyApi.transferMyPlayback([id],{"play": true})
                .then(function() {
                  const embed = new MessageEmbed()
                  .setColor('#1DD65E')
                  .setDescription(`<:spotify:956293073875374090> <@${message.author.id}>: Switched device to **${name}**`)
                  return message.channel.send({ embeds: [embed] })
                }, function(err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.body.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken()
                      .then(async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
                          let index = availableDevices.findIndex( res => res.name === args[1] )
                var id = availableDevices[index].id
                var name = availableDevices[index].name
                          spotifyApi.transferMyPlayback([id],{"play": true})
                          .then(function() {
                            const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:956293073875374090> <@${message.author.id}>: Switched device to **${name}**`)
                            return message.channel.send({ embeds: [embed] })
                          }), function(err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:869866485798023168> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] });  
                            }
                          }
                        },function(err) {
                          console.log('Could not refresh access token', err);
                      });
                  }
                });
              }
              })
  
  
  
  
  
  
  
  
                      },function(err) {
                        console.log('Could not refresh access token', err);
                    });
                }
              }
              );
            }      
          }
        } else if(args[0] == 'volume' || args[0] == 'vol'){
          if(!args[1]){
            try {
              const embed = new MessageEmbed()
                .setColor('#747F8D')
                .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
                .setTitle('Command: spotify volume')
                .setDescription('Adjust current player volume'+`\n\`\`\`Syntax: ,spotify volume (percent)\nExample: ,spotify volume 50\`\`\``)   
              message.channel.send({ embeds: [embed] }).catch();
            } catch {
            }
          } else if(isNaN(args[1]) === false){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              if(args[1]>100){
                const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Volume cannot be greater than **100** percent!`)
                message.channel.send({ embeds: [embed] });
              }
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.setVolume(args[1])
              .then(function () {
                const embed = new MessageEmbed()
                  .setColor('#1DD65E')
                  .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Adjusted **player volume** to \`${args[1]}%\``)
                return message.channel.send({ embeds: [embed] })
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
                        spotifyApi.setVolume(args[1])
                        .then(function() {
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Adjusted **player volume** to \`${args[1]}%\``)
                          return message.channel.send({ embeds: [embed] }).catch( (e) => console.log(e));
                        }), function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            return message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            return message.channel.send({ embeds: [embed] });  
                          }
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                  );  
                }   
              });
            }
          } else {
            const embed = new MessageEmbed()
              .setColor(`#FAA81A`)
              .setDescription(`<:warning:980927735327236146> Converting to "int" failed for parameter "percent".`)
            message.channel.send({ embeds: [embed] })
          }
        } else if(args[0] == 'shuffle'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              if(args[1] === 'true'){
                let prData;
                try {
                  prData = await prModel.findOne({ userID: message.author.id })
                } catch (err) {
                  console.log(err);
                }
                var spotifyApi = new SpotifyWebApi();
                spotifyApi.setAccessToken(prData.access_token);
                spotifyApi.setShuffle(true)
                .then(function() {
                  message.react("🔀")
                  message.react("✅")
                }, function  (err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken().then(
                        async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
                          spotifyApi.setShuffle(true)
                          .then(function (err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] })
                            } else {
                              message.react("🔀")
                              message.react("✅")
                            }
                        }, function(err) {
                          console.log('Could not refresh access token', err);
                        });  
                        })
                      }
                  })
              } else if(args[1] == 'false'){
                let prData;
                try {
                  prData = await prModel.findOne({ userID: message.author.id })
                } catch (err) {
                  console.log(err);
                }
                var spotifyApi = new SpotifyWebApi();
                spotifyApi.setAccessToken(prData.access_token);
                spotifyApi.setShuffle(false)
                .then(function() {
                  message.react("🔀")
                  message.react("✅")
                }, function  (err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken().then(
                        async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
                          spotifyApi.setShuffle(false)
                          .then(function (err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] })
                            } else {
                              message.react("🔀")
                              message.react("✅")
                            }
                        }, function(err) {
                          console.log('Could not refresh access token', err);
                        });  
                        })
                      }
                  })
              } else {
                  let prData;
                  try {
                    prData = await prModel.findOne({ userID: message.author.id })
                  } catch (err) {
                    console.log(err);
                  }
                  var spotifyApi = new SpotifyWebApi();
                  spotifyApi.setAccessToken(prData.access_token);
                  spotifyApi.setShuffle(true)
                  .then(function() {
                    message.react("🔀")
                    message.react("✅")
                  }, function  (err) {
                    if(err.statusCode === 403){
                      const embed = new MessageEmbed()
                        .setColor(`#FAA81A`)
                        .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                      return message.channel.send({ embeds: [embed] })
                    } else if(err.statusCode === 404){
                      const embed = new MessageEmbed()
                        .setColor(`#FAA81A`)
                        .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                      return message.channel.send({ embeds: [embed] })
                    } else if(err.statusCode === 401) {
                        var credentials = {
                          clientId: client_id,
                          clientSecret: client_secret
                        };
                        var spotifyApi = new SpotifyWebApi(credentials);
                        var refresh_token = prData.refresh_token;
                        spotifyApi.setRefreshToken(refresh_token);
                        spotifyApi.refreshAccessToken().then(
                          async function(data) {
                            await prModel.findOneAndUpdate({
                              access_token: prData.access_token
                            }, {
                              access_token: data.body['access_token']
                            })
                            console.log('The access token has been refreshed!');
                            spotifyApi.setAccessToken(data.body['access_token']);
                            spotifyApi.setShuffle(true)
                            .then(function (err) {
                              if(err.statusCode === 403){
                                const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                                return message.channel.send({ embeds: [embed] })
                              } else if(err.statusCode === 404){
                                const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                                return message.channel.send({ embeds: [embed] })
                              } else {
                                message.react("🔀")
                                message.react("✅")
                              }
                          }, function(err) {
                            console.log('Could not refresh access token', err);
                          });  
                          })
                        }
                    })
              }
            }
        } else if(args[0] == 'next' || args[0] == 'skip' || args[0] == 'ss' || args[0] == 's'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            spotifyApi.skipToNext()
            .then(function() {
              message.react('⏭️')
              message.react('✅')
              spotifyApi.getMyCurrentPlayingTrack()
              .then(function(data) {
                let track = data.body.item.name;
                let track_url = data.body.item.external_urls.spotify;
                let artist = data.body.item.artists[0].name
                const embed = new MessageEmbed()
                .setColor('#1DD65E')
                .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Now listening to **[${track}](${track_url})** by **${artist}**`)
                message.channel.send({ embeds: [embed]})
              }, function(err) {
                console.log('Something went wrong!', err);
              });
            }, function(err) {
              if(err.statusCode === 403){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 404){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 401) {
                  var credentials = {
                    clientId: client_id,
                    clientSecret: client_secret
                  };
                  var spotifyApi = new SpotifyWebApi(credentials);
                  var refresh_token = prData.refresh_token;
                  spotifyApi.setRefreshToken(refresh_token);
                  spotifyApi.refreshAccessToken().then(
                    async function(data) {
                      await prModel.findOneAndUpdate({
                        access_token: prData.access_token
                      }, {
                        access_token: data.body['access_token']
                      })
                      console.log('The access token has been refreshed!');
                      spotifyApi.setAccessToken(data.body['access_token']);
  
                      spotifyApi.skipToNext()
                      .then(function() {
                        message.react('⏭️')
                        message.react('✅')
                        spotifyApi.getMyCurrentPlayingTrack()
                        .then(function(data) {
                          let track = data.body.item.name;
                          let track_url = data.body.item.external_urls.spotify;
                          let artist = data.body.item.artists[0].name
                          const embed = new MessageEmbed()
                          .setColor('#1DD65E')
                          .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Now listening to **[${track}](${track_url})** by **${artist}**`)
                          message.channel.send({ embeds: [embed]})
                        }, function(err) {
                          console.log('Something went wrong!', err);
                        });
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          return message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          return message.channel.send({ embeds: [embed] })
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                    );  
                  })
                  }
                })
            }
        } else if(args[0] == 'pause' || args[0] == 'stop'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            spotifyApi.pause()
            .then(function() {
              message.react('⏸️')
              message.react('✅')
            }, function(err) {
              if(err.statusCode === 403){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 404){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 401) {
                  var credentials = {
                    clientId: client_id,
                    clientSecret: client_secret
                  };
                  var spotifyApi = new SpotifyWebApi(credentials);
                  var refresh_token = prData.refresh_token;
                  spotifyApi.setRefreshToken(refresh_token);
                  spotifyApi.refreshAccessToken().then(
                    async function(data) {
                      await prModel.findOneAndUpdate({
                        access_token: prData.access_token
                      }, {
                        access_token: data.body['access_token']
                      })
                      console.log('The access token has been refreshed!');
                      spotifyApi.setAccessToken(data.body['access_token']);
    
                      spotifyApi.pause()
                      .then(function() {
                        message.react('⏸️')
                        message.react('✅')
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          return message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          return message.channel.send({ embeds: [embed] })
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                    );  
                  })
                  }
                })
            }
        } else if(args[0] == 'resume' || args[0] == 'unpause'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            spotifyApi.play()
            .then(function() {
              message.react('▶️')
              message.react('✅')
            }, function(err) {
              if(err.statusCode === 403){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 404){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 401) {
                  var credentials = {
                    clientId: client_id,
                    clientSecret: client_secret
                  };
                  var spotifyApi = new SpotifyWebApi(credentials);
                  var refresh_token = prData.refresh_token;
                  spotifyApi.setRefreshToken(refresh_token);
                  spotifyApi.refreshAccessToken().then(
                    async function(data) {
                      await prModel.findOneAndUpdate({
                        access_token: prData.access_token
                      }, {
                        access_token: data.body['access_token']
                      })
                      console.log('The access token has been refreshed!');
                      spotifyApi.setAccessToken(data.body['access_token']);
    
                      spotifyApi.play()
                      .then(function() {
                        message.react('▶️')
                        message.react('✅')
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          return message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          return message.channel.send({ embeds: [embed] })
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                    );  
                  })
                  }
                })
            }
        } else if(args[0] == 'previous' || args[0] == 'prev' || args[0] == 'back'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            spotifyApi.skipToPrevious()
            .then(function() {
              message.react('⏮️')
              message.react('✅')
            }, function(err) {
              if(err.statusCode === 403){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 404){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 401) {
                  var credentials = {
                    clientId: client_id,
                    clientSecret: client_secret
                  };
                  var spotifyApi = new SpotifyWebApi(credentials);
                  var refresh_token = prData.refresh_token;
                  spotifyApi.setRefreshToken(refresh_token);
                  spotifyApi.refreshAccessToken().then(
                    async function(data) {
                      await prModel.findOneAndUpdate({
                        access_token: prData.access_token
                      }, {
                        access_token: data.body['access_token']
                      })
                      console.log('The access token has been refreshed!');
                      spotifyApi.setAccessToken(data.body['access_token']);
    
                      spotifyApi.skipToPrevious()
                      .then(function() {
                        message.react('⏮️')
                        message.react('✅')
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          return message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          return message.channel.send({ embeds: [embed] })
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                    );  
                  })
                  }
                })
            }
        } else if(args[0] == 'repeat'){
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              if(args[1] == 'track'){
                let prData;
                try {
                  prData = await prModel.findOne({ userID: message.author.id })
                } catch (err) {
                  console.log(err);
                }
                var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.setRepeat('track')
              .then(function() {
                message.react('🔂')
                message.react('✅')
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
      
                        spotifyApi.setRepeat('track')
                        .then(function() {
                          message.react('🔂')
                          message.react('✅')
                        }, function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            return message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            return message.channel.send({ embeds: [embed] })
                          }
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                      );  
                    })
                    }
                  })
              } else if(args[1] == 'context'){
                  let prData;
                  try {
                    prData = await prModel.findOne({ userID: message.author.id })
                  } catch (err) {
                    console.log(err);
                  }
                  var spotifyApi = new SpotifyWebApi();
                spotifyApi.setAccessToken(prData.access_token);
                spotifyApi.setRepeat('context')
                .then(function() {
                  message.react('🔁')
                  message.react('✅')
                }, function(err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken().then(
                        async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
        
                          spotifyApi.setRepeat('context')
                          .then(function() {
                            message.react('🔁')
                            message.react('✅')
                          }, function(err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] })
                            }
                          },
                          function(err) {
                            console.log('Could not refresh access token', err);
                          }
                        );  
                      })
                      }
                    })            
              } else if(args[1] == 'off'){
                let prData;
                try {
                  prData = await prModel.findOne({ userID: message.author.id })
                } catch (err) {
                  console.log(err);
                }
                var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.setRepeat('off')
              .then(function() {
                message.react('✅')
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
      
                        spotifyApi.setRepeat('off')
                        .then(function() {
                          message.react('✅')
                        }, function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            return message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            return message.channel.send({ embeds: [embed] })
                          }
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                      );  
                    })
                    }
                  })             
              } else if(!args[1]){
                let prData;
                try {
                  prData = await prModel.findOne({ userID: message.author.id })
                } catch (err) {
                  console.log(err);
                }
                var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.setRepeat('context')
              .then(function() {
                message.react('🔁')
                message.react('✅')
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
      
                        spotifyApi.setRepeat('context')
                        .then(function() {
                          message.react('🔁')
                          message.react('✅')
                        }, function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            return message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            return message.channel.send({ embeds: [embed] })
                          }
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                      );  
                    })
                    }
                  }) 
              } else if(args[1] !== 'track' || args[1] !== 'context' || args[1] !== 'off'){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: \`${args[1]}\` is not a valid state! Valid options are: \`track, context, off\``)
                message.channel.send({ embeds: [embed] })
              }
            }
        } else if(args[0] == 'seek'){
          const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let sec;
              try {
                if(isNaN(args[1]) === false){
                  sec = args[1]
                } else {
                  var str1 = args[1];
                  str1 =  str1.split(':');
                  if(str1.length=2){
                    var secon1 = parseInt(str1[0]*60 + str1[1]*1);
                    sec = secon1
                  } else if(str1.length=3){
                    var secon = parseInt(str1[0]*3600 + str1[1]*60 + str1[0]*1);
                    sec = secon;
                  }
                }
              } catch(e){
                const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify seek**. `)
                message.channel.send({ embeds: [embed] });
              }
              var positionMs = sec*1000;
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            spotifyApi.seek(positionMs)
            .then(function() {
              message.react('⏩')
              message.react('✅')
            }, function(err) {
              if(err.statusCode === 403){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 404){
                const embed = new MessageEmbed()
                  .setColor(`#FAA81A`)
                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                return message.channel.send({ embeds: [embed] })
              } else if(err.statusCode === 401) {
                  var credentials = {
                    clientId: client_id,
                    clientSecret: client_secret
                  };
                  var spotifyApi = new SpotifyWebApi(credentials);
                  var refresh_token = prData.refresh_token;
                  spotifyApi.setRefreshToken(refresh_token);
                  spotifyApi.refreshAccessToken().then(
                    async function(data) {
                      await prModel.findOneAndUpdate({
                        access_token: prData.access_token
                      }, {
                        access_token: data.body['access_token']
                      })
                      console.log('The access token has been refreshed!');
                      spotifyApi.setAccessToken(data.body['access_token']);
    
                      spotifyApi.seek(positionMs)
                      .then(function() {
                        message.react('⏩')
                        message.react('✅')
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          return message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          return message.channel.send({ embeds: [embed] })
                        }
                      },
                      function(err) {
                        console.log('Could not refresh access token', err);
                      }
                    );  
                  })
                  }
                })
            }
        } else if(args[0] == 'like'){
          const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.getMyCurrentPlayingTrack()
              .then(function(data) {
                let id = data.body.item.id;
                spotifyApi.addToMySavedTracks([id])
                .then(function(data) {
                  message.react('💚')
                  message.react('✅')
                }, function(err) {
                  console.log('Something went wrong!', err);
                });
              }, function(err) {
                if(err.statusCode === 403){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
      
                        spotifyApi.getMyCurrentPlayingTrack()
                        .then(function(data) {
                          let id = data.body.item.id;
                          spotifyApi.addToMySavedTracks([id])
                          .then(function(data) {
                            message.react('💚')
                            message.react('✅')
                          }, function(err) {
                            console.log('Something went wrong!', err);
                          });
                        }, function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            return message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            return message.channel.send({ embeds: [embed] })
                          }
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                      );  
                    })
                    }
                  })
            }
        } else if(args[0] == 'queue' || args[0] == 'q'){
          if(!args[1]){
            const embed = new MessageEmbed()
            .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
            .setColor('#747f8d')
            .setTitle('Command: spotify queue')
            .setDescription(`Queue a song\n\`\`\`Syntax: ,spotify queue (query)\nExample: ,spotify queue Lancey Foux RESPECT\`\`\``)
            message.channel.send({ embeds: [embed] });
          } else {
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
            try {
              prData = await prModel.findOne({ userID: message.author.id })
            } catch (err) {
              console.log(err);
            }
            var spotifyApi = new SpotifyWebApi();
          spotifyApi.setAccessToken(prData.access_token);
          const query = args.slice(1).join(' ');
          var spotify = new Spotify({
            id: client_id,
            secret: client_secret
          });
          if(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/.test(args[1])==true){
            try {
              const str = args.slice(1).join(' ');
              const regEx = /^(?:spotify:|(?:https?:\/\/(?:open|play)\.spotify\.com\/))(?:embed)?\/?(album|track)(?::|\/)((?:[0-9a-zA-Z]){22})/;
              const match = str.match(regEx);
              const albumOrTrack = match[1]
              const spotifyID = match[2]
              if(albumOrTrack == 'album'){
                const embed1 = new MessageEmbed()
                  .setColor('#7289DA')
                  .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                message.channel.send({ embeds: [embed1] });
              } else if(albumOrTrack == 'track'){
                spotifyApi.getTrack(spotifyID).then(
                  function (data) {
                    console.log(data.body)
                    let uri = data.body.uri;
                    spotifyApi.addToQueue(uri).then((data) => {
                      message.react('▶️')
                      message.react('✅')
                    }, function(err) {
                      if(err.statusCode === 403){
                        const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                        return message.channel.send({ embeds: [embed] })
                      } else if(err.statusCode === 404){
                        const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                        return message.channel.send({ embeds: [embed] })
                      } else if(err.statusCode === 401) {
                          var credentials = {
                            clientId: client_id,
                            clientSecret: client_secret
                          };
                          var spotifyApi = new SpotifyWebApi(credentials);
                          var refresh_token = prData.refresh_token;
                          spotifyApi.setRefreshToken(refresh_token);
                          spotifyApi.refreshAccessToken().then(
                            async function(data) {
                              await prModel.findOneAndUpdate({
                                access_token: prData.access_token
                              }, {
                                access_token: data.body['access_token']
                              })
                              console.log('The access token has been refreshed!');
                              spotifyApi.setAccessToken(data.body['access_token']);
            
                              spotifyApi.addToQueue(uri).then((data) => {
                                message.react('▶️')
                                message.react('✅')
                              }, function(err) {
                                if(err.statusCode === 403){
                                  const embed = new MessageEmbed()
                                  .setColor(`#FAA81A`)
                                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                                  return message.channel.send({ embeds: [embed] })
                                } else if(err.statusCode === 404){
                                  const embed = new MessageEmbed()
                                  .setColor(`#FAA81A`)
                                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                                  return message.channel.send({ embeds: [embed] })
                                }
                              },
                              function(err) {
                                console.log('Could not refresh access token', err);
                              }
                            );  
                          })
                          }
                        })
                  }, function(err) {
                    if(err.statusCode === 403){
                      const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                      return message.channel.send({ embeds: [embed] })
                    } else if(err.statusCode === 404){
                      const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                      return message.channel.send({ embeds: [embed] })
                    }
                  },
                );
              }
            } catch{
              const embed1 = new MessageEmbed()
                  .setColor('#7289DA')
                  .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                message.channel.send({ embeds: [embed1] });
            }
          } else if(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/.test(args[1])==false){
            spotify.search({ type: 'track', query: query }, function(err, data) {            
              try {
                if (err) {
                  const embed1 = new MessageEmbed()
                  .setColor('#7289DA')
                  .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                return message.channel.send({ embeds: [embed1] });
              } else {
                var trackURi = data.tracks.items[0].uri
                spotifyApi.addToQueue(trackURi).then((data) => {
                  message.react('▶️')
                  message.react('✅')
                }, function(err) {
                  if(err.statusCode === 403){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 404){
                    const embed = new MessageEmbed()
                      .setColor(`#FAA81A`)
                      .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                    return message.channel.send({ embeds: [embed] })
                  } else if(err.statusCode === 401) {
                      var credentials = {
                        clientId: client_id,
                        clientSecret: client_secret
                      };
                      var spotifyApi = new SpotifyWebApi(credentials);
                      var refresh_token = prData.refresh_token;
                      spotifyApi.setRefreshToken(refresh_token);
                      spotifyApi.refreshAccessToken().then(
                        async function(data) {
                          await prModel.findOneAndUpdate({
                            access_token: prData.access_token
                          }, {
                            access_token: data.body['access_token']
                          })
                          console.log('The access token has been refreshed!');
                          spotifyApi.setAccessToken(data.body['access_token']);
        
                          spotifyApi.addToQueue(trackURi).then((data) => {
                            message.react('▶️')
                            message.react('✅')
                          }, function(err) {
                            if(err.statusCode === 403){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                              return message.channel.send({ embeds: [embed] })
                            } else if(err.statusCode === 404){
                              const embed = new MessageEmbed()
                              .setColor(`#FAA81A`)
                              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                              return message.channel.send({ embeds: [embed] })
                            }
                          },
                          function(err) {
                            console.log('Could not refresh access token', err);
                          }
                        );  
                      })
                      }
                    })
              }
              } catch {
                const embed1 = new MessageEmbed()
                  .setColor('#7289DA')
                  .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                message.channel.send({ embeds: [embed1] });
              }
            });
          }
            }
          }
        } else if(args[0] == 'play' || args[0] == 'p'){
          if(!args[1]){
            const embed = new MessageEmbed()
            .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
            .setColor('#747f8d')
            .setTitle('Command: spotify play')
            .setDescription(`Immediately skip to the requested song\n\`\`\`Syntax: ,spotify play (query)\nExample: ,spotify play Lancey Foux RESPECT\`\`\``)
            message.channel.send({ embeds: [embed] });
          } else {
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
            spotifyApi.setAccessToken(prData.access_token);
            const query = args.slice(1).join(' ');
            var spotify = new Spotify({
              id: client_id,
              secret: client_secret
            });
              if(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/.test(args[1])==true){
                try {
                  const str = args.slice(1).join(' ');
                  const regEx = /^(?:spotify:|(?:https?:\/\/(?:open|play)\.spotify\.com\/))(?:embed)?\/?(album|track)(?::|\/)((?:[0-9a-zA-Z]){22})/;
                  const match = str.match(regEx);
                  const albumOrTrack = match[1]
                  const spotifyID = match[2]
                  if(albumOrTrack == 'album'){
                    try {
                      var spotifyApi = new SpotifyWebApi();
                      spotifyApi.setAccessToken(prData.access_token);
                      spotifyApi.play({
                        "context_uri": `spotify:album:${spotifyID}`,
                        "position_ms": 0
                      }).then(function() {
                        message.react('▶️')
                        message.react('✅')
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 401) {
                          var credentials = {
                            clientId: client_id,
                            clientSecret: client_secret
                          };
                          var spotifyApi = new SpotifyWebApi(credentials);
                          var refresh_token = prData.refresh_token;
                          spotifyApi.setRefreshToken(refresh_token);
                          spotifyApi.refreshAccessToken().then(
                            async function(data) {
                              await prModel.findOneAndUpdate({
                                access_token: prData.access_token
                              }, {
                                access_token: data.body['access_token']
                              })
                              console.log('The access token has been refreshed!');
                              spotifyApi.setAccessToken(data.body['access_token']);
            
                              spotifyApi.play({
                                "context_uri": `spotify:album:${spotifyID}`,
                                "position_ms": 0
                              }).then(function() {
                                message.react('▶️')
                                message.react('✅')
                              }, function(err) {
                                if(err.statusCode === 403){
                                  const embed = new MessageEmbed()
                                  .setColor(`#FAA81A`)
                                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                                  return message.channel.send({ embeds: [embed] })
                                } else if(err.statusCode === 404){
                                  const embed = new MessageEmbed()
                                  .setColor(`#FAA81A`)
                                  .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                                  return message.channel.send({ embeds: [embed] })
                                }
                              },
                              function(err) {
                                console.log('Could not refresh access token', err);
                              }
                            );  
                          })
                          }
                      }) 
                    } catch {
                      const embed1 = new MessageEmbed()
                      .setColor('#7289DA')
                      .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                      message.channel.send({ embeds: [embed1] });
                    }
                  } else if(albumOrTrack == 'track'){
                    spotifyApi.getTrack(spotifyID).then(
                      function (data) {
                        console.log(data.body.track_number)
                        var spotifyID = data.body.album.id;
                        var trackNumber = data.body.track_number;
                        spotifyApi.play({
                          "context_uri": `spotify:album:${spotifyID}`,
                          "offset": {
                              "position": trackNumber-1
                          },
                          "position_ms": 0
                        }).then(function() {
                          message.react('▶️')
                          message.react('✅')
                        }, function(err) {
                          if(err.statusCode === 403){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                            message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 404){
                            const embed = new MessageEmbed()
                            .setColor(`#FAA81A`)
                            .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                            message.channel.send({ embeds: [embed] })
                          } else if(err.statusCode === 401) {
                            var credentials = {
                              clientId: client_id,
                              clientSecret: client_secret
                            };
                            var spotifyApi = new SpotifyWebApi(credentials);
                            var refresh_token = prData.refresh_token;
                            spotifyApi.setRefreshToken(refresh_token);
                            spotifyApi.refreshAccessToken().then(
                              async function(data) {
                                await prModel.findOneAndUpdate({
                                  access_token: prData.access_token
                                }, {
                                  access_token: data.body['access_token']
                                })
                                console.log('The access token has been refreshed!');
                                spotifyApi.setAccessToken(data.body['access_token']);
              
                                const res = data.tracks.items[0]
                        var spotifyID = res.album.id;
                        var position = res.track_number
                        spotifyApi.play({
                          "context_uri": `spotify:album:${spotifyID}`,
                          "offset": {
                              "position": position-1
                          },
                          "position_ms": 0
                        }).then(function() {
                          message.react('▶️')
                          message.react('✅')
                        }, function(err) {
                                  if(err.statusCode === 403){
                                    const embed = new MessageEmbed()
                                    .setColor(`#FAA81A`)
                                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                                    return message.channel.send({ embeds: [embed] })
                                  } else if(err.statusCode === 404){
                                    const embed = new MessageEmbed()
                                    .setColor(`#FAA81A`)
                                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                                    return message.channel.send({ embeds: [embed] })
                                  }
                                },
                                function(err) {
                                  console.log('Could not refresh access token', err);
                                }
                              );  
                            })
                            }
                          })
                      }, function(err) {
                        if(err.statusCode === 403){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                          message.channel.send({ embeds: [embed] })
                        } else if(err.statusCode === 404){
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                          message.channel.send({ embeds: [embed] })
                        }
                      },
                    );
                  }
                } catch(e){
                  console.log(e)
                  const embed1 = new MessageEmbed()
                      .setColor('#7289DA')
                      .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                    message.channel.send({ embeds: [embed1] });
                }
              } else if(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/.test(args[1])==false){
                spotify.search({ type: 'track', query: query }, function(err, data) {            
                  try {
                    if (err) {
                      console.log(err)
                      const embed1 = new MessageEmbed()
                      .setColor('#7289DA')
                      .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                    return message.channel.send({ embeds: [embed1] });
                  } else {
                    const res = data.tracks.items[0]
                    var spotifyID = res.album.id;
                    var position = res.track_number
                    spotifyApi.play({
                      "context_uri": `spotify:album:${spotifyID}`,
                      "offset": {
                          "position": position-1
                      },
                      "position_ms": 0
                    }).then(function() {
                      message.react('▶️')
                      message.react('✅')
                    }, function(err) {
                      if(err.statusCode === 403){
                        const embed = new MessageEmbed()
                        .setColor(`#FAA81A`)
                        .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                        message.channel.send({ embeds: [embed] })
                      } else if(err.statusCode === 404){
                        const embed = new MessageEmbed()
                        .setColor(`#FAA81A`)
                        .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                        message.channel.send({ embeds: [embed] })
                      } else if(err.statusCode === 401) {
                        var credentials = {
                          clientId: client_id,
                          clientSecret: client_secret
                        };
                        var spotifyApi = new SpotifyWebApi(credentials);
                        var refresh_token = prData.refresh_token;
                        spotifyApi.setRefreshToken(refresh_token);
                        spotifyApi.refreshAccessToken().then(
                          async function(data) {
                            await prModel.findOneAndUpdate({
                              access_token: prData.access_token
                            }, {
                              access_token: data.body['access_token']
                            })
                            console.log('The access token has been refreshed!');
                            spotifyApi.setAccessToken(data.body['access_token']);
          
                            const res = data.tracks.items[0]
                    var spotifyID = res.album.id;
                    var position = res.track_number
                    spotifyApi.play({
                      "context_uri": `spotify:album:${spotifyID}`,
                      "offset": {
                          "position": position-1
                      },
                      "position_ms": 0
                    }).then(function() {
                      message.react('▶️')
                      message.react('✅')
                    }, function(err) {
                              if(err.statusCode === 403){
                                const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** Premium required`)
                                return message.channel.send({ embeds: [embed] })
                              } else if(err.statusCode === 404){
                                const embed = new MessageEmbed()
                                .setColor(`#FAA81A`)
                                .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                                return message.channel.send({ embeds: [embed] })
                              }
                            },
                            function(err) {
                              console.log('Could not refresh access token', err);
                            }
                          );  
                        })
                        }
                      })
                  }
                  } catch(e) {
                    console.log(e)
                    const embed1 = new MessageEmbed()
                      .setColor('#7289DA')
                      .setDescription(`🔎 <@${message.author.id}>: No results were found for \`${args.slice(1).join(' ')}\``)
                    message.channel.send({ embeds: [embed1] });
                  }
                });
              }
            }
          }
        } else if(args[0] == 'vc' || args[0] == 'share'){
          const member = message.guild.members.cache.get(message.author.id)
          if (!member.voice.channel) {
            const embed = new MessageEmbed()
              .setColor(`#FAA81A`)
              .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: You're not connected to a **voice channel**!`)
            message.channel.send({ embeds: [embed] })   
          } else {
            const count = await prModel.countDocuments({ userID: message.author.id });
            if(count<=0) {
              const cooldown = cooldowns.get(message.author.id);
              if(cooldown) {
                const remaining = cooldown - Date.now();
                const sec = remaining/1000
                const secs = sec.toString().slice(0, -1)

                const embed = new MessageEmbed()
                .setColor('#50C7EF')
                .setDescription(`<:cooldown:980925926562996284> <@${message.author.id}>: Please wait **${secs} seconds** before using this command again`)

                message.channel.send({ embeds: [embed] }).then( (msg) => {
                  setTimeout(() => msg.delete(), 5000)
                })
                .catch(console.error);
              } else {
                cooldowns.set(message.author.id, Date.now() + 105000);
              setTimeout(() => cooldowns.delete(message.author.id), 105000);  

              let filter = m => m.author.id === message.author.id;
  
                var embed = new MessageEmbed()
                    .setColor('#1DD65E')
                    .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Click [**here**](https://bleid.herokuapp.com/login) to **grant** Bleed access to your **Spotify account**.\nYou have **2 minutes** to complete the registration before your session expires!`)
                    .setFooter({ text: "Type 'cancel' to stop the process"})
                message.channel.send({ embeds: [embed] }).then((msg) => {
                  message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] })
                    .then( async (c) => {
                      if(c.toJSON()[0].content.toUpperCase() == 'CANCEL'){
                        message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                          mes.delete()
                        });
                        const canceled = new MessageEmbed()
                        .setColor('#FF6464')
                        .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** stopped by user. Your request has been cancelled.`)
                        msg.edit({ embeds: [canceled]})
                      } else {
                                            
                        let codesData;
                        try {
                          codesData = await codesModel.findOne({ state: c.toJSON()[0].content })
                        } catch (err) {
                          console.log(err);
                        }
                        
                        var credentials = {
                          clientId: '47b987353c674ea396ec8b26e1a2211b',
                          clientSecret: '94c9716f71f248eaaddd6fae6a5f55d2',
                          redirectUri: 'https://bleid.herokuapp.com/callback'
                        };
                        
                        var spotifyApi = new SpotifyWebApi(credentials);
                        
  
                        spotifyApi.setAccessToken(codesData.access_token);
                        spotifyApi.setRefreshToken(codesData.refresh_token);
  
                        spotifyApi.getMe().then(async function(data) {
                          let profile = await prModel.create({
                            userID: message.author.id,
                            access_token: codesData.access_token,
                            refresh_token: codesData.refresh_token,
                            spUserID: data.body.id
                          })
                          profile.save();

                          msg.delete();
  
                          const embed = new MessageEmbed()
                            .setColor('#1DD65E')
                            .setDescription(`<:spotify:980925926542049381> <@${message.author.id}>: Your **Discord account** has been connected to [**${data.body.display_name}**](${data.body.external_urls.spotify})!`)
                          message.channel.messages.fetch(c.toJSON()[0].id).then(mes => { //<---error here
                            mes.reply({ embeds: [embed], allowedMentions: { repliedUser: false }})
                          });
                        }, async function(err) {
                          var generateRandomString = function(length) {
                            var text = '';
                            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          
                            for (var i = 0; i < length; i++) {
                              text += possible.charAt(Math.floor(Math.random() * possible.length));
                            }
                            return text;
                          };
                          var errorCode = generateRandomString(13);
                          
                          let tag = await errorModel.estimatedDocumentCount();
                          let tagCount = tag+1;
  
                          var timest = `${c.toJSON()[0].createdTimestamp}`;
                          
                          let er = await errorModel.create({
                            tag: tagCount,
                            user: `${message.author.tag} (\`${message.author.id}\`)`,
                            guild: `${message.guild.name} (\`${message.guild.id}\`)`,
                            channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
                            command: 'spotify login',
                            timestamp: `<t:${timest.slice(0, -3)}>`,
                            error: { code:errorCode, message: err.body.error_description}
                          })
                          er.save();
                          
                          const embed = new MessageEmbed()
                          .setColor(`#FAA81A`)
                          .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **spotify login**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
                          msg.edit({ embeds: [embed] })
                        });
                      }
                      
                    })
                    .catch((e) =>{
  
                      console.log(e)
                      const embed = new MessageEmbed()
                      .setColor('#FF6464')
                      .setDescription(`<:deny:980925926596558918> <@${message.author.id}>: **Spotify registration** timed out! Your request has been cancelled.`)
                      msg.edit({ embeds: [embed]})
                    });
                })     
              }      
            } else {
              let prData;
              try {
                prData = await prModel.findOne({ userID: message.author.id })
              } catch (err) {
                console.log(err);
              }
              var spotifyApi = new SpotifyWebApi();
              spotifyApi.setAccessToken(prData.access_token);
              spotifyApi.getMyCurrentPlayingTrack()
              .then(async function(data) {
                const name = data.body.item.name;
                const artist = data.body.item.artists[0].name
                const url = data.body.item.external_urls.spotify;
                var query = name + ' by ' + artist;
                let guildQueue = client.player.getQueue(message.guild.id);
                let queue = client.player.createQueue(message.guild.id);
                await queue.join(member.voice.channel);
                let song = await queue.play(query).catch(_ => {
                  if(!guildQueue)
                  queue.stop();
                }).then(() => {
                  const embed2 = new MessageEmbed()
                  .setColor('#69919d')
                  .setDescription(`🎶 Now playing [**${artist} - ${name}**](${url}) in <#${member.voice.channel.id}> [<@!${message.author.id}>]`)
                  message.channel.send({ embeds: [embed2]});
                });
              }, function(err) {
                if(err.statusCode === 404){
                  const embed = new MessageEmbed()
                    .setColor(`#FAA81A`)
                    .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: **Player command failed:** No active device found`)
                  return message.channel.send({ embeds: [embed] })
                } else if(err.statusCode === 401) {
                    var credentials = {
                      clientId: client_id,
                      clientSecret: client_secret
                    };
                    var spotifyApi = new SpotifyWebApi(credentials);
                    var refresh_token = prData.refresh_token;
                    spotifyApi.setRefreshToken(refresh_token);
                    spotifyApi.refreshAccessToken().then(
                      async function(data) {
                        await prModel.findOneAndUpdate({
                          access_token: prData.access_token
                        }, {
                          access_token: data.body['access_token']
                        })
                        console.log('The access token has been refreshed!');
                        spotifyApi.setAccessToken(data.body['access_token']);
                        spotifyApi.getMyCurrentPlayingTrack()
                        .then(async function(data) {
                          const name = data.body.item.name;
                          const artist = data.body.item.artists[0].name
                          const url = data.body.item.external_urls.spotify;
                          var query = name + ' by ' + artist;
                          let guildQueue = client.player.getQueue(message.guild.id);
                          let queue = client.player.createQueue(message.guild.id);
                          await queue.join(member.voice.channel);
                          let song = await queue.play(query).catch(_ => {
                            if(!guildQueue)
                            queue.stop();
                          }).then(() => {
                            const embed2 = new MessageEmbed()
                            .setColor('#69919d')
                            .setDescription(`🎶 Now playing [**${artist} - ${name}**](${url}) in <#${member.voice.channel.id}> [<@!${message.author.id}>]`)
                            message.channel.send({ embeds: [embed2]});
                          }).catch( (e) =>{
                            console.log(e)
  
                          });                        
                        },
                        function(err) {
                          console.log('Could not refresh access token', err);
                        }
                      );  
                    })
                    }
                  })
            }
          }
        } 
      } catch(e) {
        var generateRandomString = function(length) {
          var text = '';
          var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
          for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
          }
          return text;
        };
        var errorCode = generateRandomString(13);
        
        let tag = await errorModel.estimatedDocumentCount();
        let tagCount = tag+1;

        var timest = `${c.toJSON()[0].createdTimestamp}`;
        
        let er = await errorModel.create({
          tag: tagCount,
          user: `${message.author.tag} (\`${message.author.id}\`)`,
          guild: `${message.guild.name} (\`${message.guild.id}\`)`,
          channel: `${message.channel.name || 'Unknown'} (\`${message.channel.id}\`)`,
          command: 'spotify login',
          timestamp: `<t:${timest.slice(0, -3)}>`,
          error: { code:errorCode, message: err.body.error_description}
        })
        er.save();

        let cmd;
        if(args[1]){
          cmd = `spotify ${args[1]}`
        } else {
          cmd = 'spotify'
        }
        
        const embed = new MessageEmbed()
        .setColor(`#FAA81A`)
        .setDescription(`<:warning:980927735327236146> <@${message.author.id}>: Error occurred while performing command **${cmd}**. Use this error code \`${errorCode}\` to report to the developers in the [support server](${discordServer}).`)
         msg.edit({ embeds: [embed] })
        console.log(e)
      }
    }
}


