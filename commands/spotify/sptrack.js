const { MessageEmbed } = require("discord.js");
var Spotify = require('node-spotify-api');

const { spotify } = require('../../config.json')
var client_id = spotify.id;
var client_secret = spotify.secret;


module.exports = {
    aliases: ['spotifytrack'],
    category: 'Spotify',
    description: `Search Spotify for song results`,
    callback: async ({ message, args, client }) => {

      try {

        const embed = new MessageEmbed()
        .setColor('#747F8D')
        .setAuthor({ name: `${client.user.username} help`, iconURL: `${client.user.displayAvatarURL()}`})
        .setTitle('Command: spotify')
        .setDescription(`Search Spotify for song results\n\`\`\`Syntax: ,spotify <track>\nExample: ,spotify Izaya Tiji Deeply\`\`\``)   

        if(!args.length) return message.channel.send({ embeds: [embed] });

        const query = args.join(' ');
        var spotify = new Spotify({
            id: client_id,
            secret: client_secret
        });
           
        spotify.search({ type: 'track', query: query }, function(err, data) {
            
            if (err) {
                const embed1 = new MessageEmbed()
                .setColor('#7289DA')
                .setDescription(`🔎 <@${message.author.id}>: No results were found for **${args.join(' ')}**`)
          
                return message.channel.send({ embeds: [embed1] });
            }
           
            message.channel.send(data.tracks.items[0].external_urls.spotify); 
        });

      } catch {
        const embed1 = new MessageEmbed()
        .setColor('#7289DA')
        .setDescription(`🔎 <@${message.author.id}>: No results were found for **${args.join(' ')}**`)
  
      return message.channel.send({ embeds: [embed1] });
      }

    }
} 