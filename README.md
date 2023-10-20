## About
A Discord bot intended to interact with [Spotify](https://spotify.com/) to let users control their player from the Discord Application using commands.     
`Only Spotify premium accounts can interact with the bot`

## 🚀 Getting Started
### Requirements
- [Discord Bot Token](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token)
- [MongoDB Database](mongodb.com)
- [Spotify Client ID & Secret](https://developer.spotify.com)

### Installation
```bash
# Clone the repository
git clone https://github.com/michahl/spotify-bot

# Enter into the directory
cd spotify-bot

# Install dependencies
npm install
```

### Configuration
Enter the correct information for each property in the `config.json` file.

```json
{
 	"bot": {
		"prefix": ",",
		"support": "https://discord.gg/",
		"clientID": "",
		"ownerID": ""

	},
	"mongodb": "mongodb_url",
	"spotify": {
		"redirect_url": "http://localhost:",
		"id": "",
		"secret": ""
  }
}
```
Create a `.env` file and enter your Discord Bot's token
```
TOKEN=
```

### Starting the bot

```bash
node .
```


