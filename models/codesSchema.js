const mongoose = require('mongoose');

const codesSchema = new mongoose.Schema({
    state: { type: String, require: true},
    code: { type: String, require: true},
    access_token: { type: String, require: true},
    refresh_token: { type: String, require: true}
})

const model = mongoose.model('codesModels', codesSchema);

module.exports = model;