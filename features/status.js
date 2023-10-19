module.exports = (client, instance) => {
    client.user.setActivity("github.com/michahl", { type: 5});
  }
  module.exports.config = {
    displayName: 'Status',
    dbName: 'STATUS'
  }