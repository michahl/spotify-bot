module.exports = (client, instance) => {
    client.user.setActivity("@michahl", { type: 5});
  }
  module.exports.config = {
    displayName: 'Status',
    dbName: 'STATUS'
  }